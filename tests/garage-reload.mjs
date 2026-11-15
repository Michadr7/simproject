// VD4 save and reload in the packaged game: a save made while the S70 was in the repair shop loads with the S70 still away (hidden, no door, cond kept), the repair finishes by game hours,
// and the save written after loading still holds the shop state. A save from before the garage existed (no garage field) loads with every vehicle in the world and an empty garage.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {bayPose} from '../dist/garage.js';

const B=bayPose();
const veh=(uid,x,cond)=>({uid,model:'shortbed',colour:'#c23b2e',x,z:B.z,yaw:B.yaw,fuelMgal:10000,...(cond===undefined?{}:{cond})});
// day 1, 8:00 AM = game hour 8; the repair is ready at hour 11 (3 hours later)
const g=await bootGame({position:{x:122.2,z:20.4},progress:{cash:5000,completed:5,routine:{minutes:480},vehicles:[veh('v1',B.x,250),veh('v2',60,undefined)],orders:{nextVehicle:3},garage:{hardLuckDay:null,shop:{v1:{readyAt:11,to:1000},v9:{readyAt:5,to:1000}}}}});
try{
 const {GameState,pump,send,ids,scene,store}=g,press=code=>{send('keydown',code);send('keyup',code)},mesh=uid=>scene().getObjectByName('vehicle-'+uid);
 const prompt=()=>({text:ids.get('prompt').querySelector('span').textContent,hidden:ids.get('prompt').hidden}),profile=()=>JSON.parse(store.get('edenridge.profile.v1')).progress;
 pump(1.5);
 assert.equal(mesh('v1').visible,false,'the S70 in the shop is not in the world after a reload');assert(mesh('v2').visible,'the other vehicle is');
 assert.deepEqual(Object.keys(GameState.progress.garage.shop),['v1'],'an unknown uid in the garage save was dropped');
 assert.equal(GameState.progress.vehicles.find(v=>v.uid==='v1').cond,250,'its condition is kept while it is away');
 {const p=prompt();assert(!p.hidden&&/Repair shop · Kasumuchi S70 ready in (2\.9\d|3) h|Repair shop · Kasumuchi S70 ready in \d/.test(p.text),'the counter shows the wait: '+p.text)}
 assert.deepEqual(profile().garage.shop.v1,{readyAt:11,to:1000},'the save written after loading still holds it');
 assert.equal(GameState.progress.messages?.some(m=>/is ready at the Eastbank repair shop/.test(m.text))||false,false,'not announced early');
 GameState.progress={...GameState.progress,routine:{...GameState.progress.routine,minutes:480+200}};pump(.5);
 assert(GameState.progress.messages.some(m=>/Your Kasumuchi S70 is ready at the Eastbank repair shop/.test(m.text)),'announced when the hours are up');
 press('KeyE');pump(.3);assert(/Collect the Kasumuchi S70 · 100%/.test(ids.get('jobAction').textContent),ids.get('jobAction').textContent);ids.get('jobAction').click();pump(.5);
 assert(mesh('v1').visible,'collected');assert.equal(profile().vehicles.find(v=>v.uid==='v1').cond,undefined,'saved Fine');assert.deepEqual(profile().garage.shop,{});
 console.log('Garage reload (packaged): a vehicle in the shop stays away after a reload with its condition, the wait shows at the counter, the repair finishes by game hours and it is collected Fine; junk in the garage save is dropped.');
}finally{await g.done()}
// an old save (no garage field at all)
const o=await bootGame({position:{x:122.2,z:20.4},progress:{cash:5000,completed:5,vehicles:[veh('v1',B.x,0)],orders:{nextVehicle:2}}});
try{o.pump(1.5);assert.deepEqual(o.GameState.progress.garage,{hardLuckDay:null,shop:{}},'an old save has an empty garage');assert(o.scene().getObjectByName('vehicle-v1').visible,'and its wreck is in the world');
 console.log('Old save: no garage field loads an empty garage.')}finally{await o.done()}
