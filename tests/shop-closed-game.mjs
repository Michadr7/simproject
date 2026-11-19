// Boot-game integration test for the town bundle: closed shops hide clerk/customers/cups and dim lights,
// open shops restore them, shop camera starts and stays inside the room, and walk-loop routes warm on boot.
import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {skipStarter} from '../dist/starter.js';

globalThis.location={search:'?debug&webgpu=0',hostname:'localhost',href:'http://localhost/?debug&webgpu=0',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');

const g=await bootGame({
 position:{x:19,z:-6.3},
 progress:{starter:skipStarter()}
});
try{
 const {GameState,pump,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const at=minutes=>{GameState.progress={...p(),routine:{...p().routine,minutes}}};
 const findShop=kind=>{
  const room=scene().getObjectByName(kind+'-interior');
  assert(room,kind+'-interior exists in scene');
  const clerk=room.children.find(c=>c.isGroup&&Math.abs(c.position.x)<.05&&Math.abs(c.position.z+4.35)<.05);
  assert(clerk,kind+' clerk group found');
  const customers=room.children.filter(c=>c.name==='cafe-customer');
  const cups=room.children.filter(c=>c.isMesh&&Math.abs(c.position.y-.97)<.01&&Math.abs(Math.abs(c.position.x)-3.8)<.01);
  const counter=room.getObjectByName('shop-counter');
  assert(counter,kind+' shop-counter found');
  return {room,clerk,customers,cups,counter};
 };
 const market=findShop('market'),cafe=findShop('cafe');
 assert(cafe.customers.length===4,'cafe has 4 pooled customers');
 assert(market.cups.length>=1&&cafe.cups.length===4,'used cups found');

 // 1. Closed at 03:00: market and cafe hide clerk, customers, cups, and dim interior lights.
 at(3*60);pump(.4);
 assert.equal(market.clerk.visible,false,'market closed at 03:00 hides clerk');
 assert(market.customers.every(c=>!c.visible),'market closed at 03:00 shows no customers');
 assert(market.cups.every(u=>!u.visible),'market closed at 03:00 shows no cups');
 assert(market.counter.material.color.r<market.counter.userData.baseColor.r*.5,'market closed at 03:00 dims interior');

 assert.equal(cafe.clerk.visible,false,'cafe closed at 03:00 hides clerk');
 assert(cafe.customers.every(c=>!c.visible),'cafe closed at 03:00 shows no customers');
 assert(cafe.cups.every(u=>!u.visible),'cafe closed at 03:00 shows no cups');
 assert(cafe.counter.material.color.r<cafe.counter.userData.baseColor.r*.5,'cafe closed at 03:00 dims interior');

 // 2. Open at 12:00: market and cafe show clerk and restore full lighting.
 at(12*60);pump(.4);
 assert.equal(market.clerk.visible,true,'market open at 12:00 shows clerk');
 assert(Math.abs(market.counter.material.color.r-market.counter.userData.baseColor.r)<1e-4,'market open at 12:00 restores light');
 assert.equal(cafe.clerk.visible,true,'cafe open at 12:00 shows clerk');
 assert(Math.abs(cafe.counter.material.color.r-cafe.counter.userData.baseColor.r)<1e-4,'cafe open at 12:00 restores light');

 // 3. Walk into market at 12:00: camera starts and stays inside the bounded shop room.
 Object.assign(me(),{x:MAP.shops.market.x,y:.02,z:-7.5});pump(1);
 Object.assign(me(),{x:MAP.shops.market.x,y:.02,z:-8.9});pump(2.5);
 const cam=globalThis.__renderCamera;
 assert(cam,'render camera captured');
 const origin=MAP.shops.market.interior.origin;
 assert(cam.position.x>=MAP.shops.market.x-5.6&&cam.position.x<=MAP.shops.market.x+5.6,'market camera X inside room: '+cam.position.x);
 assert(cam.position.y>=origin.y+.3&&cam.position.y<=origin.y+3.1,'market camera Y below ceiling: '+cam.position.y);
 assert(cam.position.z>=origin.z-4.6&&cam.position.z<=origin.z+4.6,'market camera Z inside room: '+cam.position.z);

 // 4. Walk-loop candidate pairs warmed into __npcRoutes.
 assert(globalThis.__npcRoutes&&globalThis.__npcRoutes.pairs>45,'walk-loop candidate pairs warmed: '+JSON.stringify(globalThis.__npcRoutes));

 console.log(`PASS shop-closed-game.mjs: 03:00 hides market/cafe clerk+customers+cups and dims lights; 12:00 restores clerk+lights; market camera clamped inside room; __npcRoutes warmed ${globalThis.__npcRoutes.pairs} pairs.`);
}finally{
 await g.done();
}
process.exit(0);
