// Regression checks for Ironwood fixes: interior NPC overlaps, Gemma Atkins, Ridge Clothing rename & inventory, overhangs clearing doors, and asset grounding.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {heightAt} from '../dist/height.js';
import {terrain} from '../dist/terrain.js';
import {createProp,propInfo} from '../dist/props.js';
import {DOWNTOWN_DETAILS,DOWNTOWN_SIGNS} from '../dist/downtown.js';
import {createIronwoodInterior,ALL_IRONWOOD_SERVICES} from '../dist/ironwood-interiors.js';
import {surfaceBaseY,attachBakeryStorefront,SHOP_STOREFRONTS,buildRidgeClothingExterior} from '../dist/ridge-clothing-shell.js';
import {townSpots} from '../dist/town.js';
import {createVehicles} from '../dist/neighborhood.js';
import {createWorld} from '../dist/world.js';

// 1. All 25 interiors have 0 stuck staff NPCs (including Sam in alder-bakery)
for(const id of Object.keys(ALL_IRONWOOD_SERVICES)){
 const r=createIronwoodInterior(id);
 for(const s of r.staff){
  assert.equal(r.blocked(s.x,s.z),false,`${id} staff ${s.name} must not stand inside furniture/walls (${s.x}, ${s.z})`);
  const cp=r.clerk.group.position;
  assert(Math.hypot(s.x-cp.x,s.z-cp.z)>=0.8,`${id} staff ${s.name} clear of clerk`);
 }
}

// 2. Gemma Atkins at alder-bakery & Ridge Clothing at alder-store
const bakerySvc=ALL_IRONWOOD_SERVICES['alder-bakery'];
assert.equal(bakerySvc.name,'Gemma Atkins');
assert.equal(bakerySvc.npcId,'gemma');

const rcProp=MAP.properties.find(p=>p.id==='alder-store');
assert.equal(rcProp.name,'Ridge Clothing');
const rcSign=DOWNTOWN_SIGNS.find(s=>s.id==='alder-store');
assert.equal(rcSign.text,'RIDGE CLOTHING');
const rcSvc=ALL_IRONWOOD_SERVICES['alder-store'];
assert.equal(rcSvc.name,'Brentster Lewis');
for(const reqItem of ['basic-jacket','rain-shell','winter-parka','small-backpack','large-backpack']){
 assert(rcSvc.actions.some(a=>a.item===reqItem),'Ridge Clothing stocks '+reqItem);
}

// 3. Overhangs/awnings clear doors (>= 2.50 m underside) and signs sit above canopies
const propHeightBox=new Map();
for(const d of DOWNTOWN_DETAILS){
 if(!propHeightBox.has(d.prop)){
  const m=createProp(d.prop,{apply:x=>x});
  m.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(m);
  propHeightBox.set(d.prop,{minY:b.min.y,maxY:b.max.y});
 }
 const {maxY}=propHeightBox.get(d.prop),sy=d.sy||1;
 const topWorld=(d.y??0)+maxY*sy;
 if(d.prop.startsWith('overhang')){
  const clearUnder=(maxY*0.75)*sy;
  assert(clearUnder>=2.50,`${d.prop} at (${d.x},${d.z}) must clear 2.40m doors (got ${clearUnder.toFixed(2)}m)`);
 }
 for(const s of DOWNTOWN_SIGNS){
  if(Math.hypot(s.x-d.x,s.z-d.z)<1.2)assert(s.y>topWorld-0.05,`Sign ${s.id} (${s.y}m) must sit above ${d.prop} top (${topWorld.toFixed(2)}m)`);
 }
}

// 4. Bakery storefront exterior door + Ridge Clothing see-through exterior + parked vehicle & landmark grounding
const T=terrain();
const parkedScene=new THREE.Scene();
const parked=createVehicles(parkedScene,[]);
for(const v of parked){
 const expectedY=surfaceBaseY(T,v.x,v.z,heightAt);
 assert(Math.abs(v.group.position.y-expectedY)<0.002,`Neighborhood car ${v.name} sits flush on surface (${v.group.position.y} vs ${expectedY})`);
}

const dummyDoc={createElement:()=>({width:256,height:128,getContext:()=>({clearRect:()=>{},fillRect:()=>{},strokeRect:()=>{},fillText:()=>{},measureText:()=>({width:40})})})};
globalThis.document=dummyDoc;
const scene=new THREE.Scene();
const world=createWorld(scene,{label:()=>new THREE.Group()});
const plinths=scene.getObjectByName('building-plinths');
assert(plinths&&plinths.isInstancedMesh&&plinths.count>=15,'building-plinths InstancedMesh grounds ironwood buildings');

const bakeryFront=scene.getObjectByName('bakery-storefront');
assert(bakeryFront,'Ironwood Bakery has exterior door & pastry storefront');
assert(scene.getObjectByName('bakery-door-glass'),'Ironwood Bakery exterior has glazed door glass');
for(const sid of Object.keys(SHOP_STOREFRONTS)){
 assert(scene.getObjectByName(sid+'-storefront'),sid+' has exterior door storefront');
 assert(scene.getObjectByName(sid+'-door-glass'),sid+' exterior has glazed door glass');
}
for(const s of DOWNTOWN_SIGNS){
 const lm=MAP.landmarks.find(l=>l.id===s.id);
 if(lm)assert(s.y+s.h/2<=propInfo(lm.prop).height+0.05,`Sign ${s.id} (${s.y}m) must stay below roofline (${propInfo(lm.prop).height.toFixed(2)}m)`);
}
const floristSign=DOWNTOWN_SIGNS.find(s=>s.id==='ironwood-florist');
const floristAwning=DOWNTOWN_DETAILS.find(d=>Math.hypot(d.x-floristSign.x,d.z-floristSign.z)<1.2);
assert(floristAwning,'ironwood-florist awning present');
assert((floristAwning.y??0)+propHeightBox.get(floristAwning.prop).maxY*(floristAwning.sy||1)<=2.60,'ironwood-florist canopy fits ground-floor height');
assert(floristSign.y<=3.10,'ironwood-florist sign sits cleanly above ground-floor canopy');
assert(townSpots().lamp.every(lp=>Math.hypot(lp.x-57.12,lp.z-(-55.5))>=1.8),'no streetlamp blocks ironwood-florist doorway');

const rcMesh=scene.getObjectByName('prop-store');
assert(rcMesh,'Ridge Clothing exterior mesh present');
let glassPanes=0;
rcMesh.traverse(o=>{if(o.isMesh&&o.material?.transparent&&o.material.opacity<=0.35)glassPanes++});
assert(glassPanes>=3,'Ridge Clothing exterior has see-through storefront glass windows & doors');

const parkedTaxis=[];
scene.traverse(o=>{if(o.name==='prop-taxi'&&Math.abs(o.position.x-(-4))<0.1&&Math.abs(o.position.z-(-85.25))<0.1)parkedTaxis.push(o)});
assert.equal(parkedTaxis.length,1,'Parked Ironwood taxi found');
assert(Math.abs(parkedTaxis[0].position.y-(-0.045))<0.005,'Ironwood street parked car sits flush on asphalt street');

console.log('PASS ironwood-fixes: 0 stuck interior staff, Gemma Atkins bakery, Ridge Clothing see-through shop/stock, cleared overhangs, grounded buildings/cars.');
