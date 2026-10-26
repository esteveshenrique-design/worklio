import http from 'node:http';
import {getAppOrigin} from './hosting.mjs';
import {createInvoice,editInvoice,finalizeInvoice,deleteInvoice,protectInvoices,invoiceExportData,invoiceSequence} from './invoices.mjs';
import {openDatabase,bufferedResponse} from './database.mjs';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {exportPdf,exportExcel} from './exports.mjs';
import {importExcel,MAX_IMPORT_BYTES} from './imports.mjs';
import {validTheme,themeKey} from './theme.mjs';
import {validLogo} from './logo.mjs';
import {initAuth} from './auth.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const web=resolve(root,'dist');
const dbPath=resolve(process.env.DATA_DIR||resolve(root,'data'),'obra.sqlite');
const host=process.env.HOST||(process.env.DATABASE_URL||process.env.RAILWAY_ENVIRONMENT_ID?'0.0.0.0':'127.0.0.1');
const port=Number(process.env.PORT||3000);
const appOrigin=getAppOrigin(process.env,host,port);
const secure=new URL(appOrigin).protocol==='https:';
const db=await openDatabase({localPath:dbPath});
const auth=await initAuth(db,{dataDir:dirname(dbPath),origin:appOrigin,secure,setupToken:process.env.SETUP_TOKEN});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function valid(data){return data&&typeof data.business==='string'&&validLogo(data.logo)&&validTheme(data.theme)&&Array.isArray(data.quotes)&&Array.isArray(data.customers)&&Array.isArray(data.jobs)&&new Set(data.quotes.map(q=>q?.id)).size===data.quotes.length&&data.quotes.every(q=>q&&typeof q.id==='string'&&typeof q.title==='string'&&Number.isFinite(q.tax)&&q.tax>=0&&q.tax<=100&&Array.isArray(q.lines)&&q.lines.length>0&&q.lines.every(l=>typeof l.description==='string'&&Number.isFinite(l.qty)&&l.qty>0&&Number.isFinite(l.price)&&l.price>=0&&(l.unit===undefined||(typeof l.unit==='string'&&l.unit.length<=16))&&(l.vat===undefined||(Number.isFinite(l.vat)&&l.vat>=0&&l.vat<=100))&&(l.groupId===undefined||l.groupId===''||(typeof l.groupId==='string'&&q.groups?.some(g=>g.id===l.groupId))))&&(q.groups===undefined||(Array.isArray(q.groups)&&q.groups.every(g=>g&&typeof g.id==='string'&&g.id.length>0&&typeof g.name==='string'&&g.name.trim().length>0)&&new Set(q.groups.map(g=>g.id)).size===q.groups.length)))&&data.customers.every(c=>c&&typeof c.id==='string'&&typeof c.name==='string')&&data.jobs.every(j=>j&&typeof j.id==='string'&&typeof j.quote==='string');}
async function receiveBody(req,limit){const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>limit)throw Object.assign(Error('Workspace too large'),{status:413});chunks.push(chunk);}req.worklioBody=Buffer.concat(chunks);}
async function body(req,limit=20000000){if(req.worklioBody===undefined)await receiveBody(req,limit);if(req.worklioBody.length>limit)throw Object.assign(Error('Workspace too large'),{status:413});return JSON.parse(req.worklioBody.toString('utf8'));}
export const server=http.createServer(async(req,actualResponse)=>{const res=bufferedResponse(actualResponse);try{
// Authenticate a write before consuming its body, but release the connection
// while it uploads. Recheck the captured organization inside the write transaction.
let expectedTenant;
const preflightPath=new URL(req.url,'http://localhost').pathname;
if(!['GET','HEAD'].includes(req.method)&&preflightPath.startsWith('/api/')&&!['/api/auth/','/api/users','/api/organizations'].some(prefix=>preflightPath.startsWith(prefix))){
 await db.transaction(async()=>{const user=await auth.current(req);if(!user)throw Object.assign(Error('Sign in'),{status:401,publicMessage:'Sign in to continue.'});auth.writeGuard(req,user);expectedTenant=(await auth.workspaceUser(req)).active_organization_id;},{write:false});
}
if(!['GET','HEAD'].includes(req.method))await receiveBody(req,20000000);
await db.transaction(async()=>{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
const path=new URL(req.url,'http://localhost').pathname;
if(path==='/health'){await db.exec('SELECT 1');return json(res,200,{ok:true});}
const requestOrigin=new URL(appOrigin);
if(req.headers.host!==requestOrigin.host) return json(res,403,{error:'Request host rejected.'});
if(path.startsWith('/api/auth/')||path.startsWith('/api/users')||path.startsWith('/api/organizations')){try{return await auth.route(req,res,path,body,json);}catch(error){
// Keep failed login/setup rate-limit counters, while rolling back all other failures.
if(['/api/auth/login','/api/auth/setup'].includes(path)&&[400,401,403,429].includes(error.status))return json(res,error.status,{error:error.publicMessage});throw error;}}
if(path.startsWith('/api/')&&!(await auth.current(req)))return json(res,401,{error:'Sign in to continue.'});
const tenantId=path.startsWith('/api/')?(await auth.workspaceUser(req,expectedTenant)).active_organization_id:null;
if(path.startsWith('/api/')&&!['GET','HEAD'].includes(req.method))auth.writeGuard(req,(await auth.current(req)));
const scopeUser=async()=>{const user=(await auth.workspaceUser(req,tenantId));if(!['GET','HEAD'].includes(req.method))auth.writeGuard(req,user);return user;};
if(path==='/api/imports/quote'&&req.method==='POST'){const b=await body(req,Math.ceil(MAX_IMPORT_BYTES/3)*4+1024);(await scopeUser());if(typeof b.file!=='string'||b.file.length>Math.ceil(MAX_IMPORT_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.file))return json(res,400,{error:'Use a Worklio export or a supported DEVIS Excel layout with valid item quantities, prices and VAT.'});return json(res,200,importExcel(Buffer.from(b.file,'base64')));}
if(path==='/api/exports/quote'&&req.method==='POST'){
const b=await body(req);(await scopeUser());
if(!['pdf','xlsx'].includes(b.format)||!['en','pt','fr','es'].includes(b.language))return json(res,400,{error:'Invalid workspace'});
const saved=(await db.prepare('SELECT data FROM workspace WHERE id=?').get(tenantId)),data=saved?JSON.parse(saved.data):null;const q=data?.quotes.find(q=>q.id===b.quoteId);if(!q)return json(res,404,{error:'Not found'});
const buffer=b.format==='pdf'?await exportPdf(data,q,b.language):exportExcel(data,q,b.language);
(await scopeUser());
res.writeHead(200,{'Content-Type':b.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${String(q.number||'quote').replace(/[^a-zA-Z0-9_-]/g,'_')}.${b.format}"`,'Cache-Control':'no-store'});return res.end(buffer);
}
if(path==='/api/invoices'&&req.method==='POST'){
const b=await body(req),row=(await db.prepare('SELECT data,version FROM workspace WHERE id=?').get(tenantId));
if(!row||b.version!==row.version)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});
(await scopeUser());
const data=JSON.parse(row.data),invoice=createInvoice(data,b,(await scopeUser()));data.invoices=[...(data.invoices||[]),invoice];data.invoiceSequence=invoiceSequence(data);
const changed=(await db.prepare('UPDATE workspace SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(data),tenantId,b.version));
if(!changed.changes)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});return json(res,201,{data,version:b.version+1,invoice});
}
if(path.startsWith('/api/invoices/')&&['PUT','PATCH'].includes(req.method)){
const b=await body(req);(await scopeUser());
const row=(await db.prepare('SELECT data,version FROM workspace WHERE id=?').get(tenantId));if(!row||b.version!==row.version)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});
if(req.method==='PATCH'&&b.action!=='finalize')return json(res,400,{error:'Invalid workspace'});
const data=JSON.parse(row.data),id=decodeURIComponent(path.slice('/api/invoices/'.length)),invoice=req.method==='PUT'?editInvoice(data,id,b,(await scopeUser())):finalizeInvoice(data,id,(await scopeUser()));data.invoices=data.invoices.map(i=>i.id===id?invoice:i);
const changed=(await db.prepare('UPDATE workspace SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(data),tenantId,b.version));if(!changed.changes)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});return json(res,200,{data,version:b.version+1,invoice});
}
if(path.startsWith('/api/invoices/')&&req.method==='DELETE'){
const b=await body(req);(await scopeUser());
const row=(await db.prepare('SELECT data,version FROM workspace WHERE id=?').get(tenantId));
if(!row||b.version!==row.version)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});
const data=deleteInvoice(JSON.parse(row.data),decodeURIComponent(path.slice('/api/invoices/'.length)));
const changed=(await db.prepare('UPDATE workspace SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(data),tenantId,b.version));
if(!changed.changes)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});return json(res,200,{data,version:b.version+1});
}
if(path==='/api/exports/invoice'&&req.method==='POST'){
const b=await body(req);(await scopeUser());if(!['pdf','xlsx'].includes(b.format)||!['en','pt','fr','es'].includes(b.language))return json(res,400,{error:'Invalid workspace'});
const row=(await db.prepare('SELECT data FROM workspace WHERE id=?').get(tenantId)),invoice=row&&(JSON.parse(row.data).invoices||[]).find(i=>i.id===b.invoiceId);if(!invoice)return json(res,404,{error:'Not found'});
const data=invoiceExportData(invoice),buffer=b.format==='pdf'?await exportPdf(data,invoice,b.language):exportExcel(data,invoice,b.language);
(await scopeUser());
res.writeHead(200,{'Content-Type':b.format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${invoice.number}.${b.format}"`,'Cache-Control':'no-store'});return res.end(buffer);
}
if(path==='/api/workspace'){
if(req.method==='GET'){const row=(await db.prepare('SELECT data,version FROM workspace WHERE id=?').get(tenantId));return json(res,200,row?{data:JSON.parse(row.data),version:row.version}:{data:JSON.parse((await db.prepare('SELECT settings FROM organizations WHERE id=?').get(tenantId)).settings),version:0});}
if(req.method==='PUT'){if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{return json(res,403,{error:'Invalid origin'});}if(origin.host!==req.headers.host)return json(res,403,{error:'Cross-site write blocked'});}if(!(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'JSON required'});const b=await body(req);(await scopeUser());if(!Number.isInteger(b.version)||b.version<0||!valid(b.data))return json(res,400,{error:'Invalid workspace'});const previous=(await db.prepare('SELECT data FROM workspace WHERE id=?').get(tenantId));protectInvoices(previous?JSON.parse(previous.data):null,b.data);const actor=(await scopeUser()),old=previous?JSON.parse(previous.data):JSON.parse((await db.prepare('SELECT settings FROM organizations WHERE id=?').get(tenantId)).settings);if(actor.role!=='admin'&&!actor.is_super){if(themeKey(b.data.theme)!==themeKey(old.theme))return json(res,403,{error:'Only administrators can change application colors.'});if(['business','email','phone','logo','address','vatId','registration','paymentTerms','bankDetails'].some(k=>JSON.stringify(b.data[k])!==JSON.stringify(old[k])))return json(res,403,{error:'Only administrators can change organization settings.'});}const changes=b.version===0?(await db.prepare('INSERT INTO workspace (id,data,version) VALUES (?,?,1) ON CONFLICT(id) DO NOTHING').run(tenantId,JSON.stringify(b.data))):(await db.prepare('UPDATE workspace SET data=?,version=version+1 WHERE id=? AND version=?').run(JSON.stringify(b.data),tenantId,b.version));if(!changes.changes)return json(res,409,{error:'This workspace changed in another tab. Reload before saving.'});(await db.prepare('UPDATE organizations SET name=? WHERE id=?').run(b.data.business,tenantId));return json(res,200,{version:b.version+1});}
return json(res,405,{error:'Method not allowed'});
}
if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed'});
const file=resolve(web,'.'+decodeURIComponent(path));if(file!==web&&!file.startsWith(web+sep))return json(res,403,{error:'Forbidden'});
const target=existsSync(file)&&statSync(file).isFile()?file:path==='/'?resolve(web,'index.html'):null;
if(!target||!existsSync(target))return json(res,404,{error:'Not found. Run npm run build first.'});
res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(target));
}, {write:!['GET','HEAD'].includes(req.method)});res.flush();}catch(e){res.reset();console.error('Request failed:',e.code||e.name);json(res,e.status||(e instanceof SyntaxError?400:500),{error:e.publicMessage||(e.status===413?'Workspace too large':'Could not complete the request. Please retry.')});res.flush();}});
if(process.env.OBRA_TEST!=='1')server.listen(port,host,()=>console.log(`${!secure&&auth.bootstrapCode?'First administrator setup code: '+auth.bootstrapCode+'\n':''}Worklio is ready: ${appOrigin}\nDatabase: ${db.dialect==='postgres'?'PostgreSQL':dbPath}\nPress Ctrl+C to stop.`));

server.on('close',()=>{void db.close();});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close();});

export {db as database};
