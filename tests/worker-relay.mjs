// The hosted relay's Durable Object (worker/lobby.js) in Node with a fake ctx: create, taken codes, unknown codes, hibernation, the hello timeout and forgetting an empty lobby.
// The real runtime is checked by scripts/relay-smoke.mjs against `npx wrangler dev` or the live site.
import assert from 'node:assert/strict';
import {Lobby,handleRequest,originAllowed,EMPTY_LOBBY_MS} from '../worker/lobby.js';
import {hello,REFUSED,HELLO_TIMEOUT_MS} from '../dist/relay-protocol.js';

let clock=1_000_000;const realNow=Date.now;Date.now=()=>clock;
class FakeSocket{constructor(){this.readyState=1;this.out=[];this.att=null}send(t){if(this.readyState!==1)throw new Error('closed');this.out.push(JSON.parse(t))}close(code){this.closeCode=code;this.readyState=3}serializeAttachment(v){this.att=structuredClone(v)}deserializeAttachment(){return structuredClone(this.att)}}
globalThis.WebSocketPair=class{constructor(){this[0]=new FakeSocket();this[1]=new FakeSocket()}};
const RealResponse=globalThis.Response;
globalThis.Response=class{constructor(body,init={}){this.status=init.status??200;this.webSocket=init.webSocket;this.body=body}};
function fakeCtx(){
 const data=new Map(),sockets=[];let alarm=null;
 return {sockets,data,get alarmAt(){return alarm},fire:async obj=>{alarm=null;await obj.alarm()}, // the runtime clears an alarm as it runs it
  acceptWebSocket:ws=>sockets.push(ws),getWebSockets:()=>sockets.filter(ws=>ws.readyState!==3),
  storage:{get:async k=>data.get(k),put:async(k,v)=>{data.set(k,v)},delete:async k=>data.delete(k),deleteAll:async()=>data.clear(),getAlarm:async()=>alarm,setAlarm:async t=>{alarm=t}}};
}
const req=(code,create)=>({headers:new Map([['x-lobby-code',code],['x-lobby-create',create?'1':'0']])});
const last=(ws,type)=>ws.out.filter(m=>m.type===type).at(-1);
// The server end of the pair is the one the object keeps (ctx.sockets); the test speaks for the client through webSocketMessage.
const connect=async(lobby,ctx,code,create)=>{const r=await lobby.fetch(req(code,create));return {res:r,ws:ctx.sockets.at(-1)}};

try{
 const ctx=fakeCtx();let obj=new Lobby(ctx,{});
 const a=await connect(obj,ctx,'ABCDEF',true);
 assert.equal(a.res.status,101);assert(ctx.data.has('created'));
 await obj.webSocketMessage(a.ws,JSON.stringify(hello('0.34.2')));
 const aw=last(a.ws,'welcome');assert.equal(aw.lobby,'ABCDEF');
 await obj.webSocketMessage(a.ws,JSON.stringify({type:'position',position:{x:7,y:0,z:8},room:'cafe'}));
 assert.deepEqual(a.ws.att.position,{x:7,y:0,z:8},'latest position kept on the socket');
 assert.equal((await obj.fetch(req('ABCDEF',true))).status,409,'a taken code is refused for create');

 // Hibernation: a fresh object over the same sockets still knows the player and where it stood.
 obj=new Lobby(ctx,{});
 const b=await connect(obj,ctx,'ABCDEF',false);
 await obj.webSocketMessage(b.ws,JSON.stringify(hello('0.34.2')));
 assert.equal(last(b.ws,'welcome').lobby,'ABCDEF');
 assert.deepEqual(last(b.ws,'playerJoined'),{type:'playerJoined',id:aw.id,position:{x:7,y:0,z:8},room:'cafe'});
 assert.equal(last(a.ws,'playerJoined').id,last(b.ws,'welcome').id,'the restored player hears the newcomer');

 // A socket that never says hello is dropped by the alarm.
 const quiet=await connect(obj,ctx,'ABCDEF',false);
 assert(ctx.alarmAt<=clock+HELLO_TIMEOUT_MS);
 clock+=HELLO_TIMEOUT_MS;await ctx.fire(obj);
 assert.equal(last(quiet.ws,'refused').reason,REFUSED.bad);assert.equal(quiet.ws.closeCode,4001);
 assert.equal(a.ws.readyState,1,'players stay');

 // Everyone leaves: the lobby is forgotten 10 minutes later, not before.
 for(const s of [a.ws,b.ws]){s.readyState=3;await obj.webSocketClose(s,1000)}
 assert.equal(ctx.data.get('emptySince'),clock);assert.equal(ctx.alarmAt,clock+EMPTY_LOBBY_MS);
 clock+=EMPTY_LOBBY_MS-1;await ctx.fire(obj);assert(ctx.data.has('created'),'still there just before');
 // Someone rejoining in time keeps it alive.
 const back=await connect(obj,ctx,'ABCDEF',false);await obj.webSocketMessage(back.ws,JSON.stringify(hello('0.34.2')));
 assert(last(back.ws,'welcome'));assert(!ctx.data.has('emptySince'));
 back.ws.readyState=3;await obj.webSocketClose(back.ws,1000);
 clock+=EMPTY_LOBBY_MS;await ctx.fire(obj);assert.equal(ctx.data.size,0,'forgotten');
 const late=await connect(obj,ctx,'ABCDEF',false);
 assert.equal(last(late.ws,'refused').reason,REFUSED.noLobby);assert.equal(late.ws.closeCode,4001);

 // An unknown code on a fresh object: refused, nothing stored, no alarm.
 const ctx2=fakeCtx(),none=new Lobby(ctx2,{});const n=await connect(none,ctx2,'ZZZZZZ',false);
 assert.equal(last(n.ws,'refused').reason,REFUSED.noLobby);assert.equal(ctx2.data.size,0);assert.equal(ctx2.alarmAt,null);

 // Routing and Origin (the parts that do not need a real namespace).
 const H=(o,extra={})=>({url:'https://simproject.example/relay/new',headers:new Headers({...(o?{origin:o}:{}),...extra})});
 assert(originAllowed(H(null)));assert(originAllowed(H('https://simproject.example')));assert(originAllowed(H('http://localhost:8000')));
 assert(!originAllowed(H('https://evil.example')));assert(!originAllowed(H('nonsense')));
 assert.equal((await handleRequest(new Request('https://s.example/other'),{})).status,404);
 assert.equal((await handleRequest(new Request('https://s.example/relay/new'),{})).status,426);
 assert.equal((await handleRequest(new Request('https://s.example/relay/new',{headers:{upgrade:'websocket',origin:'https://evil.example'}}),{})).status,403);
 console.log('Hosted relay object: create, taken code 409, hibernation restore with the latest position, hello timeout, empty lobby kept 10 min then forgotten, unknown codes, routing and Origin passed.');
}finally{Date.now=realNow;globalThis.Response=RealResponse}
