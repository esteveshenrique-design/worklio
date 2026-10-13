import type {Quote,Line} from './types';
const cents=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export const lineVat=(line:Line,quote:Quote)=>line.vat??quote.tax;
export const lineNet=(line:Line)=>cents(line.qty*line.price);
export const lineTax=(line:Line,quote:Quote)=>cents(lineNet(line)*lineVat(line,quote)/100);
export function quoteBreakdown(quote:Quote){
 const rates=new Map<number,{rate:number,base:number,tax:number}>();let subtotal=0,tax=0;
 for(const line of quote.lines){const base=lineNet(line),amount=lineTax(line,quote),rate=lineVat(line,quote);subtotal+=base;tax+=amount;const row=rates.get(rate)||{rate,base:0,tax:0};row.base=cents(row.base+base);row.tax=cents(row.tax+amount);rates.set(rate,row);}
 return {subtotal:cents(subtotal),tax:cents(tax),total:cents(subtotal+tax),rates:[...rates.values()].sort((a,b)=>a.rate-b.rate)};
}
export const quoteTotal=(quote:Quote)=>quoteBreakdown(quote).total;
export function quoteSections(quote:Quote){
 const groups=quote.groups||[];
 const sections=groups.map(group=>({...group,lines:quote.lines.filter(line=>line.groupId===group.id)}));
 const ungrouped=quote.lines.filter(line=>!line.groupId||!groups.some(group=>group.id===line.groupId));
 if(ungrouped.length)sections.push({id:'',name:'',lines:ungrouped});
 return sections;
}
