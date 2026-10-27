import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
import {migrateDatabase,createSqliteDatabase,openDatabase,bufferedResponse} from '../database.mjs';
import {initAuth} from '../auth.mjs';
import {importSqlite} from '../scripts/import-sqlite.mjs';

// Run the real PostgreSQL SQL path against an embedded PostgreSQL engine by
// default. TEST_DATABASE_URL switches this test to a disposable network server.
// WARNING: the configured database must be empty and dedicated to this test.
mkdirSync('.test-temp',{recursive:true});
const directory=mkdtempSync(join(process.cwd(),'.test-temp','postgres-'));
const NativePool=pg.Pool;
class EmbeddedPool {
 constructor(){this.engine=new PGlite(join(directory,'postgres'));this.tail=Promise.resolve();}
 on(){}
 async connect(){const previous=this.tail;let release;this.tail=new Promise(r=>{release=r;});await previous;return {query:(sql,args)=>this.execute(sql,args),release};}
 async execute(sql,args=[]){const result=!args.length&&sql.includes(';')?(await this.engine.exec(sql)).at(-1):await this.engine.query(sql,args);return {...result,rowCount:result.affectedRows??result.rows?.length??0};}
 async query(sql,args){const c=await this.connect();try{return await c.query(sql,args);}finally{c.release();}}
 async end(){await this.tail;await this.engine.close();}
}
if(!process.env.TEST_DATABASE_URL)pg.Pool=EmbeddedPool;
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'postgresql://embedded/worklio';
process.env.NODE_ENV='production';process.env.OBRA_TEST='1';process.env.HOST='127.0.0.1';process.env.APP_ORIGIN='http://localhost:4339';process.env.SETUP_TOKEN='postgres-integration-setup-secret-at-least-32';
let server,database,cookie='',csrf='',organization='';
const headers=()=>({'Content-Type':'application/json',Origin:'http://localhost:4339',Host:'localhost:4339',Cookie:cookie,'X-CSRF-Token':csrf,...(organization?{'X-Organization-ID':organization}:{})});
const request=(path,method='GET',data)=>fetch('http://localhost:4339'+path,{method,headers:headers(),...(data===undefined?{}:{body:JSON.stringify(data)})});
async function boot(suffix){({server,database}=await import(`../server.mjs?${suffix}`));await new Promise(r=>server.listen(4339,'127.0.0.1',r));}
async function stop(){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await database.close();}

test('PostgreSQL workflow, atomic writes, import and persistence across app restart',async t=>{
 try{
  await boot('first');
  for(const table of ['users','organizations','workspace','sessions','login_limits'])assert.equal((await database.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).n,0,'Use a dedicated empty test database.');
  await t.test('production refuses missing or non-PostgreSQL configuration',async()=>{
   await assert.rejects(openDatabase({env:{NODE_ENV:'production'}}),/DATABASE_URL/);
   await assert.rejects(openDatabase({env:{DATABASE_URL:'file:temporary.sqlite'}}),/PostgreSQL/);
  });
  await t.test('schema migration is repeatable',async()=>{await migrateDatabase(database);await migrateDatabase(database);assert.equal((await database.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()).n,1);});
  await t.test('legacy SQLite import preserves records and password hashes without changing source',async()=>{
   const path=join(directory,'legacy.sqlite'),source=await createSqliteDatabase(path);
   source.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,email TEXT,password TEXT,role TEXT,enabled INTEGER,created INTEGER);CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT,csrf TEXT,expires INTEGER,seen INTEGER);CREATE TABLE workspace(id TEXT PRIMARY KEY,data TEXT,version INTEGER);`);
   source.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run('legacy','Legacy admin','legacy@example.com','salt:hash','admin',1,1);
   source.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run('hashed-token','legacy','csrf-token',Date.now()+60000,Date.now());
   source.prepare('INSERT INTO workspace VALUES(?,?,?)').run('owner',JSON.stringify({business:'Legacy',customers:[],quotes:[],jobs:[],payments:[{id:'p1',amount:25}]}),7);
   await source.close();const counts=await importSqlite(database,path);assert.equal(counts.users,1);assert.equal(counts.workspace,1);assert.equal(counts.sessions,1);assert.equal((await database.prepare('SELECT token FROM sessions').get()).token,'hashed-token');
   assert.equal((await database.prepare('SELECT password FROM users WHERE id=?').get('legacy')).password,'salt:hash');
   assert.equal((await database.prepare('SELECT version FROM workspace WHERE id=?').get('owner')).version,7);
   await assert.rejects(importSqlite(database,path),/not empty/);
   const original=await createSqliteDatabase(path);assert.ok(!original.columns('users').includes('is_super'));await original.close();
   // Clear only this disposable test's fixtures before the live HTTP workflow.
   await database.transaction(async()=>{for(const table of ['sessions','users','workspace','organizations','login_limits'])await database.exec(`DELETE FROM ${table}`);});
  });
  await t.test('setup, organization and login use PostgreSQL',async()=>{
   let r=await request('/api/auth/setup','POST',{name:'Platform',email:'platform@example.com',password:'Strong-postgres-password-123',token:process.env.SETUP_TOKEN});assert.equal(r.status,201,await r.clone().text());cookie=r.headers.get('set-cookie').split(';')[0];csrf=(await r.json()).csrf;
   r=await request('/api/organizations','POST',{settings:{business:'Postgres company'},admin:{name:'Admin',email:'admin@example.com',password:'Strong-organization-password-123'}});assert.equal(r.status,201,await r.clone().text());const result=await r.json();csrf=result.csrf;organization=result.organization.id;
  });
  let current;
  await t.test('financial records survive saves and stale simultaneous writes cannot overwrite them',async()=>{
   const data={business:'Postgres company',customers:[{id:'c',name:'Customer'}],jobs:[],payments:[{id:'payment-1',amount:60}],quotes:[{id:'q',number:'QT-1',title:'Work',customer:'c',status:'Accepted',date:'2026-10-26',tax:20,lines:[{description:'Labour',qty:1,price:100}]}]};
   const results=await Promise.all([request('/api/workspace','PUT',{version:0,data}),request('/api/workspace','PUT',{version:0,data:{...data,business:'Other'}})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
   current=await(await request('/api/workspace')).json();assert.equal(current.version,1);assert.equal(current.data.payments[0].amount,60);
   const invoice=await request('/api/invoices','POST',{version:1,quoteId:'q',date:'2026-10-26',lineIndexes:[0],extraLines:[]});assert.equal(invoice.status,201,await invoice.clone().text());current=await(await request('/api/workspace')).json();assert.equal(current.data.invoices[0].number,'INV-0001');
   const paid={...current.data,quotes:current.data.quotes.map(q=>({...q,status:'Paid'}))};assert.equal((await request('/api/workspace','PUT',{version:current.version,data:paid})).status,200);current=await(await request('/api/workspace')).json();assert.equal(current.data.quotes[0].status,'Paid');
  });
  await t.test('a late SQL error rolls back both workspace and organization updates',async()=>{
   await assert.rejects(database.transaction(async()=>{await database.prepare('UPDATE workspace SET data=?,version=version+1 WHERE id=?').run('{}',organization);await database.prepare('UPDATE organizations SET name=? WHERE id=?').run('Should roll back',organization);await database.exec('SELECT * FROM deliberately_missing_table');}));
   assert.deepEqual(await(await request('/api/workspace')).json(),current);
   assert.notEqual((await database.prepare('SELECT name FROM organizations WHERE id=?').get(organization)).name,'Should roll back');
  });
  await t.test('HTTP failure after saving workspace rolls back the complete request',async()=>{
   await database.exec(`CREATE FUNCTION worklio_test_reject_name() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='Reject this update' THEN RAISE EXCEPTION 'injected failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER worklio_test_failure BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION worklio_test_reject_name();`);
   try{const response=await request('/api/workspace','PUT',{version:current.version,data:{...current.data,business:'Reject this update'}});assert.equal(response.status,500);assert.deepEqual(await(await request('/api/workspace')).json(),current);}
   finally{await database.exec('DROP TRIGGER worklio_test_failure ON organizations;DROP FUNCTION worklio_test_reject_name();');}
  });
  await t.test('application restart preserves records, invoices, payments, organization and session',async()=>{
   await stop();await boot('restart');assert.deepEqual(await(await request('/api/workspace')).json(),current);const auth=await(await request('/api/auth/status')).json();assert.equal(auth.user.email,'platform@example.com');assert.equal(auth.csrf,csrf);assert.equal((await request('/health')).status,200);
  });
  await t.test('organization creation can defer activation until the form is closed',async()=>{
   const before=await(await request('/api/auth/status')).json();
   const response=await request('/api/organizations','POST',{activate:false,settings:{business:'Deferred organization'},admin:{name:'Deferred admin',email:'deferred@example.com',password:'Deferred-organization-password-123'}});
   assert.equal(response.status,201,await response.clone().text());const result=await response.json();assert.notEqual(result.organization.id,organization);assert.equal(result.user.organizationId,organization);assert.equal(result.csrf,csrf);
   const after=await(await request('/api/auth/status')).json();assert.equal(after.user.organizationId,before.user.organizationId);assert.equal(after.csrf,before.csrf);
   assert.deepEqual(await(await request('/api/workspace')).json(),current);
  });
  await t.test('failed login counters remain committed',async()=>{
   for(let i=0;i<2;i++)assert.equal((await request('/api/auth/login','POST',{email:'missing@example.com',password:'Incorrect-password-123'})).status,401);
   assert.ok((await database.prepare("SELECT count FROM login_limits WHERE key LIKE 'email:%'").get()).count>=2);
  });
  await t.test('a failed commit cannot leak a buffered success or session cookie',()=>{
   const output=[];const response=bufferedResponse({writeHead:(...v)=>output.push(v),end:v=>output.push(v)});response.setHeader('Set-Cookie','secret');response.writeHead(201);response.end('success');assert.equal(output.length,0);response.reset();response.writeHead(500);response.end('failed');response.flush();assert.deepEqual(output,[[500,{}],'failed']);
  });
 }finally{if(server?.listening)await stop();pg.Pool=NativePool;rmSync(directory,{recursive:true,force:true});}
});
