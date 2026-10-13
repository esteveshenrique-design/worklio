import {useId} from 'react';
import type {Quote,Translate} from '../types';
const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
const key=(value:string)=>clean(value).normalize('NFKC').toLocaleLowerCase();
export function reusableUnits(quotes:Quote[],current:Quote):string[]{
 const units=new Map<string,string>();
 for(const quote of [...quotes,current])for(const line of quote.lines){const unit=clean(line.unit||'');if(unit&&!units.has(key(unit)))units.set(key(unit),unit);}
 return [...units.values()].sort((a,b)=>a.localeCompare(b));
}
type Props={units:string[];value:string;t:Translate;onSelect:(value:string)=>void;};
export default function UnitDropdown({units,value,t,onSelect}:Props){
 const id=useId();
 return <div className="unit-combobox line-unit"><input type="text" list={id} maxLength={16} aria-label={t('Unit of measure')} title={t('Type a unit or select a saved unit.')} value={value} onChange={e=>onSelect(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/><datalist id={id}>{units.map(unit=><option key={unit} value={unit}/>)}</datalist></div>;
}
