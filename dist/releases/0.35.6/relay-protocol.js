// The multiplayer wire format and one lobby's rules, shared by the local relay (server.js), the hosted relay (worker/relay.js) and the client (multiplayer.js).
// Pure: no sockets here. A lobby is given a send(peer, message) and a close(peer, code, reason) and is told when peers join, speak and leave.
// PROTOCOL changes only when the messages change shape; the relay refuses any other number, so an old open tab is told to update instead of half-working.
export const PROTOCOL=1;
export const MAX_PLAYERS=8,MAX_MESSAGE_BYTES=4096,HELLO_TIMEOUT_MS=10000;
export const POSITION_RATE={perSecond:25,burst:10}; // the game sends at most 20 a second while moving
// Lobby codes: 6 characters, none of 0, O, 1, I, L, U (easy to misread or mishear). 30^6 is about 729 million codes.
export const CODE_ALPHABET='ABCDEFGHJKMNPQRSTVWXYZ23456789',CODE_LENGTH=6;
export const REFUSED={update:'update',serverOld:'server-old',full:'full',noLobby:'no-lobby',bad:'bad-hello'};
// The close code a refusal uses (4000-4999 is for applications).
export const CLOSE_REFUSED=4001;

export function makeLobbyCode(random=Math.random){let code='';for(let i=0;i<CODE_LENGTH;i++)code+=CODE_ALPHABET[Math.floor(random()*CODE_ALPHABET.length)%CODE_ALPHABET.length];return code}
// Typed codes are forgiving about case, spaces and dashes; anything outside the alphabet makes the code invalid.
export function normalizeLobbyCode(text){const code=String(text??'').toUpperCase().replace(/[\s-]/g,'');return code.length===CODE_LENGTH&&[...code].every(c=>CODE_ALPHABET.includes(c))?code:null}

export const validRoom=room=>typeof room==='string'&&(['street','market','cafe','home'].includes(room)||/^house:[a-z0-9-]{1,40}$/.test(room));
export const validPosition=p=>!!p&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=10000);
export const validVersion=v=>typeof v==='string'&&/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(v);

// What the client sends first. Anything else first is a bad hello.
export const hello=version=>({type:'hello',protocol:PROTOCOL,version});
export function checkHello(message){
 if(message?.type!=='hello'||!Number.isInteger(message.protocol))return {ok:false,reason:REFUSED.bad};
 if(message.protocol<PROTOCOL)return {ok:false,reason:REFUSED.update};
 if(message.protocol>PROTOCOL)return {ok:false,reason:REFUSED.serverOld};
 return {ok:true,version:validVersion(message.version)?message.version:null};
}
export function parseMessage(text){if(typeof text!=='string'||text.length>MAX_MESSAGE_BYTES)return null;try{const m=JSON.parse(text);return m&&typeof m==='object'&&!Array.isArray(m)?m:null}catch{return null}}

// A token bucket per peer: positions beyond the rate are dropped, never queued.
export function allowPosition(bucket,nowMs){
 const {perSecond,burst}=POSITION_RATE;
 if(bucket.at===undefined){bucket.at=nowMs;bucket.tokens=burst}
 bucket.tokens=Math.min(burst,bucket.tokens+Math.max(0,nowMs-bucket.at)/1000*perSecond);bucket.at=nowMs;
 if(bucket.tokens<1)return false;bucket.tokens-=1;return true;
}

// One lobby. Peers are opaque keys (a ws socket, a Durable Object WebSocket). A peer is 'waiting' until its hello, then a player.
// restore: players rebuilt after a hosted relay wakes from hibernation ({peer, id, position, room}).
export function createLobby({send,close,newId,now=()=>Date.now(),maxPlayers=MAX_PLAYERS,code=null,restore=[]}){
 const players=new Map(); // peer -> {id, position, room, bucket}
 for(const r of restore)players.set(r.peer,{id:r.id,position:r.position,room:r.room,bucket:{}});
 const view=p=>({id:p.id,position:p.position,room:p.room});
 const broadcast=(message,except)=>{for(const peer of players.keys())if(peer!==except)send(peer,message)};
 const refuse=(peer,reason)=>{send(peer,{type:'refused',reason,protocol:PROTOCOL});close(peer,CLOSE_REFUSED,reason)};
 function join(peer,message){
  const check=checkHello(message);
  if(!check.ok){refuse(peer,check.reason);return null}
  if(players.size>=maxPlayers){refuse(peer,REFUSED.full);return null}
  const player={id:newId(),position:{x:-5,y:.2,z:15},room:'street',bucket:{}};
  send(peer,{type:'welcome',id:player.id,protocol:PROTOCOL,lobby:code,max:maxPlayers});
  // A new player must also see everyone already here.
  for(const other of players.values())send(peer,{type:'playerJoined',...view(other)});
  players.set(peer,player);
  broadcast({type:'playerJoined',...view(player)},peer);
  return view(player);
 }
 // Returns what changed (the player after a move, the player after joining) so a host can persist it; null when nothing did.
 function receive(peer,text){
  const message=parseMessage(text);
  const player=players.get(peer);
  if(!player)return message?join(peer,message):(refuse(peer,REFUSED.bad),null);
  if(message?.type!=='position'||!validPosition(message.position))return null;
  const room=message.room??'street';
  if(!validRoom(room)||!allowPosition(player.bucket,now()))return null;
  // Trust the peer's own id, never a client-supplied identity.
  player.position={x:message.position.x,y:message.position.y,z:message.position.z};player.room=room;
  broadcast({type:'playerMoved',...view(player)},peer);
  return view(player);
 }
 function leave(peer){
  const player=players.get(peer);
  if(!player)return false;
  players.delete(peer);broadcast({type:'playerLeft',id:player.id},peer);return true;
 }
 return {join,receive,leave,get size(){return players.size},has:peer=>players.has(peer),player:peer=>players.has(peer)?view(players.get(peer)):null};
}
