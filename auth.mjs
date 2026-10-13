import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
const derive=promisify(scrypt),digest=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const failure=(status,message)=>Object.assign(Error(message),{status,publicMessage:message});
export function initAuth(db,{dataDir,origin,secure,setupToken}){
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','user')),enabled INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL,seen INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
 const count=()=>db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
 const tokenFile=join(dataDir,'setup-token.txt');
 let bootstrap=setupToken||'';
 if(!count()&&!bootstrap){if(secure)throw Error('Set SETUP_TOKEN to a random secret of at least 32 characters before the first hosted launch.');bootstrap=existsSync(tokenFile)?readFileSync(tokenFile,'utf8').trim():randomBytes(32).toString('hex');writeFileSync(tokenFile,bootstrap,{mode:0o600});}
 if(!count()&&bootstrap.length<32)throw Error('SETUP_TOKEN must contain at least 32 characters.');
 let hashing=0;
 async function hash(password,salt=randomBytes(16).toString('hex')){if(hashing>=2)throw failure(503,'Please retry in a moment.');hashing++;try{const key=await derive(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});return salt+':'+key.toString('hex');}finally{hashing--;}}
 async function verify(password,stored){const [salt,key]=(stored||('00000000000000000000000000000000:'+ '00'.repeat(64))).split(':');return same(await hash(password,salt),salt+':'+key);}
 function validatePassword(password){if(typeof password!=='string'||password.length<15||password.length>128)throw failure(400,'Use a password between 15 and 128 characters.');}
 function identity(b){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>120||typeof b.email!=='string'||b.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))throw failure(400,'Enter a name and valid email address.');validatePassword(b.password);return {name:b.name.trim(),email:b.email.trim().toLowerCase()};}
 function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,enabled:!!u.enabled};}
 function cookie(token,maxAge=28800){return `${secure?'__Host-obra':'obra-session'}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`;}
 function current(req,touch=true){const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith((secure?'__Host-obra':'obra-session')+'='))?.split('=')[1];if(!token)return null;const row=db.prepare('SELECT s.token,s.csrf,s.expires,s.seen,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?').get(digest(token));if(!row||!row.enabled||row.expires<Date.now()||row.seen<Date.now()-1800000){if(row)db.prepare('DELETE FROM sessions WHERE token=?').run(row.token);return null;}if(touch)db.prepare('UPDATE sessions SET seen=? WHERE token=?').run(Date.now(),row.token);return row;}
 function writeGuard(req,user){if(req.headers.origin!==origin)throw failure(403,'Request origin rejected.');if(!(req.headers['content-type']||'').startsWith('application/json'))throw failure(415,'JSON required');if(user&&!same(req.headers['x-csrf-token'],user.csrf))throw failure(403,'Session verification failed. Reload and retry.');}
 function limit(key){db.prepare('DELETE FROM login_limits WHERE expires<?').run(Date.now());const row=db.prepare('SELECT count FROM login_limits WHERE key=?').get(key);if(row?.count>=10)throw failure(429,'Too many attempts. Try again in 15 minutes.');db.prepare('INSERT INTO login_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,Date.now()+900000);}
 function issue(res,user){const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<? OR seen<?').run(Date.now(),Date.now()-1800000);db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(digest(token),user.id,csrf,Date.now()+28800000,Date.now());res.setHeader('Set-Cookie',cookie(token));return {user:publicUser(user),csrf};}
 async function route(req,res,path,read,json){const user=current(req,path!=='/api/auth/status');
 if(path==='/api/auth/status'&&req.method==='GET')return json(res,200,{user:user?publicUser(user):null,csrf:user?.csrf||null,setupRequired:count()===0});
 if(path==='/api/auth/login'&&req.method==='POST'){writeGuard(req);const b=await read(req);if(typeof b.email!=='string'||b.email.length>254||typeof b.password!=='string'||b.password.length>128)throw failure(401,'Invalid email or password.');const email=b.email.trim().toLowerCase();limit('ip:'+req.socket.remoteAddress);limit('email:'+digest(email));let u=db.prepare('SELECT * FROM users WHERE email=?').get(email);const correct=await verify(b.password,u?.password);u=u?db.prepare('SELECT * FROM users WHERE id=?').get(u.id):null;if(!correct||!u?.enabled)throw failure(401,'Invalid email or password.');db.prepare('DELETE FROM login_limits WHERE key=?').run('email:'+digest(email));db.prepare('UPDATE login_limits SET count=MAX(0,count-1) WHERE key=?').run('ip:'+req.socket.remoteAddress);return json(res,200,issue(res,u));}
 if(path==='/api/auth/setup'&&req.method==='POST'){writeGuard(req);limit('setup:'+req.socket.remoteAddress);if(count())throw failure(403,'Administrator setup is already complete.');const b=await read(req);if(!same(b.token,bootstrap))throw failure(403,'Invalid setup code.');const fields=identity(b),password=await hash(b.password);if(count())throw failure(403,'Administrator setup is already complete.');const id=randomBytes(16).toString('hex');db.prepare('INSERT INTO users VALUES(?,?,?,?,?,1,?)').run(id,fields.name,fields.email,password,'admin',Date.now());bootstrap='';if(existsSync(tokenFile))unlinkSync(tokenFile);return json(res,201,issue(res,db.prepare('SELECT * FROM users WHERE id=?').get(id)));}
 if(!user)throw failure(401,'Sign in to continue.');
 if(!['GET','HEAD'].includes(req.method))writeGuard(req,user);
 if(path==='/api/auth/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(user.token);res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true});}
 if(path==='/api/auth/password'&&req.method==='POST'){const b=await read(req);validatePassword(b.password);if(typeof b.currentPassword!=='string'||b.currentPassword.length>128||!await verify(b.currentPassword,user.password))throw failure(400,'Current password is incorrect.');const password=await hash(b.password);if(!current(req))throw failure(401,'Sign in to continue.');db.prepare('UPDATE users SET password=? WHERE id=?').run(password,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true});}
 if(path.startsWith('/api/users')){if(user.role!=='admin')throw failure(403,'Administrator access required.');
 if(path==='/api/users'&&req.method==='GET')return json(res,200,{users:db.prepare('SELECT * FROM users ORDER BY created').all().map(publicUser)});
 if(path==='/api/users'&&req.method==='POST'){const b=await read(req),fields=identity(b);if(!['admin','user'].includes(b.role))throw failure(400,'Invalid role.');const password=await hash(b.password);const fresh=current(req);if(!fresh||fresh.role!=='admin')throw failure(403,'Administrator access required.');if(db.prepare('SELECT id FROM users WHERE email=?').get(fields.email))throw failure(409,'An account with this email already exists.');const id=randomBytes(16).toString('hex');db.prepare('INSERT INTO users VALUES(?,?,?,?,?,1,?)').run(id,fields.name,fields.email,password,b.role,Date.now());return json(res,201,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id))});}
 if(/^\/api\/users\/[a-f0-9]{32}$/.test(path)&&req.method==='PATCH'){
 const id=path.split('/').pop(),b=await read(req);
 if(!Object.keys(b).length||Object.keys(b).some(k=>!['name','email','role','password','enabled'].includes(k)))throw failure(400,'Invalid account details.');
 if(b.name!==undefined&&(typeof b.name!=='string'||!b.name.trim()||b.name.length>120))throw failure(400,'Enter a name and valid email address.');
 if(b.email!==undefined&&(typeof b.email!=='string'||b.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())))throw failure(400,'Enter a name and valid email address.');
 if(b.role!==undefined&&!['admin','user'].includes(b.role))throw failure(400,'Invalid role.');
 if(b.enabled!==undefined&&typeof b.enabled!=='boolean')throw failure(400,'Invalid account status.');
 let password;if(b.password!==undefined){validatePassword(b.password);password=await hash(b.password);}
 const fresh=current(req);if(!fresh||fresh.role!=='admin')throw failure(403,'Administrator access required.');
 const target=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!target)throw failure(404,'User not found.');
 const name=b.name===undefined?target.name:b.name.trim(),email=b.email===undefined?target.email:b.email.trim().toLowerCase(),role=b.role??target.role,enabled=b.enabled===undefined?!!target.enabled:b.enabled;
 if((!enabled||role!=='admin')&&target.role==='admin'&&(id===fresh.id||(target.enabled&&db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND enabled=1").get().n<=1)))throw failure(400,'You cannot disable yourself or the last active administrator.');
 if(!enabled&&id===fresh.id)throw failure(400,'You cannot disable yourself or the last active administrator.');
 if(db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email,id))throw failure(409,'An account with this email already exists.');
 db.prepare('UPDATE users SET name=?,email=?,role=?,enabled=?,password=? WHERE id=?').run(name,email,role,enabled?1:0,password??target.password,id);
 const sessionsRevoked=password!==undefined||email!==target.email||role!==target.role||b.enabled!==undefined;
 if(sessionsRevoked)db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
 return json(res,200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)),sessionsRevoked});
 }
 }
 throw failure(404,'Not found');
 }
 return {current,writeGuard,route,bootstrapCode:count()?null:bootstrap};
}
