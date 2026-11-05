// The hosted multiplayer relay: the `simproject` Worker's script (wrangler.jsonc "main"). The game's files are still served as static assets;
// this script only runs for paths no file matches, and answers only /relay/...
//   wss://<site>/relay/new        create a lobby with a fresh code and join it
//   wss://<site>/relay/<CODE>     join that lobby (refused 'no-lobby' if it does not exist)
// Each lobby is one Durable Object (class Lobby, named by its code), running the shared rules in dist/relay-protocol.js.
// It uses the WebSocket Hibernation API: an idle lobby is evicted from memory (not billed for time) and rebuilt from its sockets' attachments.
// No login yet: anyone with the code can join. Accounts come later (DESIGN.md).
import {createLobby,makeLobbyCode,normalizeLobbyCode,HELLO_TIMEOUT_MS,CLOSE_REFUSED,REFUSED,PROTOCOL} from '../dist/relay-protocol.js';

export const EMPTY_LOBBY_MS=10*60*1000; // a lobby with nobody in it is forgotten after this
const CODE_HEADER='x-lobby-code',CREATE_HEADER='x-lobby-create';

// Browsers send Origin; only this site and local development pages may open a socket. (Non-browser clients can lie about Origin; this only stops other websites using the relay.)
export function originAllowed(request){
 const origin=request.headers.get('origin');
 if(!origin)return true;
 let o;try{o=new URL(origin)}catch{return false}
 if(o.origin===new URL(request.url).origin)return true;
 return ['localhost','127.0.0.1','[::1]'].includes(o.hostname)&&(o.protocol==='http:'||o.protocol==='https:');
}

export async function handleRequest(request,env){
  const url=new URL(request.url);
  const m=/^\/relay\/([^/]+)\/?$/.exec(url.pathname);
  if(!m)return new Response('Not found',{status:404});
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('This is the City Life relay: connect with a WebSocket.',{status:426,headers:{upgrade:'websocket'}});
  if(!originAllowed(request))return new Response('Forbidden',{status:403});
  const forward=(code,create)=>{
   const headers=new Headers(request.headers);headers.set(CODE_HEADER,code);headers.set(CREATE_HEADER,create?'1':'0');
   return env.LOBBY.get(env.LOBBY.idFromName(code)).fetch(new Request(request.url,{headers}));
  };
  if(m[1]==='new'){
   // 729 million codes: a clash is very unlikely, but a taken code answers 409 and we draw again.
   for(let i=0;i<5;i++){const res=await forward(makeLobbyCode(()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32),true);if(res.status!==409)return res}
   return new Response('Could not find a free lobby code',{status:503});
  }
  const code=normalizeLobbyCode(decodeURIComponent(m[1]));
  // A malformed code still gets a socket, so the game hears 'no-lobby' instead of a bare failure.
  return forward(code??'------',false);
}

// One lobby. A plain class (not extending DurableObject) so tests can run it in Node with a fake ctx.
export class Lobby{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.lobby=null;this.code=null}
 // The rules object, rebuilt from the sockets' attachments after hibernation.
 rules(){
  if(this.lobby)return this.lobby;
  const restore=[];
  for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.id)restore.push({peer:ws,id:a.id,position:a.position,room:a.room});if(a?.code)this.code=a.code}
  this.lobby=createLobby({
   code:this.code,restore,newId:()=>crypto.randomUUID(),
   send:(ws,message)=>{try{ws.send(JSON.stringify(message))}catch{}},
   close:(ws,code,reason)=>{try{ws.close(code,reason)}catch{}}
  });
  return this.lobby;
 }
 async fetch(request){
  const code=request.headers.get(CODE_HEADER),create=request.headers.get(CREATE_HEADER)==='1';
  const known=await this.ctx.storage.get('created');
  if(create&&known)return new Response('Code taken',{status:409});
  if(create){await this.ctx.storage.put('created',Date.now())}
  if(code&&code!=='------'&&code!==this.code){this.code=code;this.lobby=null} // rebuilt from the sockets, so nobody is lost
  const pair=new WebSocketPair(),[client,server]=Object.values(pair);
  this.ctx.acceptWebSocket(server);
  if(!known&&!create){
   // Unknown code: say why, then close. The empty object is wiped by the alarm below (nothing was stored, so nothing to wipe).
   server.send(JSON.stringify({type:'refused',reason:REFUSED.noLobby,protocol:PROTOCOL}));server.close(CLOSE_REFUSED,REFUSED.noLobby);
   return new Response(null,{status:101,webSocket:client});
  }
  server.serializeAttachment({code:this.code,waitingSince:Date.now()});
  this.rules();
  await this.ctx.storage.delete('emptySince');
  await this.schedule(Date.now()+HELLO_TIMEOUT_MS);
  return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(ws,data){
  if(typeof data!=='string')return;
  const lobby=this.rules();
  const view=lobby.receive(ws,data);
  // Keep each player's latest state on its socket, so a wake-up from hibernation restores it.
  if(view)try{ws.serializeAttachment({code:this.code,...view})}catch{}
 }
 async webSocketClose(ws,code){await this.gone(ws);try{ws.close(code===1005||code===1006?1000:code)}catch{}}
 async webSocketError(ws){await this.gone(ws)}
 async gone(ws){
  this.rules().leave(ws);
  if(this.open().length===0){await this.ctx.storage.put('emptySince',Date.now());await this.schedule(Date.now()+EMPTY_LOBBY_MS)}
 }
 open(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===undefined||ws.readyState===1)}
 async schedule(at){const current=await this.ctx.storage.getAlarm();if(current===null||at<current)await this.ctx.storage.setAlarm(at)}
 // One alarm does two jobs: drop sockets that never said hello, and forget a lobby that has been empty long enough.
 async alarm(){
  const now=Date.now(),lobby=this.rules();let next=null;
  for(const ws of this.open()){
   if(lobby.has(ws))continue;
   const since=ws.deserializeAttachment()?.waitingSince??0;
   if(now-since>=HELLO_TIMEOUT_MS){try{ws.send(JSON.stringify({type:'refused',reason:REFUSED.bad,protocol:PROTOCOL}));ws.close(CLOSE_REFUSED,REFUSED.bad)}catch{}}
   else next=Math.min(next??Infinity,since+HELLO_TIMEOUT_MS);
  }
  if(lobby.size===0){
   const emptySince=await this.ctx.storage.get('emptySince');
   if(emptySince===undefined)await this.ctx.storage.put('emptySince',now);
   else if(now-emptySince>=EMPTY_LOBBY_MS&&this.open().length===0){await this.ctx.storage.deleteAll();return}
   next=Math.min(next??Infinity,(emptySince??now)+EMPTY_LOBBY_MS);
  }
  if(next!==null)await this.ctx.storage.setAlarm(next);
 }
}
