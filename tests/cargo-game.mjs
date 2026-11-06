import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {loadPoints} from '../dist/cargo.js';

// Cargo in the packaged game (0.35, flatbed step 2): an owned flatbed parked on Freight South; a log on your shoulder goes onto the bed with E from behind it, the bed draws it,
// the tailgate opens while you stand there, empty-handed E takes it off again, and the cargo is saved with the vehicle.
const AT={x:150,z:66,yaw:Math.PI/2},rear=loadPoints('flatbed').find(p=>p.side==='rear');
// behind the flatbed: it faces +x (yaw pi/2), so its back is toward -x
const behind={x:AT.x-(-rear.z),z:AT.z};
const g=await bootGame({position:behind,progress:{vehicles:[{uid:'v1',model:'flatbed',colour:'blue',x:AT.x,z:AT.z,yaw:AT.yaw,fuelMgal:30000}],orders:{nextVehicle:2}}});
try{
 const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const prompt=()=>ids.get('prompt').querySelector('span').textContent,press=()=>{send('keydown','KeyE');send('keyup','KeyE');pump(1.5)};
 const truck=()=>scene().getObjectByName('vehicle-v1'),logs=()=>truck().getObjectByName('cargo-log');
 assert(truck(),'the owned flatbed is in the world');assert.equal(logs().count,0,'its bed is empty');
 // a log on the shoulder, standing behind the bed
 GameState.progress={...p(),carry:{kind:'log'}};me().x=behind.x;me().z=behind.z;pump(.8);assert(/Open the tailgate/.test(prompt()),'a shut tailgate is opened first: '+prompt());press();
 assert(/Load the log onto the Tylan Flatbed · empty/.test(prompt()),'the bed offers to take the log: '+prompt());
 assert(truck().userData.tailgate.rotation.x<-.5,'the tailgate opens while you stand behind it');
 press();assert.equal(p().carry,null,'the log left your shoulder');assert.equal(logs().count,1,'and lies on the bed');
 assert.deepEqual(p().vehicles.find(v=>v.uid==='v1').cargo,[{k:'log'}],'the cargo is saved with the vehicle');
 // a second log, then take one off
 GameState.progress={...p(),carry:{kind:'log'}};pump(.4);press();assert.equal(logs().count,2);
 pump(.4);assert(/Take a log off the Tylan Flatbed · 2 logs/.test(prompt()),'empty-handed, the bed offers a log back: '+prompt());
 press();assert.deepEqual(p().carry,{kind:'log'},'the log is on your shoulder again');assert.equal(logs().count,1);
 // a mixed load: planks go on beside the log
 GameState.progress={...p(),carry:{kind:'planks',count:4}};pump(.4);press();assert.equal(p().carry,null,'the planks went on the bed');assert.equal(truck().getObjectByName('cargo-planks').count,4,'four boards drawn, one stack');assert.deepEqual(p().vehicles.find(v=>v.uid==='v1').cargo,[{k:'log'},{k:'planks',n:4}],'a log and four planks');
 // walking away leaves it open; H closes it
 me().x=behind.x-8;pump(1.5);assert(truck().userData.tailgate.rotation.x<-.5,'the tailgate stays open when you walk away');me().x=behind.x;pump(.8);send('keydown','KeyH');send('keyup','KeyH');pump(1.5);assert(Math.abs(truck().userData.tailgate.rotation.x)<1e-6,'H at the back shuts it again');
 console.log('PASS cargo-game.mjs: a log loaded onto an owned flatbed with E from behind it (the tailgate opens), drawn on the bed and saved, taken off again empty-handed; planks loaded beside the log (a mixed load); the tailgate shuts when you walk away.');
}finally{await g.done()}
