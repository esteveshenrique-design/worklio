import {useRef,useState} from 'react';
import type {Translate} from '../types';
type Props={groups:{id:string,name:string}[];saved:string[];value:string;t:Translate;onSelect:(value:string)=>void;onCreate:(name:string)=>void;};
export default function GroupDropdown({groups,saved,value,t,onSelect,onCreate}:Props){
 const ref=useRef<HTMLDetailsElement>(null),[name,setName]=useState(''),[invalid,setInvalid]=useState(false);
 const close=()=>{if(ref.current)ref.current.open=false;};
 function create(){if(!name.trim()){setInvalid(true);return;}onCreate(name);setName('');setInvalid(false);close();}
 function choose(id:string){onSelect(id);close();}
 return <details ref={ref} className="group-dropdown"><summary aria-label={t('Group')}>{groups.find(g=>g.id===value)?.name||t('Ungrouped')}</summary><div className="group-dropdown-menu"><button type="button" onClick={()=>choose('')}>{t('Ungrouped')}</button>{groups.map(g=><button type="button" key={g.id} onClick={()=>choose(g.id)}>{g.name}</button>)}{saved.length>0&&<><small>{t('Groups from other quotes')}</small>{saved.map(n=><button key={n} type="button" onClick={()=>choose('__saved__'+n)}>{n}</button>)}</>}<div className="group-dropdown-create"><label>{t('New group…')}<input aria-label={t('Group name')} value={name} onChange={e=>{setName(e.target.value);setInvalid(false);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();create();}if(e.key==='Escape'){e.preventDefault();close();}}}/></label><button type="button" onClick={create}>{t('Add group')}</button>{invalid&&<p role="alert">{t('Enter a group name.')}</p>}</div></div></details>;
}
