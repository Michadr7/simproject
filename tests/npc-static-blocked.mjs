// blockedStatic (OPUS-blockedStatic, notes/eval/reviews/gemini-audit-0.35.17.md finding #1): world.js createColliders blockedAll / world.blockedStatic, the obstacle test the NPC route table is measured with
// (game.js npcStaticBlocked). It must ignore chunk streaming (c.off) and play state (felled trees, hidden landmarks), and give the same answers on every machine and every save.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,createColliders,worldLayout} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
import {chunkIndex,chunkKey} from '../dist/chunks.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const warn=console.warn;console.warn=()=>{}; // the cover atlas needs Image (a browser), as in tests/chunks.mjs

// 1. The collider list alone: streaming, a felled (mutable) collider, a switched-off overlay box, a removed collider.
{const c=createColliders(),keyAt=(x,z)=>{const {i,j}=chunkIndex(x,z);return chunkKey(i,j)};
 const rock=c.box(10,10,1,1),tree=Object.assign(c.circle(40,10,.4,'t'),{mutable:true}),overlay=c.box(70,10,1,1),gone=c.box(100,10,1,1);
 c.stream(true);
 assert.equal(c.blocked(10,10),false,'streamed out: blocked() skips it');assert.equal(c.blockedAll(10,10),true,'blockedAll ignores c.off');
 c.setChunkLive(keyAt(10,10),true);assert.equal(c.blocked(10,10),true);assert.equal(c.blockedAll(10,10),true,'live or not, the same answer');
 tree.active=false;assert.equal(c.blocked(40,10),false,'a felled tree is no obstacle in play');assert.equal(c.blockedAll(40,10),true,'blockedAll counts a mutable collider as built');
 overlay.active=false;assert.equal(c.blockedAll(70,10),false,'a box switched off for good (scene overlay rebuild) is not mutable: off for blockedAll too');
 c.remove(gone);assert.equal(c.blockedAll(100,10),false,'a removed collider is gone');
 assert.equal(c.blockedAll(10,11.3),true,'player radius .33 is kept');assert.equal(c.blockedAll(10,11.34),false)}

// 2. The real world: blockedStatic on sample grids (spawn, farm, forest, every landmark) is the same with only the spawn chunks loaded, after the farm and forest
// chunks load, after every forest tree is felled and every landmark hidden, and equals a whole-map (unstreamed) world's blocked() with nothing felled.
const areas=[[MAP.spawn.x,MAP.spawn.z,24,1],[-62,-236,30,1],[82.5,-266,30,1],...MAP.landmarks.map(l=>[l.x,l.z,8,.5])];
const sample=f=>{let h=2166136261,n=0,hits=0;for(const [cx,cz,r,s] of areas)for(let x=cx-r;x<=cx+r;x+=s)for(let z=cz-r;z<=cz+r;z+=s){const b=f(x,z)?1:0;hits+=b;h=Math.imul(h^b,16777619)>>>0;n++}return {h,n,hits}};
const streamed=createWorld(new THREE.Scene(),{streaming:true}),whole=createWorld(new THREE.Scene(),{});
const atSpawn=sample(streamed.blockedStatic),again=sample(streamed.blockedStatic);
assert.deepEqual(again,atSpawn,'deterministic: two passes give the same answers');
const playAtSpawn=sample(streamed.blocked);
streamed.ensure(-62,-236,2);streamed.ensure(82.5,-266,2);
const loaded=sample(streamed.blockedStatic),playLoaded=sample(streamed.blocked);
assert.notDeepEqual(playLoaded,playAtSpawn,'the probe can see streaming: blocked() changes when the farm and forest load');
assert.deepEqual(loaded,atSpawn,'blockedStatic does not change when chunks load');
let felled=0;for(const t of worldLayout().cuttable)if(streamed.setFelled(t.key))felled++;
let hidden=0;for(const l of MAP.landmarks)if(streamed.setLandmarkVisible(l.id,false))hidden++;
const playFelled=sample(streamed.blocked),afterPlay=sample(streamed.blockedStatic);
assert.ok(felled>100,'trees felled: '+felled);assert.notDeepEqual(playFelled,playLoaded,'felling changes blocked()');
assert.deepEqual(afterPlay,atSpawn,'blockedStatic does not change when trees are felled or landmarks hidden');
assert.deepEqual(sample(whole.blocked),atSpawn,'blockedStatic = the whole map as built');
setTimeout(()=>{console.warn=warn},0).unref?.(); // the cover import fails after the last line (async): keep its warning quiet
console.log(`PASS npc-static-blocked: ${atSpawn.n} samples (${atSpawn.hits} blocked) identical at spawn, with farm+forest loaded, after ${felled} trees felled and ${hidden} landmarks hidden, and against the unstreamed world`);
