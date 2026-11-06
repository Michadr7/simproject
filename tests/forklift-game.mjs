import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {ticketsOf} from '../dist/tickets.js';
import {racksOf,forkLoadOf,stockOf,addStock} from '../dist/forest.js';
import {bayX,FACE_ROWS,WAREHOUSE_PILE,WAREHOUSE_STAGING} from '../dist/warehouse-layout.js';
import {BAY,TIP} from '../dist/forklift.js';
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');

// The forklift in the game (0.35 step 5, DESIGN 4.16 D): in its bay in the warehouse; E at it to drive (Yard hand on shift), W and R move it and raise the forks, and at a bay, a staging pallet or the delivery pile
// E lifts or sets down a whole pallet. Nothing here drives it round the hall by key: the pure drive is tested in forklift.mjs, so the test places it.
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3,wait=ms=>new Promise(r=>setTimeout(r,ms));
const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
try{
 const {GameState,pump,send,ids,scene,win}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent,press=(code='KeyE',s=1)=>{send('keydown',code);send('keyup',code);pump(s)};
 const fork=()=>win.__city.fork,load=()=>forkLoadOf(p()),object=name=>scene().getObjectByName(name),racks=()=>racksOf(p());
 // a Yard hand on shift, a bay of planks on level 2, a taken pickup order, a delivery pile
 GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<4)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
 GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:700}};GameState.progress=clockIn(p(),'ridgeline').state;
 const order={id:1,customer:'Greenway Builders',kind:'pickup',planks:12,issuedAt:(DAY-1)*1440+420,dueAt:(DAY-1)*1440+1080,status:'taken',staged:0,takenBy:'me'};
 GameState.progress=addStock({...p(),companies:{...p().companies,ridgeline:{...p().companies.ridgeline,racks:{'B4-2':40},tickets:{nextId:2,day:DAY,released:[0,1,2,3],list:[order]}}}},{planks:100});
 pump(1.2);pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),prompt());press('KeyE',2.5);await wait(300);pump(.8);
 assert(fork().state.x===BAY.x&&fork().state.z===BAY.z,'the forklift stands in its bay');assert(object('forklift'),'it is drawn in the warehouse');assert.equal(object('forklift-load').visible,false,'nothing on the forks');
 // E at it
 me().x=BAY.x;me().z=BAY.z+2.3;pump(.6);assert.match(prompt(),/Drive the forklift/);press('KeyE',.6);assert.equal(fork().on,true,'you are on it');
 assert(Math.hypot(me().x-fork().state.x,me().z-fork().state.z)<.5,'you ride at its seat');
 // W drives it east, R raises the forks
 const x0=fork().state.x;send('keydown','KeyW');send('keydown','KeyR');pump(1);send('keyup','KeyW');send('keyup','KeyR');pump(1);
 assert(fork().state.x>x0+1,'it drove: '+fork().state.x);assert(fork().state.lift>.7,'the forks rose: '+fork().state.lift);assert(object('forklift-carriage').position.y>.4,'and the drawing follows');assert(object('forklift-mast').scale.y>=1);
 // level two of B4: take the pallet
 fork().state={x:bayX(4),z:FACE_ROWS.B.z-1-TIP,yaw:0,speed:0,lift:1.5};pump(.6);assert.match(prompt(),/Lift the pallet from rack B4-2 · 40 planks/,prompt());press('KeyE',.6);
 assert.equal(load(),40);assert.equal(racks()['B4-2'],undefined);assert.equal(object('forklift-load').visible,true,'a pallet on the forks');
 // the staging pallet of the order: twelve planks go on, the rest stays on the forks
 fork().state={x:WAREHOUSE_STAGING[0].x,z:WAREHOUSE_STAGING[0].z+1+TIP,yaw:Math.PI,speed:0,lift:.2};pump(.6);assert.match(prompt(),/Stage the pallet on order #1 · 0 \/ 12/,prompt());press('KeyE',.6);
 assert.equal(ticketsOf(p().companies.ridgeline).list[0].status,'staged','the order is staged');assert.equal(load(),28,'28 planks still on the forks');
 // the top shelf of the back wall: set the rest down
 fork().state={x:bayX(1),z:FACE_ROWS.A.z+1+TIP,yaw:Math.PI,speed:0,lift:2.85};pump(.6);assert.match(prompt(),/Set the pallet in rack A1-3 · 0 \/ 40/,prompt());press('KeyE',.6);
 assert.equal(racks()['A1-3'],28);assert.equal(load(),0);assert.equal(object('forklift-load').visible,false);
 // the delivery pile feeds a whole pallet
 fork().state={x:WAREHOUSE_PILE.x,z:WAREHOUSE_PILE.z+1+TIP,yaw:Math.PI,speed:0,lift:.2};pump(.6);assert.match(prompt(),/Lift planks from the delivery pile · 100/,prompt());press('KeyE',.6);
 assert.equal(load(),40);assert.equal(stockOf(p()).planks,60);
 // nothing to do here: E gets you off, beside it
 fork().state={x:BAY.x,z:BAY.z,yaw:BAY.yaw,speed:0,lift:.2};pump(.6);assert.match(prompt(),/Get off the forklift/,prompt());press('KeyE',.6);assert.equal(fork().on,false);
 assert(Math.hypot(me().x-BAY.x,me().z-BAY.z)>1,'you stand beside it, not in it: '+me().x+','+me().z);
 // the load is saved with the company
 assert.equal(p().companies.ridgeline.forkload,40);
 // off shift: it will not start
 GameState.progress={...p(),shift:null};me().x=BAY.x;me().z=BAY.z+2.3;pump(.6);press('KeyE',.6);assert.equal(fork().on,false,'not without a shift');
 console.log('PASS forklift-game.mjs: the forklift stands in its bay, E drives it (Yard hand on shift), W and R move it and the forks, and at a rack bay, a staging pallet and the delivery pile E lifts or sets down a whole pallet, drawn on the forks and saved; E gets you off beside it.');
}finally{g.done?.();g.close?.()}
