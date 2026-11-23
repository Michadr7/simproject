// W-J: two packaged game instances use the phone, dock and delivery controls over a real relay.
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import {needsForStock} from '../dist/bakery-needs.js';
import {needToSlot} from '../dist/needs.js';
import {startServer} from '../server.js';

const day=5,stock={flour:6,'coffee-beans':0};
const need=needsForStock(stock,0,[],{day}),slot=needToSlot(need);
async function until(fn,label){
 for(let i=0;i<120;i++){const value=fn();if(value)return value;await sleep(30)}
 throw new Error('Timed out: '+label);
}

async function player(url,host){
 globalThis.WebSocket=WebSocket;
 const {bootGame}=await import('./support/boot-game.mjs');
 const game=await bootGame({play:false,progress:{housing:{day:day+1},routine:{minutes:600},
  bakeryStock:stock,needs:host?[need]:[]}});
 const {find,GameState,pump,send}=game;
 find('menuAddress').value=url;
 find('menuJoin').click();
 await until(()=>find('welcome').hidden,'join');
 const progress=()=>GameState.progress;
 const gigs=()=>{if(find('phoneOverlay').hidden)find('phoneButton').click();find('phoneApp-gigs').click()};
 const offer=()=>find('accept-slot-0').offer;
 const actions={
  status:()=>({active:progress().gigs.active?.needId,cash:progress().cash,carry:progress().carry?.kind}),
  offer:()=>{gigs();return offer()?.needId||null},
  accept:async()=>{
   await until(()=>{gigs();return offer()?.shared&&offer().needId===need.id},'shared phone card');
   find('accept-slot-0').click();
   await until(()=>progress().gigs.active,'phone acceptance');
   return progress().gigs.active.needId;
  },
  cancel:async()=>{
   gigs();find('phoneGiveUp').click();find('phoneGiveUp').click();
   await until(()=>!progress().gigs.active,'phone cancellation');
   return true;
  },
  load:async()=>{
   if(!find('phoneOverlay').hidden)find('phoneClose').click();
   Object.assign(GameState.me.position,slot.origin);pump(.16);
   send('keydown','KeyE');pump(.08);send('keyup','KeyE');
   await until(()=>progress().carry?.kind==='sack','E at the Wholesale dock');
   return true;
  },
  deliver:async()=>{
   Object.assign(GameState.me.position,slot.places[0]);pump(.16);
   send('keydown','KeyE');pump(.08);send('keyup','KeyE');
   await until(()=>!progress().gigs.active,'E at Ironwood Bakery');
   return progress().cash;
  },
  leave:()=>{find('mainMenu').click();return true}
 };
 process.on('message',async ({id,action})=>{
  try{process.send({id,result:await actions[action]()})}catch(error){process.send({id,error:String(error.stack||error)})}
 });
 process.on('disconnect',async()=>{await game.done();process.exit()});
 process.send({ready:true});
}

if(process.argv[2]==='player'){
 await player(process.argv[3],process.argv[4]==='host');
}else{
 const server=startServer({port:0});await once(server,'listening');
 const url='ws://127.0.0.1:'+server.address().port;
 const children=[];
 function start(role){
  const child=fork(fileURLToPath(import.meta.url),['player',url,role],{stdio:['ignore','ignore','inherit','ipc']});
  children.push(child);
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Timed out booting '+role)),20000);
   child.once('exit',code=>reject(new Error(role+' exited '+code)));
   child.on('message',message=>{if(message.ready){clearTimeout(timer);resolve(child)}});
  });
 }
 let id=0;
 function ask(child,action){
  return new Promise((resolve,reject)=>{
   const request=++id;
   const timer=setTimeout(()=>{child.off('message',receive);reject(new Error('No response: '+action))},7000);
   const receive=message=>{
    if(message.id!==request)return;
    clearTimeout(timer);child.off('message',receive);
    if(message.error)reject(new Error(message.error));else resolve(message.result);
   };
   child.on('message',receive);child.send({id:request,action});
  });
 }
 try{
  const host=await start('host'),guest=await start('guest');
  assert.equal(await ask(host,'accept'),need.id);
  assert.equal(await ask(guest,'offer'),null);
  assert.equal(await ask(host,'cancel'),true);
  assert.equal(await ask(guest,'accept'),need.id);
  assert.equal(await ask(guest,'load'),true);
  const before=await ask(guest,'status');
  await ask(host,'leave');
  await until(()=>server.clients.size===1,'host disconnect');
  assert((await ask(guest,'deliver'))>before.cash);
  const after=await ask(guest,'status');
  assert.equal(after.carry,undefined);assert.equal(after.active,undefined);
  console.log('PASS bakery-coop-game: packaged phone accept/cancel, shared board, dock pickup and one delivery payout after host departure');
 }finally{
  for(const child of children)if(child.connected)child.disconnect();
  for(const client of server.clients)client.terminate();
  await new Promise(resolve=>server.close(resolve));
 }
}
