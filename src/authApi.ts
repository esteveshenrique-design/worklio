let csrf='';
export const setCsrf=(value:string)=>{csrf=value;};
export async function authFetch(path:string,options:RequestInit={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{}),...(csrf?{'X-CSRF-Token':csrf}:{})}});if(response.status===401&&!path.includes('/auth/login'))window.dispatchEvent(new Event('obra-signout'));return response;}
export async function authRequest(path:string,method='GET',body?:unknown){const r=await authFetch(path,{method,...(body!==undefined?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
export type User={id:string;name:string;email:string;role:'admin'|'user';enabled:boolean};
