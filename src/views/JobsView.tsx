import type {ReactNode} from 'react';
import type {Data,Quote,Customer,Job,Translate} from '../types';
import {Clock,ChevronRight} from 'lucide-react';
type Props={data:Data;t:Translate;filter:string;setFilter:(filter:string)=>void;locale:string;name:(id:string)=>string;onEditJob:(job:Job)=>void;};
export default function JobsView({data,t,filter,setFilter,locale,name,onEditJob}:Props){
return (
<section className="panel"><div className="toolbar"><div className="tabs">{['All','Unscheduled','Scheduled','Completed'].map(s=><button className={filter===s?'selected':''} onClick={()=>setFilter(s)} key={s}>{t(s)}</button>)}</div></div>{[...data.jobs].sort((a,b)=>a.date.localeCompare(b.date)).filter(j=>filter==='All'||j.status===filter).map(j=><button key={j.id} className="jobrow" onClick={()=>onEditJob(j)}><div className="datebox"><small>{new Date(j.date+'T12:00').toLocaleDateString(locale,{month:'short'})}</small><b>{j.date.slice(8)}</b></div><div className="jobinfo"><b>{j.title}</b><span>{name(j.customer)} · {data.customers.find(c=>c.id===j.customer)?.address}</span><small><Clock size={14}/>{j.time}</small></div><span className={'badge '+j.status.toLowerCase()}>{t(j.status)}</span><ChevronRight size={18}/></button>)}{!data.jobs.length&&<div className="empty">{t("Accept a quote to create a job, then set its date and time.")}</div>}</section>
);
}
