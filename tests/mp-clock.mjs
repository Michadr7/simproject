import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {startServer} from '../server.js';
import {MultiplayerClient} from '../dist/multiplayer.js';
import {makeSessionClock} from '../dist/session-clock.js';

// Real relay server and real WebSocket clients on localhost: the host's game clock reaches joiners, only the host may send it, and the host passes on when it leaves.
const server=startServer({port:0});
await once(server,'listening');
const url=`ws://127.0.0.1:${server.address().port}`;
globalThis.WebSocket=WebSocket;
const a=new MultiplayerClient(),b=new MultiplayerClient(),c=new MultiplayerClient();
const next=(client,event,ms=2000)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>{off();reject(new Error('Timed out: '+event))},ms);const off=client.on(event,v=>{clearTimeout(t);off();resolve(v)})});
const quiet=(client,event,ms=300)=>new Promise((resolve,reject)=>{const off=client.on(event,v=>{off();reject(new Error('unexpected '+event+' '+JSON.stringify(v)))});setTimeout(()=>{off();resolve()},ms)});
try{
 let ready=next(a,'connected');a.connect(url);await ready;
 assert.equal(a.isHost,true,'the first player is the host');
 assert.equal(a.sendClock({day:6,minutes:725}),true);
 ready=next(b,'connected');const clockB=next(b,'clock');b.connect(url);await ready;
 assert.equal(b.isHost,false);assert.equal(b.hostId,a.id);
 // the joiner is told the host's time at once (the relay holds the latest and ages it), without waiting for a 30 s broadcast
 const first=await clockB;assert.equal(first.day,6);assert(first.minutes>=725&&first.minutes<727,'aged by the little time that passed: '+first.minutes);
 // a joiner follows it through the session clock
 const sc=makeSessionClock();sc.setHost(false);sc.setMode('visit');assert.equal(sc.receiveHost(first),true);assert.equal(sc.day,6);
 // only the host can send: the client refuses, and a forged message is dropped by the relay
 assert.equal(b.sendClock({day:9,minutes:1}),false,'a joiner client does not send a clock');
 const heard=quiet(a,'clock');b.socket.send(JSON.stringify({type:'clock',day:9,minutes:1}));await heard;
 // the host's later broadcast arrives (2 clients: B and, newly joined, C)
 ready=next(c,'connected');const clockC=next(c,'clock');c.connect(url);await ready;await clockC;
 await new Promise(r=>setTimeout(r,600)); // the relay allows one clock per half second
 const bGot=next(b,'clock'),cGot=next(c,'clock');a.sendClock({day:6,minutes:760});
 assert.deepEqual(await bGot,{day:6,minutes:760});assert.deepEqual(await cGot,{day:6,minutes:760});
 // junk from the host is not relayed
 const junk=quiet(b,'clock');await new Promise(r=>setTimeout(r,600));a.socket.send(JSON.stringify({type:'clock',day:6,minutes:99999}));a.socket.send(JSON.stringify({type:'clock',day:-1,minutes:5}));await junk;
 // the host leaves: the next oldest player (B) is the host and may send; C is told
 const hostMsg=next(c,'host');a.disconnect();
 assert.equal(await hostMsg,b.id);assert.equal(c.hostId,b.id);assert.equal(b.isHost,true,'B was promoted');
 assert.equal(c.isHost,false);
 const cNew=next(c,'clock');assert.equal(b.sendClock({day:7,minutes:10}),true);assert.deepEqual(await cNew,{day:7,minutes:10});
 console.log('PASS mp-clock: real relay and clients: host is the first player, a join gets the host time at once, only the host can send a clock, junk is not relayed, the next oldest player becomes host');
}finally{
 for(const x of [a,b,c])x.disconnect();
 for(const s of server.clients)s.terminate();
 server.close();
}
