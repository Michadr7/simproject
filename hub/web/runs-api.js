// Mikkadr Hub P5, R4: the browser side of the run writes. Gets the per-start token once from GET /api/hub-token, sends it as X-Hub-Token, and asks again if the hub was restarted (403).
// Nothing is sent without a click: the pages call runCall from button handlers only.
import {callFor} from './run-actions.js';

let token=null;
async function hubToken(fresh){
 if(token&&!fresh)return token;
 try{const r=await fetch('/api/hub-token',{cache:'no-store'});const d=await r.json();token=d&&d.runs?d.token:null}catch{token=null}
 return token}
const post=(tk,c)=>fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Token':tk},body:JSON.stringify(c.body),cache:'no-store'});

// Returns {ok, status, data}. data is the server's JSON ({run, needsConfirm} or {error, reasons}).
export async function runCall(op,args){
 const c=callFor(op,args);if(!c)return {ok:false,status:400,data:{error:'That button is not known.'}};
 let tk=await hubToken(false);if(!tk)return {ok:false,status:503,data:{error:'Runs are off. Start the hub with: npm run hub -- --runs'}};
 let r;try{r=await post(tk,c);if(r.status===403){tk=await hubToken(true);if(tk)r=await post(tk,c)}}catch{return {ok:false,status:0,data:{error:'Could not reach the hub.'}}}
 let data=null;try{data=await r.json()}catch{}
 return {ok:r.ok,status:r.status,data}}

// One sentence for a failed call (the hub already joins its gate reasons into `error`).
export const errorText=res=>(res&&res.data&&typeof res.data.error==='string'&&res.data.error)||'That did not work.';
