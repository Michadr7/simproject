// Checks a hosted relay with real WebSocket clients: create a lobby, join it by code, move, refusals, leave.
//   node scripts/relay-smoke.mjs ws://127.0.0.1:8787          (npx wrangler dev)
//   node scripts/relay-smoke.mjs wss://simproject.ghostjumper007.workers.dev
// Leaves nothing behind: the lobby it makes is forgotten 10 minutes after it empties.
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {hello,PROTOCOL,REFUSED,normalizeLobbyCode,CODE_ALPHABET} from '../dist/relay-protocol.js';
import {MultiplayerClient} from '../dist/multiplayer.js';

const base=(process.argv[2]||'ws://127.0.0.1:8787').replace(/\/$/,'');
function open(path){
 const ws=new WebSocket(base+path),inbox=[],waiters=[];
 ws.on('message',d=>{const m=JSON.parse(d.toString());inbox.push(m);for(const w of [...waiters])if(w.test(m)){waiters.splice(waiters.indexOf(w),1);w.resolve(m)}});
 const closed=new Promise(r=>ws.on('close',code=>r(code)));
 const next=(test,label)=>{const hit=inbox.find(test);if(hit){inbox.splice(inbox.indexOf(hit),1);return Promise.resolve(hit)}
  return new Promise((resolve,reject)=>{const w={test,resolve:m=>{clearTimeout(t);inbox.splice(inbox.indexOf(m),1);resolve(m)}};const t=setTimeout(()=>reject(new Error('Timed out waiting for '+label+' on '+path)),5000);waiters.push(w)})};
 return {ws,next,closed,ready:new Promise((r,j)=>{ws.on('open',r);ws.on('error',j)}),say:m=>ws.send(JSON.stringify(m))};
}
const t0=Date.now();
const a=open('/relay/new');await a.ready;a.say(hello('0.0.0'));
const aw=await a.next(m=>m.type==='welcome','welcome');
assert.equal(aw.protocol,PROTOCOL);assert.equal(normalizeLobbyCode(aw.lobby),aw.lobby,'a lobby code: '+aw.lobby);
console.log('created lobby',aw.lobby,'in',Date.now()-t0,'ms');
const b=open('/relay/'+aw.lobby.toLowerCase());await b.ready;b.say(hello('0.0.0'));
const bw=await b.next(m=>m.type==='welcome','welcome');assert.equal(bw.lobby,aw.lobby);
assert.equal((await b.next(m=>m.type==='playerJoined','snapshot')).id,aw.id);
assert.equal((await a.next(m=>m.type==='playerJoined','join')).id,bw.id);
const sent=Date.now();a.say({type:'position',position:{x:3,y:0,z:4},room:'house:cedar-1'});
const mv=await b.next(m=>m.type==='playerMoved','move');assert.deepEqual([mv.id,mv.position.x,mv.room],[aw.id,3,'house:cedar-1']);
console.log('move relayed in',Date.now()-sent,'ms');
const absent=CODE_ALPHABET[0].repeat(6)===aw.lobby?'BBBBBB':CODE_ALPHABET[0].repeat(6);
for(const [path,message,reason] of [['/relay/'+absent,hello('0.0.0'),null],['/relay/'+aw.lobby,{type:'hello',protocol:PROTOCOL-1},REFUSED.update],['/relay/nonsense',hello('0.0.0'),REFUSED.noLobby]]){
 const c=open(path);await c.ready;c.say(message);
 const r=await c.next(m=>m.type==='refused','refused');
 if(reason)assert.equal(r.reason,reason);else assert.equal(r.reason,REFUSED.noLobby,'unknown code '+absent);
 assert.equal(await c.closed,4001);
}
const left=b.next(m=>m.type==='playerLeft','leave');a.ws.close();assert.equal((await left).id,aw.id);b.ws.close();
// The game's own client: a created lobby is rejoined by its code after the lobby has emptied.
globalThis.WebSocket=WebSocket;
const game=new MultiplayerClient(),until=(ev)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('Timed out: '+ev)),5000);const off=game.on(ev,v=>{clearTimeout(t);off();res(v)})});
let w=until('connected');game.connect(base+'/relay/new');await w;const code=game.lobby;
assert.equal(game.rejoinUrl,base+'/relay/'+code);game.disconnect();
w=until('connected');game.connect(game.rejoinUrl);await w;assert.equal(game.lobby,code,'rejoined the same lobby while it was empty');game.disconnect();console.log('Relay smoke passed at',base,': create, join by code (any case), snapshot, move in a house room, no-lobby, update refusal, leave, game client rejoin by code.');
