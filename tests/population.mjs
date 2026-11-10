// The people of the town (0.35.4, DESIGN 4.20): homes and posts are map data, the population is built from them by fixed rules,
// the same every time; a new home fills itself and nobody else moves; every post is held; cars, outfits and places are sound.
import assert from 'node:assert/strict';
import {MAP,validateMap} from '../dist/map-definition.js';
import {OUTFITS,palettes} from '../dist/appearance.js';
import {buildPopulation,townPopulation,placePoint,tripOf,hashOf,residentsOf,staffOf,employeesOf,personById,isAway,HOUSEHOLD_MAX,FLAT_MAX,WALK_LIMIT,DRIVE_OVER} from '../dist/population.js';

assert.deepEqual(validateMap(),[],'the map, with its dwellings and posts, is sound');
const town=buildPopulation(),byId=id=>personById(town,id);

// the same town every time, and the cached one is that town
assert.deepEqual(buildPopulation(),town);assert.deepEqual(townPopulation(),town);assert.equal(townPopulation(),townPopulation());
assert.equal(hashOf(1,'a'),hashOf(1,'a'));assert.notEqual(hashOf(1,'a'),hashOf(1,'b'));

// ids and names are unique; everyone has a body, an outfit their body can wear, and colours from the palettes
assert.equal(new Set(town.people.map(p=>p.id)).size,town.people.length);
assert.equal(new Set(town.people.map(p=>p.name)).size,town.people.length,'no two people share a name');
for(const p of town.people){
 assert.ok(['male','female'].includes(p.body),p.id);
 assert.ok(OUTFITS[p.body].some(o=>o[0]===p.outfit),`${p.name} wears ${p.outfit}`);
 if(p.workOutfit)assert.ok(OUTFITS[p.body].some(o=>o[0]===p.workOutfit),`${p.name} works in ${p.workOutfit}`);
 assert.ok(palettes.skin.some(s=>s[1]===p.skin)&&palettes.hair.some(s=>s[1]===p.hair));
 assert.ok(placePoint(p.home),`${p.name} lives at a known place`);
}

// homes: every NPC-owned property has a household headed by its owner; vacant houses, shops and the player's studio have nobody
for(const prop of MAP.properties){const live=residentsOf(town,'property:'+prop.id);
 if(prop.owner?.type==='npc'){
  assert.ok(live.length>=1&&live.length<=(HOUSEHOLD_MAX[prop.size]||HOUSEHOLD_MAX.small),`${prop.name} holds ${live.length}`);
  assert.equal(live[0].name,prop.owner.name);if(prop.owner.body)assert.equal(live[0].body,prop.owner.body);
  const family=prop.owner.name.split(' ').pop();for(const p of live)assert.ok(p.name.endsWith(' '+family),`${p.name} is a ${family}`);
 }else assert.equal(live.length,0,`nobody lives at ${prop.name}`);
}
assert.equal(byId('farm-house#1').outfit,'Farmer');
for(const d of MAP.dwellings){const flats=town.households.filter(h=>h.home==='dwelling:'+d.id);
 assert.equal(flats.length,d.units);assert.equal(flats.filter(h=>h.car).length,d.cars);
 for(const h of flats)assert.ok(h.members.length>=1&&h.members.length<=FLAT_MAX);
 d.residents.forEach((r,i)=>{const p=byId(flats[i].members[0]);assert.equal(p.name,r.name);assert.equal(p.body,r.body);assert.equal(p.outfit,r.outfit)});
}
// the six people who already walk Oak Street, the café's Elena and the market's Noah live in the flats
for(const name of ['Alex','Sophie','Robert','Julia','Carlos','Megan','Elena','Noah'])assert.equal(town.people.find(p=>p.name===name)?.home,'dwelling:oak-apartments',name);
const residents=town.people.filter(p=>p.resident);
assert.ok(residents.length>=18&&residents.length<=40,`${residents.length} residents`);
for(const h of town.households){assert.ok(h.members.every(id=>byId(id).household===h.id&&byId(id).home===h.home));
 const drivers=h.members.filter(id=>byId(id).drives);assert.ok(drivers.length<=(h.car?1:0),`${h.id}: one car, one driver`);assert.equal(h.driver,drivers[0]||null)}

// posts: one holder each, the right number of slots, named posts held by the named person
assert.equal(town.posts.length,MAP.posts.reduce((n,p)=>n+(p.count||1),0));
for(const slot of town.posts){const p=byId(slot.holder),data=MAP.posts.find(x=>x.id===slot.post);
 assert.ok(p,`${slot.id} is held`);assert.equal(p.post,slot.id);assert.equal(p.work,slot.place);assert.deepEqual(p.hours,data.hours);assert.equal(p.role,data.role);
 assert.ok(placePoint(slot.place),`${slot.id} is at a known place`);
 if(data.person)assert.equal(p.name,data.person.name);
 if(data.outfit&&OUTFITS[p.body].some(o=>o[0]===data.outfit))assert.equal(p.workOutfit,data.outfit);
 // a resident gets to work on foot within the walking limit, or drives; a commuter always drives
 const way=tripOf(p.home,p.work,p);
 if(p.resident){if(!p.drives)assert.ok(way.metres<=WALK_LIMIT,`${p.name} walks ${Math.round(way.metres)} m to ${slot.id}`)}
 else{assert.ok(isAway(p.home)&&p.drives);assert.equal(way.mode,'drive')}
}
assert.equal(new Set(town.posts.map(s=>s.holder)).size,town.posts.length,'nobody holds two posts');
assert.equal(town.people.find(p=>p.name==='Elena').post,'cafe-manager');assert.equal(town.people.find(p=>p.name==='Noah').post,'market-day');
assert.equal(town.people.find(p=>p.name==='Hal Brennan').work,'property:farm-house');
const walt=town.people.find(p=>p.name==='Walt Hargrove');assert.ok(!walt.resident&&walt.home==='away:east'&&walt.outfit==='Suit','Walt drives in from out of town');
assert.deepEqual(staffOf(town,'shop:market').map(p=>p.post).sort(),['market-day','market-evening']);
assert.equal(employeesOf(town,'ridgeline').length,5,'Ridgeline: the owner, two fellers, a sawyer and a yard hand');
// people without a post either work out of town (and drive) or stay home; some of each kind of day exists
for(const p of town.people.filter(x=>!x.post))assert.ok(p.resident&&(p.work===null||(isAway(p.work)&&p.drives)));
assert.ok(town.people.some(p=>!p.post&&!p.work),'somebody is at home in the day');

// places: every point is inside the playable map; trips take time, short ones are walked, long ones driven only with a car
const inMap=q=>q.x>=MAP.playable.x0&&q.x<=MAP.playable.x1&&q.z>=MAP.playable.z0&&q.z<=MAP.playable.z1;
for(const place of new Set(town.people.flatMap(p=>[p.home,p.work].filter(Boolean))))assert.ok(inMap(placePoint(place)),place);
assert.deepEqual(placePoint('shop:market'),{x:MAP.shops.market.x,z:MAP.shops.market.z});
assert.deepEqual(placePoint('away:east'),{x:MAP.playable.x1,z:65});
assert.equal(placePoint('property:house-r2').z,-61,'a house is reached at the street end of its front path');
assert.equal(placePoint('property:nowhere'),null);
assert.deepEqual(tripOf('shop:market','shop:market',{}),{metres:0,mode:'walk',minutes:0});
const near=tripOf('shop:market','shop:cafe',{drives:true});assert.equal(near.mode,'walk');assert.ok(near.metres<DRIVE_OVER&&near.minutes>=2);
const far=['property:house-r2','zone:forest'];assert.equal(tripOf(...far,{drives:true}).mode,'drive');assert.equal(tripOf(...far,{drives:false}).mode,'walk');
assert.ok(tripOf(...far,{drives:true}).minutes<tripOf(...far,{drives:false}).minutes);

// a new home fills itself, and nobody who was already there changes home, household or post-holding id
{const map=structuredClone(MAP),sold=map.properties.find(p=>p.id==='house-r1');sold.owner={type:'npc',name:'Ada Lovell',body:'female'};delete sold.listing;
 assert.deepEqual(validateMap(map),[]);
 const next=buildPopulation(map),moved=residentsOf(next,'property:house-r1');
 assert.ok(moved.length>=1&&moved[0].name==='Ada Lovell');
 for(const p of town.people.filter(x=>x.resident)){const q=personById(next,p.id);assert.ok(q,p.id);assert.equal(q.home,p.home);assert.equal(q.household,p.household)}
 assert.ok(next.posts.every(s=>s.holder));
 // a bigger block of flats, and a new post: both are filled
 map.dwellings[0].units+=3;map.posts.push({id:'night-clerk',at:{shop:'market'},role:'Clerk',hours:[1200,1380],count:2});
 assert.deepEqual(validateMap(map),[]);
 const grown=buildPopulation(map);assert.equal(grown.households.filter(h=>h.home==='dwelling:oak-apartments').length,MAP.dwellings[0].units+3);
 assert.equal(grown.posts.filter(s=>s.post==='night-clerk'&&s.holder).length,2);}

// validateMap catches bad people data
{const broken=change=>{const map=structuredClone(MAP);change(map);return validateMap(map).join('\n')};
 assert.match(broken(m=>{m.posts[0].hours=[1300,1500]}),/hours inside one day/);
 assert.match(broken(m=>{m.posts[0].at={shop:'nowhere'}}),/must be at one known/);
 assert.match(broken(m=>{m.posts[1].person={name:'Noah'}}),/Noah holds two posts/);
 assert.match(broken(m=>{m.posts.push({...m.posts[1]})}),/duplicate id/);
 assert.match(broken(m=>{m.dwellings[0].units=2}),/more residents than it has units/);
 assert.match(broken(m=>{m.dwellings[0].door={x:1,z:-15}}),/inside a building/);
 assert.match(broken(m=>{m.dwellings[0].cars=99}),/cars/);
 assert.match(broken(m=>{m.properties.find(p=>p.id==='house-r2').owner.body='robot'}),/unknown body/);
 assert.match(broken(m=>{m.exits=[]}),/posts need a map exit/);}

console.log(`population tests passed: ${residents.length} residents in ${town.households.length} households, ${town.people.length-residents.length} commuters, ${town.posts.length} posts`);
