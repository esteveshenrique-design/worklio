import type {Quote} from './types';
export function nextQuoteNumber(quotes:Quote[]):string {
 const highest=quotes.reduce((max,q)=>{const match=/^QT-(\d+)$/.exec(q.number);return match?Math.max(max,Number(match[1])):max;},0);
 return `QT-${String(highest+1).padStart(3,'0')}`;
}
export function cloneQuote(source:Quote,quotes:Quote[],id:string,date:string):Quote {
 return {...source,id,number:nextQuoteNumber(quotes),date,status:'Draft',lines:source.lines.map(line=>({...line})),...(source.groups?{groups:source.groups.map(group=>({...group}))}:{})};
}
