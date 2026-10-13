import type {ReactNode} from 'react';
import type {Data,Quote,Customer,Job,Translate} from '../types';
type Props={data:Data;t:Translate;outstanding:number;paid:number;eur:(value:number)=>string;quoteRows:(quotes:Quote[])=>ReactNode;};
export default function PaymentsView({data,t,outstanding,paid,eur,quoteRows}:Props){
return (
<><div className="stats twostats"><div className="stat"><span>{t("Awaiting payment")}</span><h2>{eur(outstanding)}</h2></div><div className="stat dark"><span>{t("Payments received")}</span><h2>{eur(paid)}</h2></div></div><section className="panel"><div className="panelhead"><div><h3>{t("Payment ledger")}</h3><p>{t("Open a completed job to record its payment.")}</p></div></div>{quoteRows(data.quotes.filter(q=>['Completed','Paid'].includes(q.status)))}</section><p className="footnote">{t("Payment records track collections. Issue official invoices through your certified invoicing provider.")}</p></>
);
}
