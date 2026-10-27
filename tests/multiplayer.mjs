import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {startServer} from '../server.js';
import {MultiplayerClient} from '../dist/multiplayer.js';
import {createRemotePlayer,updateRemotePlayer,disposeRemotePlayer} from '../dist/remote-player.js';

const server=startServer({port:0});
await once(server,'listening');
const url=`ws://127.0.0.1:${server.address().port}`;
globalThis.WebSocket=WebSocket;
const a=new MultiplayerClient(),b=new MultiplayerClient(),c=new MultiplayerClient();
const received=(client,event)=>new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{off();reject(new Error('Timed out: '+event))},2000);
 const off=client.on(event,value=>{clearTimeout(timeout);off();resolve(value)});
});
try{
 const aReady=received(a,'connected');a.connect(url);await aReady;
 a.sendPosition({x:12,y:.165,z:9},'street');
 // Wait for a server-observed move via a third socket below rather than a sleep.
 const aJoined=received(a,'playerJoined'),bExisting=received(b,'playerJoined'),bReady=received(b,'connected');
 b.connect(url);await bReady;
 assert.equal((await aJoined).id,b.id);
 assert.equal((await bExisting).id,a.id,'late joiner receives existing player');
 assert.notEqual(a.id,b.id);
 const moved=received(b,'playerMoved');
 a.sendPosition({x:4,y:.02,z:-2},'cafe');
 const update=await moved;
 assert.equal(update.id,a.id);assert.equal(update.room,'cafe');assert.deepEqual(update.position,{x:4,y:.02,z:-2});
 // Sender identity cannot be forged; malformed messages must not crash the relay.
 a.socket.send('invalid JSON');a.socket.send(JSON.stringify({type:'position',position:{x:null,y:0,z:0}}));
 const forged=received(b,'playerMoved');
 a.socket.send(JSON.stringify({type:'position',id:b.id,position:{x:6,y:0,z:0}}));
 assert.equal((await forged).id,a.id);
 const existing=[];c.onPlayerJoined(p=>existing.push(p));const cReady=received(c,'connected');
 const cSnapshot=new Promise(resolve=>c.onPlayerJoined(()=>{if(existing.length===2)resolve()}));
 c.connect(url);await cReady;await cSnapshot;
 assert.equal(existing.find(p=>p.id===a.id).position.x,6,'snapshot holds latest position');
 const departed=received(b,'playerLeft');const oldId=a.id;a.disconnect();assert.equal(await departed,oldId);
 assert.equal(a.sendPosition({x:0,y:0,z:0}),false);
 const mesh=createRemotePlayer({x:0,y:0,z:0});mesh.userData.target.set(10,0,0);
 updateRemotePlayer(mesh,.05);assert(mesh.position.x>0&&mesh.position.x<10,'movement is interpolated');
 for(let i=0;i<100;i++)updateRemotePlayer(mesh,.05);
 assert(Math.abs(mesh.position.x-10)<.001);disposeRemotePlayer(mesh);
 console.log('Real WebSocket clients: joins, snapshot, movement, ID spoof rejection, malformed messages, leave, and mesh smoothing passed.');
}finally{
 a.disconnect();b.disconnect();c.disconnect();
 for(const socket of server.clients)socket.terminate();
 await new Promise(resolve=>server.close(resolve));
}
