// Dev mode inside the real game: the menu entry, F2, every panel action, and the one flag that removes it all.
import assert from 'node:assert/strict';
import {readFile,rm,writeFile} from 'node:fs/promises';import {join} from 'node:path';
import {bootGame} from './support/boot-game.mjs';
import {clockLabel,QUICK_TIMES,MONEY_STEPS} from '../dist/dev.js';
const CAR={x:6,z:13.9},away=(p,o)=>Math.hypot(p.x-o.x,p.z-o.z);

assert.equal(clockLabel(0),'12:00 AM');assert.equal(clockLabel(720),'12:00 PM');assert.equal(clockLabel(1080),'6:00 PM');assert.equal(clockLabel(545),'9:05 AM');
assert.deepEqual(QUICK_TIMES.map(([name])=>name),['Dawn','Noon','Dusk','Night']);assert(MONEY_STEPS.every(Number.isSafeInteger),'money is whole cents');
assert.match(await readFile('dist/dev-flag.js','utf8'),/export const DEV_MODE=true;/,'the flag is on in the development build');

{ // ── Flag on ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 const g=await bootGame({play:false}),{GameState:S}=g,me=S.me.position;
 const button=g.find('menuDev'),panel=g.find('devPanel');
 assert(button,'the main menu has a Dev Mode button');assert.equal(button.textContent,'Dev Mode');assert(g.ids.get('menuHome').children.includes(button),'inside the menu\'s home panel');
 assert(panel&&panel.hidden,'the panel starts hidden');
 g.send('keydown','F2');assert(panel.hidden,'F2 does nothing until you have entered dev mode');

 button.click();
 assert(g.ids.get('welcome').hidden,'Dev Mode starts the game');assert(!panel.hidden,'and opens the panel');
 for(const id of ['devPlace','devGo','devX','devZ','devGoXZ','devTime','devSetTime','devItem','devQty','devSpawn','devUnstick','devSpawnPoint','devClose','devMessage','devReadout'])assert(g.find(id),`${id} is in the panel`);
 assert(/Westside|WESTSIDE/i.test(g.find('devReadout').textContent),`the readout names where you are: ${g.find('devReadout').textContent}`);
 assert(g.find('devPlace').children.length>=10,`${g.find('devPlace').children.length} places to teleport to`);

 // F2 toggles; typing in the panel never reaches the game, but F2 does
 g.send('keydown','F2');assert(panel.hidden,'F2 hides it');g.send('keydown','F2');assert(!panel.hidden,'and shows it');
 {const e=new Event('keydown',{cancelable:true});e.code='KeyW';panel.dispatchEvent(e);assert.equal(e.cancelBubble,true,'a game key typed in the panel is stopped');
  const f=new Event('keydown',{cancelable:true});f.code='F2';panel.dispatchEvent(f);assert.equal(f.cancelBubble,false,'F2 is let through');}

 // Teleport: to a named place, snapped to clear ground; never into water, never nowhere
 const place=g.find('devPlace');
 place.value='cedar';g.find('devGo').click();assert(away(me,{x:120,z:-87.5})<=31,`Cedar Heights (${me.x.toFixed(1)}, ${me.z.toFixed(1)})`);assert(/At Cedar Heights/.test(g.find('devMessage').textContent));assert.notEqual(g.find('devMessage').dataset.kind,'error');
 place.value='forest';g.find('devGo').click();assert(me.z<-216&&me.x>-25,'Pine Ridge');
 place.value='spawn';g.find('devGo').click();assert.deepEqual([me.x,me.z],[-5,15],'the spawn, exactly, when it is clear');
 {const {riverZAt,MAP}=await import('../dist/map-definition.js'),{isWalkable}=await import('../dist/world.js'),riverZ=riverZAt(MAP.water.rivers[0],-60);
  assert(!isWalkable(-60,riverZ),'(-60, riverZ) is in the river');g.find('devX').value='-60';g.find('devZ').value=String(riverZ);g.find('devGoXZ').click();
  assert(isWalkable(me.x,me.z),`a point in the river lands on land (${me.x},${me.z})`);assert(/nearest clear spot/.test(g.find('devMessage').textContent),g.find('devMessage').textContent)}
 {const before={...me};g.find('devX').value='5000';g.find('devZ').value='5000';g.find('devGoXZ').click();assert.deepEqual({...me},before,'a point off the map leaves you where you are');assert.equal(g.find('devMessage').dataset.kind,'error')}
 {const before={...me};g.find('devX').value='';g.find('devZ').value='3';g.find('devGoXZ').click();assert.deepEqual({...me},before);assert.equal(g.find('devMessage').dataset.kind,'error','x and z are both needed')}

 // Time of day: only the time moves
 {const housing=JSON.stringify(S.progress.housing),day=JSON.stringify(S.progress.properties);
  const dusk=g.find('devMessage'),btn=name=>g.created.find(e=>e.textContent===name&&e.dataset.minutes!==undefined);
  btn('Dusk').click();assert.equal(S.progress.routine.minutes,1080);assert.equal(g.find('devTime').value,'1080');assert.match(dusk.textContent,/6:00 PM/);
  btn('Dawn').click();assert.equal(S.progress.routine.minutes,360);
  g.find('devTime').value='1439';g.find('devSetTime').click();assert.equal(S.progress.routine.minutes,1439);
  g.find('devTime').value='0';g.find('devSetTime').click();assert.equal(S.progress.routine.minutes,0);
  assert.equal(JSON.stringify(S.progress.housing),housing,'no bills or days were advanced');assert.equal(JSON.stringify(S.progress.properties),day);
  g.pump(.5);assert(S.progress.routine.minutes>0&&S.progress.routine.minutes<30,'the clock carries on from there')}

 // Money: whole cents, capped
 {const cash=S.progress.cash,buttons=g.created.filter(e=>e.dataset.cents!==undefined);
  assert.deepEqual(buttons.map(b=>Number(b.dataset.cents)),MONEY_STEPS);
  buttons[0].click();assert.equal(S.progress.cash,cash+10000);buttons[2].click();assert.equal(S.progress.cash,cash+10000+1000000);
  assert(Number.isSafeInteger(S.progress.cash));assert.match(g.find('devMessage').textContent,/\$10,100\.00|\$[\d,]+\.\d\d/);
  S.progress.cash=1e10-5;buttons[2].click();assert.equal(S.progress.cash,1e10,'capped at the save format\'s limit')}

 // Spawn items
 {const count=id=>S.progress.inventory.slots.filter(s=>s.id===id).reduce((n,s)=>n+s.quantity,0);
  g.find('devItem').value='apple';g.find('devQty').value='5';g.find('devSpawn').click();assert.equal(count('apple'),5);assert.match(g.find('devMessage').textContent,/Added 5 × Apple/);
  g.find('devItem').value='axe';g.find('devQty').value='99';g.find('devSpawn').click();
  const axes=count('axe');assert(axes>=1&&axes<20,`a full bag stops the spawn (${axes} axes)`);assert.equal(g.find('devMessage').dataset.kind==='error'?'error':'ok','ok','some were added, so it is not an error');assert.match(g.find('devMessage').textContent,/bag is full/);
  g.find('devItem').value='apple';g.find('devQty').value='1';g.find('devSpawn').click();assert.equal(count('apple'),6,'later spawns still stack');
  g.find('devItem').value='nonsense';g.find('devSpawn').click();assert.equal(g.find('devMessage').dataset.kind,'error');
  assert.equal(S.progress.inventory.slots.every(s=>s.quantity>=1),true)}

 // Unstick: inside the parked car, then on clear ground; on clear ground it says so and does not move you
 {Object.assign(me,{x:CAR.x,z:CAR.z});g.find('devUnstick').click();assert(away(me,CAR)>=1.5,`moved out of the car (${away(me,CAR).toFixed(2)} m)`);assert.match(g.find('devMessage').textContent,/nearest clear spot/);
  const here={...me};g.find('devUnstick').click();assert.deepEqual({...me},here);assert.match(g.find('devMessage').textContent,/already on clear ground/);
  Object.assign(me,{x:30,z:20});g.find('devSpawnPoint').click();assert.deepEqual([me.x,me.z],[-5,15],'Back to spawn')}

 // Rendering switches: they flip their label and say so, and can be flipped back
 {for(const [id,label] of [['devShadows','Shadows'],['devFade','Tree dissolve']]){const b=g.find(id);assert(b,id+' is in the panel');assert.equal(b.textContent,label+': on');b.click();assert.equal(b.textContent,label+': off');assert.match(g.find('devMessage').textContent,new RegExp(label+' off'));b.click();assert.equal(b.textContent,label+': on')}}

 // Interior editor: go inside any house, move a piece and see the model move, see the layout's problems, leave the stairs alone, and fail gracefully with no dev server
 {const toggle=g.find('devInteriorToggle'),body=g.find('devInteriorBody');assert(toggle&&body&&body.hidden,'the editor is folded away until you open it');toggle.click();assert(!body.hidden);
  assert.match(g.find('devInteriorStatus').textContent,/Choose a house/,'before you go inside it says what to do');assert(g.find('devHouse').children.length>=9,g.find('devHouse').children.length+' houses to choose from');
  g.find('devHouse').value='house-r1';g.find('devVisit').click();g.pump(.3);
  const list=g.find('devPiece'),texts=()=>list.children.map(o=>o.textContent),meshOf=name=>{let m=null;g.scene().traverse(o=>{if(o.name===name)m=o});return m};
  assert(texts().length>10,texts().length+' pieces listed');assert.match(g.find('devInteriorStatus').textContent,/1 Cedar Loop \(house-a\)/);assert.match(g.find('devProblems').textContent,/Nothing wrong/);
  const sofa=texts().findIndex(t=>t.startsWith('sofa'));assert(sofa>=0);
  assert(meshOf('f:f-sofa'),'the sofa is in the scene we are drawing (the house, not the street)');
  list.value=String(sofa);list.onchange();
  const x0=meshOf('f:f-sofa').position.x,t0=texts()[sofa];g.find('devEast').click();g.pump(.1);
  assert(Math.abs(meshOf('f:f-sofa').position.x-(x0+.25))<1e-9,'the model moved a step east');assert.notEqual(texts()[sofa],t0,'and the list shows it');assert.match(g.find('devMessage').textContent,/Moved/);
  g.find('devStep').click();g.find('devWest').click();assert(Math.abs(meshOf('f:f-sofa').position.x-(x0+.2))<1e-9,'fine steps are 5 cm');
  const marker=meshOf('selection');assert.equal(marker.visible,true,'the chosen piece has a box around it');
  // problems appear as you go and clear when you reset
  const stove=texts().findIndex(t=>t.startsWith('stove'));list.value=String(stove);list.onchange();g.find('devDelete').click();
  assert.match(g.find('devProblems').textContent,/⚠.*no stove/);assert.equal(g.find('devProblems').dataset.kind,'error');assert.equal(meshOf('f:f-stove'),null,'the stove model is gone');
  g.find('devInteriorReset').click();assert.match(g.find('devProblems').textContent,/Nothing wrong/);assert(meshOf('f:f-stove'),'reset brings it back');assert(Math.abs(meshOf('f:f-sofa').position.x-x0)<1e-9,'and the sofa too');
  // add and copy
  const n=texts().length;g.find('devAddItem').value='f-bookcase';g.find('devAdd').click();assert.equal(texts().length,n+1);g.find('devCopy').click();assert.equal(texts().length,n+2);
  g.find('devDelete').click();g.find('devInteriorReset').click();assert.equal(texts().length,n);
  // no piece chosen: nothing happens, and it says so
  g.find('devInteriorReset').click();list.value='';g.find('devVisit').click(); // visiting again clears the choice
  g.find('devEast').click();assert.equal(g.find('devMessage').dataset.kind,'error','move with no piece chosen');
  // the stairs are fixed (a two-storey house)
  g.find('devHouse').value='house-r2';g.find('devVisit').click();g.pump(.2);const stairs=texts().findIndex(t=>/^stairs/.test(t));assert(stairs>=0&&/fixed/.test(texts()[stairs]),'the stairs are listed as fixed');
  list.value=String(stairs);list.onchange();g.find('devEast').click();assert.match(g.find('devMessage').textContent,/cannot do that/);
  // saving with no dev server (this test's page is not served by one): it says what to do
  g.find('devInteriorSave').click();await new Promise(r=>setTimeout(r,50));assert.match(g.find('devMessage').textContent,/npm run dev/);assert.equal(g.find('devMessage').dataset.kind,'error');
 }
 // The save keeps what the panel did
 {const saved=JSON.parse(g.store.get('citylife.profile.v1')).progress;assert.equal(saved.cash,S.progress.cash,'the save holds the cash the panel added');assert(saved.routine.minutes<30,'and the time it set (the clock has only run on a little since the last save)');assert(saved.inventory.slots.length>0,'and the items it spawned')}
 g.find('devClose').click();assert(panel.hidden,'the close button hides it');g.send('keydown','F2');assert(!panel.hidden);
 {const e=new Event('keydown',{cancelable:true});e.code='Escape';panel.dispatchEvent(e);assert(panel.hidden,'Escape inside the panel closes it')}
 await g.done();
}

{ // ── Flag off: no button, no panel, and dev.js is never fetched (it is deleted from this copy of the release, and the game still starts) ──
 const g=await bootGame({editRelease:async dir=>{await writeFile(join(dir,'dev-flag.js'),'export const DEV_MODE=false;\n');await rm(join(dir,'dev.js'))}});
 assert.equal(g.find('menuDev'),null,'no Dev Mode button');assert.equal(g.find('devPanel'),null,'no panel');assert(g.ids.get('welcome').hidden,'the game started normally');
 g.send('keydown','F2');assert.equal(g.find('devPanel'),null,'F2 does nothing');
 assert.equal(g.created.some(e=>e.tag==='style'&&e.id==='devStyle'),false,'no dev CSS');
 g.pump(.3);await g.done();
}

{ // ── Nothing of dev mode lives outside its own files ─────────────────────────────────────────────────────────────────────
 const html=await readFile('dist/index.html','utf8'),css=await readFile('dist/style.css','utf8'),game=await readFile('dist/game.js','utf8');
 assert(!/devPanel|menuDev|dev\.js|dev-flag|installDev/.test(html),'index.html does not mention dev mode');assert(!/devPanel|menuDev|devStyle|dev-row/.test(css),'style.css has no dev rules');
 const code=game.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
 assert.equal((code.match(/DEV_MODE/g)||[]).length,2,'game.js: one import and one `if` block, nothing else');assert.equal((code.match(/dev\.js/g)||[]).length,1,'and one dynamic import of dev.js');
}
console.log('Dev mode: Dev Mode menu entry, F2, teleport (named places, snapped to clear ground, never water or off-map), set time (time only), add money (whole cents, capped), spawn items (stacking, full bag), unstick and back to spawn; the flag off or the files deleted leaves no trace and the game starting normally.');
process.exit(0);
