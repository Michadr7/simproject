// Crowd separation (audit B2): four people with the same plan standing at one shop front end up at least 0.7 m apart, none on top of another.
import assert from 'node:assert/strict';
import {createNpcCrowd} from '../dist/npc-crowd.js';
import {MAP} from '../dist/map-definition.js';
const mk=()=>({group:{visible:false,position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}},rotation:{y:0}},apply(){},setMotion(){},update(){}});
const people=['p01','p02','p03','p04'].map(id=>({id,name:id,body:'male'}));
const s=MAP.shops.market;
// a stand block with no pace: act 'shopfront' at a non-indoor kind? use outside but at minute where pace waits (first 4 s of block): from=600 minute=600
const plan=[{from:0,to:600,act:'home',place:'dwelling:x'},{from:600,to:1440,act:'outside',place:'shop:market'}];
const crowd=createNpcCrowd({scene:{add(){}},createCharacter:mk,outfit:()=>({}),population:{people},schedule:{planOf:()=>plan},pool:9});
for(let i=0;i<200;i++)crowd.update(.05,{x:s.x+30,z:s.z},{day:1,minute:600});
const pos=crowd.slots.filter(x=>x.owner).map(x=>[x.avatar.group.position.x,x.avatar.group.position.z]);
assert.ok(pos.length>=4,'four people drawn');let min=1e9;for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++)min=Math.min(min,Math.hypot(pos[i][0]-pos[j][0],pos[i][1]-pos[j][1]));
assert.ok(min>=.7,'nobody stands on anybody: closest pair '+min.toFixed(2)+' m');
// audit B8: with solid ground only on one side (a wall along the shop front), the push never puts anybody inside it, and nobody is drawn in the wall
{const base=(await import('../dist/population.js')).placePoint('shop:market'),wall=(x,z)=>z<base.z-.3&&Math.abs(x-base.x)<8;let at=0;
 const c2=createNpcCrowd({scene:{add(){}},createCharacter:mk,outfit:()=>({}),population:{people},schedule:{planOf:()=>plan},pool:9,blocked:wall});
 for(let i=0;i<200;i++)c2.update(.05,{x:base.x+30,z:base.z},{day:1,minute:600});
 const p2=c2.slots.filter(x=>x.owner).map(x=>x.avatar.group.position);assert.ok(p2.length>=4);for(const q of p2)assert.ok(!wall(q.x,q.z),'pushed into the wall at '+q.x.toFixed(2)+','+q.z.toFixed(2));at=p2.length;
 // the player standing in a wall's direction: the step-aside is dropped too
 const c3=createNpcCrowd({scene:{add(){}},createCharacter:mk,outfit:()=>({}),population:{people:people.slice(0,1)},schedule:{planOf:()=>plan},pool:9,blocked:wall});
 for(let i=0;i<100;i++)c3.update(.05,{x:base.x,z:base.z+.5},{day:1,minute:600});
 const p3=c3.slots.find(x=>x.owner).avatar.group.position;assert.ok(!wall(p3.x,p3.z),'player push does not enter the wall');
 console.log('PASS npc-crowd-separation walls: '+at+' people, none in the wall');}
console.log('PASS npc-crowd-separation: closest pair '+min.toFixed(2)+' m');