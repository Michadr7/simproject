// B5 wildlife & hunting.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {weaponZoneAt} from '../dist/map-definition.js';
import {freshProgress} from '../dist/jobs.js';
import {buyHuntingLicence,hasHuntingLicence,LICENCE_PRICE_CENTS} from '../dist/kiosk-shift.js';
import {
 WILDLIFE_MAX,DAILY_BAG_LIMIT,WILDLIFE_SPECIES,
 rollChunkWildlife,normalizeHunting,canHuntAt,harvestAnimal,sellHuntHaul,
} from '../dist/wildlife.js';

// 1. Deterministic rollChunkWildlife, species caps, and WILDLIFE_MAX (12) cap
assert.equal(WILDLIFE_MAX,12);
assert.equal(DAILY_BAG_LIMIT,3);
{
 const a=rollChunkWildlife('9:2',1),b=rollChunkWildlife('9:2',1),c=rollChunkWildlife('9:2',2),d=rollChunkWildlife('10:2',1);
 assert.deepEqual(a,b,'identical chunkKey + seed is deterministic');
 assert.notDeepEqual(a,c,'different seed changes spawns');
 assert.notDeepEqual(a,d,'different chunkKey changes spawns');
 for(let i=0;i<30;i++){
  const list=rollChunkWildlife(`9:${i}`,i+1);
  assert(list.length>=1&&list.length<=WILDLIFE_MAX,`total <= ${WILDLIFE_MAX}`);
  const counts=Object.create(null),ids=new Set();
  for(const sp of list){
   assert(Object.hasOwn(WILDLIFE_SPECIES,sp.speciesId),'known species');
   assert(!ids.has(sp.id),'unique id per chunk');
   ids.add(sp.id);
   assert(sp.offsetX>=0&&sp.offsetX<=100&&sp.offsetZ>=0&&sp.offsetZ<=100,'offset inside 100 m chunk');
   assert(sp.yaw>=0&&sp.yaw<Math.PI*2,'yaw in [0, 2pi)');
   counts[sp.speciesId]=(counts[sp.speciesId]||0)+1;
  }
  for(const [id,n] of Object.entries(counts))assert(n<=WILDLIFE_SPECIES[id].cap,`${id} respects cap`);
 }
}

// 2. Real weaponZoneAt zones + licence gate (buyHuntingLicence unlocks hunting)
assert.equal(weaponZoneAt(550,-980).kind,'hunting','Blackstone hunting ground');
assert.equal(weaponZoneAt(760,-790).kind,'open','C1 keepOut is not hunting');
assert.equal(weaponZoneAt(0,0).kind,'noWeapon','town is noWeapon');

let p={...freshProgress(),cash:50000};
assert.equal(hasHuntingLicence(p),false);
assert(canHuntAt(p,550,-980).error,'refused without licence');
assert(canHuntAt(p,760,-790).error,'refused in C1 keepOut');
assert(canHuntAt(p,0,0).error,'refused in town noWeapon');
const lic=buyHuntingLicence(p);
assert(!lic.error);
assert.equal(lic.state.cash,50000-LICENCE_PRICE_CENTS);
p=lic.state;
assert.equal(hasHuntingLicence(p),true);
assert.deepEqual(canHuntAt(p,550,-980),{ok:true});
assert(canHuntAt(p,760,-790).error,'still refused in C1 keepOut even with licence');
assert(canHuntAt(p,0,0).error,'still refused in town even with licence');

// 3. Harvesting, hunting XP, daily bag limit (3), day rollover, and immutability
{
 const beforeCash=p.cash;
 const r1=harvestAnimal(p,'rabbit',550,-980);
 assert(!r1.error);
 assert.equal(p.hunting,undefined,'input progress not mutated');
 assert.equal(r1.state.skills.hunting.xp,WILDLIFE_SPECIES.rabbit.xp);
 assert.deepEqual(r1.state.hunting,{day:1,bagged:1,meatCents:1000,peltCents:1500,count:1});

 const r2=harvestAnimal(r1.state,'deer',550,-980);
 assert(!r2.error);
 assert.equal(r2.state.skills.hunting.xp,WILDLIFE_SPECIES.rabbit.xp+WILDLIFE_SPECIES.deer.xp);
 assert.equal(r2.state.hunting.bagged,2);

 const r3=harvestAnimal(r2.state,'elk',550,-980);
 assert(!r3.error);
 const totalXp=WILDLIFE_SPECIES.rabbit.xp+WILDLIFE_SPECIES.deer.xp+WILDLIFE_SPECIES.elk.xp;
 assert.equal(r3.state.skills.hunting.xp,totalXp);
 assert.deepEqual(r3.state.hunting,{day:1,bagged:3,meatCents:8000,peltCents:11500,count:3});

 assert(canHuntAt(r3.state,550,-980).error,'bag limit reached on day 1');
 assert(harvestAnimal(r3.state,'turkey',550,-980).error,'4th harvest blocked on same day');
 assert(harvestAnimal(r1.state,'unicorn',550,-980).error,'unknown species refused');

 // Next day resets bagged to 0 -> 1 while keeping unsold haul
 const day2={...r3.state,housing:{...r3.state.housing,day:2}};
 assert.deepEqual(canHuntAt(day2,550,-980),{ok:true});
 const r4=harvestAnimal(day2,'turkey',550,-980);
 assert(!r4.error);
 assert.deepEqual(r4.state.hunting,{day:2,bagged:1,meatCents:9800,peltCents:13500,count:4});
 assert.equal(r4.state.cash,beforeCash,'harvesting does not pay cash yet');

 // 4. sellHuntHaul (Eden Outdoors buy-back)
 assert(sellHuntHaul(p).error,'nothing to sell when empty');
 const sold=sellHuntHaul(r4.state);
 assert(!sold.error);
 assert.equal(sold.earned,9800+13500);
 assert.equal(sold.state.cash,beforeCash+23300);
 assert.equal(sold.state.routine.earned,23300);
 assert.deepEqual(sold.state.hunting,{day:2,bagged:1,meatCents:0,peltCents:0,count:0});
 assert(sold.message.includes('$233.00'));
 assert(sellHuntHaul(sold.state).error,'cannot sell twice');

 // 5. normalizeHunting round-trip & empty omission
 assert.deepEqual(normalizeHunting(r4.state.hunting),r4.state.hunting,'haul round-trips');
 assert.deepEqual(normalizeHunting(sold.state.hunting),sold.state.hunting,'post-sale bagged count round-trips');
 assert.equal(normalizeHunting(null),null);
 assert.equal(normalizeHunting({}),null);
 assert.equal(normalizeHunting({day:3,bagged:0,meatCents:0,peltCents:0,count:0}),null);
 assert.equal(normalizeHunting({day:'bad',bagged:-1,meatCents:-5,peltCents:null,count:[]}),null);
 assert.deepEqual(normalizeHunting({day:4,bagged:99,meatCents:100,peltCents:0,count:1}),{day:4,bagged:DAILY_BAG_LIMIT,meatCents:100,peltCents:0,count:1});
}

// 6. Purity check
{
 const src=fs.readFileSync(new URL('../dist/wildlife.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'must not use '+bad);
}

console.log('PASS wildlife: deterministic chunk spawns (<=12 & species caps), Blackstone weaponZoneAt & licence gate, bag limit (3/day), hunting XP, Eden Outdoors haul buy-back, and normalizeHunting.');
