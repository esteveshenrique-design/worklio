import {useEffect,useState} from 'react';
import {defaultTheme,type Theme} from '../../theme.mjs';
import type {Data,Translate} from '../types';
export default function ThemeSettings({data,t,save,busy,ready}:{data:Data;t:Translate;save:(data:Data)=>Promise<boolean>;busy:boolean;ready:boolean}){
 const [theme,setTheme]=useState<Theme>(data.theme||defaultTheme);
 useEffect(()=>setTheme(data.theme||defaultTheme),[data.theme]);
 const labels:{[K in keyof Theme]:string}={accent:'Accent color',secondary:'Secondary color',background:'Background color',surface:'Panel color',text:'Text color',border:'Border color',link:'Link color'};
 return <section className="panel settings theme-settings"><h3>{t('Application colors')}</h3><form onSubmit={async e=>{e.preventDefault();await save({...data,theme});}}><div className="theme-grid">{(Object.keys(defaultTheme) as (keyof Theme)[]).map(key=><label key={key}>{t(labels[key])}<div className="color-field"><input aria-label={t(labels[key])} type="color" value={theme[key]} onChange={e=>setTheme({...theme,[key]:e.target.value})}/><span>{theme[key].toUpperCase()}</span></div></label>)}</div><div className="logo-actions"><button type="button" disabled={busy||!ready} onClick={()=>setTheme({...defaultTheme})}>{t('Reset colors')}</button><button className="primary" disabled={busy||!ready}>{t('Save colors')}</button></div></form></section>;
}
