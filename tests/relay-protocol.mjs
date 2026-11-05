import assert from 'node:assert/strict';
import {PROTOCOL,REFUSED,CLOSE_REFUSED,CODE_ALPHABET,CODE_LENGTH,makeLobbyCode,normalizeLobbyCode,validRoom,checkHello,hello,allowPosition,POSITION_RATE,createLobby,parseMessage,MAX_MESSAGE_BYTES} from '../dist/relay-protocol.js';

// Codes
for(const c of '01ILOU')assert(!CODE_ALPHABET.includes(c),'no look-alike '+c);
let seed=1;const rnd=()=>((seed=seed*16807%2147483647)-1)/2147483646;
const codes=new Set();for(let i=0;i<500;i++){const c=makeLobbyCode(rnd);assert.equal(c.length,CODE_LENGTH);assert.equal(normalizeLobbyCode(c),c);codes.add(c)}
assert(codes.size>495,'codes spread out');
assert.equal(makeLobbyCode(()=>.999999999),CODE_ALPHABET.at(-1).repeat(CODE_LENGTH));
assert.equal(normalizeLobbyCode(' abc-def '.replace('c','x')),'ABXDEF');
assert.equal(normalizeLobbyCode('ABCDE'),null);assert.equal(normalizeLobbyCode('ABCDE0'),null);assert.equal(normalizeLobbyCode(null),null);

// Rooms: houses are rooms (they were dropped before 0.34.2)
for(const r of ['street','market','cafe','home','house:cedar-1'])assert(validRoom(r),r);
for(const r of ['House:x','house:','house:a b','lobby',7,null])assert(!validRoom(r),String(r));

// Hello
assert.deepEqual(checkHello(hello('0.34.2')),{ok:true,version:'0.34.2'});
assert.equal(checkHello({type:'hello',protocol:PROTOCOL-1}).reason,REFUSED.update);
assert.equal(checkHello({type:'hello',protocol:PROTOCOL+1}).reason,REFUSED.serverOld);
assert.equal(checkHello({type:'position'}).reason,REFUSED.bad);
assert.equal(checkHello({type:'hello',protocol:PROTOCOL,version:'<script>'}).version,null);
assert.equal(parseMessage('x'.repeat(MAX_MESSAGE_BYTES+1)),null);assert.equal(parseMessage('[1]'),null);assert.equal(parseMessage('{bad'),null);

// Rate: a burst passes, a flood is cut to the rate
const bucket={};let passed=0;for(let i=0;i<100;i++)if(allowPosition(bucket,1000))passed++;
assert.equal(passed,POSITION_RATE.burst);
passed=0;for(let t=0;t<2000;t+=10)if(allowPosition(bucket,1000+t))passed++; // 100 a second for 2 s
assert(Math.abs(passed-2*POSITION_RATE.perSecond)<=2,'about the rate: '+passed);

// A lobby with fake peers
const out=[],closed=[];let n=0,clock=0;
const lobby=createLobby({send:(p,m)=>out.push([p,m]),close:(p,code,reason)=>closed.push([p,code,reason]),newId:()=>'id'+(++n),now:()=>clock,maxPlayers:2,code:'ABCDEF'});
const said=p=>out.filter(([q])=>q===p).map(([,m])=>m);
lobby.receive('a',JSON.stringify(hello('0.34.2')));
assert.deepEqual(said('a')[0],{type:'welcome',id:'id1',protocol:PROTOCOL,lobby:'ABCDEF',max:2});
lobby.receive('b',JSON.stringify(hello('0.34.2')));
assert.equal(said('b').find(m=>m.type==='playerJoined').id,'id1','late joiner sees the first');
assert.equal(said('a').find(m=>m.type==='playerJoined').id,'id2');
lobby.receive('c',JSON.stringify(hello('0.34.2')));
assert.equal(said('c')[0].reason,REFUSED.full);assert.deepEqual(closed.at(-1),['c',CLOSE_REFUSED,REFUSED.full]);assert.equal(lobby.size,2);
lobby.receive('d',JSON.stringify({type:'hello',protocol:PROTOCOL-1}));assert.equal(said('d')[0].reason,REFUSED.update);
lobby.receive('e','not json');assert.equal(said('e')[0].reason,REFUSED.bad);
out.length=0;clock=5000;
const moved=lobby.receive('a',JSON.stringify({type:'position',id:'id2',position:{x:1,y:2,z:3},room:'house:cedar-1'}));
assert.deepEqual(moved,{id:'id1',position:{x:1,y:2,z:3},room:'house:cedar-1'},'own id, never the claimed one');
assert.deepEqual(said('b'),[{type:'playerMoved',...moved}]);assert.equal(said('a').length,0,'not echoed');
assert.equal(lobby.receive('a',JSON.stringify({type:'position',position:{x:1e9,y:0,z:0}})),null);
assert.equal(lobby.receive('a',JSON.stringify({type:'position',position:{x:0,y:0,z:0},room:'roof'})),null);
out.length=0;assert(lobby.leave('a'));assert.deepEqual(said('b'),[{type:'playerLeft',id:'id1'}]);assert(!lobby.leave('a'));
// Restored after hibernation: the players are there, and a newcomer sees them
const woke=createLobby({send:(p,m)=>out.push([p,m]),close(){},newId:()=>'new',restore:[{peer:'x',id:'old',position:{x:1,y:0,z:1},room:'cafe'}]});
out.length=0;woke.receive('y',JSON.stringify(hello('0.34.2')));
assert.deepEqual(said('y')[1],{type:'playerJoined',id:'old',position:{x:1,y:0,z:1},room:'cafe'});
console.log('Relay protocol: codes, rooms, hello and version refusal, rate limit, lobby join/full/move/leave, restore passed.');
