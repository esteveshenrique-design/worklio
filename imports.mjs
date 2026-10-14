import {devisHeader,importDevis} from './imports-devis.mjs';
import {read,set_cptable} from './vendor/xlsx.mjs';
import * as codepages from './vendor/cpexcel.full.mjs';
set_cptable(codepages);
export const MAX_IMPORT_BYTES=10*1024*1024;
import {randomUUID} from 'node:crypto';
import {unzip} from './zip.mjs';
import {translate} from './src/translations.mjs';
const fail=()=>{throw Object.assign(Error('Invalid Excel budget.'),{publicMessage:'Use a Worklio export or a supported DEVIS Excel layout with valid item quantities, prices and VAT.'});};
const decode=s=>s.replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,num,n)=>hex||num?String.fromCodePoint(Number.parseInt(hex||num,hex?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[n.toLowerCase()]));
const text=s=>[...s.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
const number=v=>typeof v==='number'&&Number.isFinite(v);
export function importExcel(buffer){
 try{
 if(buffer.length>MAX_IMPORT_BYTES)throw Object.assign(Error('Import too large'),{publicMessage:'Choose an Excel (.xls or .xlsx) file up to 10 MB.'});
 let rows;
 if(buffer.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'))){
 const workbook=read(buffer,{type:'buffer',cellHTML:false,cellStyles:false,cellNF:false,bookVBA:true,sheetRows:20000});
 if(workbook.vbaraw||!workbook.SheetNames.length)fail();
 const sheet=workbook.Sheets[workbook.SheetNames[0]],cells=new Map();
 for(const [address,cell] of Object.entries(sheet)){const match=address.match(/^([A-I])(\d+)$/);if(!match||+match[2]>20000)continue;const row=cells.get(+match[2])||{};if(cell.t==='n'||cell.t==='s'||cell.t==='str')row[match[1]]=cell.v;else if(cell.t==='e')row[match[1]]=NaN;cells.set(+match[2],row);}
 rows=[...cells.entries()].sort((a,b)=>a[0]-b[0]).map(([rowNumber,row])=>({...row,__row:rowNumber}));
 }else{
 const files=unzip(buffer,{maxBytes:96000000,maxEntries:300});
 // External workbook links are never resolved: only cached worksheet values
 // in the uploaded archive are read. Legacy estimates often contain these.
 if([...files.keys()].some(p=>/vbaProject/i.test(p)))fail();
 const source=files.get('xl/worksheets/sheet1.xml')?.toString().replace(/<(\/?)[\w]+:/g,'<$1');if(!source||/<!DOCTYPE|<!ENTITY/i.test(source))fail();
 const sharedXml=files.get('xl/sharedStrings.xml')?.toString().replace(/<(\/?)[\w]+:/g,'<$1')||'';if(/<!DOCTYPE|<!ENTITY/i.test(sharedXml))fail();
 const shared=[...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>text(m[1]));
 rows=[...source.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((row,index)=>{const cells={__row:Number(row[1].match(/\br="(\d+)"/)?.[1]||index+1)};for(const c of row[2].matchAll(/<c\b([^>]*)(?<!\/)>([\s\S]*?)<\/c>/g)){const col=c[1].match(/\br="([A-Z]+)\d+"/)?.[1],type=c[1].match(/\bt="([^"]+)"/)?.[1],v=c[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];if(col)cells[col]=type==='inlineStr'?text(c[2]):type==='s'?shared[Number(v)]:type==='str'?decode(v||''):v!==undefined?Number(v):'';}return cells;});
 }
 const langs=['en','pt','fr','es'],header=rows.findIndex(row=>langs.some(l=>row.B===translate(l,'Description')&&row.C===translate(l,'Unit')&&row.F===translate(l,'VAT %')));if(header<0){const alternate=devisHeader(rows);if(alternate)return importDevis(rows,alternate,fail);fail();}
 const language=langs.find(l=>rows[header].B===translate(l,'Description'))||'en';
 const groups=[],lines=[];let groupId='';
 for(const row of rows.slice(header+1)){
 if(langs.some(l=>row.A===translate(l,'VAT %')))break;
 if(number(row.A)&&typeof row.B==='string'&&row.B.trim()&&!number(row.D)&&!number(row.E)){if(langs.some(l=>row.B.trim()===translate(l,'Ungrouped'))){groupId='';continue;}groupId=randomUUID();groups.push({id:groupId,name:row.B.trim()});continue;}
 if(typeof row.B==='string'&&row.B.trim()&&(number(row.D)||number(row.E)||typeof row.A==='string'&&/^\d+-\d+$/.test(row.A))){
 if(typeof row.C==='number'&&!number(row.C))fail();
 if(!number(row.D)||row.D<=0||!number(row.E)||row.E<0||!number(row.F)||row.F<0||row.F>1||String(row.C||'').length>16)fail();
 lines.push({description:row.B.trim(),unit:String(row.C||''),qty:row.D,price:row.E,vat:Number((row.F*100).toFixed(8)),groupId});
 }
 }
 if(!lines.length||lines.length>1000)fail();
 const project=rows.slice(0,header).find(row=>typeof row.A==='string'&&langs.some(l=>row.A.startsWith(translate(l,'Job title')+':')))?.A||'';
 const client=rows.slice(0,header).map(r=>r.F).find(v=>typeof v==='string'&&v.trim())||'';
 return {title:project.slice(project.indexOf(':')+1).trim(),tax:lines[0].vat,groups,lines,client};
 }catch(e){if(e.publicMessage)throw e;fail();}
}
