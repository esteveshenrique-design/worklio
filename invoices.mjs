import {randomUUID} from 'node:crypto';
import {quoteBreakdown} from './quote-math.mjs';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{publicMessage:message,status});};
export const invoiceSequence=data=>Math.max(Number.isSafeInteger(data?.invoiceSequence)?data.invoiceSequence:0,0,...(data?.invoices||[]).map(i=>Number(i.number.match(/^INV-(\d+)$/)?.[1]||0)));
export function deleteInvoice(data,id){
 if(!(data.invoices||[]).some(i=>i.id===id))fail('Invoice not found.',404);
 return {...data,invoiceSequence:invoiceSequence(data),invoices:data.invoices.filter(i=>i.id!==id)};
}
export const approved=q=>['Accepted','Completed','Paid'].includes(q.status);
export function createInvoice(data,input,user){
 const quote=data.quotes.find(q=>q.id===input.quoteId);if(!quote||!approved(quote))fail('Choose an approved quote.');
 const indexes=input.lineIndexes,extras=input.extraLines||[];
 if(!Array.isArray(indexes)||new Set(indexes).size!==indexes.length||indexes.some(i=>!Number.isInteger(i)||i<0||i>=quote.lines.length)||!Array.isArray(extras)||indexes.length+extras.length===0||extras.length>500)fail('Select items or add extra items.');
 const used=new Set((data.invoices||[]).filter(i=>i.quoteId===quote.id).flatMap(i=>i.sourceLineIndexes));if(indexes.some(i=>used.has(i)))fail('Some selected items have already been invoiced.',409);
 if(extras.some(l=>!l||typeof l.description!=='string'||!l.description.trim()||!Number.isFinite(l.qty)||l.qty<=0||!Number.isFinite(l.price)||l.price<0||!Number.isFinite(l.vat)||l.vat<0||l.vat>100||typeof l.unit!=='string'||l.unit.length>16))fail('Add a description and valid quantity for every item.');
 if(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)fail('Invalid invoice date.');
 const customer=data.customers.find(c=>c.id===quote.customer);if(!customer)fail('Unknown customer');
 const groups=structuredClone(quote.groups||[]),extraGroup=randomUUID();if(extras.length)groups.push({id:extraGroup,name:'Additional work'});
 const lines=[...indexes.sort((a,b)=>a-b).map(i=>({...quote.lines[i],vat:quote.lines[i].vat??quote.tax})),...extras.map(l=>({description:l.description.trim(),unit:l.unit,qty:l.qty,price:l.price,vat:l.vat,groupId:extraGroup}))];
 if(!Number.isFinite(quoteBreakdown({...quote,lines}).total))fail('Add a description and valid quantity for every item.');
 const business={};for(const k of ['business','email','phone','logo','address','vatId','registration','paymentTerms','bankDetails'])if(data[k]!==undefined)business[k]=data[k];
 const number=1+invoiceSequence(data);
 return {id:randomUUID(),documentType:'invoice',number:'INV-'+String(number).padStart(4,'0'),quoteId:quote.id,quoteNumber:quote.number,extraGroupId:extras.length?extraGroup:undefined,sourceLineIndexes:indexes,createdBy:user.id,createdAt:new Date().toISOString(),customer:quote.customer,customerSnapshot:structuredClone(customer),businessSnapshot:business,title:quote.title+' — '+quote.number,status:'Draft',date:input.date,tax:quote.tax,groups:groups.filter(g=>lines.some(l=>l.groupId===g.id)),lines};
}
export function editInvoice(data,id,input,user){
 const current=(data.invoices||[]).find(i=>i.id===id);if(!current)fail('Invoice not found.',404);
 if(current.status!=='Draft')fail('Final invoices cannot be edited.',409);
 if(input.quoteId!==current.quoteId)fail('The invoice quote cannot be changed.',400);
 const rebuilt=createInvoice({...data,invoices:data.invoices.filter(i=>i.id!==id)},input,user);
 return {...rebuilt,id:current.id,number:current.number,createdBy:current.createdBy,createdAt:current.createdAt,businessSnapshot:current.businessSnapshot,customerSnapshot:current.customerSnapshot,title:current.title,updatedBy:user.id,updatedAt:new Date().toISOString()};
}
export function finalizeInvoice(data,id,user){
 const current=(data.invoices||[]).find(i=>i.id===id);if(!current)fail('Invoice not found.',404);
 if(current.status!=='Draft')fail('Final invoices cannot be edited.',409);
 return {...current,status:'Final',finalizedBy:user.id,finalizedAt:new Date().toISOString()};
}
export function protectInvoices(previous,next){
 if(JSON.stringify(previous?.invoices||[])!==JSON.stringify(next.invoices||[])||(previous?.invoiceSequence||0)!==(next.invoiceSequence||0))fail('Use the invoice actions to change invoices.',403);
 for(const invoice of previous?.invoices||[]){const old=previous.quotes.find(q=>q.id===invoice.quoteId),q=next.quotes.find(q=>q.id===invoice.quoteId);if(!q||!approved(q)||['lines','groups','tax','customer'].some(k=>JSON.stringify(old[k])!==JSON.stringify(q[k])))fail('Items in an invoiced quote cannot be changed or deleted.',409);}
}
export function invoiceExportData(invoice){return {...invoice.businessSnapshot,customers:[invoice.customerSnapshot],quotes:[invoice],jobs:[]};}
