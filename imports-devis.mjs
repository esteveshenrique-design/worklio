import {randomUUID} from 'node:crypto';
import {quoteBreakdown} from './quote-math.mjs';
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const blank=v=>v===undefined||v===null||typeof v==='string'&&!v.trim();
const numeric=v=>{if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v!=='string'||!v.trim())return null;let s=v.trim().replace(/(?:€|EUR)/gi,'').replace(/[\s\u00a0\u202f]/g,'');if(!/^[+-]?\d+(?:[.,]\d+)*$/.test(s))return null;if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:null;};
const cents=v=>Math.round((v+Number.EPSILON)*100)/100;
export function devisHeader(rows){
 for(let index=0;index<rows.length;index++){const row=rows[index],columns={};for(const [col,v] of Object.entries(row)){if(!/^[A-Z]+$/.test(col))continue;const n=normalize(v);if(['designation','description'].includes(n))columns.description=col;else if(['u','unite','unit'].includes(n))columns.unit=col;else if(['qte','quantite','quantity','qty'].includes(n))columns.quantity=col;else if(['pu','prixunitaire','unitprice'].includes(n))columns.price=col;else if(['montantht','amountexclvat'].includes(n))columns.amount=col;else if(['n','no','numero'].includes(n))columns.code=col;else if(['totauxht','grouptotal'].includes(n))columns.groupTotal=col;else if(['tva','tvap','vat','vatp'].includes(n))columns.vat=col;}
 if(['description','unit','quantity','price','amount'].every(k=>columns[k]))return {index,columns};
 }return null;
}
export function importDevis(rows,header,fail){
 const {index,columns:c}=header,groups=[],lines=[];let groupId='',last=null;const review={skippedNoAmount:0,skippedUnpriced:0,skippedZeroQuantity:0,derivedPrices:0,mismatchedAmounts:0,vatMissing:false,amountDifferences:[],derivedPriceItems:[],sourceSubtotal:null,importedSubtotal:0};
 let rate=null;
 for(const row of rows.slice(index+1)){for(const [col,value] of Object.entries(row)){const label=normalize(value);if(col===c.price&&['tva','vat'].includes(label)){const adjacent=row[String.fromCharCode(col.charCodeAt(0)+1)],n=numeric(typeof adjacent==='string'?adjacent.replace('%',''):adjacent);if(n!==null&&n>=0&&n<=100)rate=typeof adjacent==='string'&&adjacent.includes('%')?n:n<=1?n*100:n;}
 if(['totalht','totalhorstaxes','subtotal'].includes(label)){const v=numeric(row[c.groupTotal]??row[c.amount]);if(v!==null)review.sourceSubtotal=v;}}
 }
 if(rate===null){rate=0;review.vatMissing=true;}
 for(const row of rows.slice(index+1)){
 if(Object.values(row).some(v=>['totalht','totaltva','totalttc','totalhorstaxes'].includes(normalize(v))))break;
 const description=typeof row[c.description]==='string'?row[c.description].trim():'',code=String(row[c.code]??'').trim();
 if(/sous.?total|sub.?total/i.test(code)||/^soustotal/.test(normalize(description))){last=null;continue;}
 if(description&&blank(row[c.price])&&(/^\d+$/.test(code)||/^lot\b/i.test(description))){groupId=randomUUID();groups.push({id:groupId,name:description});last=null;continue;}
 let qty=numeric(row[c.quantity]),unit=row[c.unit];if(qty===null&&numeric(row[c.unit])!==null&&typeof row[c.quantity]==='string'&&numeric(row[c.quantity])===null){qty=numeric(row[c.unit]);unit=row[c.quantity];}
 const amount=numeric(row[c.amount]),price=numeric(row[c.price]),hasNumbers=!blank(row[c.quantity])||!blank(row[c.price])||!blank(row[c.amount]);
 if(!description){if(amount!==null&&amount>0)fail();if(code)last=null;continue;}
 if(!hasNumbers){if(!code&&last){last.description+='\n'+description;}else last=null;continue;}
 if(qty!==null&&qty<0||price!==null&&price<0||amount!==null&&amount<0)fail();
 if(qty===0){review.skippedZeroQuantity++;last=null;continue;}
 if(amount===null){review.skippedNoAmount++;last=null;continue;}
 if(qty===null||qty<=0){if(amount>0)fail();review.skippedUnpriced++;last=null;continue;}
 let unitPrice=price;if(unitPrice===null){if(!blank(row[c.price]))fail();if(amount<=0){review.skippedUnpriced++;last=null;continue;}unitPrice=amount/qty;review.derivedPrices++;review.derivedPriceItems.push({row:row.__row,description,price:unitPrice});}
 if(!Number.isFinite(qty*unitPrice)||(!blank(unit)&&typeof unit!=='string')||String(unit??'').trim().length>16)fail();
 if(price!==null&&Math.abs(cents(qty*price)-cents(amount))>.001){review.mismatchedAmounts++;review.amountDifferences.push({row:row.__row,description,source:cents(amount),calculated:cents(qty*price)});}
 const rawVat=c.vat?row[c.vat]:null;let vat=c.vat?numeric(typeof rawVat==='string'?rawVat.replace('%',''):rawVat):rate;if(c.vat){if(vat===null||vat<0||vat>100)fail();if(vat<=1&&!(typeof rawVat==='string'&&rawVat.includes('%')))vat*=100;}
 last={description,unit:typeof unit==='string'?unit.trim():'',qty,price:unitPrice,vat:Number(vat.toFixed(8)),groupId};lines.push(last);
 }
 if(!lines.length||lines.length>1000)fail();if(c.vat&&review.vatMissing){rate=lines[0].vat;review.vatMissing=false;}const totals=quoteBreakdown({lines,tax:rate});if(!Number.isFinite(totals.total))fail();review.importedSubtotal=totals.subtotal;
 const before=rows.slice(0,index),title=before.flatMap(Object.values).find(v=>typeof v==='string'&&/^\s*(affaire|projet|job title)\s*:/i.test(v))||'';
 const client=before.map(r=>r[c.price]).filter(v=>typeof v==='string'&&v.trim()&&!/\b(?:le\s+\d+|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.test(v)).map(v=>v.trim()).join('\n');
 return {title:title.replace(/^\s*(affaire|projet|job title)\s*:\s*/i,'').trim(),tax:rate,groups:groups.filter(g=>lines.some(l=>l.groupId===g.id)),lines,client,review};
}
