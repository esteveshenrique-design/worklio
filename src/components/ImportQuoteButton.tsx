import {useRef,useState} from 'react';
import {authFetch} from '../authApi';
import type {Quote,Translate} from '../types';
type Imported=Pick<Quote,'title'|'tax'|'lines'|'groups'>&{client:string};
export default function ImportQuoteButton({t,disabled,onImport,onError}:{t:Translate;disabled:boolean;onImport:(value:Imported)=>void;onError:(message:string)=>void}){
 const input=useRef<HTMLInputElement>(null),[loading,setLoading]=useState(false);
 async function upload(file?:File){if(!file)return;setLoading(true);try{if(!/\.xlsx?$/i.test(file.name)||file.size>10*1024*1024)throw Error('Choose an Excel (.xls or .xlsx) file up to 10 MB.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const response=await authFetch('/api/imports/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file:btoa(binary)})});const result=await response.json();if(!response.ok)throw Error(result.error);onImport(result);}catch(e:any){onError(e.message||'Could not complete the request. Please retry.');}finally{setLoading(false);}}
 return <><input ref={input} type="file" hidden accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label={t('Import Excel')} onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/><button type="button" disabled={disabled||loading} onClick={()=>input.current?.click()}>{loading?t('Loading…'):t('Import Excel')}</button></>;
}
