import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {hire} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {loadPoints} from '../dist/cargo.js';
import {LANDING,stockOf} from '../dist/forest.js';

// The lumberyard dock and the company stock in the packaged game (0.35): planks carried into the Eastbank timber yard are delivered at the pallets ($1.00 each, drawn on them);
// a truck parked in the yard unloads all its planks at once (a log on it stays); a log stacked at the landing joins the pile and can be taken back. Only on a Ridgeline shift.
const TRUCK={x:87,z:52,yaw:0},rear=loadPoints('flatbed').find(p=>p.side==='rear');
const g=await bootGame({position:{x:86,z:47},progress:{vehicles:[{uid:'v1',model:'flatbed',colour:'orange',x:TRUCK.x,z:TRUCK.z,yaw:TRUCK.yaw,fuelMgal:30000,cargo:[{k:'log'},{k:'planks',n:4},{k:'planks',n:4},{k:'planks',n:4}]}],orders:{nextVehicle:2}}});
try{
 const {GameState,pump,send,ids,scene,created}=g,p=()=>GameState.progress,me=()=>GameState.me.position,find=id=>[...created].reverse().find(e=>e.id===id);
 const prompt=()=>ids.get('prompt').querySelector('span').textContent,press=()=>{send('keydown','KeyE');send('keyup','KeyE');pump(1.5)};
 const planksDrawn=()=>scene().getObjectByName('stock-planks').count,logsDrawn=()=>scene().getObjectByName('stock-logs').count;
 const setDay=()=>{GameState.progress={...p(),housing:{...p().housing,day:3},routine:{...p().routine,minutes:540}}};
 setDay();GameState.progress=hire(p(),'ridgeline').state;
 // off shift: planks in hand are not taken
 GameState.progress={...p(),carry:{kind:'planks',count:4}};pump(.6);assert(!/Deliver/.test(prompt()),'off shift the yard takes nothing: '+prompt());
 GameState.progress=clockIn({...p(),carry:null},'ridgeline').state;
 // by hand: four planks at the pallets
 GameState.progress={...p(),carry:{kind:'planks',count:4}};me().x=86;me().z=47;pump(.6);assert(/Deliver 4 planks to the lumberyard · \$4\.00/.test(prompt()),'the pallets take the planks: '+prompt());
 press();assert.equal(p().carry,null);assert.equal(stockOf(p()).planks,4,'four planks in stock');assert.equal(p().shift.pieces.delivered,4,'and paid as delivered');assert.equal(planksDrawn(),1,'one stack drawn on a pallet');
 // by truck: the flatbed in the yard; standing behind it, all its planks come off at once and the log stays
 me().x=TRUCK.x;me().z=TRUCK.z+rear.z;pump(.8);assert(/Open the tailgate/.test(prompt()),'a shut tailgate is opened first: '+prompt());press();assert(/Cargo · 1 log, 12 planks/.test(prompt()),'a mixed bed offers the Cargo panel: '+prompt());
 press();assert(!ids.get('cargoOverlay').hidden,'the panel opens');{const rows=[0,1,2].map(i=>find('cargo-row-'+i)?.textContent);assert(/Take a log · 1 on the bed/.test(rows[0])&&/Take planks · 12 on the bed/.test(rows[1])&&/Unload all 12 planks at the lumberyard · \$12\.00/.test(rows[2]),'a row per kind and the bulk unload: '+rows.join(' | '))}
 send('keydown','Digit3');pump(.5);ids.get('cargoClose').onclick();pump(.5);assert.equal(stockOf(p()).planks,16);assert.equal(p().shift.pieces.delivered,16);assert.deepEqual(p().vehicles.find(v=>v.uid==='v1').cargo,[{k:'log'}],'the log is still on the bed');assert.equal(planksDrawn(),4,'four stacks on the pallets now');
 // the landing: a log stacked joins the pile (drawn), and can be taken back
 GameState.progress={...p(),carry:{kind:'log'}};me().x=LANDING.x+.8;me().z=LANDING.z;pump(.6);press();assert.equal(stockOf(p()).logs,1);assert.equal(logsDrawn(),1,'the pile shows the log');
 pump(.6);assert(/Take a log from the pile · 1/.test(prompt()),'empty-handed, the pile offers it back: '+prompt());press();assert.deepEqual(p().carry,{kind:'log'});assert.equal(stockOf(p()).logs,0);assert.equal(logsDrawn(),0);
 console.log('PASS dock-game.mjs: planks delivered by hand at the lumberyard pallets ($1.00 each, drawn on them), a parked flatbed with a mixed load opens the Cargo panel (a row per kind, the bulk unload on key 3: all its planks at once, its log stays), a log stacked at the landing joins the pile and can be taken back; nothing is taken off shift.');
}finally{await g.done()}
