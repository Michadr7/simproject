import assert from 'node:assert/strict';
import {vehicleHudModel,createVehicleHud,STOP_SPEED} from '../dist/vehicle-hud.js';

// The vehicle panel (0.33): what it shows on foot, driving and riding, and the Get out / Stop to get out prompt.
const off=vehicleHudModel({});
assert.equal(off.state,'off','on foot the panel is greyed out (state off)');assert.equal(off.name,'Not in a vehicle');assert.equal(off.speed,'—');assert.deepEqual(off.keys,[],'no keys offered on foot');
const driving=vehicleHudModel({driving:true,seat:'driver',name:'Worktruck',speed:0});
assert.equal(driving.state,'driving');assert.equal(driving.name,'Worktruck');assert.equal(driving.speed,'0 mph');
assert.deepEqual(driving.keys,[{kbd:'E',text:'Get out',muted:false}],'stopped: Get out, not muted');
const moving=vehicleHudModel({driving:true,seat:'driver',name:'Worktruck',speed:10});
assert.equal(moving.speed,'22 mph','10 m/s is 22 mph');assert.deepEqual(moving.keys,[{kbd:'E',text:'Stop to get out',muted:true}],'moving: Stop to get out, dimmed');
assert.equal(vehicleHudModel({driving:true,seat:'driver',name:'X',speed:STOP_SPEED-.01}).keys[0].text,'Get out','below 1 m/s you may get out (the same rule as the game)');
assert.equal(vehicleHudModel({driving:true,seat:'driver',name:'X',speed:STOP_SPEED}).keys[0].text,'Stop to get out','1 m/s is moving');
assert.equal(vehicleHudModel({driving:true,seat:'driver',name:'X',speed:-5}).speed,'11 mph','reversing shows a positive speed');
const riding=vehicleHudModel({driving:true,seat:'passenger',name:'Pevrolet Off Road Pickup',speed:0});
assert.equal(riding.state,'riding');assert.deepEqual(riding.keys,[{kbd:'E',text:'Get out'}],'a passenger can always get out (no speed rule: nobody drives)');assert.match(riding.note,/passenger/);
assert.match(driving.note,/W S/,'the driving note lists the controls');

// the DOM writer: writes once per change, and shows the keys (not as text)
function fakeEl(tag){const el={tag,dataset:{},textContent:'',className:'',children:[],append(...c){this.children.push(...c)},replaceChildren(){this.children=[]},setAttribute(){}};return el}
const els=Object.fromEntries(['vehiclePanel','vpName','vpSpeed','vpFuel','vpKeys','vpNote'].map(id=>[id,fakeEl(id)]));
globalThis.document={createElement:tag=>fakeEl(tag)};
let writes=0;const $=id=>{writes++;return els[id]||null};
const hud=createVehicleHud($);
hud(off);assert.equal(els.vehiclePanel.dataset.state,'off');assert.equal(els.vpName.textContent,'Not in a vehicle');assert.equal(els.vpKeys.children.length,0);
hud(driving);assert.equal(els.vehiclePanel.dataset.state,'driving');assert.equal(els.vpName.textContent,'Worktruck');assert.equal(els.vpSpeed.textContent,'0 mph');
const row=els.vpKeys.children[0];assert.equal(row.children[0].textContent,'E','the key is its own kbd element');assert.equal(row.children[1].textContent,'Get out');assert.equal(row.dataset.muted,'false');
const before=writes;hud(vehicleHudModel({driving:true,seat:'driver',name:'Worktruck',speed:0}));assert.equal(writes,before,'an identical model writes nothing (no DOM work per frame)');
hud(moving);assert.equal(els.vpKeys.children[0].children[1].textContent,'Stop to get out');assert.equal(els.vpKeys.children[0].dataset.muted,'true');
// a missing panel (an old page) is not an error
assert.doesNotThrow(()=>createVehicleHud(()=>null)(driving));
// fuel: the type each vehicle takes, gallons, and the out-of-fuel note
{const diesel=vehicleHudModel({driving:true,seat:'driver',name:'Worktruck',speed:0,fuel:{mgal:12300,capacityMgal:21000,type:'diesel'}});assert.equal(diesel.fuel,'Diesel · 12.3 of 21 gal','the panel names the fuel this vehicle takes');
 assert.equal(vehicleHudModel({driving:true,seat:'driver',name:'X',speed:0,fuel:{mgal:5000,capacityMgal:18000,type:'gas'}}).fuel,'Gas · 5.0 of 18 gal');
 const empty=vehicleHudModel({driving:true,seat:'driver',name:'Worktruck',speed:0,fuel:{mgal:0,capacityMgal:21000,type:'diesel'}});assert.equal(empty.fuel,'Diesel · Empty');assert.match(empty.note,/Out of fuel.*diesel/);
 assert.equal(vehicleHudModel({driving:true,seat:'passenger',name:'X',fuel:{mgal:1000,capacityMgal:21000,type:'diesel'}}).fuel,'Diesel · 1.0 of 21 gal','a passenger sees the tank too');assert.equal(off.fuel,'—')}
console.log('Vehicle panel: greyed out on foot; driving shows the name, speed in mph, the fuel type and gallons, and Get out, or Stop to get out while moving (1 m/s); riding shows Get out; the DOM is written only when the model changes.');
