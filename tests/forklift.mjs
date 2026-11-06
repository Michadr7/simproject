import assert from 'node:assert/strict';
import {hire,normalizeCompanies} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {freshProgress} from '../dist/jobs.js';
import {racksOf,addStock,stockOf,forkTake,forkTakePile,forkPut,forkUsed,forkLoadOf,RACK_CAP} from '../dist/forest.js';
import {FORKLIFT} from '../dist/forklift-assets.js';
import * as F from '../dist/forklift.js';
import {bayX,FACE_ROWS,WAREHOUSE_PILE,WAREHOUSE_STAGING,LEVEL_Y} from '../dist/warehouse-layout.js';

// The warehouse forklift (0.35 step 5, DESIGN 4.16 D): its arcade drive, its forks and what they are at, the pallet rules on the company's racks, and the converted model.
const open=()=>false,run=(s,input,seconds,blocked=open)=>{for(let i=0;i<Math.round(seconds*30);i++)s=F.step(s,input,1/30,blocked);return s};
// driving
{let s=F.fresh();assert.equal(s.lift,F.LIFT_MIN);assert.equal(s.yaw,F.BAY.yaw);
 s=run(s,{throttle:1},3);assert(Math.abs(s.speed-F.TOP)<1e-6,'top speed 3 m/s: '+s.speed);assert(s.x>F.BAY.x+4,'it drove east: '+s.x);
 s=run(s,{},2);assert.equal(s.speed,0,'it rolls to a stop');
 const r=run(F.fresh(),{throttle:-1},3);assert(Math.abs(r.speed+F.REVERSE_TOP)<1e-6,'reverse is slower: '+r.speed);
 // a full turn at speed is a circle of about 4 m across: it turns round in a 4 m aisle
 let t=run(F.fresh(),{throttle:1},2),xs=[],zs=[];for(let i=0;i<150;i++){t=F.step(t,{throttle:1,steer:1},1/30,open);xs.push(t.x);zs.push(t.z)}
 const w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs);assert(w>3&&w<4.8&&d>3&&d<4.8,'turning circle '+w.toFixed(1)+' x '+d.toFixed(1)+' m');
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
// what the forks are at
{const at=(x,z,yaw,lift)=>({x,z,yaw,speed:0,lift});
 const bay=4,row=FACE_ROWS.B.z,fx=bayX(bay),z=row-1.0-F.TIP; // facing +z... face B looks toward -z, so the forklift comes from the aisle at lower z and faces +z
 assert.equal(F.slotAt(at(fx,z,0,1.5)),'B4-2','level two');assert.equal(F.slotAt(at(fx,z,0,2.85)),'B4-3','level three');assert.equal(F.slotAt(at(fx,z,0,F.LIFT_MIN)),'B4-1','the floor level');
 assert.equal(F.slotAt(at(fx,z,0,1.0)),null,'between levels: none');assert.equal(F.slotAt(at(fx+.9,z,0,1.5)),null,'half a bay to the side: the neighbour or none, not this one');
 assert.equal(F.slotAt(at(fx+1.8,z,0,1.5)),'B5-2','the next bay along');assert.equal(F.slotAt(at(fx,z,1.3,1.5)),null,'turned away');assert.equal(F.slotAt(at(fx,z-3,0,1.5)),null,'too far back');
 const s0=WAREHOUSE_STAGING[0],pz=s0.z+1.0+F.TIP;assert.equal(F.stagingAt(at(s0.x,pz,Math.PI,F.LIFT_MIN)),0,'the first staging pallet');assert.equal(F.stagingAt(at(WAREHOUSE_STAGING[2].x,pz,Math.PI,F.LIFT_MIN)),2,'the third');
 assert.equal(F.stagingAt(at(s0.x,pz,Math.PI,1.5)),-1,'not with the forks raised');assert.equal(F.stagingAt(at(s0.x,pz+4,Math.PI,F.LIFT_MIN)),-1,'not far away');
 assert.equal(F.pileAt(at(WAREHOUSE_PILE.x,WAREHOUSE_PILE.z+1+F.TIP,Math.PI,F.LIFT_MIN)),true,'the delivery pile');assert.equal(F.pileAt(at(0,0,Math.PI,F.LIFT_MIN)),false)}
// rules: a whole pallet at a time, kept on the company
{const base=hire(freshProgress(),'ridgeline').state,shifted=clockIn({...base,housing:{...base.housing,day:3},routine:{...base.routine,minutes:600}},'ridgeline').state;
 const withRack=(slot,n)=>({...shifted,companies:{...shifted.companies,ridgeline:{...shifted.companies.ridgeline,racks:{[slot]:n}}}});
 assert.match(forkTake(hire(freshProgress(),'ridgeline').state,'A1-1').error,/Clock in/,'on shift only');
 let p=withRack('C3-3',40);const t=forkTake(p,'C3-3');assert(!t.error,t.error);assert.equal(forkLoadOf(t.state),40,'the whole bay on the forks');assert.equal(racksOf(t.state)['C3-3'],undefined,'the bay is empty');
 assert.match(forkTake(t.state,'C3-3').error,/already loaded/);assert.match(forkTake(p,'A9-1').error,/no such rack/);assert.match(forkTake({...shifted},'A1-1').error,/empty/);
 const put=forkPut(t.state,'A2-2');assert.equal(racksOf(put.state)['A2-2'],40);assert.equal(forkLoadOf(put.state),0);assert.equal(put.filled,true,'a full bay');
 const half=forkPut(forkTake(withRack('E8-1',30),'E8-1').state,'E8-1');assert.equal(racksOf(half.state)['E8-1'],30,'it goes back where it came from');
 // a bay with room takes some; the rest stays on the forks
 let q=forkTake(withRack('B1-1',30),'B1-1').state;q={...q,companies:{...q.companies,ridgeline:{...q.companies.ridgeline,racks:{'A5-3':25}}}};const part=forkPut(q,'A5-3');assert.equal(racksOf(part.state)['A5-3'],40);assert.equal(forkLoadOf(part.state),15,'15 left on the forks');
 assert.match(forkPut(shifted,'A1-1').error,/empty/);assert.match(forkPut(put.state,'A2-2').error,/empty/);
 // the pile, and planks leaving the forks for a pallet
 const stocked=addStock(shifted,{planks:100}),pile=forkTakePile(stocked);assert.equal(forkLoadOf(pile.state),40);assert.equal(stockOf(pile.state).planks,60);assert.equal(forkLoadOf(forkUsed(pile.state,12)),28);assert.equal(forkLoadOf(forkUsed(pile.state,99)),0);
 assert.match(forkTakePile(shifted).error,/empty/);
 // saved: normalised
 assert.equal(normalizeCompanies({ridgeline:{forkload:25}}).ridgeline.forkload,25);assert.equal(normalizeCompanies({ridgeline:{forkload:900,racks:{}}}).ridgeline.forkload,40);assert.equal(normalizeCompanies({ridgeline:{forkload:-3,name:'x'}}).ridgeline.forkload,undefined)}
// the model
{const m=FORKLIFT;assert(m.triangles<16000,'about 14,000 triangles: '+m.triangles);assert.deepEqual(Object.keys(m.parts).sort(),['body','carriage','mast']);
 assert(m.bounds.min[1]===0&&m.bounds.max[1]>2&&m.bounds.max[1]<2.4,'about 2.2 m tall, standing on the floor: '+JSON.stringify(m.bounds));assert(Math.abs(m.bounds.max[2]-F.TIP)<.05&&Math.abs(m.bounds.min[2]+F.TIP)<.05,'the tine tips are at TIP: '+JSON.stringify(m.bounds));
 assert(m.bounds.max[0]<.6&&m.bounds.min[0]>-.6,'about 1.1 m wide');assert(Math.abs(m.tineTop-F.LIFT_MIN)<.02,'the tines rest at the minimum lift: '+m.tineTop)}
console.log('PASS forklift.mjs: arcade drive (3 m/s, slower in reverse, about 4 m turning circle, no spinning on the spot, stops at walls), forks 0.2 to 3.05 m reaching all three levels, bay, staging pallet and pile found from the tine tips, pallet rules on the company racks (a whole bay at a time, saved), and the converted 14,000-triangle model.');
