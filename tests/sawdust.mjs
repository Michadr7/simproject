import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {SAWDUST_MAX,GRAVITY,PARKED,createParticles,spawn,step,createSawdust} from '../dist/sawdust.js';

// The particle pool (pure): a ring of short-lived points that fall, slow down, and die on time or on reaching the floor.
{const p=createParticles(4);assert.equal(p.alive,0);assert(p.pos.every((v,i)=>i%3!==1||v===PARKED),'unused ones are parked below the ground');
 spawn(p,0,2,0,1,0,0,1);assert.equal(step(p,.1,0),1);assert(p.pos[0]>0&&p.pos[1]<2,'moves and falls');assert(p.vel[1]<0&&Math.abs(p.vel[1]-GRAVITY*.1*(1-1.6*.1))<1e-5,'gravity');assert(p.vel[0]<1,'drag slows it');
 assert.equal(step(p,.95,0),0,'dead when its life is up');assert.equal(p.pos[1],PARKED);assert.equal(step(p,.1,0),0);
 spawn(p,0,.05,0,0,-1,0,5);assert.equal(step(p,.1,.3),0,'reaching the floor kills it at once');
 for(let i=0;i<6;i++)spawn(p,i,2,0,0,0,0,5);assert.equal(step(p,.01,0),4,'a full pool replaces its oldest: never more than the pool size');assert.equal(p.pos[0],2,'the ring wrapped: slot 0 was overwritten by the third of the six')}
// The sawdust object: one Points, hidden when nothing is alive, spraying along the model's feed direction whatever the yaw.
{const parent=new THREE.Group(),yaw=-Math.PI/2,dust=createSawdust(parent,{origin:{x:104,y:1.38,z:-278},yaw,floorY:.3,random:(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647})()});
 assert.equal(parent.children.length,1);assert.equal(dust.points.name,'sawdust');assert.equal(dust.points.castShadow,false);assert.equal(dust.points.visible,false,'not drawn until used');assert.equal(SAWDUST_MAX,300);
 assert.equal(dust.update(.016),0);assert.equal(dust.points.visible,false);
 dust.emit(300);assert.equal(dust.update(.016),300,'a few hundred points at once');assert.equal(dust.points.visible,true);
 const P=dust.particles;let vx=0,vz=0,vy=0;for(let i=0;i<P.max;i++){vx+=P.vel[i*3];vy+=P.vel[i*3+1];vz+=P.vel[i*3+2]}assert(vz/300>.5,'thrown along the model +x, which yaw -90 turns to world +z: '+(vz/300).toFixed(2));assert(Math.abs(vx/300)<.5,'little sideways drift');assert(vy/300>0,'and up');
 for(let i=0;i<P.max;i++){assert(Math.abs(P.pos[i*3]-104)<.5&&Math.abs(P.pos[i*3+2]+278)<.5,'starts at the blade')}
 let t=0;while(dust.update(.05)>0&&t<40)t++;assert(t<40,'all gone within about 1.5 s: '+t*.05);assert.equal(dust.points.visible,false,'hidden again');
 dust.emit(50);assert.equal(dust.update(.01,false),50);assert.equal(dust.points.visible,false,'and hidden while the sawmill is out of range');dust.dispose();assert.equal(parent.children.length,0)}
console.log('Sawdust: a 300-point ring that falls, slows and dies on time or at the floor; one Points object, hidden when empty or out of range, no shadows, thrown along the log\'s way at any yaw.');