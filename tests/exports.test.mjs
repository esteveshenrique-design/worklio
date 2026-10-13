import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportModel,exportPdf,exportExcel} from '../exports.mjs';
import {unzip} from '../zip.mjs';
import {PDFDocument} from '../vendor/pdf-lib.mjs';
const quote={id:'q',number:'QT-003',customer:'c',title:'Rénovation électrique',date:'2026-10-03',tax:23,status:'Draft',groups:[{id:'g',name:'Peinture'}],lines:[{description:'Murs & préparation <chantier>',unit:'m²',qty:2,price:50,vat:6,groupId:'g'},{description:'Labour',qty:1,price:20,vat:23}]};
const data={business:'Test',address:'Street',vatId:'PT123',paymentTerms:'After acceptance',bankDetails:'Own bank',customers:[{id:'c',name:'Ana'}],quotes:[quote],jobs:[]};
test('localized PDF and XLSX exports preserve totals, groups and safe typed workbook values',async()=>{for(const language of ['en','pt','fr','es']){const model=exportModel(data,quote,language);assert.equal(model.totals.total,130.6);const bytes=await exportPdf(data,quote,language),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);const files=unzip(exportExcel(data,quote,language)),sheet=files.get('xl/worksheets/sheet1.xml').toString();assert.match(sheet,/Peinture/);assert.match(sheet,/<c r="C\d+"[^>]*>.*?<t xml:space="preserve">m²<\/t>/);assert.match(sheet,/Murs &amp; préparation &lt;chantier&gt;/);assert.match(sheet,/<f>ROUND\(D\d+\*E\d+,2\)<\/f>/);assert.match(sheet,/<f>SUMIF\(/);assert.match(sheet,/<v>130.6<\/v>/);assert.match(sheet,/t="inlineStr"/);assert.match(sheet,/fitToWidth="1"/);assert.match(files.get('xl/styles.xml').toString(),/dd\/mm\/yyyy/);}});
test('long descriptions and many lines produce multipage PDFs',async()=>{const long={...quote,lines:Array.from({length:90},(_,i)=>({...quote.lines[0],description:`Line ${i+1}: ${'Long description with accents é ç ã '.repeat(i===0?80:3)}`}))};assert.ok((await PDFDocument.load(await exportPdf(data,long,'fr'))).getPageCount()>3);});
test('text that resembles an Excel formula is exported as literal text',()=>{const q={...quote,title:'=HYPERLINK("https://example.com")',lines:[{...quote.lines[0],description:'=1+1'}]};const xml=unzip(exportExcel(data,q,'en')).get('xl/worksheets/sheet1.xml').toString();assert.match(xml,/<t xml:space="preserve">=1\+1<\/t>/);assert.ok(!xml.includes('<f>=1+1'))});
test('saved logo is embedded in both quote exports and invalid image sources are rejected',async()=>{
 const {logoBytes,validLogo}=await import('../logo.mjs');
 const logo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=';
 assert.equal(validLogo(logo),true);assert.equal(logoBytes(logo).width,1);for(const bad of ['https://example.com/logo.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,AAA=',false])assert.equal(validLogo(bad),false);
 const files=unzip(exportExcel({...data,logo},quote,'en'));assert.deepEqual(files.get('xl/media/company-logo.png'),logoBytes(logo).bytes);assert.match(files.get('xl/worksheets/sheet1.xml').toString(),/rIdLogo/);assert.match(files.get('xl/drawings/drawing1.xml').toString(),/Company logo/);assert.match(files.get('[Content_Types].xml').toString(),/image\/png/);const pdf=await exportPdf({...data,logo},quote,'en');assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);
});
test('Excel prices, VAT and amounts use numeric cells with right alignment and two-decimal formats',()=>{
 const sheetFiles=unzip(exportExcel(data,quote,'en'));
 const sheet=sheetFiles.get('xl/worksheets/sheet1.xml').toString(),styles=sheetFiles.get('xl/styles.xml').toString().replace(/<(\/?)(?:x:)/g,'<$1');
 const xfs=[...styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].matchAll(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)].map(m=>m[0]);
 const formats=new Map([...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]+)"/g)].map(m=>[m[1],m[2]]));
 let checked=0;
 for(const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)" s="(\d+)"[^>]*(?<!\/)>([\s\S]*?)<\/c>/g)){
  if(!m[4].includes('<v>')||m[2]==='1'||m[1]==='D'||(m[1]==='A'&&!xfs[+m[3]].includes('numFmtId="202"')))continue;
  const style=xfs[+m[3]],fmt=formats.get(style.match(/numFmtId="(\d+)"/)[1]);
  assert.match(style,/horizontal="right"/,m[0]);assert.ok(!style.includes('wrapText="1"'),m[0]);assert.ok(fmt?.includes('.00'),`${m[1]}${m[2]} ${fmt}`);checked++;
 }
 assert.ok(checked>=10);
});
