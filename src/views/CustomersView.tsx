import type {ReactNode} from 'react';
import type {Data,Quote,Customer,Job,Translate} from '../types';
import {Search,Mail,Phone,MapPin,ChevronRight} from 'lucide-react';
type Props={data:Data;t:Translate;query:string;setQuery:(query:string)=>void;newCustomer:(customer?:Customer)=>void;};
export default function CustomersView({data,t,query,setQuery,newCustomer}:Props){
return (
<><label className="search standalone"><Search size={18}/><input placeholder={t("Find a customer…")} value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="customergrid">{data.customers.filter(c=>(c.name+c.email+c.address).toLowerCase().includes(query.toLowerCase())).map(c=><button key={c.id} className="customercard" onClick={()=>newCustomer(c)}><div className="customerinitial">{c.name.split(' ').map(s=>s[0]).slice(0,2).join('')}</div><h3>{c.name}</h3><p><Mail size={15}/>{c.email||t("No email added")}</p><p><Phone size={15}/>{c.phone||t("No phone added")}</p><p><MapPin size={15}/>{c.address||t("No address added")}</p><div>{data.quotes.filter(q=>q.customer===c.id).length} {t("quotes")} <ChevronRight size={15}/></div></button>)}</div>{!data.customers.length&&<div className="empty">{t("Add a customer to start creating quotes.")}</div>}</>
);
}
