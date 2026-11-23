// The multiplayer wire format and one lobby's rules, shared by the local relay (server.js), the hosted relay (worker/relay.js) and the client (multiplayer.js).
// Pure: no sockets here. A lobby is given a send(peer, message) and a close(peer, code, reason) and is told when peers join, speak and leave.
// PROTOCOL changes only when the messages change shape; the relay refuses any other number, so an old open tab is told to update instead of half-working.
import {applyPetSnapshot} from './pet-view.js'; // PET3: a player's cat rides along with the position (optional field: an old client or relay just ignores it, so PROTOCOL stays)
import {createBakeryLobby} from './bakery-lobby.js';
export const PROTOCOL=2;
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

export const validRoom=room=>typeof room==='string'&&(['street','market','cafe','home','hotel'].includes(room)||/^house:[a-z0-9-]{1,40}$/.test(room));
export const validPosition=p=>!!p&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<=10000);
// The host's game clock (MP-CLOCK): the lobby's host (its oldest player) sends {type:'clock',day,minutes}; the relay passes it to everyone else.
export const validClockMessage=m=>!!m&&Number.isInteger(m.day)&&m.day>=1&&m.day<=100000&&Number.isFinite(m.minutes)&&m.minutes>=0&&m.minutes<1440;
export const CLOCK_GAME_MINUTES_PER_SECOND=.5; // the game clock's rate (session-clock.js GAME_MINUTES_PER_SECOND; a test keeps them equal)
export const CLOCK_MIN_GAP_MS=500; // the host may send at most one clock per half second (a burst of joins is answered with the latest)
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
export function createLobby({send,close,newId,now=()=>Date.now(),maxPlayers=MAX_PLAYERS,code=null,restore=[],bakeryState=null,saveBakery=()=>{}}){
 const players=new Map(); // peer -> {id, position, room, bucket}
 for(const r of restore)players.set(r.peer,{id:r.id,position:r.position,room:r.room,pet:applyPetSnapshot(r.pet),bucket:{}});
 const view=p=>p.pet?{id:p.id,position:p.position,room:p.room,pet:p.pet}:{id:p.id,position:p.position,room:p.room};
 // The host is the oldest player still here (the one who created the lobby, or the next oldest if it left). Map order is join order, also after a restore.
 let lastClock=null; // the host's latest clock, so a joiner gets the time at once (aged to now) without waiting for the next broadcast
 const agedClock=()=>{if(!lastClock)return null;const abs=(lastClock.day-1)*1440+lastClock.minutes+Math.max(0,now()-lastClock.at)/1000*CLOCK_GAME_MINUTES_PER_SECOND;const day=Math.floor(abs/1440)+1;return {type:'clock',day,minutes:abs-(day-1)*1440}};
 const hostPeer=()=>{for(const peer of players.keys())return peer;return null};
 const hostId=()=>{const h=hostPeer();return h===null?null:players.get(h).id};
 const broadcast=(message,except)=>{for(const peer of players.keys())if(peer!==except)send(peer,message)};
 const bakery=createBakeryLobby(bakeryState);
 const publishBakery=()=>{saveBakery(bakery.save());const board=bakery.board();if(board)broadcast(board)};
 const refuse=(peer,reason)=>{send(peer,{type:'refused',reason,protocol:PROTOCOL});close(peer,CLOSE_REFUSED,reason)};
 function join(peer,message){
  const check=checkHello(message);
  if(!check.ok){refuse(peer,check.reason);return null}
  if(players.size>=maxPlayers){refuse(peer,REFUSED.full);return null}
  const player={id:newId(),position:{x:-5,y:.2,z:15},room:'street',bucket:{}};
  send(peer,{type:'welcome',id:player.id,protocol:PROTOCOL,lobby:code,max:maxPlayers,host:players.size?hostId():player.id});
  // A new player must also see everyone already here.
  for(const other of players.values())send(peer,{type:'playerJoined',...view(other)});
  const aged=players.size?agedClock():null;if(aged)send(peer,aged);
  players.set(peer,player);
  const board=bakery.board();if(board)send(peer,board);
  broadcast({type:'playerJoined',...view(player)},peer);
  return view(player);
 }
 // Returns what changed (the player after a move, the player after joining) so a host can persist it; null when nothing did.
 function receive(peer,text){
  const message=parseMessage(text);
  const player=players.get(peer);
  if(!player)return message?join(peer,message):(refuse(peer,REFUSED.bad),null);
  if(message?.type==='clock'){
   if(hostPeer()!==peer||!validClockMessage(message)||now()-(player.clockAt??-Infinity)<CLOCK_MIN_GAP_MS)return null;
   player.clockAt=now();lastClock={day:message.day,minutes:message.minutes,at:player.clockAt};broadcast({type:'clock',day:message.day,minutes:message.minutes},peer);return null;
  }
  if(message?.type==='bakerySeed'){
   if(bakery.seed(message,hostPeer()===peer))publishBakery();
   return null;
  }
  if(message?.type==='bakeryAction'){
   if(!allowPosition(player.bakeryBucket??={},now())){
    send(peer,{type:'bakeryResult',request:message.request,error:'Wait a moment and try again.'});return null;
   }
   const clock=agedClock();
   const reply=bakery.execute(player,message,clock?(clock.day-1)*1440+clock.minutes:null);
   if(reply){if(!reply.error)publishBakery();send(peer,reply)}
   return null;
  }
  if(message?.type!=='position'||!validPosition(message.position))return null;
  const room=message.room??'street';
  if(!validRoom(room)||!allowPosition(player.bucket,now()))return null;
  // Trust the peer's own id, never a client-supplied identity.
  player.position={x:message.position.x,y:message.position.y,z:message.position.z};player.room=room;player.pet=applyPetSnapshot(message.pet); // validated or null: junk never reaches the others
  broadcast({type:'playerMoved',...view(player)},peer);
  return view(player);
 }
 function leave(peer){
  const player=players.get(peer);
  if(!player)return false;
  const hostWas=hostId();players.delete(peer);broadcast({type:'playerLeft',id:player.id},peer);
  if(hostWas===player.id)lastClock=null;
  if(hostWas===player.id&&players.size)broadcast({type:'host',id:hostId()}); // the next oldest player is the host now
  if(bakery.leave(player.id))publishBakery();
  return true;
 }
 return {join,receive,leave,bakerySnapshot:bakery.save,get size(){return players.size},get host(){return hostId()},has:peer=>players.has(peer),player:peer=>players.has(peer)?view(players.get(peer)):null};
}
