// PB1 in the packaged game. (A) Call a tow while you sit in the vehicle: it is checked first (a refused tow leaves you in your seat), then the vehicle goes to the shop bay, you stand at the shop counter on foot, nothing of the drive state is left (panel, fuel nozzle, camera), cash is charged, the Call app AND the toast say what happened.
// (B) Open ground east of the old town: a vehicle driven east from (280, 40) at three headings passes the old ground's 10 m rim (x 290 to 300, which used to be an invisible wall outside the freight gate) or, at the world's last metres, says 'You are at the edge of the map'.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {CLASSES,doorPoint} from '../dist/vehicle.js';
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),live=(g,id)=>g.ids.get('phoneCall').children.flatMap(c=>c.children||[]).find(e=>e.id===id)||null,last=(g,id)=>g.created.filter(e=>e.id===id).at(-1);
const car=(x,z,yaw,model='shortbed',extra={})=>({uid:'v1',model,colour:'#c23b2e',x,z,yaw,fuelMgal:10000,...extra});
const boot=(vehicle,pos,cash=30000)=>bootGame({position:pos,progress:{cash,completed:5,routine:{minutes:480},vehicles:[vehicle],orders:{nextVehicle:2}}});
async function sitIn(g,v,cls){const {pump,send,ids,GameState}=g,door=doorPoint(v,cls);Object.assign(GameState.me.position,{x:door.x,z:door.z});pump(1);send('keydown','KeyE');send('keyup','KeyE');pump(3);assert.equal(ids.get('vehiclePanel').dataset.state,'driving','in the vehicle')}
const toastText=g=>g.ids.get('jobToast').hidden?'':g.ids.get('jobToast').textContent;

// A1. A tow while driving.
{const V={x:-20,z:30,yaw:0},g=await boot(car(V.x,V.z,V.yaw),{x:V.x+6,z:V.z});
 try{const {pump,ids,GameState,scene}=g;pump(1.5);await sitIn(g,V,CLASSES.shortbed);
  const cash0=GameState.progress.cash;ids.get('phoneButton').click();ids.get('phoneApp-call').click();last(g,'call-tow').click();await sleep(2300);
  assert(live(g,'call-tow-v1'),'the driven vehicle is on the tow list');live(g,'call-tow-v1').onclick({preventDefault(){}});
  const line=last(g,'callLine').textContent;assert(/tow truck brought your/.test(line)&&/on foot at the shop/.test(line),'the Call app says what happened: '+line);assert(/tow truck brought your/.test(toastText(g)),'and the screen toast does too: '+toastText(g));
  assert(GameState.progress.cash<cash0,'the tow was charged');
  ids.get('phoneClose').click();pump(1);assert.notEqual(ids.get('vehiclePanel').dataset.state,'driving','you are out of it');
  const bay=MAP.garage.pose,m=scene().getObjectByName('vehicle-v1').position;assert(Math.hypot(m.x-bay.x,m.z-bay.z)<4,`the vehicle stands in the shop bay (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
  const me=GameState.me.position;assert(Math.hypot(me.x-MAP.garage.counter.x,me.z-MAP.garage.counter.z)<6,`you stand at the shop (${me.x.toFixed(1)}, ${me.z.toFixed(1)})`);
  const sv=JSON.parse(g.store.get('edenridge.profile.v1')).progress.vehicles.find(v=>v.uid==='v1');assert(Math.hypot(sv.x-bay.x,sv.z-bay.z)<4,'the save holds the bay pose');
  pump(2);g.send('keydown','KeyW');pump(2);g.send('keyup','KeyW');const m2=scene().getObjectByName('vehicle-v1').position;assert(Math.hypot(m2.x-m.x,m2.z-m.z)<.5,'W moves nobody else: no ghost driver');
 }finally{await g.done()}}
// A2. Broke: the tow is refused, you stay in your seat, and the Call app and the toast both say why.
{const V={x:-20,z:30,yaw:0},g=await boot(car(V.x,V.z,V.yaw),{x:V.x+6,z:V.z},0);
 try{const {pump,ids}=g;pump(1.5);await sitIn(g,V,CLASSES.shortbed);
  ids.get('phoneButton').click();ids.get('phoneApp-call').click();last(g,'call-tow').click();await sleep(2300);live(g,'call-tow-v1').onclick({preventDefault(){}});
  assert(/costs/.test(last(g,'callLine').textContent),'the Call app says why: '+last(g,'callLine').textContent);assert(/costs/.test(toastText(g)),'the toast too: '+toastText(g));
  ids.get('phoneClose').click();pump(.5);assert.equal(ids.get('vehiclePanel').dataset.state,'driving','a refused tow leaves you in your seat');
 }finally{await g.done()}}

// B. East of the old ground.
const heads=[Math.PI/2,Math.PI/2-.35,Math.PI/2+.35],report=[];
for(const yaw of heads){
 const g=await boot(car(280,40,yaw,'offroad'),{x:276,z:40});
 try{const {pump,send,scene}=g,V={x:280,z:40,yaw};pump(1.5);await sitIn(g,V,CLASSES.offroad);send('keydown','KeyW');
  let edgeSeen=false,x=280;for(let i=0;i<24;i++){pump(1);x=scene().getObjectByName('vehicle-v1').position.x;if(/edge of the map/.test(toastText(g)))edgeSeen=true;if(x>330)break}
  report.push([+yaw.toFixed(2),+x.toFixed(1)]);assert(x>330||edgeSeen,`heading ${yaw.toFixed(2)}: the offroad truck passes x 330 or says the edge message (it stopped at x ${x.toFixed(1)})`);
 }finally{await g.done()}}
// B2. The world's last metres: driven east along Eden Road into the edge (x 1040), the vehicle stops and says so (and the hull never leaves the world).
{const g=await boot(car(280,68,Math.PI/2,'offroad'),{x:276,z:68});
 try{const {pump,send,scene}=g,V={x:280,z:68,yaw:Math.PI/2};pump(1.5);await sitIn(g,V,CLASSES.offroad);send('keydown','KeyW');let said=false,x=280;
  for(let i=0;i<500&&!said;i++){pump(x>980?.1:1);x=scene().getObjectByName('vehicle-v1').position.x;if(/edge of the map/.test(toastText(g)))said=true}
  if(!said){await sleep(700);pump(.1);said=/edge of the map/.test(toastText(g))} // the note comes a beat after the bump (a real timer)
  assert(said,`at the world edge the toast says so (x ${x.toFixed(1)})`);assert(x<1050,'and the vehicle stays inside the world')}
 finally{await g.done()}}
console.log('PASS tow-driven.mjs: a tow called from the driven vehicle takes it to the shop bay and leaves you on foot at the counter (Call app and toast both report, a refused tow keeps you seated); the offroad truck driven east from (280, 40) passes the old rim at three headings '+JSON.stringify(report)+'; at the world edge it says: You are at the edge of the map');