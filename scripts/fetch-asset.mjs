// Mikkadr Hub 2.8: download one file the owner asked for with "Add from link" on the Assets page. No model is involved.
// The hub writes .hub/fetch-request.json ({url, folder, at}) after the owner's press; this script checks it again, follows at most 5 redirects (each one checked and each address resolved to a public one),
// refuses anything that is not an allowed kind of file or is bigger than 300 MB, and saves it under assets-src/<folder>/ without ever overwriting a file. It sends no cookies and no login.
// Output lines: `REFUSED <why>` (nothing saved) or `FETCHED {json}`. The file then shows up under "New files in assets-src/" on the Assets page.
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {checkFetchUrl,cleanFolder,nameFrom,isPrivateAddress,MAX_BYTES,MAX_REDIRECTS,FETCH_FRESH_MS,sizeText} from '../hub/web/fetch-rules.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),reqFile=path.join(root,'.hub','fetch-request.json'),base=path.join(root,'assets-src');
const refuse=why=>{console.log('REFUSED '+why);process.exit(2)};
let req=null;try{req=JSON.parse(fs.readFileSync(reqFile,'utf8').replace(/^\uFEFF/,''))}catch{}
try{fs.unlinkSync(reqFile)}catch{} // one press, one download
if(!req||typeof req.url!=='string'||!Number.isFinite(req.at))refuse('The hub did not ask for a download.');
if(Date.now()-req.at>FETCH_FRESH_MS)refuse('The request is more than 5 minutes old. Press Download again.');
const folder=cleanFolder(req.folder);if(!folder)refuse('That folder name is not allowed. Use up to 3 plain names, like Characters/man.');
// every address (the first and each redirect): a public https site that resolves only to public addresses
async function vet(raw){
 const c=checkFetchUrl(raw);if(c.error)refuse(c.error);
 let addrs;try{addrs=await dns.lookup(c.host,{all:true})}catch{refuse(`The site ${c.host} could not be found.`)}
 if(!addrs.length||addrs.some(a=>isPrivateAddress(a.address)))refuse(`${c.host} points at an address inside a network, not on the internet.`);
 return c}
let cur=await vet(req.url),res=null;
const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),10*60000);
try{
 for(let hop=0;;hop++){
  res=await fetch(cur.url,{redirect:'manual',signal:ctl.signal,headers:{'User-Agent':'Mikkadr-Hub-asset-download','Accept':'*/*'}});
  if(res.status>=300&&res.status<400&&res.headers.get('location')){
   if(hop>=MAX_REDIRECTS)refuse('Too many redirects.');
   let next;try{next=new URL(res.headers.get('location'),cur.url).toString()}catch{refuse('The site sent a broken redirect.')}
   cur=await vet(next);continue}
  break}
}catch(e){refuse(e&&e.name==='AbortError'?'The download took more than 10 minutes.':'The download could not be started: '+String(e&&e.message||'unknown').slice(0,120))}
if(!res.ok)refuse(`The site answered ${res.status}. A page that needs a login or a click-through cannot be downloaded this way: download it in your browser and put it in assets-src/.`);
const type=String(res.headers.get('content-type')||'').toLowerCase();
if(type.startsWith('text/html'))refuse('That link is a web page, not a file. It may need a login or a click on a download button: do that in your browser, then put the file in assets-src/.');
const name=nameFrom(res.headers.get('content-disposition'),new URL(cur.url).pathname);
if(!name)refuse('The file name or its kind is not allowed. Allowed: glb, gltf, bin, fbx, obj, mtl, zip, png, jpg, webp, wav, ogg, mp3, txt, md, pdf.');
const len=Number(res.headers.get('content-length'));if(Number.isFinite(len)&&len>MAX_BYTES)refuse(`The file is ${sizeText(len)}; the limit is ${sizeText(MAX_BYTES)}.`);
const dir=path.resolve(base,folder);if(path.relative(base,dir).startsWith('..')||path.isAbsolute(path.relative(base,dir)))refuse('That folder is outside assets-src.');
fs.mkdirSync(dir,{recursive:true});
let final=name,k=1;while(fs.existsSync(path.join(dir,final))){k++;final=name.replace(/(\.[^.]+)$/,`-${k}$1`)}
const tmp=path.join(dir,`.download-${process.pid}.tmp`),out=fs.createWriteStream(tmp),hash=crypto.createHash('sha256');let bytes=0,tooBig=false;
try{
 for await(const chunk of Readable.fromWeb(res.body)){bytes+=chunk.length;if(bytes>MAX_BYTES){tooBig=true;break}hash.update(chunk);if(!out.write(chunk))await new Promise(r=>out.once('drain',r))}
 await new Promise(r=>out.end(r));
}catch(e){out.destroy();try{fs.unlinkSync(tmp)}catch{}refuse('The download broke off: '+String(e&&e.message||'unknown').slice(0,120))}
clearTimeout(timer);
if(tooBig){try{fs.unlinkSync(tmp)}catch{}refuse(`The file is bigger than the limit of ${sizeText(MAX_BYTES)}.`)}
if(bytes===0){try{fs.unlinkSync(tmp)}catch{}refuse('The site sent an empty file.')}
fs.renameSync(tmp,path.join(dir,final));
console.log('FETCHED '+JSON.stringify({path:`${folder}/${final}`,bytes,sha256:hash.digest('hex'),host:cur.host}));