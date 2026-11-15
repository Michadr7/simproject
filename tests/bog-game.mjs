// TR4 in the packaged game: an S70 parked in the Eastbank yard puddle. Hold W: the panel warns (Sinking), then says "Stuck: rock it with W and S" and the vehicle crawls. Rocking (S, W, S, W within 1.2 s each) frees it.
// Stuck again, the phone's Call app (the tow line, answered because you are in a vehicle) offers "Pull me out" for $40: the vehicle lands on firm ground (not in the mud, not in a wall), half a game hour passes, nothing sinks any more.
// On foot the line is busy and there is no pull-out. Nothing of the bog meter is saved.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {CLASSES,doorPoint} from '../dist/vehicle.js';
const live=id=>g.ids.get('phoneCall').children.flatMap(c=>c.children||[]).find(e=>e.id===id)||null; // what the Call app shows now (g.created keeps every element ever made)
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),puddle=MAP.mud.find(m=>m.id==='mud-yard-puddle'),V={x:(puddle.x0+puddle.x1)/2,z:(puddle.z0+puddle.z1)/2,yaw:0};
const inMud=(x,z)=>MAP.mud.some(m=>x>=m.x0-.5&&x<=m.x1+.5&&z>=m.z0-.5&&z<=m.z1+.5);
assert(puddle,'the yard puddle exists');
const boot=()=>bootGame({position:{x:V.x+5,z:V.z},progress:{cash:30000,completed:5,routine:{minutes:480},vehicles:[{uid:'v1',model:'shortbed',colour:'#c23b2e',x:V.x,z:V.z,yaw:V.yaw,fuelMgal:10000}],orders:{nextVehicle:2}}});
let g=await boot();
try{
 const {GameState,pump,send,ids,find,scene,store}=g,press=code=>{send('keydown',code);send('keyup',code)},last=id=>g.created.filter(e=>e.id===id).at(-1);
 const row=()=>({hidden:ids.get('vpStuck').hidden,text:ids.get('vpStuck').textContent,level:ids.get('vpStuck').dataset.level}),mesh=()=>scene().getObjectByName('vehicle-v1');
 pump(1.5);
 const door=doorPoint(V,CLASSES.shortbed);Object.assign(GameState.me.position,{x:door.x,z:door.z});pump(1);press('KeyE');pump(3);
 assert.equal(ids.get('vehiclePanel').dataset.state,'driving','in the S70');assert.equal(row().hidden,true,'no bog row at the start');

 // 1. Hold W in the mud: first the warning, then Stuck, and the vehicle only crawls.
 send('keydown','KeyW');let warned=false,stuckAfter=null;
 for(let i=0;i<10&&stuckAfter===null;i++){pump(.5);const r=row();if(!r.hidden&&r.level==='warn'){warned=true;assert(/Sinking/.test(r.text))}if(!r.hidden&&r.level==='stuck')stuckAfter=(i+1)*.5}
 assert(warned,'the panel warned before it got stuck');assert(stuckAfter!==null&&stuckAfter<=6,'Stuck within about 4 s of flooring it (it was '+stuckAfter+' s)');assert.equal(row().text,'Stuck: rock it with W and S');
 pump(2);const x0=mesh().position.x,z0=mesh().position.z;pump(2);assert(Math.hypot(mesh().position.x-x0,mesh().position.z-z0)<2.2,'Stuck: it only crawls (under a metre a second)');
 send('keyup','KeyW');

 // 2. Rock it: S then W then S then W, each held for half a second, frees it well inside the 45 s net.
 let freed=false;for(const code of ['KeyS','KeyW','KeyS','KeyW','KeyS','KeyW']){send('keydown',code);pump(.5);send('keyup',code);if(row().hidden){freed=true;break}}
 assert(freed,'rocking freed it (row now '+JSON.stringify(row())+')');
 pump(8);assert.equal(row().hidden,true,'with the throttle released it stays free');
 await g.done();g=await boot(); // the second half starts again in the puddle (a freed vehicle has driven on)
 {const {GameState,pump,send,ids,find,scene,store}=g,press=code=>{send('keydown',code);send('keyup',code)},last=id=>g.created.filter(e=>e.id===id).at(-1),row=()=>({hidden:ids.get('vpStuck').hidden,text:ids.get('vpStuck').textContent,level:ids.get('vpStuck').dataset.level}),mesh=()=>scene().getObjectByName('vehicle-v1');
 pump(1.5);const door=doorPoint(V,CLASSES.shortbed);Object.assign(GameState.me.position,{x:door.x,z:door.z});pump(1);press('KeyE');pump(3);

 // 3. Stuck again: the Call app offers Pull me out. Cash, clock and place are checked around the click.
 send('keydown','KeyW');pump(7);send('keyup','KeyW');assert.equal(row().hidden,false,'stuck again at '+mesh().position.x.toFixed(1)+','+mesh().position.z.toFixed(1)+' puddle '+JSON.stringify(puddle));
 ids.get('phoneButton').click();ids.get('phoneApp-call').click();last('call-tow').click();await sleep(2300);
 assert(/pull you out/.test(last('callLine').textContent),'the tow service offers a pull-out: '+last('callLine').textContent);
 const pull=last('call-pull');assert(pull&&pull.textContent==='Pull me out · $40.00 · 30 min','the button: '+pull?.textContent);
 {const cash0=GameState.progress.cash,m0=GameState.progress.routine.minutes,before=mesh().position.clone();pull.onclick({preventDefault(){}});
  assert.equal(GameState.progress.cash,cash0-4000,'$40 paid');assert.equal(+(GameState.progress.routine.minutes-m0).toFixed(3),30,'half a game hour passed (or crossed midnight)');assert(/pulled your/.test(last('callLine').textContent),last('callLine').textContent);
  ids.get('phoneClose').click();pump(.5);const p=mesh().position;assert(Math.hypot(p.x-before.x,p.z-before.z)>1,'the vehicle moved '+JSON.stringify([before.x,before.z,p.x,p.z])+' '+last('callLine').textContent);assert(!inMud(p.x,p.z),`it stands on firm ground (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);assert.equal(row().hidden,true,'no longer stuck');
  assert.equal(ids.get('vehiclePanel').dataset.state,'driving','you are still sitting in it');
  const sv=JSON.parse(store.get('edenridge.profile.v1')).progress.vehicles.find(v=>v.uid==='v1');assert(!inMud(sv.x,sv.z),'the save holds the new place');assert(!('bog' in sv)&&!('stuck' in sv),'the bog meter is not saved')}
 send('keydown','KeyW');pump(1);send('keyup','KeyW');assert.equal(row().hidden,true,'driving off from firm ground: not stuck');

 // 4. Firm ground: no Pull me out; on foot: the line is busy.
 ids.get('phoneButton').click();ids.get('phoneApp-call').click();last('call-tow').click();await sleep(2300);assert(!live('call-pull'),'not stuck and on firm ground: no pull-out offered');last('callHangup').click();ids.get('phoneClose').click();
 pump(3);press('KeyE');pump(2);assert.notEqual(ids.get('vehiclePanel').dataset.state,'driving','out of the vehicle');
 ids.get('phoneButton').click();ids.get('phoneApp-call').click();last('call-tow').click();await sleep(700);assert.equal(last('callLine').textContent,'Line busy','on foot the line is busy');assert(!live('call-pull'));
 console.log('PASS bog-game.mjs: an S70 in the yard puddle warns, gets Stuck ("Stuck: rock it with W and S") and crawls; rocking frees it; the Call app offers Pull me out ($40, half a game hour) only to a bogged driver, puts the vehicle on firm ground, keeps you in the seat and saves nothing extra; on foot the line is busy.');
}}finally{await g.done()}
