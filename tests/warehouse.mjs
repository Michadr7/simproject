import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {hire} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {RACK_IDS,RACK_CAP,racksOf,rackPlanks,stackPlanks,takeFromRack} from '../dist/forest.js';
import {RACK_SLOTS,boardAt} from '../dist/warehouse.js';
import {HALL,FACE_ROWS,UNITS,BAYS,LEVELS,bayX,slotById,reachableByHand,WAREHOUSE_STAGING,WAREHOUSE_TABLE,WAREHOUSE_INTERIOR} from '../dist/warehouse-layout.js';
import {trackerItems} from '../dist/tracker.js';

// The warehouse, step 2 (DESIGN 4.16 and I): pallets in the racks saved on the company, stacks taken from a pallet and stacked bay by bay, a full bay counts as a rack once per shift (the Stack task),
// and the room in the game: the person door, the racks drawn as boards, the prompts.
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3;
assert(W&&W.id==='ridgeline-warehouse','the map has the warehouse');assert.deepEqual(RACK_SLOTS.map(s=>s.id),RACK_IDS,'a drawn cell for every rack id');
assert.equal(RACK_IDS.length,5*BAYS*LEVELS,'120 shelf cells: five faces, eight bays, three levels');assert(RACK_IDS.includes('B4-2')&&!RACK_IDS.includes('F1-1'));
assert(HALL.halfW*2*HALL.halfD*2>=3*14*10*2,'the hall is far bigger than the first room (36 x 24 m against 14 x 10)');
{ // the plan: aisles wide enough for a forklift (3.5 m to turn), everything inside the hall, the front-zone things clear of the shelving
 const edges=UNITS.map(u=>({lo:u.z-u.depth/2,hi:u.z+u.depth/2})).sort((a,b)=>a.lo-b.lo);
 for(let i=1;i<edges.length;i++)assert(edges[i].lo-edges[i-1].hi>=3.9,'aisle '+i+' is '+(edges[i].lo-edges[i-1].hi).toFixed(2)+' m');
 assert(WAREHOUSE_STAGING[0].z-edges[2].hi>=3.9,'the aisle in front of the last unit');assert(edges[0].lo>=-HALL.halfD,'the back unit is inside the wall');
 for(const f of Object.values(FACE_ROWS))assert(Math.abs(f.stand-f.z)>=1.3&&Math.abs(f.stand-f.z)<=2.3,'you stand 1.3 to 2.3 m from the shelf face');
 assert.equal(bayX(1),-6.3);assert.equal(bayX(BAYS),6.3);assert(slotById('A1-3').y>2.5&&slotById('A1-1').y<.2,'three levels high');
 assert(reachableByHand('A1-1')&&!reachableByHand('A1-2')&&!reachableByHand('A1-3'),'by hand only the floor level');
 for(const p of [WAREHOUSE_TABLE,...WAREHOUSE_STAGING])assert(Math.abs(p.x)<HALL.halfW-1&&p.z>edges[2].hi+3&&p.z<HALL.halfD-1,'the front-zone things stand clear of the shelving and the wall');
 assert(WAREHOUSE_INTERIOR.exitDoor.near.z<WAREHOUSE_INTERIOR.exitDoor.trigger.z&&WAREHOUSE_INTERIOR.entry.z<WAREHOUSE_INTERIOR.exitDoor.z,'the exit door opens before its trigger line');
 assert.deepEqual(W.interior.exitDoor,WAREHOUSE_INTERIOR.exitDoor,'the map uses the hall\'s interior spec');
}
assert(MAP.employers[0].sites.some(s=>s.room==='ridgeline-warehouse'),'it is one of the company\'s sites');

// pure rules ----------------------------------------------------------------------------------------------------------------
const base=hire(freshProgress(),'ridgeline').state,shifted=clockIn({...base,housing:{...base.housing,day:DAY},routine:{...base.routine,minutes:600}},'ridgeline').state;
// a Yard hand on shift with the Stack task and pallets in the racks ({cell: planks}: read as pallets, as a save from before pallets would be)
const racked=(map,extra={})=>({...shifted,shift:{...shifted.shift,tasks:[{kind:'stack',piece:'racks',target:1,done:0}]},companies:{...shifted.companies,ridgeline:{...shifted.companies.ridgeline,racks:map}},...extra});
assert(/Too high/.test(stackPlanks({...racked({}),carry:{kind:'planks',count:4}},'A1-2').error),'an upper shelf cannot be reached by hand');assert(/Clock in/.test(takeFromRack({...base,companies:{ridgeline:{racks:{'A1-1':9}}}},'A1-1').error),'off shift nothing moves');assert(/is empty/.test(takeFromRack(shifted,'A1-1').error));assert(/hands are full/.test(takeFromRack({...racked({'A1-1':9}),carry:{kind:'log'}},'A1-1').error));
{let p=racked({'D1-1':10});let r=takeFromRack(p,'D1-1');assert(!r.error);p=r.state;assert.deepEqual(p.carry,{kind:'planks',count:4},'a stack of four');assert.equal(racksOf(p)['D1-1'],6,'from the pallet in the rack');
 assert(/Carry planks/.test(stackPlanks(racked({}),'A1-1').error),'empty hands cannot stack');assert(/no such rack/.test(stackPlanks(p,'Z9').error));
 r=stackPlanks(p,'A1-1');p=r.state;assert.equal(racksOf(p)['A1-1'],4);assert.equal(p.carry,null);assert.equal(r.filled,false);assert(/4 \/ 40/.test(r.message));
 // fill a bay to 40: it counts as a rack once, pays, and finishes the task
 let q=racked({'D1-1':40,'B2-1':4});for(let i=0;i<9;i++){q=takeFromRack(q,'D1-1').state;const s=stackPlanks(q,'B2-1');q=s.state;if(i<8)assert.equal(s.filled,false);else{assert.equal(s.filled,true);assert(/Task done/.test(s.message),s.message)}}
 assert.equal(racksOf(q)['B2-1'],RACK_CAP);assert.equal(q.shift.pieces.racks,1,'one rack stacked');assert.equal(q.shift.tasks[0].done,1);assert.equal(racksOf(q)['D1-1'],4,'thirty-six planks left the other pallet');
 q={...q,carry:{kind:'planks',count:4}};assert(/is full/.test(stackPlanks(q,'B2-1').error),'a full bay takes no more');
 // taking a stack out and putting it back fills the cell again but pays nothing more this shift (it cannot be farmed)
 {let w=takeFromRack({...q,carry:null},'B2-1').state;assert.equal(racksOf(w)['B2-1'],36);const back=stackPlanks(w,'B2-1');assert.equal(back.filled,true);assert.equal(back.state.shift.pieces.racks,1,'still one piece: no second pay');assert(!/\$5/.test(back.message),back.message);assert.deepEqual(back.state.shift.stacked,['B2-1'])}
 // a stack that does not fit in the bay: the rest stays in the hands
 let z=racked({'C1-1':38},{carry:{kind:'planks',count:4}});const part=stackPlanks(z,'C1-1');assert.equal(part.put,2);assert.deepEqual(part.state.carry,{kind:'planks',count:2});assert.equal(racksOf(part.state)['C1-1'],40);assert.equal(part.state.shift.pieces.racks,1);
 assert.equal(rackPlanks(q),44);
 // saved: pallets survive normalisation (the old counts migrate); junk and absurd numbers do not
 const saved=normalizeProgress({careers:{ridgeline:{hired:true,rank:4}},companies:{ridgeline:{racks:{'A1-1':12,'B9-1':3,'A2-1':-1,'E8-3':9999,'F1-1':5,'A1':7}}}});assert.deepEqual(racksOf(saved),{'A1-1':12,'E8-3':40},'only real cells, clamped to the cap');assert.equal(saved.companies.ridgeline.racks,undefined,'the old field is gone');assert.equal(saved.companies.ridgeline.pallets.length,2);
 assert.equal(normalizeProgress({companies:{ridgeline:{racks:{'A1-1':0}}}}).companies.ridgeline,undefined,'empty racks save nothing')}
// the racks are drawn board by board
assert.deepEqual(boardAt(0),{x:-.36,y:.044},'the first board');assert(boardAt(39).y>boardAt(0).y+.8,'forty boards stand about a metre high');
// the tracker points at the warehouse for the stack task
{const t=trackerItems({...racked({})},{x:0,z:0}).find(i=>i.id==='task:stack');assert.deepEqual(t.pos,{x:W.door.out.x,z:W.door.out.z});assert.equal(t.place,'Warehouse')}
// inside the warehouse (B3) the arrow points at places in the room, in its own coordinates
{const inRoom=(p,room,from={x:0,z:5})=>trackerItems(p,from,room).find(i=>i.id==='task:stack');
 const empty=inRoom({...racked({})},{carryPlanks:false});assert.deepEqual([empty.pos,empty.place],[{x:WAREHOUSE_TABLE.x,z:WAREHOUSE_TABLE.z},'Order table'],'nothing in the racks: the order table');
 const stocked=racked({'B4-1':12,'E2-1':30,'A1-2':40}),take=inRoom(stocked,{carryPlanks:false});assert.equal(take.place,'Rack E2-1','empty-handed: the nearest hand-level rack that holds planks (upper shelves are for the forklift)');
 assert.deepEqual(take.pos,slotById('E2-1').stand);
 const put=inRoom(racked({'E2-1':40,'B4-1':12}),{carryPlanks:true},{x:0,z:3.9});assert(put.place.startsWith('Rack ')&&put.place!=='Rack E2-1','a full rack is skipped: '+put.place);
 const outdoors=trackerItems({...racked({}),shift:{...racked({}).shift,tasks:[{kind:'fell',piece:'trees',target:3,done:0}]}},{x:0,z:0},{carryPlanks:false})[0];assert.deepEqual([outdoors.pos,outdoors.place],[{x:0,z:11.4},'Front door'],'an outdoor task points at the front door')}

// in the packaged game -------------------------------------------------------------------------------------------------------
const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
try{
 const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent;
 const press=(code='KeyE',seconds=1.5)=>{send('keydown',code);send('keyup',code);pump(seconds)};
 const room=()=>scene().getObjectByName('warehouse-interior'),boards=()=>({count:room().children.filter(c=>/^warehouse-boards/.test(c.name)).reduce((n,c)=>n+c.count,0)}) // the planks are drawn per shelving unit (so a unit fades with its planks) ;
 const at=minutes=>{GameState.progress={...p(),routine:{...p().routine,minutes}}};
 assert.equal(room().visible,false,'the room is not drawn while you are outside');assert(scene().getObjectByName('warehouse-doorway'),'the person door is drawn on the wall');
 at(330);pump(.5);assert(/closed/i.test(prompt()),'closed at 5:30 AM: '+prompt());press();assert.equal(room().visible,false);
 at(540);pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),'the door offers to go in: '+prompt());
 press('KeyE',2.5);assert.equal(room().visible,true,'inside');assert(Math.abs(me().x)<2&&me().z>9,'just inside the door: '+me().x+','+me().z);assert(/WAREHOUSE/.test(ids.get('locationName').textContent),ids.get('locationName').textContent);
 // not on shift: planks on a pallet in the racks are drawn on a wooden pallet with a tag above that says what it holds
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...(p().companies?.ridgeline||{}),racks:{'E8-1':12}}}};me().x=6.3;me().z=5;pump(.6);assert.equal(boards().count,12,'the 12 planks of the pallet are drawn');
 assert.equal(room().getObjectByName('warehouse-pallets').count,1,'on a wooden pallet');assert.equal(room().getObjectByName('pallet-tags').count,1,'with one tag above it');
 me().x=-16;me().z=-8;pump(.6);assert.equal(room().getObjectByName('pallet-tags').count,0,'no tag from across the hall (the 10 m range)');
 // on shift: take a stack from the pallet, put it in bay A2
 GameState.progress={...hire(p(),'ridgeline').state};GameState.progress={...clockIn({...p(),routine:{...p().routine,minutes:540}},'ridgeline').state};
 GameState.progress={...p(),shift:{...p().shift,tasks:[{kind:'stack',piece:'racks',target:1,done:0}]}};pump(.6);
 const E8=RACK_SLOTS.find(s=>s.id==='E8-1');me().x=E8.stand.x;me().z=E8.stand.z;pump(.6);assert(/Take a stack from rack E8-1 · 12/.test(prompt()),'the pallet offers a stack: '+prompt());press('KeyE',1.2);assert.deepEqual(p().carry,{kind:'planks',count:4});assert.equal(racksOf(p())['E8-1'],8);
 const A2=RACK_SLOTS.find(s=>s.id==='A2-1');me().x=A2.stand.x;me().z=A2.stand.z;pump(.6);assert(/Stack the planks in rack A2-1 · 0 \/ 40/.test(prompt()),'a bay offers it: '+prompt());
 press('KeyE',1.2);assert.equal(racksOf(p())['A2-1'],4);assert.equal(p().carry,null);pump(.6);assert.equal(boards().count,4+8,'four boards in the new pallet, eight on the old');assert.equal(room().getObjectByName('warehouse-pallets').count,2,'two pallets now');
 // fill a bay: nine stacks make forty
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...p().companies.ridgeline,pallets:undefined,racks:{'A2-1':36,'E8-1':40}}}}; // seeded as old counts (the pallets are replaced)
 me().x=E8.stand.x;me().z=E8.stand.z;pump(.6);press('KeyE',1.2);me().x=A2.stand.x;me().z=A2.stand.z;pump(.6);press('KeyE',1.2);
 assert.equal(racksOf(p())['A2-1'],RACK_CAP,'the bay is full');assert.equal(p().shift.pieces.racks,1,'and counted as a rack');assert(/Task done|full/.test(ids.get('jobToast').textContent),ids.get('jobToast').textContent);
 // the door out: the double doors are opened by hand
 me().x=0;me().z=10.9;pump(.4);assert(/Open the doors/.test(prompt()));press('KeyE',1);me().x=0;me().z=12.4;pump(3);assert.equal(room().visible,false,'outside again');assert(Math.abs(me().x-W.door.out.x)<1.5&&Math.abs(me().z-W.door.out.z)<1.5,'at the person door: '+me().x+','+me().z);
 console.log('Warehouse: pallets in the racks saved on the company, stacks taken from a pallet and stacked bay by bay, a full bay counts as a rack once a shift, the leftover stays in the hands, the racks drawn board by board on wooden pallets with a tag above each, the person door and the room work in the game, and the tracker points at the warehouse.');
}finally{g.close?.()}
