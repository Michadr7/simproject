import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from '../dist/vendor/three.module.js';import {createShop} from '../dist/shops.js';import {MAP} from '../dist/map-definition.js';import {footprintRects,makeCoverSampler} from '../dist/cover-sampler.js';import {densityAt,SURF} from '../dist/ground-cover-rules.js';import {TABLES} from '../dist/diner-job.js';import {PASS,MAKE,COUNTER_AT} from '../dist/diner-flow.js';const TABLE={x:-2.55,z:TABLES[0].z},MACHINE=MAKE,MANAGER=COUNTER_AT; // diner D-A2: the spots the diner flow uses (the aisle beside table 1, the make spot, the counter) replace the old cafe-job.js ones; the pass is checked below too
const cafeBldg=MAP.buildings.find(b=>b.shop==='cafe');
const coverSampler=makeCoverSampler({bounds:{x0:25,z0:-28,x1:47,z1:-5},surfaceAt:()=>SURF.GRASS,heightAt:()=>0,rects:footprintRects(MAP.buildings)});
for(const kind of ['market','cafe']){const room=createShop(kind);room.scene.updateMatrixWorld(true);const x=kind==='market'?-4.6:-3.8,y=kind==='market'?1.5:.85;const ray=new T.Raycaster(new T.Vector3(x,y,8),new T.Vector3(0,0,-1));const hits=ray.intersectObject(room.scene,true).filter(h=>h.object.visible);assert.equal(hits[0].object.name,'storefront-glass','no opaque wall hides the glazing');assert.equal(hits[0].object.renderOrder,2,'glass renders after opaque geometry');assert(hits.some(h=>h.point.z<4&&h.object.material.opacity===1),'actual interior geometry is visible behind glass');
 assert.equal(room.doorBits.length,0,'no leftover duplicate doorBits');assert.equal(room.scene.getObjectByName('glass-door'),undefined,'no leftover glass-door pane');
 assert.equal(room.exitDoor.group.name,kind+'-exit-door','named exit door group for single-door check');
 const sills=room.scene.children.filter(m=>m.geometry?.type==='BoxGeometry'&&Math.abs(m.position.z-5)<0.05&&Math.abs(m.position.y-0.15)<0.05&&m.geometry.parameters.width>3);
 assert.equal(sills.length,2,'two front sills flush against doorway frame');
 for(const s of sills)assert(Math.abs(Math.abs(s.position.x)-s.geometry.parameters.width/2-1.27)<0.01,'sill meets door jamb cleanly without gap');
 const counter=room.scene.getObjectByName('shop-counter');assert(counter&&counter.material.transparent===false&&counter.material.depthWrite===true&&counter.material.opacity===1,'counter is solid and opaque');assert(!room.occluders.includes(counter),'counter is never faded as an indoor-camera occluder');
 const c0=counter.material.color.r;room.setLight(.2);assert(counter.material.color.r<c0,'setLight dims interior materials');room.setLight(1);assert(Math.abs(counter.material.color.r-c0)<1e-6,'setLight restores interior materials');
 if(kind==='cafe'){
  const org=MAP.shops.cafe.interior.origin;
  assert(cafeBldg.x-cafeBldg.w/2<=MAP.shops.cafe.x-room.bounds.halfW&&cafeBldg.x+cafeBldg.w/2>=MAP.shops.cafe.x+room.bounds.halfW,'cafe X bounds fit inside building footprint');
  assert(cafeBldg.z-cafeBldg.d/2<=org.z+room.bounds.minZ&&cafeBldg.z+cafeBldg.d/2>=org.z+room.bounds.maxZ,'cafe Z bounds fit inside building footprint');
  for(const [lx,lz] of [[-5.5,-8.5],[0,-7.5],[5.5,-8.5],[-4.5,-7.2],[4.8,-7.2]])assert.equal(densityAt('grass',MAP.shops.cafe.x+lx,org.z+lz,coverSampler),0,`zero grass inside cafe at (${lx},${lz})`);
  const kCounter=room.scene.getObjectByName('kitchen-counter');assert(kCounter&&kCounter.material.opacity===1&&kCounter.position.z<-8.5&&kCounter.geometry.parameters.width>=7,'long back kitchen counter runs along the north kitchen wall');
  assert(!room.occluders.includes(kCounter),'kitchen counter is not faded as an indoor-camera occluder');
  for(const id of ['f-sink','f-fridge','f-bath-sink']){const props=room.scene.children.filter(o=>o.name===id);assert(props.length>=1,'missing '+id);for(const o of props)assert(Math.abs(o.rotation.y-Math.PI)<0.01,`${id} faces south into the room (${o.rotation.y})`)}
  assert(MAKE.z<-6,'diner MAKE spot is in the back kitchen');
  const shopsSrc=fs.readFileSync(new URL('../dist/shops.js',import.meta.url),'utf8');
  for(const app of ['espresso_machine','coffee_grinder','prep_board','flat_grill','pizza_oven']){const m=shopsSrc.match(new RegExp(`\\['${app}',[^,]+,[^,]+,([^,\\]]+)`));assert(m&&Number(m[1])<-8,'cooking appliance placed in back kitchen, not on front counter: '+app)}
  const queue=[[0,15]],seen=new Set(['0,15']);for(let i=0;i<queue.length;i++){const [qx,qz]=queue[i];for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=qx+dx,b=qz+dz,k=a+','+b;if(!seen.has(k)&&!room.blocked(a*.2,b*.2)){seen.add(k);queue.push([a,b])}}}for(const p of [TABLE,MACHINE,MANAGER,PASS,{x:2.55,z:2},{x:-4.5,z:-7.2},{x:4.8,z:-7.2}])assert(queue.some(([qx,qz])=>Math.hypot(qx*.2-p.x,qz*.2-p.z)<.3),'work station / back room is reachable: '+JSON.stringify(p));
 }
}
console.log('Glass sightlines reveal real interiors; no leftover doorBits; counter stays solid/opaque; setLight dims/restores; café work stations & kitchen/restroom reachable with zero grass inside footprint.');
