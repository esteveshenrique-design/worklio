export function getAppOrigin(env,host,port){
 const configured=env.APP_ORIGIN?.trim(),domain=env.RAILWAY_PUBLIC_DOMAIN?.trim();
 const local=['127.0.0.1','localhost','::1'].includes(host);
 if(!configured&&!domain&&!local)throw Error('Hosted access requires APP_ORIGIN set to your HTTPS site URL, or a generated Railway public domain.');
 const value=configured||(domain?`https://${domain}`:`http://localhost:${port}`);
 let url;try{url=new URL(value);}catch{throw Error('APP_ORIGIN must be a valid site URL, such as https://your-domain.up.railway.app.');}
 if(!['http:','https:'].includes(url.protocol)||(!local&&url.protocol!=='https:'))throw Error('Hosted access requires an HTTPS site URL. Set APP_ORIGIN to https://your-domain, or remove it to use the generated Railway public domain.');
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('APP_ORIGIN must contain only the site origin, without a path, credentials, query or fragment.');
 return url.origin;
}
