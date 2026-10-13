import {useState} from 'react';
import type {Translate} from '../types';
export default function InvoiceDeleteButton({t,disabled,onDelete}:{t:Translate,disabled:boolean,onDelete:()=>Promise<void>}){
 const [confirm,setConfirm]=useState(false);
 return confirm?<div className="invoice-delete-confirm" role="group" aria-label={t('Delete invoice')}><p>{t('Delete this invoice? Its quote items will become available again. Invoice-only extra items will be removed.')}</p><button type="button" disabled={disabled} onClick={()=>setConfirm(false)}>{t('Cancel')}</button><button type="button" disabled={disabled} onClick={onDelete}>{t('Confirm deletion')}</button></div>:<button type="button" disabled={disabled} onClick={()=>setConfirm(true)}>{t('Delete invoice')}</button>;
}
