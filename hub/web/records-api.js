// Hub v2 V4: the page's record writes

// Gets the records token once from GET /api/hub-token (recordsToken), sends it as X-Hub-Token, and asks again if the hub was restarted (403). Works with or without --runs.
// Nothing is sent without a click: the pages call recordsCall from button handlers only. Returns {ok, status, data}.
let token=null;
async function recordsToken(fresh){
 if(token&&!fresh)return token;
 try{const r=await fetch('/api/hub-token',{cache:'no-store'});const d=await r.json();token=d&&d.records?d.recordsToken:null}catch{token=null}
 return token}
const post=(tk,url,body)=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Token':tk},body:JSON.stringify(body),cache:'no-store'});
export const RECORD_URLS=Object.freeze({add:'/api/assets/add',stage:'/api/assets/stage',file:'/api/assets/file',undo:'/api/records/undo'});
export async function recordsCall(op,body){
 const url=RECORD_URLS[op];if(!url)return {ok:false,status:400,data:{error:'That button is not known.'}};
 let tk=await recordsToken(false);if(!tk)return {ok:false,status:503,data:{error:'Asset records are off.'}};
 let r;try{r=await post(tk,url,body);if(r.status===403){tk=await recordsToken(true);if(tk)r=await post(tk,url,body)}}catch{return {ok:false,status:0,data:{error:'Could not reach the hub.'}}}
 let data=null;try{data=await r.json()}catch{}
 return {ok:r.ok,status:r.status,data}}
