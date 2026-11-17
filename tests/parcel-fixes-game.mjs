// Audit fixes in the packaged game (notes/eval/reviews/gemini-audit-0.35.17.md #3, #4, #7): a tow called from the seat gives the stowed parcel back into your hands (not left on the towed truck);
// a parcel left on a far truck ticks off no stop (in your hands it does); a gig that times out with its parcel on a bed is saved WITHOUT that parcel (reconcile before persist).
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {doorPoint,CLASSES} from '../dist/vehicle.js';
import {loadPoints,slotPositions} from '../dist/cargo.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),live=(g,id)=>g.ids.get('phoneCall').children.flatMap(c=>c.children||[]).find(e=>e.id===id)||null,last=(g,id)=>g.created.filter(e=>e.id===id).at(-1);
const car=(x,z,yaw,extra={})=>({uid:'v1',model:'shortbed',colour:'#c23b2e',x,z,yaw,fuelMgal:10000,...extra});
const PIECE={k:'parcel',g:7,m:'prop.carton-small'},HANDS={kind:'parcel',gig:7,model:'prop.carton-small'};
const gig=(extra={})=>({nextId:8,active:{type:'parcel',client:'c1',id:7,places:[{x:0,z:3,room:'street'}],visited:[false],...extra}});
const boot=async(vehicle,pos,extra={})=>{const g=await bootGame({position:pos,progress:{cash:30000,completed:5,routine:{minutes:480},vehicles:[vehicle],orders:{nextVehicle:2},...extra}});const el=g.ids.get('jobToast');let tc='';g.seen=[];Object.defineProperty(el,'textContent',{get:()=>tc,set:v=>{tc=v;g.seen.push(String(v))},configurable:true});return g};
const saved=g=>JSON.parse(g.store.get('edenridge.profile.v1')).progress,hasPiece=c=>(c||[]).some(q=>q.k==='parcel');
const report=[];

// #4: in the seat with the parcel stowed, call a tow: you stand at the shop with the parcel in your hands; the towed truck's bed has no parcel
{const V={x:-20,z:30,yaw:0},g=await boot(car(V.x,V.z,V.yaw),{x:V.x+6,z:V.z},{gigs:gig(),carry:HANDS});
 try{const {pump,send,ids,GameState}=g,p=()=>GameState.progress;pump(1.5);assert.deepEqual(p().carry,HANDS,'the parcel is in the hands');
  const door=doorPoint(V,CLASSES.shortbed);Object.assign(GameState.me.position,{x:door.x,z:door.z});pump(1);send('keydown','KeyE');send('keyup','KeyE');pump(3);assert.equal(ids.get('vehiclePanel').dataset.state,'driving','in the vehicle');
  assert.equal(p().carry,null,'stowed: the hands are free');assert(hasPiece(saved(g).vehicles.find(v=>v.uid==='v1').cargo),'and the parcel rides on the bed');
  ids.get('phoneButton').click();ids.get('phoneApp-call').click();last(g,'call-tow').click();await sleep(2300);live(g,'call-tow-v1').onclick({preventDefault(){}});ids.get('phoneClose').click();pump(1);
  assert.notEqual(ids.get('vehiclePanel').dataset.state,'driving','towed: you are out');
  assert.deepEqual(p().carry,HANDS,'the parcel came back into your hands (it was left on the towed truck)');assert(g.seen.includes('You take the parcel back.'),'and the toast says so');
  const sv=saved(g);assert(!hasPiece(sv.vehicles.find(v=>v.uid==='v1').cargo),'the towed truck has no parcel in the save');assert.equal(sv.carry?.kind,'parcel','the save has it in the hands');assert.equal(sv.gigs.active.id,7,'the gig goes on');report.push('tow');
 }finally{await g.done()}}

// #3: the parcel on a truck 30 m away: standing at the door ticks nothing off; with the parcel in the hands it does
{const g=await boot(car(-20,30,0,{cargo:[PIECE]}),{x:0,z:3},{gigs:gig()});
 try{const {pump,GameState}=g,p=()=>GameState.progress,me=GameState.me.position;pump(1);assert.equal(p().carry,null,'on the bed, not in the hands');
  me.x=0;me.z=3;pump(1);assert.equal(p().gigs.active.visited[0],false,'the parcel is on the far truck: the door does not tick off');assert.notEqual(p().activeJob?.stage,'return');
  GameState.progress={...p(),carry:HANDS};me.x=0;me.z=3;pump(1);assert.equal(p().gigs.active.visited[0],true,'in the hands: it ticks off');assert.equal(p().activeJob.stage,'return');report.push('far bed');
 }finally{await g.done()}}

// #7: a rush gig times out while its parcel lies on a bed: the vehicle list persist() writes into the game state at that moment has no dead parcel on the truck
// (the localStorage copy was already clean before the fix, because saveProfile normalises the save and drops orphan parcels; the live GameState.progress.vehicles kept the dead piece until the next save)
{const g=await boot(car(-20,30,0,{cargo:[PIECE]}),{x:0,z:3},{gigs:gig({type:'rush'})});
 try{const {pump,GameState}=g,p=()=>GameState.progress;pump(1);assert(p().gigs.active,'the rush gig runs');assert(hasPiece(p().vehicles[0].cargo),'its parcel is on the truck');
  p().gigs.active.dueAt=1;pump(.04); // one frame: the hard limit has passed
  assert.equal(p().gigs.active,null,'the rush gig ran out');assert(!hasPiece(p().vehicles.find(v=>v.uid==='v1').cargo),'the game state has no dead parcel on the truck: '+JSON.stringify(p().vehicles[0].cargo));
  const sv=saved(g);assert.equal(sv.gigs.active,null);assert(!hasPiece(sv.vehicles.find(v=>v.uid==='v1').cargo),'nor the save');report.push('timeout');
 }finally{await g.done()}}
// #8: the parcel lies on a bed (timber grid); a crate goes on after it, the bed switches to the crate grid, and the drawn parcel moves to its new cell
{const V={x:-20,z:30,yaw:0},rear=loadPoints('shortbed').find(q=>q.side==='rear'),behind={x:V.x+rear.x,z:V.z+rear.z},g=await boot(car(V.x,V.z,V.yaw,{cargo:[PIECE]}),behind,{gigs:gig()});
 try{const {pump,send,GameState,scene}=g,p=()=>GameState.progress,me=GameState.me.position,box=()=>scene().getObjectByName('gig-parcel'),press=()=>{send('keydown','KeyE');send('keyup','KeyE');pump(1.5)};
  pump(1);const before=slotPositions('shortbed',[PIECE])[0];assert(Math.abs(box().position.x-before.x)<1e-6&&Math.abs(box().position.z-before.z)<1e-6,'the parcel is drawn in its cell');
  GameState.progress={...p(),carry:{kind:'crate'}};me.x=behind.x;me.z=behind.z;pump(.5);for(let i=0;i<3&&p().carry;i++)press();
  assert.equal(p().carry,null,'the crate went on the bed');const cargo=p().vehicles.find(v=>v.uid==='v1').cargo;assert.deepEqual(cargo.map(q=>q.k),['parcel','crate']);
  const now=slotPositions('shortbed',cargo)[0];assert(Math.abs(now.x-before.x)>.05,'the cell moved (crate grid)');pump(.2);
  assert(Math.abs(box().position.x-now.x)<1e-6&&Math.abs(box().position.z-now.z)<1e-6,`the drawn parcel followed its cell (${box().position.x.toFixed(2)}, ${box().position.z.toFixed(2)} vs ${now.x}, ${now.z})`);report.push('slot shift');
 }finally{await g.done()}}
console.log('PASS parcel-fixes-game.mjs: '+report.join(', ')+': a tow from the seat hands the stowed parcel back, a parcel on a far truck ticks no stop (in the hands it does), a timed-out gig leaves no dead parcel on the bed in the game state or the save, the drawn parcel follows its cell when a crate goes on after it.');
