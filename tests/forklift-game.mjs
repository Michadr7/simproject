import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {ticketsOf} from '../dist/tickets.js';
import {racksOf,forkLoadOf} from '../dist/forest.js';
import {floorPallets,palletsOf} from '../dist/pallets.js';
import {bayX,FACE_ROWS,WAREHOUSE_STAGING} from '../dist/warehouse-layout.js';
import {BAY,TIP} from '../dist/forklift.js';
import {CARRY_Z,levelBase} from '../dist/fork-pallets.js';
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');

// The forklift in the game (0.35 step 5 and DESIGN 4.16 I step 2): E at it to drive (Yard hand on shift); W S A D drive, R and F move the forks (Shift: slowly). There is no E to lift or set a pallet down:
// the tines go into a pallet's pocket and raising them lifts it; lowering a carried pallet onto a free shelf cell, an order's square or the floor sets it down. The pure rules are fork-pallets.mjs; here
// the test places the forklift in front of things (driving round the hall by key is forklift.mjs) and works the forks with the keys.
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3,wait=ms=>new Promise(r=>setTimeout(r,ms));
const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
try{
 const {GameState,pump,send,ids,scene,win}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent,press=(code='KeyE',s=1)=>{send('keydown',code);send('keyup',code);pump(s)};
 const hold=(code,seconds)=>{send('keydown',code);pump(seconds);send('keyup',code);pump(.1)};
 const fork=()=>win.__city.fork,load=()=>forkLoadOf(p()),object=name=>scene().getObjectByName(name),racks=()=>racksOf(p()),note=()=>ids.get('vpNote').textContent;
 const forkTagShown=()=>win.__city.tagsShown?.().find(t=>t.y>fork().state.lift&&Math.abs(t.x-fork().state.x)<2)?.count;
 const place=(x,z,yaw,lift)=>{fork().state={x,z,yaw,speed:0,lift,steer:0,roll:0};pump(.3)};
 // a Yard hand on shift, a pallet of 40 on level two of B4, a taken pickup order for 12 planks
 GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<4)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
 GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:700}};GameState.progress=clockIn(p(),'ridgeline').state;
 const order={id:1,customer:'Greenway Builders',kind:'pickup',planks:12,issuedAt:(DAY-1)*1440+420,dueAt:(DAY-1)*1440+1080,status:'taken',staged:0,takenBy:'me'};
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...p().companies.ridgeline,racks:{'B4-2':40},tickets:{nextId:2,day:DAY,released:[0,1,2,3],list:[order]}}}};
 pump(1.2);pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),prompt());press('KeyE',2.5);await wait(300);pump(.8);
 assert(fork().state.x===BAY.x&&fork().state.z===BAY.z,'the forklift stands in its bay');assert(object('forklift'),'it is drawn in the warehouse');assert.equal(object('forklift-load').visible,false,'nothing on the forks');
 // E at it
 me().x=BAY.x;me().z=BAY.z+2.3;pump(.6);assert.match(prompt(),/Drive the forklift/);press('KeyE',.6);assert.equal(fork().on,true,'you are on it');
 assert(Math.hypot(me().x-fork().state.x,me().z-fork().state.z)<.8,'you ride at its seat (on the cushion, 0.62 m behind the middle)');
 {const pl=object('player');assert.equal(pl.visible,true,'you are seen on the forklift (an open cab)');assert(pl.position.y>.15&&pl.position.y<.5,'sitting on the seat, not standing on the floor: '+pl.position.y.toFixed(2));assert.match(ids.get('vpName').textContent,/Forklift/,'the vehicle panel names the forklift');assert.equal(ids.get('vpKeys').children.length,5,'and lists its controls')}
 // W drives it east, R raises the forks
 const x0=fork().state.x;send('keydown','KeyW');send('keydown','KeyR');pump(1);send('keyup','KeyW');send('keyup','KeyR');pump(1);
 assert(fork().state.x>x0+.8,'it drove: '+fork().state.x);assert(Math.abs(object('forklift-wheelFL').rotation.x)>1,'the wheels turned: '+object('forklift-wheelFL').rotation.x.toFixed(2));assert(fork().state.lift>.5,'the forks rose: '+fork().state.lift);assert(object('forklift-carriage').position.y>.25,'and the drawing follows');assert(object('forklift-mast').scale.y>=1);
 assert.match(prompt(),/Get off the forklift|Stop to get off/,'E only gets you off: '+prompt());

 // the shelf will not take the tines between its levels (in a column with no pallet to level the forks to): the forklift stops at its face
 const row=FACE_ROWS.B.z,cx=bayX(4),mouth=row-.62; // face B looks toward -z: the forklift comes from the aisle at lower z, facing +z (yaw 0)
 place(bayX(6),-6.8-TIP,0,1.4);hold('KeyW',1.5);assert(fork().state.z+TIP<-6.55,'stopped at the shelf: the tines are at '+(fork().state.z+TIP).toFixed(2)+' (the shelf face is -6.575)');
 // in line, level two, but too high for the pocket
 place(cx,mouth+.6-TIP,0,1.5+.9);assert.match(note(),/too high/,'the panel says why: '+note());assert.equal(load(),0);
 // closer to the pocket height the forks level themselves (the assist): 40 cm up they glide into the pocket without a key
 place(cx,mouth-.5-TIP,0,1.5+.4);pump(1.2);assert(fork().state.lift<1.5+.19&&fork().state.lift>1.5+.02,'auto-level: the forks settled at '+fork().state.lift.toFixed(2));
 // the tines at pocket height: the panel says to raise
 place(cx,mouth+.6-TIP,0,1.5+.1);assert.match(note(),/Raise the forks to lift the pallet/,note());assert.equal(load(),0,'not lifted until the forks are raised');
 // raise: the pallet comes off the shelf and rides on the forks, with its tag
 hold('KeyR',.25);assert.equal(load(),40,'the pallet is on the forks');assert.equal(racks()['B4-2'],undefined,'and the cell is empty');assert.equal(object('forklift-load').visible,true,'drawn on the forks');
 assert(p().companies.ridgeline.pallets.some(q=>q.at.fork&&q.count===40),'saved as the pallet on the forks');assert.equal(p().companies.ridgeline.racks,undefined);assert.equal(forkTagShown(),40,'with a tag that says 40');
 assert.match(ids.get('vpFuel').textContent,/40 planks/);assert.match(toastText(),/Lifted a pallet · 40 planks/);
 // the carried pallet is a real pallet with its planks board by board (not a block), and the guide marks where to take it
 assert.equal(object('forklift-load-planks').count,40,'forty boards on the forks');assert(object('forklift-load-pallet'),'on a wooden pallet');
 pump(.3);assert.equal(object('fork-beacon').visible,true,'a beam over the order square it is wanted at');assert.equal(object('fork-ghost').visible,true,'and a ghost outline of where it will rest');assert.match(note(),/Order #1 needs 12 more planks: take this pallet to square S1/,'the panel says where to take it: '+note());
 function toastText(){return ids.get('jobToast').textContent}
 // the top shelf of the back wall: line up with A1-3 (face A looks +z, so the forklift comes from the aisle and faces -z) and lower the pallet onto its deck
 const A=FACE_ROWS.A.z,ax=bayX(1);place(ax,A+CARRY_Z,Math.PI,levelBase(3)+.09+.2);assert.match(note(),/Lower the pallet into rack A1-3/,note());
 hold('KeyF',.6);assert.equal(racks()['A1-3'],40,'set in the cell by lowering it onto the deck');assert.equal(load(),0);assert.equal(object('forklift-load').visible,false);assert.match(toastText(),/Set the pallet in rack A1-3/);
 // take it down again from the same shelf: the tines 60 cm into its pocket, level three, then raise
 place(ax,A+.62-.6+TIP,Math.PI,2.85+.1);assert.match(note(),/Raise the forks to lift the pallet/,note());hold('KeyR',.25);assert.equal(load(),40,'lifted again from the top shelf');assert.equal(racks()['A1-3'],undefined);
 // the order's staging square (D1): lower the pallet onto it and the order takes its 12 planks; the other 28 are split off at once and go back to the racks (nothing disappears)
 const sq=WAREHOUSE_STAGING[0],sumRacks=()=>Object.values(racks()).reduce((s,n)=>s+n,0);place(sq.x,sq.z-CARRY_Z,0,.6);hold('KeyF',1.2);
 assert.equal(ticketsOf(p().companies.ridgeline).list[0].status,'staged','the order is staged');assert.equal(load(),0,'the forks are empty: the pallet became the order\'s');assert.equal(sumRacks(),28,'the 28 spare planks went back to the racks');
 {const op=palletsOf(p().companies.ridgeline).find(q=>q.order===1);assert.deepEqual([op.count,op.at.staging],[12,0],'an order pallet of 12 stands on S1');assert.equal(ticketsOf(p().companies.ridgeline).list[0].staged,12);assert.equal(object('warehouse-boards-floor').count,12,'its 12 boards are drawn');assert.match(toastText(),/Order #1 is staged/)}
 // the order's pallet can be lifted like any other: the tines in its pocket, then raise (the order stays staged, but cannot ship from the forks)
 const back=(.62-.6)+TIP;place(sq.x,sq.z-back,0,.1);assert.match(note(),/Raise the forks to lift the pallet/,note());hold('KeyR',.25);assert.equal(load(),12,'the order pallet is on the forks');assert(palletsOf(p().companies.ridgeline).some(q=>q.order===1&&q.at.fork),'still the order\'s pallet');
 // another order's square is refused
 const sq2=WAREHOUSE_STAGING[2];place(sq2.x,sq2.z-CARRY_Z,0,.6);pump(.3);assert.match(note(),/not this order/,note());hold('KeyF',1.2);assert.equal(load(),12,'it was not set down on another order\'s square');
 // the floor: in the aisle, set it down where the forklift faces (it is still the order's pallet)
 place(0,5-0.0,.5,.6);hold('KeyF',1.5);assert.equal(load(),0,'set down on the floor');assert.equal(floorPallets(p().companies.ridgeline).length,1);
 {const f=floorPallets(p().companies.ridgeline)[0],at=f.at.floor;assert.equal(f.count,12);assert.equal(f.order,1,'it keeps its order');assert(Math.abs(at.yaw-.5)<.01,'turned the way it was facing');assert.equal(object('warehouse-boards-floor').count,12,'12 boards drawn on it');assert(object('warehouse-pallets').count>=1,'on a wooden pallet');
  // lift it again from the floor: in front of the pallet, tines in 60 cm
  const sin=Math.sin(at.yaw),cos=Math.cos(at.yaw),back2=(.62-.6)+TIP;place(at.x-sin*back2,at.z-cos*back2,at.yaw,.1);assert.match(note(),/Raise the forks to lift the pallet/,note());hold('KeyR',.25);assert.equal(load(),12,'a pallet on the floor can be lifted again');assert.equal(floorPallets(p().companies.ridgeline).length,0)}
}finally{g.close?.()}
