import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {exhaustRate,stepSmoke,createSmoke,SMOKE_MAX,START_PUFFS} from '../dist/smoke.js';
import {createParticles,spawn,PARKED} from '../dist/sawdust.js';
import {CLASSES,freshVehicle,toWorld} from '../dist/vehicle.js';

// the rate: nothing when off, a thin wisp idling, more on the throttle, cheaper tiers smoke more
assert.equal(exhaustRate({running:false,throttle:1}),0,'an engine that is off makes no smoke');
const idle=exhaustRate({throttle:0,speed:0}),gun=exhaustRate({throttle:1,speed:0}),fast=exhaustRate({throttle:1,speed:10,top:10});
assert(idle>0&&idle<4,'a thin wisp at idle ('+idle.toFixed(1)+' puffs a second)');assert(gun>idle&&fast>gun&&fast<12,'more under throttle and at speed, but still slight ('+fast.toFixed(1)+')');
assert(exhaustRate({tier:'low',throttle:1})>exhaustRate({tier:'mid',throttle:1})&&exhaustRate({tier:'mid',throttle:1})>exhaustRate({tier:'high',throttle:1}),'the cheaper the vehicle, the more it smokes');
assert(START_PUFFS.low>START_PUFFS.mid&&START_PUFFS.mid>START_PUFFS.high,'and the key-turn burst');

// the pool: puffs rise, slow down sideways, die when their life is up, and are parked
{const p=createParticles(4);spawn(p,0,1,0,2,0,0,1);const y0=p.pos[1];stepSmoke(p,.25);assert(p.pos[1]>y0&&p.pos[0]>0&&p.vel[0]<2,'a puff rises and slows sideways');
 assert.equal(stepSmoke(p,.5),1,'still alive at 0.75 s');assert.equal(stepSmoke(p,.5),0,'gone after its life');assert.equal(p.pos[1],PARKED,'and parked below the ground')}

// the object: one Points, drawn only while a puff is alive, never more than SMOKE_MAX, emits at the rate (fractions carried over)
{const scene=new THREE.Scene(),s=createSmoke(scene,{random:()=>.5});assert.equal(s.points.visible,false,'hidden until there is smoke');assert.equal(s.particles.max,SMOKE_MAX);
 const tip={x:5,y:.4,z:5,dx:0,dz:-1};for(let i=0;i<32;i++)s.emit('a',1/32,tip,3);assert.equal(s.update(0),3,'3 puffs a second for one second is 3 puffs (the fractions add up)');assert.equal(s.points.visible,true);
 s.burst(tip,9);assert.equal(s.update(0),12,'a burst adds its puffs');for(let i=0;i<200;i++)s.emit('b',1/30,tip,200);assert(s.update(0)<=SMOKE_MAX,'never more than the pool');
 for(let i=0;i<120;i++)s.update(1/30);assert.equal(s.points.visible,false,'and gone again (hidden) a few seconds after the engine stops');assert.equal(scene.children.filter(c=>c.isPoints).length,1,'one draw call')}

// the muffler tips are behind the vehicle, on its right (-x), low, and point straight back
for(const c of Object.values(CLASSES)){assert(c.exhaust&&c.exhaust.z<-c.hz+.3&&c.exhaust.z>-c.hz-.3&&c.exhaust.x<0&&Math.abs(c.exhaust.x)<c.hx&&c.exhaust.y>.2&&c.exhaust.y<.7,c.id+': a muffler tip at the back, right, low');
 const s={...freshVehicle({x:10,z:10,yaw:Math.PI/2})},w=toWorld(s,c.exhaust.x,c.exhaust.z);assert(w.x<10,'turned to face +x ... the back is at -x ('+w.x.toFixed(1)+')')}
console.log('Smoke: slight (idle 2 puffs a second, at most about 9 flat out), more from cheaper tiers, a key-turn burst, rising and fading puffs in one pool of 90 points (one draw call, hidden when none live), and each vehicle\'s muffler tip at its back right.');