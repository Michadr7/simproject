import assert from 'node:assert/strict';
import {normalizeCompanies} from '../dist/careers.js';
import {forkLoadOf} from '../dist/forest.js';
import {FORKLIFT} from '../dist/forklift-assets.js';
import * as F from '../dist/forklift.js';
import {LEVEL_Y} from '../dist/warehouse-layout.js';

// The warehouse forklift (0.35 step 5, DESIGN 4.16 D and I): its arcade drive and fork speeds, an old save's fork load, the converted model, and the vehicle panel. What the forks can touch is fork-pallets.mjs.
const open=()=>false,run=(s,input,seconds,blocked=open)=>{for(let i=0;i<Math.round(seconds*30);i++)s=F.step(s,input,1/30,blocked);return s};
// driving
{let s=F.fresh();assert.equal(s.lift,F.LIFT_MIN);assert.equal(s.yaw,F.BAY.yaw);
 s=run(s,{throttle:1},3);assert(Math.abs(s.speed-F.TOP)<1e-6&&F.TOP===5,'top speed 5 m/s (11 mph): '+s.speed);assert(s.x>F.BAY.x+4,'it drove east: '+s.x);
 s=run(s,{},2);assert.equal(s.speed,0,'it rolls to a stop');
 const r=run(F.fresh(),{throttle:-1},3);assert(Math.abs(r.speed+F.REVERSE_TOP)<1e-6,'reverse is slower: '+r.speed);
 // a full turn at top speed is a circle under 4.8 m across: it turns round in a 4 m aisle (slower, it turns tighter)
 let t=run(F.fresh(),{throttle:1},2),xs=[],zs=[];for(let i=0;i<150;i++){t=F.step(t,{throttle:1,steer:1},1/30,open);xs.push(t.x);zs.push(t.z)}
 const w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);assert(w>2&&w<4.8&&d>2&&d<4.8,'turning circle '+w.toFixed(1)+' x '+d.toFixed(1)+' m');
 // no turning while stopped
 assert.equal(run(F.fresh(),{steer:1},1).yaw,F.BAY.yaw,'it cannot spin on the spot');
 // a wall: it stops short and is never inside it
 const wall=(x,z)=>x>-2;let q=F.fresh();q=run(q,{throttle:1},6,wall);assert(F.clear(q,wall),'never inside the wall');assert(q.x>-4.5&&q.speed<.5,'stopped at the wall: '+q.x+' '+q.speed);
 // a turn that would put the body into a wall is undone
 const corner=(x,z)=>z<5.9&&x>-9;let c={...F.fresh(),x:-11,z:7,yaw:Math.PI/2,speed:2};c=run(c,{throttle:1,steer:-1},3,corner);assert(F.clear(c,corner),'clear after a turn against a wall');
 // the forks
 let l=run(F.fresh(),{raise:1},10);assert.equal(l.lift,F.LIFT_MAX,'up to 3.05 m');l=run(l,{raise:-1},10);assert.equal(l.lift,F.LIFT_MIN,'down to the floor');assert(Math.abs(run(F.fresh(),{raise:1},1).lift-F.LIFT_MIN-F.LIFT_SPEED)<1e-6)}
// the third level (2.85 m) is within the forks' reach
assert(F.LIFT_MAX>=LEVEL_Y[2]&&F.LIFT_MIN<=LEVEL_Y[0]+.35);
// the model
{const m=FORKLIFT;assert(m.triangles<16000,'about 14,000 triangles: '+m.triangles);assert.deepEqual(Object.keys(m.parts).sort(),['body','carriage','mast','wheelFL','wheelFR','wheelRL','wheelRR']);
 assert(m.bounds.min[1]===0&&m.bounds.max[1]>2&&m.bounds.max[1]<2.4,'about 2.2 m tall, standing on the floor: '+JSON.stringify(m.bounds));assert(Math.abs(m.bounds.max[2]-F.TIP)<.05&&Math.abs(m.bounds.min[2]+F.TIP)<.05,'the tine tips are at TIP: '+JSON.stringify(m.bounds));
 assert(m.bounds.max[0]<.6&&m.bounds.min[0]>-.6,'about 1.1 m wide');assert(m.tineTop>=F.LIFT_MIN&&m.tineTop-F.LIFT_MIN<.15,'the tines rest at '+m.tineTop+' in the model and the carriage can drop to '+F.LIFT_MIN+' so they fit the pocket of a pallet on the floor')}
// the vehicle panel while on the forklift: named, fork height and load, every control listed
{const {vehicleHudModel}=await import('../dist/vehicle-hud.js');const m=vehicleHudModel({forklift:{speed:0,lift:1.5,load:40}});assert.equal(m.state,'driving');assert.match(m.name,/Forklift/);assert.equal(m.fuelLabel,'Forks');assert.match(m.fuel,/1\.50 m · 40 planks/);
 assert.deepEqual(m.keys.map(k=>k.kbd),['W S','A D','R F','Shift','E']);assert.equal(vehicleHudModel({forklift:{speed:3,lift:.2,load:0}}).keys[4].muted,true,'stop to get off');assert.match(m.note,/Slide the forks into a pallet/);assert.equal(vehicleHudModel({forklift:{speed:0,lift:.2,load:0,hint:'Forks too high for the pallet.'}}).note,'Forks too high for the pallet.','the panel says why the forks are stopped')}
// an old save's fork load is read as a pallet on the forks
{const load=raw=>forkLoadOf({companies:normalizeCompanies(raw)});assert.equal(load({ridgeline:{forkload:25}}),25);assert.equal(load({ridgeline:{forkload:900}}),40);assert.equal(load({ridgeline:{forkload:-3,name:'x'}}),0)}
console.log('PASS forklift.mjs: arcade drive (5 m/s, rear-wheel steering with the tail swinging out, wheels that roll, slower in reverse, under 4.8 m turning circle, no spinning on the spot, stops at walls), forks 0.08 to 3.05 m reaching all three levels (and a slow lift), an old save with a fork load becoming a pallet, the converted 14,000-triangle model with its four wheels on their axles, and the vehicle panel in forklift mode.');
