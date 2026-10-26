import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
import {openDatabase} from '../database.mjs';

const tables={
 organizations:['id','name','enabled','settings','created'],
 users:['id','name','email','password','role','enabled','created','organization_id','is_super'],
 sessions:['token','user_id','csrf','expires','seen','organization_id'],
 login_limits:['key','count','expires'],
 workspace:['id','data','version']
};
export async function importSqlite(target,path){
 const source=new DatabaseSync(path,{readOnly:true});let snapshot;
 try{
  // A read transaction also includes committed WAL data and gives one snapshot.
  source.exec('BEGIN');
  const existing=new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  if(!existing.has('users')||!existing.has('workspace'))throw Error('Not a Worklio SQLite database.');
  snapshot=Object.fromEntries(Object.keys(tables).map(table=>[table,existing.has(table)?source.prepare(`SELECT * FROM ${table}`).all():[]]));
  const legacy=!source.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='organization_id');
  if(legacy&&snapshot.users.length){
   const settings=snapshot.workspace.find(r=>r.id==='owner')?.data||JSON.stringify({business:'Existing organization',email:'',phone:'',customers:[],quotes:[],jobs:[]});
   const admin=snapshot.users.filter(u=>u.role==='admin'&&u.enabled).sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id))[0];
   if(!admin)throw Error('Legacy database requires an enabled administrator.');
   snapshot.organizations=[{id:'owner',name:JSON.parse(settings).business||'Existing organization',enabled:1,settings,created:Date.now()}];
   snapshot.users=snapshot.users.map(u=>({...u,organization_id:u.id===admin.id?null:'owner',is_super:u.id===admin.id?1:0}));
   snapshot.sessions=snapshot.sessions.map(s=>({...s,organization_id:'owner'}));
  }
  for(const row of snapshot.workspace){JSON.parse(row.data);row.version??=0;}
  for(const row of snapshot.organizations)JSON.parse(row.settings);
  source.exec('COMMIT');
 }finally{source.close();}
 const counts={};
 await target.transaction(async()=>{
  for(const table of Object.keys(tables))if((await target.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).n)throw Error('Target is not empty. Import refused; no records were overwritten.');
  for(const [table,columns] of Object.entries(tables)){
   const statement=target.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
   for(const row of snapshot[table])await statement.run(...columns.map(column=>row[column]??null));
   counts[table]=(await target.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).n;
   if(counts[table]!==snapshot[table].length)throw Error(`Row count mismatch: ${table}`);
  }
 });
 return counts;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.env.DATABASE_URL||!process.argv[2])throw Error('Usage: DATABASE_URL=... npm run db:import:sqlite -- /path/to/obra.sqlite');
 const db=await openDatabase();
 try{console.log('Import complete:',await importSqlite(db,process.argv[2]));}finally{await db.close();}
}
