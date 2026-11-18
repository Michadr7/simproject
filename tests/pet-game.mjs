import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {bootGame} from './support/boot-game.mjs';
import {MSG,NAME_MAX,PET_COOLDOWN} from '../dist/pets.js';
import {applyPetSnapshot} from '../dist/pet-view.js';
import {normalizeProgress} from '../dist/jobs.js';
import {createLobby} from '../dist/relay-protocol.js';
import {CAT_FILES} from '../dist/cat-sounds.js';
import {ALL_FILES} from '../dist/vehicle-sounds.js';
import {MAP} from '../dist/map-definition.js';

// PET3 in the packaged game: moving into the studio brings the shelter's text and offer, the cat is named and lives in the studio, E pats or feeds it, it is saved,
// it runs away after 3 game weeks unfed, and a co-op player's cat snapshot is validated by the relay (junk is dropped).
const g=await bootGame({position:{x:1,z:-6.3}});
try{
 const {GameState,pump,send,ids,created,scene,store}=g,p=()=>GameState.progress,pressE=()=>{send('keydown','KeyE');send('keyup','KeyE');pump(.3)};
 const now=()=>(p().housing.day-1)*1440+Math.floor(p().routine.minutes),toastText=()=>ids.get('jobToast').textContent,label=()=>ids.get('prompt').querySelector('span').textContent;
 GameState.progress={...p(),routine:{...p().routine,minutes:9*60}};pump(5);
 assert.equal(p().pets.offer.status,'none');assert(!p().messages.some(m=>m.text.includes(MSG.offer)),'no offer before you have a home');
 // move in: the shelter texts once, and the offer opens inside
 GameState.progress={...p(),housing:{...p().housing,rented:true}};pump(5);
 assert(!p().messages.some(m=>m.text.includes(MSG.offer)),'not at once: an hour after moving in');
 GameState.progress={...p(),routine:{...p().routine,minutes:p().routine.minutes+61}};pump(5);
 assert(!p().messages.some(m=>m.text.includes(MSG.offer)),'not while you are out');
 pressE();pump(5);assert.equal(ids.get('locationName').textContent,'STUDIO 2B','inside the studio');
 assert.equal(p().messages.filter(m=>m.app==='homes'&&m.text.includes(MSG.offer)).length,1,'the shelter texts');
 assert.equal(ids.get('dialog').hidden,false,'the offer opens at home');assert.match(ids.get('dialogTitle').textContent,/cat/i);assert.equal(ids.get('extraAction').textContent,'No thanks');
 const input=created.find(e=>e.id==='petName');assert(input&&input.tag==='input','the name box');assert.equal(input.maxLength,NAME_MAX);
 input.value='  Mochi!! ';ids.get('jobAction').click();pump(2);
 assert.equal(ids.get('dialog').hidden,true,'closed after adopting');
 const pet0=p().pets.pet;assert.equal(pet0.name,'Mochi','named (cleaned)');assert.equal(pet0.homeId,'studio');assert.equal(p().pets.offer.status,'accepted');
 assert.equal(p().messages.filter(m=>m.text.includes(MSG.offer)).length,1,'no second text');
 // the cat is in the studio scene, shown
 const cat=scene().getObjectByName('pet-cat');assert(cat&&cat.visible,'the cat is shown in the studio');
 assert(Math.abs(cat.position.x)<6&&Math.abs(cat.position.z)<5,'inside the room: '+cat.position.x+','+cat.position.z);
 // 10:30-11:00 is a wander slot: it walks to free spots
 GameState.progress={...p(),routine:{...p().routine,minutes:10*60+31}};pump(.1);
 {const x0=cat.position.x,z0=cat.position.z;pump(10);assert(Math.hypot(cat.position.x-x0,cat.position.z-z0)>.3,'it wanders by day');assert(Math.abs(cat.position.x)<6.05&&Math.abs(cat.position.z)<5.05,'still in the room')}
 // a co-op player's cat in the same room is drawn as a second cat, and goes when they do
 {const cats=()=>scene().children.filter(o=>o.name==='pet-cat'&&o.visible).length;GameState.otherPlayers.v={id:'v',room:'home',position:{x:0,y:0,z:0},pet:applyPetSnapshot({name:'Tom',homeId:'studio',clip:'Sit',x:1,z:1,yaw:0})};pump(.5);
  assert.equal(cats(),2,'a visitor cat');GameState.otherPlayers.v.room='street';pump(.3);assert.equal(cats(),1,'gone when its owner leaves the room');delete GameState.otherPlayers.v}
 // night: it sleeps (stays put); stand on it and E pats it, with a cooldown
 GameState.progress={...p(),routine:{...p().routine,minutes:23*60+30}};pump(3);
 const stand=()=>{GameState.me.position.x=cat.position.x+.05;GameState.me.position.z=cat.position.z;pump(.3)};stand();
 assert.equal(label(),'Pet Mochi');pressE();
 assert.equal(p().pets.pet.affection,5,'a pat');assert.match(toastText(),/Mochi purrs/);const patAt=p().pets.pet.patAt;assert(patAt>=now()-1);
 stand();pressE();assert.equal(p().pets.pet.affection,5,'cooldown');assert.match(toastText(),/just had a pat/);
 GameState.progress={...p(),routine:{...p().routine,minutes:p().routine.minutes+PET_COOLDOWN-25}};pump(1);
 // four days on it is peckish: E feeds it, and that takes a grocery pack
 GameState.progress={...p(),housing:{...p().housing,day:p().housing.day+4},life:{...p().life,groceries:0}};pump(2);stand();
 assert.equal(label(),'Feed Mochi');pressE();assert.match(toastText(),/grocery pack to feed Mochi/);assert.equal(p().pets.pet.fedAt,pet0.fedAt,'not fed without food');
 GameState.progress={...p(),life:{...p().life,groceries:2}};stand();pressE();
 assert(Math.abs(p().pets.pet.fedAt-now())<=1,'fed now');assert.equal(p().life.groceries,1,'one pack used');assert.match(toastText(),/Mochi is eating/);
 stand();assert.equal(label(),'Pet Mochi','fed: back to patting');
 // saved, and a saved game loads it back
 const saved=JSON.parse(store.get('edenridge.profile.v1')).progress;assert.equal(saved.pets.pet.name,'Mochi');assert.equal(saved.pets.pet.fedAt,p().pets.pet.fedAt);
 assert.deepEqual(normalizeProgress(saved).pets,saved.pets,'the save round-trips');assert.equal(normalizeProgress({}).pets.pet,null,'an old save has no cat');
 // outside the cat is hidden
 const exit=MAP.studio.interior.exit;GameState.me.position.x=exit.x;GameState.me.position.z=exit.z;pump(.3);pressE();pump(2);
 assert.notEqual(ids.get('locationName').textContent,'STUDIO 2B','outside');assert.equal(cat.visible,false,'hidden outside the home');
 // three weeks and a day unfed: both warnings, then it runs away
 GameState.progress={...p(),housing:{...p().housing,day:p().housing.day+22}};pump(3);
 assert.equal(p().pets.pet,null,'ran away');assert.equal(p().pets.lostName,'Mochi');assert(Number.isFinite(p().pets.lostAt));
 const texts=p().messages.map(m=>m.text);for(const t of [MSG.warn1('Mochi'),MSG.warn2('Mochi'),MSG.ranaway])assert(texts.includes(t),'phone: '+t);
 assert(texts.indexOf(MSG.ranaway)<texts.indexOf(MSG.warn1('Mochi')),'in order (newest first)');
 const saved2=JSON.parse(store.get('edenridge.profile.v1')).progress;assert.equal(saved2.pets.pet,null);assert.equal(saved2.pets.lostName,'Mochi');
}finally{await g.done()}

// Co-op: the relay passes a cat snapshot on with the position, cleaned, and drops junk (old clients without one see nothing new)
{let t=0,n=0;const sent=[];const lobby=createLobby({send:(peer,m)=>sent.push([peer,m]),close(){},newId:()=>'p'+(++n),now:()=>t});
 lobby.receive('a',JSON.stringify({type:'hello',protocol:1}));lobby.receive('b',JSON.stringify({type:'hello',protocol:1}));
 const move=pet=>{t+=1000;lobby.receive('a',JSON.stringify({type:'position',position:{x:1,y:0,z:2},room:'home',...(pet===undefined?{}:{pet})}));return sent.filter(([peer,m])=>peer==='b'&&m.type==='playerMoved').at(-1)[1]};
 const ok=move({name:'Mochi',homeId:'studio',clip:'walk',x:1.23456,z:-2,yaw:7});assert.deepEqual(ok.pet,{name:'Mochi',homeId:'studio',clip:'walk',x:1.235,z:-2,yaw:applyPetSnapshot({name:'M',homeId:'h',clip:'idle',x:0,z:0,yaw:7}).yaw});
 assert.equal('pet' in move(undefined),false,'no cat: no field');
 for(const junk of [null,'cat',[1,2],{},{name:'<b>',homeId:'studio',clip:'dance',x:0,z:0,yaw:0},{name:'A',homeId:'../x',clip:'idle',x:0,z:0,yaw:0},{name:'A',homeId:'studio',clip:'idle',x:'1',z:0,yaw:0},{name:'A',homeId:'studio',clip:'idle',x:null,z:0,yaw:0},{name:'',homeId:'studio',clip:'idle',x:0,z:0,yaw:0},{name:'A',homeId:'studio',clip:'constructor',x:0,z:0,yaw:0}])
  assert.equal('pet' in move(junk),false,'junk dropped: '+JSON.stringify(junk));
 assert.equal(move({name:'X'.repeat(40),homeId:'house-a',clip:'sleep',x:9e9,z:0,yaw:0}).pet.x,2000,'clamped, name cut');}

// Sounds: the seven cat clips are registered (lazy-loaded with the rest) and on disk
for(const f of CAT_FILES){assert(ALL_FILES.includes(f),f+' registered');assert(existsSync(new URL('../dist/assets/sounds/'+f+'.ogg',import.meta.url)),f+' on disk')}
assert.equal(CAT_FILES.length,7);
console.log('PASS pet-game: offer text + dialog on moving in, naming, cat shown in the studio and hidden outside, pat (cooldown) and feed (a grocery pack), save round-trip, run-away after 3 weeks with both warnings, relay cleans co-op cat snapshots, 7 cat sounds registered.');
