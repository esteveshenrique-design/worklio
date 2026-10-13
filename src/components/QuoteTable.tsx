import {ChevronRight} from 'lucide-react';
import type {Quote,Translate} from '../types';
type Props={quotes:Quote[];t:Translate;name:(id:string)=>string;locale:string;eur:(value:number)=>string;onSelect:(quote:Quote)=>void;};
import {quoteTotal,quoteBreakdown} from '../quoteTotal';
export default function QuoteTable({quotes:qs,t,name,locale,eur,onSelect}:Props){return (
<div className="tablewrap"><table><thead><tr><th>{t("Quote / customer")}</th><th>{t("Created")}</th><th>{t("Amount")}</th><th>{t("VAT %")}</th><th>{t("Status")}</th><th></th></tr></thead><tbody>{qs.length?qs.map(q=><tr key={q.id} onClick={()=>onSelect(q)} tabIndex={0} onKeyDown={e=>e.key==='Enter'&&onSelect(q)}><td><strong>{q.title}</strong><span>{q.number} · {name(q.customer)}</span></td><td>{new Date(q.date+'T12:00').toLocaleDateString(locale,{day:'numeric',month:'short'})}</td><td className="amount">{eur(quoteTotal(q))}</td><td>{quoteBreakdown(q).rates.map(row=>row.rate+'%').join(' / ')}</td><td><span className={'badge '+q.status.toLowerCase()}>{t(q.status)}</span></td><td><ChevronRight size={17}/></td></tr>):<tr><td colSpan={6} className="empty">{t("No quotes here yet. Create your first quote to get started.")}</td></tr>}</tbody></table></div>
);}
