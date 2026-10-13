import type {Quote} from './types';
const groupKey=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
export function reusableGroups(quotes:Quote[],current:Quote){
 const used=new Set((current.groups||[]).map(g=>groupKey(g.name)));
 const names:string[]=[];
 for(const quote of quotes){if(quote.id===current.id)continue;for(const group of quote.groups||[]){const name=group.name.trim(),key=groupKey(name);if(name&&!used.has(key)){used.add(key);names.push(name);}}}
 return names.sort((a,b)=>a.localeCompare(b));
}
export function addQuoteGroup(quote:Quote,name:string,lineIndex:number|null,id:string):Quote{
 const trimmed=name.trim().replace(/\s+/g,' ');if(!trimmed)return quote;
 const existing=(quote.groups||[]).find(g=>groupKey(g.name)===groupKey(trimmed));
 const group=existing||{id,name:trimmed};
 return {...quote,groups:existing?quote.groups:[...(quote.groups||[]),group],lines:lineIndex===null?quote.lines:quote.lines.map((line,i)=>i===lineIndex?{...line,groupId:group.id}:line)};
}
