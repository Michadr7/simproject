// W-J normal WebSocket path with competing bakery claims and host handoff.
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {startServer} from '../server.js';
import {MultiplayerClient} from '../dist/multiplayer.js';
import {freshProgress} from '../dist/jobs.js';
import {needsForStock} from '../dist/bakery-needs.js';
import {applyBakeryReceipt,sharedBakeryOffers} from '../dist/bakery-client.js';
import {needToSlot} from '../dist/needs.js';
import {skipStarter} from '../dist/starter.js';

globalThis.WebSocket=WebSocket;
const server=startServer({port:0});
await once(server,'listening');
const url='ws://127.0.0.1:'+server.address().port;
const host=new MultiplayerClient(),guest=new MultiplayerClient();
function event(client,type){
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{off();reject(new Error('Timed out: '+type))},3000);
  const off=client.on(type,message=>{clearTimeout(timer);off();resolve(message)});
 });
}
const connect=async client=>{const ready=event(client,'connected');client.connect(url);await ready};
const day=5,now=day*1440+600,stock={flour:6,'coffee-beans':0};
const need=needsForStock(stock,0,[],{day}),slot=needToSlot(need);
const move=(client,p)=>client.sendPosition({x:p.x,y:.17,z:p.z},'street');
const act=(client,action,gigId)=>{
 const result=event(client,'bakeryResult');
 assert(client.sendBakery({type:'bakeryAction',action,request:action+gigId,needId:need.id,gigId}));
 return result;
};
try{
 await connect(host);
 await connect(guest);
 const seeded=event(guest,'bakeryBoard');
 guest.sendBakery({type:'bakerySeed',now:now+1440,needs:[],stock});
 host.sendBakery({type:'bakerySeed',now,needs:[need],stock});
 const board=await seeded;
 assert.equal(board.needs[0].id,need.id,'guest cannot seed the world');
 let progress={...freshProgress(),starter:skipStarter()};
 assert.equal(sharedBakeryOffers(progress,board,now)[0].needId,need.id);
 const first=await act(host,'accept',1);
 assert.equal(first.active.needId,need.id);
 const rejected=await act(guest,'accept',1);
 assert.match(rejected.error,/another player/i);
 assert.equal((await act(host,'cancel',1)).active,null);
 const accepted=await act(guest,'accept',1);
 progress=applyBakeryReceipt(progress,{action:'accept',need},accepted).state;
 assert.equal(progress.activeJob.title,'Coffee beans for the bakery');
 assert.match((await act(guest,'load',1)).error,/closer/);
 move(guest,slot.origin);
 const loaded=await act(guest,'load',1);
 progress=applyBakeryReceipt(progress,{action:'load',need,load:{}},loaded).state;
 assert.equal(progress.carry.kind,'sack');
 const becameHost=event(guest,'host');
 host.disconnect();
 await becameHost;
 assert(guest.isHost,'guest becomes host without losing their active load');
 move(guest,slot.places[0]);
 const delivered=await act(guest,'deliver',1);
 assert(delivered.paid>0);
 const cash=progress.cash;
 progress=applyBakeryReceipt(progress,{action:'deliver',need},delivered).state;
 assert.equal(progress.cash,cash+delivered.paid);
 assert.equal(progress.carry,null);
 assert.equal(progress.activeJob,null);
 assert.match((await act(guest,'deliver',1)).error,/no longer yours/);
 assert.match((await act(guest,'accept',1)).error,/already accepted/);
 const rejoined=event(host,'bakeryBoard');
 await connect(host);
 assert.equal((await rejoined).stock['coffee-beans'],1);
 assert.equal((await act(host,'accept',2)).active.needId,need.id);
 console.log('PASS bakery-coop: host-only board, competing claims, cancel, pickup, host exit, single payout, replay rejection and rejoin');
}finally{
 host.disconnect();guest.disconnect();
 for(const client of server.clients)client.terminate();
 await new Promise(resolve=>server.close(resolve));
}
