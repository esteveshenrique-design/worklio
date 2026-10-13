import {randomBytes} from 'node:crypto';
import {validLogo} from './logo.mjs';
import {validTheme} from './theme.mjs';
export const organizationFailure=(status,message)=>Object.assign(Error(message),{status,publicMessage:message});
export function organizationSettings(input){
 if(!input||typeof input.business!=='string'||!input.business.trim()||input.business.length>200||!validLogo(input.logo)||!validTheme(input.theme))throw organizationFailure(400,'Enter valid organization settings.');
 const data={business:input.business.trim(),email:'',phone:'',customers:[],quotes:[],jobs:[]};
 for(const key of ['email','phone','address','vatId','registration','paymentTerms','bankDetails']){if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>4000))throw organizationFailure(400,'Enter valid organization settings.');if(input[key]!==undefined)data[key]=input[key];}
 if(input.logo!==undefined)data.logo=input.logo;if(input.theme!==undefined)data.theme=input.theme;return data;
}
export function migrateOrganizations(db){
 const columns=table=>db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
 if(columns('users').includes('organization_id'))return;
 db.exec('BEGIN IMMEDIATE');try{
 db.exec(`CREATE TABLE IF NOT EXISTS organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,settings TEXT NOT NULL,created INTEGER NOT NULL);
 ALTER TABLE users ADD COLUMN organization_id TEXT;
 ALTER TABLE users ADD COLUMN is_super INTEGER NOT NULL DEFAULT 0;
 ALTER TABLE sessions ADD COLUMN organization_id TEXT;`);
 const users=db.prepare('SELECT * FROM users').all();
 if(users.length){
 const row=columns('workspace').length?db.prepare('SELECT data FROM workspace WHERE id=?').get('owner'):null;
 const settings=row?JSON.parse(row.data):{business:'Existing organization',email:'',phone:'',customers:[],quotes:[],jobs:[]};
 db.prepare('INSERT INTO organizations VALUES(?,?,1,?,?)').run('owner',settings.business||'Existing organization',JSON.stringify(settings),Date.now());
 db.prepare('UPDATE users SET organization_id=?').run('owner');db.prepare('UPDATE sessions SET organization_id=?').run('owner');
 const admin=db.prepare("SELECT id FROM users WHERE role='admin' AND enabled=1 ORDER BY created,id LIMIT 1").get();if(!admin)throw Error('Migration requires an enabled administrator.');
 db.prepare('UPDATE users SET is_super=1,organization_id=NULL WHERE id=?').run(admin.id);
 }
 db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
export const organizationId=()=>randomBytes(16).toString('hex');
