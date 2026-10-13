import type {ReactNode} from 'react';
import type {Data,Quote,Customer,Job,Translate} from '../types';
import {Search} from 'lucide-react';
type Props={data:Data;t:Translate;filter:string;setFilter:(filter:string)=>void;query:string;setQuery:(query:string)=>void;name:(id:string)=>string;quoteRows:(quotes:Quote[])=>ReactNode;};
export default function QuotesView({data,t,filter,setFilter,query,setQuery,name,quoteRows}:Props){
return (
<section className="panel"><div className="toolbar"><div className="tabs">{['All','Draft','Sent','Accepted','Completed','Paid'].map(s=><button className={filter===s?'selected':''} key={s} onClick={()=>setFilter(s)}>{t(s)}</button>)}</div><label className="search"><Search size={17}/><input placeholder={t("Search quotes…")} value={query} onChange={e=>setQuery(e.target.value)}/></label></div>{quoteRows([...data.quotes].reverse().filter(q=>(filter==='All'||q.status===filter)&&(q.title+' '+name(q.customer)+' '+q.number).toLowerCase().includes(query.toLowerCase())))}</section>
);
}
