export function logoBytes(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||value.length>275000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Invalid company logo.');
 const bytes=Buffer.from(value.slice(value.indexOf(',')+1),'base64');
 if(bytes.length>200000||bytes.length<45||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR'||bytes.toString('ascii',bytes.length-8,bytes.length-4)!=='IEND')throw Error('Invalid company logo.');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width>512||height>256)throw Error('Invalid company logo.');return {bytes,width,height};
}
export function validLogo(value){try{logoBytes(value);return true;}catch{return false;}}
