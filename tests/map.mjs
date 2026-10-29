import assert from 'node:assert/strict';
import {MAP,validateMap,roadRects,zoneAtPoint,zoneById,hoursOf} from '../dist/map-definition.js';
import {ZONES,WALKABLE,GROUND,DIRT_ROADS,FIELDS,CITY_WEST,CITY_EAST,WORLD_SEED,zoneAt,isWalkable,worldLayout,fenceSegments} from '../dist/world.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER} from '../dist/shops.js';
import {EXIT,BED,ENTRY} from '../dist/apartment.js';
import {shopOpen,hoursText} from '../dist/routine.js';
import {STUDIO} from '../dist/housing.js';
import {MARKET} from '../dist/jobs.js';

// ── The shipped map is sound, and frozen ───────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
assert(Object.isFrozen(MAP)&&Object.isFrozen(MAP.zones[0].bounds)&&Object.isFrozen(MAP.buildings));assert.throws(()=>{'use strict';MAP.seed=1});

// ── Re-expressing the world in data changed nothing: every number matches the hard-coded version it replaced ──────────
assert.equal(WORLD_SEED,7301);assert.deepEqual(GROUND,{x0:-190,x1:190,z0:-90,z1:90});assert.deepEqual([CITY_WEST,CITY_EAST],[-61,58]);
assert.deepEqual(WALKABLE.map(({zone,x0,x1,z0,z1})=>({zone,x0,x1,z0,z1})),[{zone:'city',x0:-61,x1:58,z0:-48,z1:48},{zone:'farm',x0:-168,x1:-61,z0:-56,z1:56},{zone:'forest',x0:58,x1:168,z0:-56,z1:56}]);
assert.deepEqual(WALKABLE.map(w=>w.grid),[false,true,true]);
assert.deepEqual(ZONES.farm,{id:'farm',name:'Oak Farms',label:'OAK FARMS',subtitle:'Fields & plots',color:'#c9ae63'});assert.equal(ZONES.city.label,'WESTSIDE');assert.equal(ZONES.forest.name,'Alder Woods');
assert.deepEqual(DIRT_ROADS.map(({zone,x0,x1,z0,z1})=>[zone,x0,x1,z0,z1]),[['farm',-168,-55,2.5,9.5],['farm',-112,-108,-56,56],['forest',55,168,2.5,9.5],['forest',111,116,-56,56]]);
assert.deepEqual(roadRects('asphalt').map(({x0,x1,z0,z1})=>[x0,x1,z0,z1]),[[-55,55,-3.5,15.5],[-38,-22,-60,60]]);
assert.equal(FIELDS.length,8);assert.deepEqual(FIELDS[0],{id:'field--156--15',x0:-156,x1:-138,z0:-15,z1:-2,gateSide:'south-of-road'});assert.deepEqual(FIELDS.at(-1),{id:'field--82-12',x0:-82,x1:-66,z0:12,z1:25,gateSide:'north-of-road'});
assert.equal(fenceSegments().length,244);
const layout=worldLayout();let hash=0;for(const t of layout.cuttable)hash=(hash*31+Math.round(t.x*100)*7919+Math.round(t.z*100)*104729)%2147483647;for(const d of layout.decor)hash=(hash*31+Math.round(d.x*100)*7919+Math.round(d.z*100)*104729)%2147483647;
assert.deepEqual([layout.cuttable.length,layout.decor.length,hash],[333,1087,-1284982646],'every tree is exactly where it was');
assert.deepEqual(SHOPS,{market:{name:'Corner Market',x:19,z:-6.3},cafe:{name:'Alder Coffee',x:36,z:-6.3}});assert.deepEqual(MARKET,{name:'Corner Market',x:19,z:-6.3});assert.deepEqual([STUDIO.x,STUDIO.z],[1,-6.3]);
assert.deepEqual(MAP.spawn,{x:-5,y:.2,z:15});assert.deepEqual(MAP.minimap.view,{x0:-176,x1:176,z0:-62,z1:62});assert.equal(MAP.buildings.length,16,'nine city buildings and a backdrop row of seven');
assert.deepEqual(MAP.buildings.filter(b=>b.shop).map(b=>[b.name,b.shop,b.x,b.z,b.w,b.d]),[['CORNER MARKET','market',19,-13.5,15,10],['ALDER COFFEE','cafe',36,-16,15,15]]);
assert.deepEqual(MAP.buildings.slice(-7).map(b=>[b.x,b.z,b.w,b.d,b.h]),[-48,-31,-14,3,20,37,54].map(x=>[x,-61,13,17,12+((x+65)%4)*3]),'the backdrop row');
// Opening hours: the same boundaries as before.
for(const [kind,minute,open] of [['market',419,false],['market',420,true],['market',1319,true],['market',1320,false],['cafe',479,false],['cafe',480,true],['cafe',1079,true],['cafe',1080,false]])assert.equal(shopOpen(kind,{minutes:minute}),open,`${kind} at ${minute}`);
assert.deepEqual(hoursOf('market'),[420,1320]);assert.equal(hoursText('market'),'7 AM–10 PM');assert.equal(hoursText('cafe'),'8 AM–6 PM');

// ── Doorways and interiors: the numbers that used to be literals in game.js, shops.js and apartment.js ──────────────
for(const kind of ['market','cafe']){
 const shop=MAP.shops[kind];
 assert.deepEqual(shop.doorway,{halfWidth:1.3,approach:{halfWidth:2.6,z0:-9.2,z1:-5.4},threshold:-8.4,closedTouch:-7.6,enterHalfWidth:.9,blocker:{z:-8.5,depth:.25},backWall:{z:-9.3,depth:.2},beaconZ:-8.3,exit:{z:-7.6,clamp:.8}},`${kind} doorway`);
 assert.deepEqual(shop.interior,{origin:{y:.165,z:-13.5},frontWallZ:5,entry:{x:0,z:3.9},spawn:{x:0,z:3.1},exit:{x:0,z:4},counter:{x:0,z:-2},exitDoor:{z:4.96,width:2.2,height:2.7,near:{halfWidth:2.4,z:2.7},trigger:{halfWidth:.9,z:4.3}}},`${kind} interior`);
}
assert.notEqual(MAP.shops.market.doorway,MAP.shops.cafe.doorway,'each shop owns its doorway data');
assert.deepEqual([SHOP_ENTRY,SHOP_EXIT,COUNTER],[{x:0,z:3.1},{x:0,z:4},{x:0,z:-2}]);
assert.deepEqual([EXIT,BED,ENTRY],[{x:0,z:4.45},{x:-3.6,z:-2.3},{x:0,z:3.3}]);assert.deepEqual(MAP.studio,{x:1,z:-6.3,doorZ:-8.25,interior:{entry:{x:0,z:3.3},exit:{x:0,z:4.45},bed:{x:-3.6,z:-2.3}}});

// ── Zone lookup ───────────────────────────────────────────────────────────────
for(const [x,z,id] of [[0,0,'city'],[-60.9,10,'city'],[-61,0,'city'],[-61.01,0,'farm'],[-100,-40,'farm'],[58,0,'city'],[58.01,0,'forest'],[120,50,'forest']])assert.equal(zoneAt(x,z).id,id,`${x},${z}`);
assert.equal(zoneAtPoint(0,100),null);assert.equal(zoneAt(0,100).id,'city','outside every zone falls back to the x bands');assert.equal(zoneAt(-150).id,'farm');assert.equal(zoneById('forest').grid,true);assert.equal(zoneById('nope'),null);
assert(isWalkable(0,0)&&!isWalkable(0,60)&&!isWalkable(-170,0));

// ── The validator catches broken maps ──────────────────────────────────────────
const broken=edit=>{const map=structuredClone(MAP);edit(map);return validateMap(map)};
const has=(problems,pattern)=>assert(problems.some(p=>pattern.test(p)),`expected ${pattern}, got ${JSON.stringify(problems)}`);
has(broken(m=>{m.zones[1].bounds.x1=-50}),/zones city and farm overlap/);
has(broken(m=>{m.zones[0].id='farm'}),/duplicate zone id/);
has(broken(m=>{m.zones[2].bounds.x1=999}),/outside the ground/);
has(broken(m=>{m.zones[0].bounds.x0=m.zones[0].bounds.x1}),/invalid bounds/);
has(broken(m=>{m.spawn={x:0,y:0,z:300}}),/spawn is outside/);
has(broken(m=>{m.roads.nodes.oakEast.z=20}),/not axis-aligned/);
has(broken(m=>{m.roads.edges[0].from='nowhere'}),/unknown node/);
has(broken(m=>{m.roads.edges[0].width=0}),/no width/);
has(broken(m=>{m.roads.edges[0].surface='lava'}),/unknown surface/);
has(broken(m=>{m.roads.edges.push({id:'island',from:'alderNorth',to:'alderSouth',width:1,surface:'dirt'});m.roads.nodes.alderNorth={x:500,z:-60};m.roads.nodes.alderSouth={x:500,z:60}}),/outside the ground/);
has(broken(m=>{m.fields[0].x0=-157.5}),/whole-cell/);
has(broken(m=>{m.fields[0]={...m.fields[0],x0:0,x1:10}}),/not inside a plot-grid zone/);
has(broken(m=>{m.fields[0]={...m.fields[0],x0:-130,x1:-120,z0:-10,z1:10}}),/overlaps a dirt road|overlap/);
has(broken(m=>{m.fields[1].gateSide='sideways'}),/no gate side/);
has(broken(m=>{m.buildings.push({...m.buildings[0],name:'COPY'})}),/overlap/);
has(broken(m=>{m.buildings[1].w=0}),/no size/);
has(broken(m=>{m.shops.market.x=30}),/door is not on its building/);
has(broken(m=>{m.shops.market.doorZ=-12}),/front wall/);
has(broken(m=>{m.shops.cafe.z=-12}),/in front of the door/);
has(broken(m=>{m.shops.cafe.hours=[1000,900]}),/invalid hours/);
has(broken(m=>{delete m.buildings[1].shop}),/shop market has no building/);
// Reserved plots: a good one passes, and the bad ones are each caught.
const plot=(over={})=>({id:'R1',kind:'residential',x0:80,z0:20,x1:90,z1:30,...over});
assert.deepEqual(broken(m=>{m.reserved.push(plot())}),[]);
has(broken(m=>{m.reserved.push(plot({kind:'castle'}))}),/unknown kind/);
has(broken(m=>{m.reserved.push(plot({x0:80.5}))}),/whole-cell/);
has(broken(m=>{m.reserved.push(plot({x0:-300,x1:-290}))}),/outside every zone/);
has(broken(m=>{m.reserved.push(plot({x0:0,z0:2,x1:5,z1:8}))}),/overlaps a road/);
has(broken(m=>{m.reserved.push(plot({x0:-150,z0:-10,x1:-140,z1:-5}))}),/overlaps a field/);
has(broken(m=>{m.reserved.push(plot({x0:15,z0:-20,x1:22,z1:-12}))}),/overlaps a building/);
has(broken(m=>{m.reserved.push(plot(),plot({x0:85,x1:95}))}),/duplicate reserved plot/);
has(broken(m=>{m.reserved.push(plot(),plot({id:'R2',x0:85,x1:95}))}),/overlap/);
// Doorway and interior rules.
has(broken(m=>{m.shops.market.doorway.enterHalfWidth=1.2}),/too narrow to reach its entry trigger/);
has(broken(m=>{m.shops.cafe.doorway.approach.halfWidth=1}),/approach zone is narrower than the doorway/);
has(broken(m=>{m.shops.market.doorway.threshold=-9.0}),/behind the back wall/);
has(broken(m=>{m.shops.market.doorway.threshold=-8.0}),/threshold is not at the door/);
has(broken(m=>{m.shops.cafe.doorway.closedTouch=-8.0}),/behind the blocker/);
has(broken(m=>{m.shops.cafe.doorway.approach.z1=-8.0}),/approach zone does not contain/);
has(broken(m=>{m.shops.market.doorway.exit.z=-8.2}),/back inside the entry trigger/);
has(broken(m=>{m.shops.market.interior.origin.z=-12}),/interior front wall is not on the building's front/);
has(broken(m=>{m.shops.cafe.interior.entry.z=4.5}),/entry or spawn is inside the exit trigger/);
has(broken(m=>{m.shops.cafe.interior.exitDoor.near.z=4.5}),/exit door would open after its trigger line/);
has(broken(m=>{m.shops.market.interior.counter.x=7}),/counter is outside the room/);
has(broken(m=>{delete m.shops.cafe.doorway}),/needs a doorway and an interior/);
has(broken(m=>{delete m.studio.interior}),/studio interior needs an entry, exit and bed/);
console.log('Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 42 broken maps are each caught.');
