// Timber redesign T-E in the packaged game: a felled pine leaves one trunk, the axe bucks it (swings) and the chainsaw (a hold), a second log joins the first on the shoulder, X puts everything down,
// a trunk is picked up with empty hands and slows you to 60%, the saw takes two logs and a trunk at the feed end, and a slab comes off the yard's pile.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {worldLayout} from '../dist/world.js';
import {hire} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {equipTool,addItem} from '../dist/inventory.js';
import {MAP} from '../dist/map-definition.js';
import {markedTrees} from '../dist/forest.js';
import {carryEffects} from '../dist/carry.js';
import {anchorWorld} from '../dist/sawmill.js';
import {slabPile} from '../dist/sawmill-pile.js';
import {workforcePose} from '../dist/workforce-pose.js';import {townPopulation} from '../dist/population.js';
import {readFileSync} from 'node:fs';import {readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import * as THREE from '../dist/vendor/three.module.js';
// The drawing needs the owner's GLBs; Node has no image decoder for their textures, so the test reads each model's REAL geometry from the .glb (positions and indices) with a plain material,
// and the boot hands them to game.js through the one hook it would otherwise load them with (editRelease below patches the temp copy only).
const glbGeometry=name=>{const b=readFileSync('dist/assets/timber/'+name+'.glb'),len=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+len).toString()),bin=b.subarray(28+len),view=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],off=(v.byteOffset||0)+(a.byteOffset||0),n=a.count*({SCALAR:1,VEC3:3,VEC2:2}[a.type]),T=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;return new T(bin.buffer.slice(bin.byteOffset+off,bin.byteOffset+off+n*T.BYTES_PER_ELEMENT))};
 const pr=j.meshes[0].primitives[0],g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(view(pr.attributes.POSITION),3));g.setIndex(new THREE.BufferAttribute(view(pr.indices),1));return g};
globalThis.__timberParts=Object.fromEntries(['trunk','logs2','slab'].map(n=>[n,{geometry:glbGeometry(n),material:new THREE.MeshStandardMaterial()}]));
const HOOK="if(globalThis.document?.baseURI)Promise.all(['trunk','logs2','slab']";

// the sawyer's loop (workforce-pose.js) brings her to the feed end at times, and then E offers "Talk to Priya Nair" first: the clock steps to a minute she is at least 6 m away
const SAWYER=townPopulation().people.find(q=>q.post==='ridgeline-sawyer'),far=(at,m)=>{const s=workforcePose({},SAWYER,DAY,m,{seed:MAP.seed});return Math.hypot(s.x-at.x,s.z-at.z)>6},awayFrom=(at,from)=>{for(let m=from;m<from+60;m+=.1)if(far(at,m)&&far(at,m+1.5))return m;return from}; // away now and still in 1.5 game minutes (the test's next 3 s)
const DAY=3,tree=markedTrees(worldLayout().cuttable,DAY)[1],SAW=MAP.landmarks.find(l=>l.id==='sawmill');
const g=await bootGame({position:{x:tree.x-1.4,z:tree.z},editRelease:async dir=>{const f=join(dir,'game.js'),src=await readFile(f,'utf8');assert(src.includes(HOOK),'game.js loads the timber models');await writeFile(f,src.replace(HOOK,'if(globalThis.__timberParts){Object.assign(TIMBER,globalThis.__timberParts);timberLoaded()}else '+HOOK))}});
try{
 const {GameState,pump,send,ids,scene}=g,obj=n=>scene().getObjectByName(n),p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent||'';
 const hold=s=>{send('keydown','KeyE');pump(s);send('keyup','KeyE');pump(.5)},tap=()=>hold(.1),putDown=()=>{send('keydown','KeyX');send('keyup','KeyX');pump(1.2)},go=(x,z)=>{me().x=x;me().z=z;pump(.6)};
 GameState.progress={...equipTool(hire(p(),'ridgeline').state,'axe').state,housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:600}};GameState.progress=clockIn(p(),'ridgeline').state;pump(1);
 // fell: ONE trunk
 hold(7);assert.equal(p().plots[tree.key]?.tree,null,'felled');pump(2);
 const trunks=p().logs.filter(l=>l.kind==='trunk');assert.equal(trunks.length,1,'one trunk on the ground: '+JSON.stringify(p().logs));assert.equal(p().logs.length,1,'and no loose logs');assert.equal(obj('ground-trunks')?.count,1,'drawn as the trunk model (ground-trunks)');assert.equal(obj('ground-trunks').castShadow,true);
 // empty hands pick it up: 60%, no sprint; X puts it down again as a trunk
 {const eq=equipTool(p(),'axe');GameState.progress=eq.state;pump(.3)} // unequip (toggle)
 assert.equal(p().equipped,null);go(trunks[0].x,trunks[0].z);assert(/Pick up the trunk/.test(prompt()),prompt());tap();pump(1);
 assert.deepEqual(p().carry,{kind:'trunk'});assert.equal(p().logs.length,0);assert.deepEqual([carryEffects(p().carry).speed,carryEffects(p().carry).sprint],[.6,false]);assert(obj('carried-trunk')?.visible&&obj('carried-log').visible&&!obj('carried-logs2').visible,'the trunk model rides on the shoulder');assert.equal(obj('ground-trunks').count,0);
 putDown();assert.equal(p().carry,null,'X puts the trunk down');const t2=p().logs.find(l=>l.kind==='trunk');assert(t2,'a trunk again on the ground');
 // the axe bucks it: hold E keeps swinging until it is logs
 GameState.progress=equipTool(p(),'axe').state;go(t2.x,t2.z);assert(/Cut the trunk into logs/.test(prompt()),prompt());hold(4);
 const logs=p().logs;assert(logs.length===2&&logs.every(l=>!l.kind),'bucked into two logs at level 1: '+JSON.stringify(logs));
 // two logs on the shoulder (picking the second adds it), X puts both down
 go(logs[0].x,logs[0].z);tap();pump(1);assert.deepEqual(p().carry,{kind:'log'});go(logs[1].x,logs[1].z);assert(/Pick up a second log/.test(prompt()),prompt());tap();pump(1);
 assert.deepEqual(p().carry,{kind:'log',count:2});assert.equal(carryEffects(p().carry).speed,.9);assert(obj('carried-logs2').visible&&!obj('carried-trunk').visible,'two logs: the logs2 model');putDown();assert.equal(p().carry,null);assert.equal(p().logs.length,2,'both logs back on the ground');
 // the chainsaw: a hold of buckTimeSec (1.2 s) cuts a trunk; letting go early stops the cut
 GameState.progress={...p(),logs:[...p().logs,{id:900,x:me().x+.5,z:me().z,rot:0,t:p().logs[0].t,kind:'trunk'}],nextLogId:901};GameState.progress=equipTool(addItem(p(),'chainsaw').state,'chainsaw').state;pump(.3);
 go(me().x+.5,me().z);assert(/Cut the trunk into logs · hold E/.test(prompt()),prompt());hold(.4);assert(p().logs.some(l=>l.id===900),'let go at 0.4 s: still a trunk');
 hold(1.6);assert(!p().logs.some(l=>l.id===900),'held 1.2 s: cut');assert.equal(p().logs.filter(l=>!l.kind).length,4);
 // the saw: two logs at the feed end, then a trunk; a slab off the pile
 GameState.progress={...p(),equipped:null,carry:{kind:'log',count:2}};const y0=p().sawmillYard,cut=y=>y.logs+y.logsSawn;let fed=false;
 for(const x of [-4.4,-4.8,-5.2,-5.6])for(const z of [0,.6,-.6,1.2,-1.2]){if(fed)break;const w=anchorWorld(SAW,[x,0,z]);go(w.x,w.z);if(/Put the two logs on the bench/.test(prompt())){tap();fed=true}}
 assert(fed,'the feed end offers the two logs');assert.equal(p().carry,null);assert.equal(cut(p().sawmillYard)-cut(y0),2,'both logs went in');
 GameState.progress={...p(),carry:{kind:'trunk'},routine:{...p().routine,minutes:awayFrom(me(),p().routine.minutes)}};pump(.6);assert(/Put the trunk on the bench/.test(prompt()),prompt());tap();assert.equal(p().carry,null);assert.equal(p().sawmillYard.trunks+p().sawmillYard.trunksSawn,1,'the trunk waits at the saw');pump(.1);assert.equal(obj('yard-trunks')?.count,p().sawmillYard.trunks,'drawn on the trunk deck');assert.equal(obj('yard-trunks').castShadow,false);
 GameState.progress={...p(),sawmillYard:{...p().sawmillYard,slabs:5}};const top=slabPile(5).at(-1),w=anchorWorld(SAW,[top.x,0,top.z]);let took=false;
 for(const dx of [0,.6,-.6,1.2,-1.2])for(const dz of [0,.6,-.6,1.2]){if(took)break;go(w.x+dx,w.z+dz);if(/Take a slab/.test(prompt())){tap();took=true}}
 assert(took,'the slab pile offers a slab');assert.deepEqual(p().carry,{kind:'slab'});assert.equal(p().sawmillYard.slabs,4);putDown();assert.equal(p().carry,null);assert.equal(p().slabDrops?.length,1,'X puts the slab on the ground');pump(.1);assert.equal(obj('yard-slabs')?.count,p().sawmillYard.slabs+1,'one mesh draws the yard slabs and the slab on the ground');assert.equal(obj('yard-slabs').castShadow,false);
 {const names=['ground-trunks','yard-trunks','yard-slabs'],found=[];scene().traverse(o=>{if(names.includes(o.name))found.push(o.name)});assert.deepEqual(found.sort(),names.sort(),'exactly three timber meshes (+3 draw calls), one each')}
 console.log('PASS timber-game.mjs: a felled pine leaves one trunk, picked up with empty hands (60%, no sprint) and put down with X; the axe bucks it into two logs (hold E), the chainsaw in a 1.2 s hold (letting go stops it); a second log joins the first (90%) and X puts both down; the saw takes two logs and a trunk at the feed end; a slab comes off the yard pile and goes down with X; drawn with the real model geometry: ground-trunks (casts shadows), yard-trunks and yard-slabs (no shadows), the trunk and two-log models on the shoulder: three new meshes.');
}finally{await g.done()}
