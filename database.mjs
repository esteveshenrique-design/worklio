import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import pg from 'pg';

// Keep every transaction on its checked-out connection, including auth helpers.
const context=new AsyncLocalStorage();
const WRITE_LOCK=186628381; // Shared by all Worklio instances using this database.
function parameters(sql){let i=0;return sql.replace(/\?/g,()=>`$${++i}`);}
function rows(result){return result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,['created','expires','seen','n'].includes(key)&&typeof value==='string'?Number(value):value])));}
export function createPostgresDatabase(pool){
 let closing;
 const db={dialect:'postgres',
  async query(sql,args=[]){const state=context.getStore();return (state?.db===db?state.client:pool).query(parameters(sql),args);},
  async exec(sql){await db.query(sql);},
  prepare(sql){return {
   async get(...args){return rows(await db.query(sql,args))[0];},
   async all(...args){return rows(await db.query(sql,args));},
   async run(...args){const result=await db.query(sql,args);return {changes:result.rowCount};}
  };},
  async columns(table){const result=await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?',[table]);return result.rows.map(r=>r.column_name);},
  async transaction(fn,{write=true}={}){
   if(context.getStore()?.db===db)return fn();
   const client=await pool.connect();
   try{await client.query('BEGIN');if(write)await client.query('SELECT pg_advisory_xact_lock($1)',[WRITE_LOCK]);
    const result=await context.run({db,client},fn);await client.query('COMMIT');return result;
   }catch(error){try{await client.query('ROLLBACK');}catch{}throw error;}finally{client.release();}
  },
  close(){return closing??=pool.end();}
 };return db;
}
export async function createSqliteDatabase(path){
 const {DatabaseSync}=await import('node:sqlite');
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const native=new DatabaseSync(path);native.exec('PRAGMA journal_mode=WAL');
 let tail=Promise.resolve();
 const db={dialect:'sqlite',
  exec(sql){native.exec(sql);},
  prepare(sql){return native.prepare(sql.replaceAll('GREATEST(', 'MAX('));},
  columns(table){if(!['users','sessions','workspace','organizations'].includes(table))throw Error('Invalid table');return native.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);},
  async transaction(fn){
   if(context.getStore()?.db===db)return fn();
   const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
   try{native.exec('BEGIN IMMEDIATE');const result=await context.run({db},fn);native.exec('COMMIT');return result;}
   catch(error){try{native.exec('ROLLBACK');}catch{}throw error;}finally{release();}
  },
  async close(){native.close();}
 };return db;
}
export async function migrateDatabase(db){
 await db.transaction(async()=>{
  await db.exec(`CREATE TABLE IF NOT EXISTS workspace(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 0)`);
  if(db.dialect==='postgres')await db.exec(`
   CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
   CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,settings TEXT NOT NULL,created BIGINT NOT NULL);
   CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','user')),enabled INTEGER NOT NULL DEFAULT 1,created BIGINT NOT NULL,organization_id TEXT,is_super INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,csrf TEXT NOT NULL,expires BIGINT NOT NULL,seen BIGINT NOT NULL,organization_id TEXT);
   CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires BIGINT NOT NULL);
   CREATE INDEX IF NOT EXISTS users_organization_idx ON users(organization_id);
   CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
   CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires);
   INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT(version) DO NOTHING;
  `);
 });
}
export async function openDatabase({localPath,env=process.env}={}){
 const url=env.DATABASE_URL?.trim();
 if(!url&&(env.RAILWAY_ENVIRONMENT_ID||env.NODE_ENV==='production'))throw Error('DATABASE_URL is required in production. Refusing to use temporary SQLite storage.');
 if(url&&!/^postgres(?:ql)?:\/\//.test(url))throw Error('DATABASE_URL must be a PostgreSQL connection URL.');
 const max=Number(env.PG_POOL_MAX||10);if(!Number.isInteger(max)||max<1||max>100)throw Error('PG_POOL_MAX must be an integer between 1 and 100.');
 let db;
 if(url){const pool=new pg.Pool({connectionString:url,max,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});pool.on('error',error=>console.error('Idle PostgreSQL connection failed:',error.code||error.name));db=createPostgresDatabase(pool);}
 else db=await createSqliteDatabase(localPath);
 try{await migrateDatabase(db);return db;}catch(error){await db.close();throw error;}
}
// Send responses only after COMMIT succeeds. A failed transaction must never
// return a success body or authentication cookie to the browser.
export function bufferedResponse(target){
 let headers={},status=200,body;
 return {
  setHeader(name,value){headers[name]=value;},
  writeHead(code,values={}){status=code;Object.assign(headers,values);},
  end(value){body=value;},
  reset(){headers={};status=200;body=undefined;},
  flush(){target.writeHead(status,headers);target.end(body);}
 };
}
