import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {forkLoadOf} from '../dist/forest.js';
import {BAY} from '../dist/forklift.js';
import {IN,OUT,YARD,inYard} from '../dist/dock.js';
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');

// The roller door in the game (D2): it rolls up when the forklift comes near, the forklift drives out through it onto the apron (a short fade, the same forklift, load and fork height kept), stays on the apron,
// can be left there and driven again, and comes back in through the door.
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3,wait=ms=>new Promise(r=>setTimeout(r,ms));
const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
try{
 const {GameState,pump,send,ids,scene,win}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent,press=(code='KeyE',s=1)=>{send('keydown',code);send('keyup',code);pump(s)};
 const hold=(code,seconds)=>{send('keydown',code);pump(seconds);send('keyup',code);pump(.1)};
 const fork=()=>win.__city.fork,object=name=>scene().getObjectByName(name),note=()=>ids.get('vpNote').textContent;
 const place=(x,z,yaw,lift=.3)=>{fork().state={x,z,yaw,speed:0,lift,steer:0,roll:0};pump(.3)};
 GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<4)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
 GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:700}};GameState.progress=clockIn(p(),'ridgeline').state;
 // a pallet of 40 planks already on the forks
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...p().companies.ridgeline,pallets:[{id:1,product:'planks',count:40,at:{fork:true}}]}}};
 pump(1.2);pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),prompt());press('KeyE',2.5);await wait(300);pump(.8);
 assert.equal(fork().where,'inside');me().x=BAY.x;me().z=BAY.z+2.3;pump(.6);press('KeyE',.6);assert.equal(fork().on,true,'on the forklift');
 const room=()=>object('warehouse-interior'),panel=()=>object('dock-door-panel'),outPanel=()=>object('dock-door-outside');
 assert.equal(panel().scale.y,1,'the inside door is shut');assert.equal(outPanel().scale.y,1,'and so is the one outside');
 // drive at the door from inside, in line, forks first: it is shut at first (the wall stops the forks), rolls up as you come near, and then you go through
 place(IN.x,6.5,0);send('keydown','KeyW');pump(1.5);assert(panel().scale.y<1,'the inside door is rolling up: '+panel().scale.y);send('keyup','KeyW');pump(.3);
 place(IN.x,8.6,0);hold('KeyW',3);pump(.8);
 assert.equal(fork().where,'outside','through the door and out');assert(inYard(fork().state.x,fork().state.z),'on the apron: '+fork().state.x.toFixed(1)+','+fork().state.z.toFixed(1));assert(Math.abs(Math.abs(fork().state.yaw)-Math.PI)<.5,'facing north, forks first');
 assert.equal(forkLoadOf(p()),40,'the pallet is still on the forks');assert(object('forklift'),'the forklift is drawn');
 assert.equal(fork().on,true,'still driving it');
 // the panel outside is up while it is near, and it comes down after it has gone
 pump(.5);assert(outPanel().scale.y<1,'the outside door is up while the forklift is by it: '+outPanel().scale.y);
 // it stays in the yard: drive north until it stops at the edge
 send('keydown','ShiftLeft');send('keydown','KeyW');pump(9);send('keyup','KeyW');send('keyup','ShiftLeft');pump(.6);
 {const s=fork().state;assert(inYard(s.x,s.z),'never leaves the yard: '+s.x.toFixed(1)+','+s.z.toFixed(1));assert(s.z<YARD.z0+3,'it went as far as the edge: '+s.z.toFixed(1));assert.match(note(),/stays in the yard/,'the panel says why: '+note())}
 pump(5);assert.equal(outPanel().scale.y,1,'the outside door shut itself again');
 // a pallet cannot be set down out here yet
 {hold('KeyF',2.5);assert.equal(forkLoadOf(p()),40,'nothing set down on the apron');}
 // get off outside: it stays where it is, solid to you, and E drives it again
 press('KeyE',.6);assert.equal(fork().on,false,'off the forklift');{const s=fork().state;assert(Math.hypot(me().x-s.x,me().z-s.z)>1,'you stand beside it');pump(.4);assert.match(prompt(),/Drive the forklift/,'E drives it again: '+prompt());press('KeyE',.6);assert.equal(fork().on,true)}
 // back to the door and in: facing the wall, in line
 place(OUT.x+.3,28.2,0);send('keydown','KeyW');pump(.9);send('keyup','KeyW');pump(.4);
 place(OUT.x,29.0,0);hold('KeyW',2.5);pump(.8);
 assert.equal(fork().where,'inside','back in the hall');assert.equal(forkLoadOf(p()),40,'with its load');assert.equal(object('forklift').parent!==null,true);assert(fork().state.z<IN.line,'inside the line');assert(Math.abs(Math.abs(fork().state.yaw)-Math.PI)<.5,'forks first, facing into the hall');
 console.log('PASS roller-door-game.mjs: the roller door rolls up when the forklift comes near (inside and outside) and comes down after it has gone, the forklift drives out onto the apron with its load and fork height, stays on the apron, nothing can be set down there yet, it can be left and driven again, and it comes back in through the door.');
}finally{g.close?.()}
