import {useState} from 'react';
import type {Translate} from '../types';
export default function InvoiceFinalizeButton({t,disabled,onFinalize}:{t:Translate,disabled:boolean,onFinalize:()=>Promise<void>}){
 const [confirm,setConfirm]=useState(false);
 return confirm?<div className="invoice-delete-confirm" role="group" aria-label={t('Mark final')}><p>{t('Make this invoice final? You will no longer be able to edit its items.')}</p><button type="button" disabled={disabled} onClick={()=>setConfirm(false)}>{t('Cancel')}</button><button type="button" disabled={disabled} onClick={onFinalize}>{t('Confirm final invoice')}</button></div>:<button type="button" disabled={disabled} onClick={()=>setConfirm(true)}>{t('Mark final')}</button>;
}
