// Cloud saves for a signed-in player (the Worker side is worker/accounts.js). One save per account, with revisions.
// This browser remembers which cloud revision its save is based on and a fingerprint of the save as last synced (citylife.cloud.v1),
// so it can tell who changed what: only this browser -> upload; only the cloud (another browser) -> download; both -> ask the player.
// A download replaces the save through save-file.js, so the save it replaces is backed up first.
import {readStoredSave,makeSaveFile,readSaveFile,replaceSave,summarize} from './save-file.js';

export const CLOUD_KEY='citylife.cloud.v1',PUSH_EVERY_MS=120000;
// FNV-1a over the normalised save, plus its length: equal saves always match, and a change is all but certain to show.
export function fingerprint(save){const s=JSON.stringify(save);let h=0x811c9dc5;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16)+':'+s.length}
export function loadCloudState(storage){try{const v=JSON.parse(storage.getItem(CLOUD_KEY));return v&&typeof v.userId==='string'&&Number.isInteger(v.revision)&&typeof v.fingerprint==='string'?v:null}catch{return null}}
const saveCloudState=(storage,v)=>{try{storage.setItem(CLOUD_KEY,JSON.stringify(v))}catch{}};

// What to do, from: the save here (or null), the cloud's {save file or null, revision}, what this browser last synced, and who is signed in.
export function planSync({local,cloud,state,userId}){
 const synced=state?.userId===userId?state:null; // another account's sync record says nothing about this one
 const read=cloud.save?readSaveFile(JSON.stringify(cloud.save)):null;
 if(!read?.ok)return local?{action:'upload',base:cloud.revision}:{action:'none'}; // no cloud save yet (or a damaged one): this browser's becomes it
 if(!local)return {action:'download',cloud:read};
 const here=fingerprint(local);
 if(fingerprint(read.save)===here)return {action:'mark',revision:cloud.revision,fingerprint:here};
 const localChanged=!synced||synced.fingerprint!==here,cloudChanged=!synced||synced.revision!==cloud.revision;
 if(!cloudChanged)return {action:'upload',base:cloud.revision};
 if(!localChanged)return {action:'download',cloud:read};
 return {action:'ask',cloud:read,base:cloud.revision};
}

export function createCloud({fetchFn,storage,version,now=()=>Date.now()}){
 let user=null,methods=[]; // methods: the sign-in buttons the server offers ('google', 'dev')
 const api=async(path,{method='GET',body}={})=>{
  const res=await fetchFn(path,{method,credentials:'same-origin',headers:{'x-city-life':'1',...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  let data=null;try{data=await res.json()}catch{}
  return {status:res.status,data};
 };
 const remember=(revision,save)=>saveCloudState(storage,{userId:user.id,revision,fingerprint:fingerprint(save)});

 async function me(){
  try{const r=await api('/api/me');if(r.status!==200)return {available:false,user:null};user=r.data?.user??null;methods=Array.isArray(r.data?.methods)?r.data.methods:[];return {available:true,user}}
  catch{return {available:false,user:null,offline:true}}
 }
 async function upload(local,base){
  let r;try{r=await api('/api/save',{method:'PUT',body:{file:makeSaveFile(local,{version,now:now()}),baseRevision:base}})}catch{return {status:'offline'}}
  if(r.status===200){remember(r.data.revision,local);return {status:'uploaded',revision:r.data.revision}}
  if(r.status===409)return {status:'conflict'};
  if(r.status===429)return {status:'later'};
  if(r.status===401){user=null;return {status:'signed-out'}}
  return {status:'error',error:r.data?.error||'HTTP '+r.status};
 }
 function download(read,revision){
  if(!replaceSave(storage,read.save,{reason:'before cloud download',version,now:now()}))return {status:'error',error:'the browser would not store the save'};
  remember(revision,readStoredSave(storage));
  return {status:'downloaded'};
 }
 // The whole check, done when the page loads and on "Sync now". 'downloaded' means the caller must reload; 'conflict' carries both sides and a resolve().
 async function sync(){
  const who=await me();if(!who.user)return {status:who.available?'signed-out':'unavailable'};
  let cloud;try{cloud=await api('/api/save')}catch{return {status:'offline'}}
  if(cloud.status!==200)return {status:'error',error:cloud.data?.error||'HTTP '+cloud.status};
  const local=readStoredSave(storage),plan=planSync({local,cloud:cloud.data,state:loadCloudState(storage),userId:user.id});
  if(plan.action==='none')return {status:'synced'};
  if(plan.action==='mark'){saveCloudState(storage,{userId:user.id,revision:plan.revision,fingerprint:plan.fingerprint});return {status:'synced'}}
  if(plan.action==='upload')return upload(local,plan.base);
  if(plan.action==='download')return download(plan.cloud,cloud.data.revision);
  return {status:'conflict',
   here:summarize(local,{savedAt:null}),
   cloud:{...plan.cloud.summary,savedAt:cloud.data.savedAt?new Date(cloud.data.savedAt).toISOString():plan.cloud.summary.savedAt},
   resolve:choice=>choice==='cloud'?download(plan.cloud,cloud.data.revision):upload(local,plan.base)};
 }
 // While playing: upload only when the save changed since the last sync, and only for the account it was synced with.
 async function pushIfChanged(){
  const state=loadCloudState(storage),local=readStoredSave(storage);
  if(!user||!state||state.userId!==user.id||!local)return {status:'skipped'};
  if(fingerprint(local)===state.fingerprint)return {status:'unchanged'};
  return upload(local,state.revision);
 }
 async function devLogin(name){try{const r=await api('/api/dev-login',{method:'POST',body:{name}});return r.status===200}catch{return false}}
 async function logout(){try{await api('/api/logout',{method:'POST'})}catch{}user=null}
 return {me,sync,pushIfChanged,devLogin,logout,get user(){return user},get methods(){return methods}};
}
