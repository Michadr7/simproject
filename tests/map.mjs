import assert from 'node:assert/strict';
import {MAP,validateMap,roadRects,zoneAtPoint,zoneById,hoursOf,riverZAt,riverDistance} from '../dist/map-definition.js';
const inBridgeLane=(x,z)=>MAP.water.bridges.some(b=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1);
import {ZONES,WALKABLE,GROUND,DIRT_ROADS,FIELDS,CITY_WEST,CITY_EAST,WORLD_SEED,zoneAt,isWalkable,worldLayout,fenceSegments,inRiver} from '../dist/world.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER} from '../dist/shops.js';
import {EXIT,BED,ENTRY} from '../dist/apartment.js';
import {shopOpen,hoursText} from '../dist/routine.js';
import {STUDIO} from '../dist/housing.js';
import {MARKET} from '../dist/jobs.js';

// ── The shipped map is sound, and frozen ───────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
assert(Object.isFrozen(MAP)&&Object.isFrozen(MAP.zones[0].bounds)&&Object.isFrozen(MAP.buildings));assert.throws(()=>{'use strict';MAP.seed=1});

// ── The map: the city exactly where it was, a curving river with the County Bridge, Willow Fields (north-west) and Pine Ridge (north-east) ──────
assert.equal(WORLD_SEED,7301);assert.deepEqual(GROUND,{x0:-260,x1:260,z0:-310,z1:110});assert.deepEqual([CITY_WEST,CITY_EAST],[-61,58]);
assert.deepEqual(WALKABLE.map(({zone,x0,x1,z0,z1})=>({zone,x0,x1,z0,z1})),[{zone:'city',x0:-61,x1:58,z0:-48,z1:48},{zone:'county',x0:-35,x1:-25,z0:-246,z1:-48},{zone:'farm',x0:-170,x1:-35,z0:-216,z1:-108},{zone:'forest',x0:-25,x1:150,z0:-246,z1:-146}]);
assert.deepEqual(WALKABLE.map(w=>w.grid),[false,false,true,true]);
assert.deepEqual(ZONES.farm,{id:'farm',name:'Willow Fields',label:'WILLOW FIELDS',subtitle:'Fields & plots',color:'#c9ae63'});assert.equal(ZONES.city.label,'WESTSIDE');assert.equal(ZONES.forest.name,'Pine Ridge');assert.equal(ZONES.county.label,'COUNTY ROAD');
assert.deepEqual(DIRT_ROADS.map(({zone,x0,x1,z0,z1})=>[zone,x0,x1,z0,z1]),[['farm',-164,-34,-163.5,-156.5],['forest',-26,150,-183.5,-176.5],['forest',87.5,92.5,-246,-146]]);
assert.deepEqual(roadRects('asphalt').map(({x0,x1,z0,z1})=>[x0,x1,z0,z1]),[[-55,55,-3.5,15.5],[-38,-22,-60,60],[-34,-26,-246,-60]],'the city streets are as they were, plus the County Road');
// Willow Fields: three big open fields, each its own ground, and a fence only around the perimeter.
assert.deepEqual(FIELDS.map(f=>[f.id,f.surface,f.x0,f.x1,f.z0,f.z1]),[['field-wheat','wheat',-165,-90,-208,-170],['field-plowed','plowed',-165,-115,-150,-114],['field-green','green',-108,-52,-150,-114]]);
for(const f of FIELDS)assert((f.x1-f.x0)>=50&&(f.z1-f.z0)>=36,'big enough for a tractor to turn in: '+f.id);
assert.equal(fenceSegments().length,240);
const layout=worldLayout();let hash=0;for(const t of layout.cuttable)hash=(hash*31+Math.round(t.x*100)*7919+Math.round(t.z*100)*104729)%2147483647;for(const d of layout.decor)hash=(hash*31+Math.round(d.x*100)*7919+Math.round(d.z*100)*104729)%2147483647;
assert.deepEqual([layout.cuttable.length,layout.decor.length,hash],[406,354,-1885582030],'the generated forest and scenery are unchanged (a deliberate change to the map means updating these numbers)');
const forestTrees=layout.cuttable.length+layout.decor.filter(t=>zoneAtPoint(t.x,t.z)?.id==='forest').length;assert(forestTrees>=400&&forestTrees<=500,'Pine Ridge has '+forestTrees+' trees');
for(const c of MAP.scenery.forest.clearings)assert(![...layout.cuttable,...layout.decor].some(t=>((t.x-c.x)/c.rx)**2+((t.z-c.z)/c.rz)**2<1),'nothing grows in a clearing');
assert(MAP.scenery.forest.clearings.some(c=>c.x===106&&c.z===-212&&c.rx===30&&c.rz===24),'the north-east Sawmill clearing is kept (60 x 48 m)');
// The river: a gentle curve rising from the south-west to the north-east, north of the city, crossed by the bridge at the County Road.
const river=MAP.water.rivers[0];assert.equal(river.id,'north-river');assert.equal(river.width,12);assert.equal(river.points.length,8);
assert.deepEqual(MAP.water.bridges,[{id:'county-bridge',river:'north-river',x0:-35,x1:-25,z0:-104,z1:-76}]);
assert(Math.abs(riverZAt(river,-30)+90)<.01,'the river crosses the County Road at z = -90');
const slopes=[];for(let x=-250;x<250;x+=50)slopes.push((riverZAt(river,x+50)-riverZAt(river,x))/50);
assert(slopes.every(k=>k<-.05&&k>-.35),'always gently rising to the north-east: '+slopes.map(k=>k.toFixed(2)));assert(slopes.at(-1)<slopes[0]-.08,'and curving (steeper to the east)');
for(const x of [-61,-30,0,58]){const z=riverZAt(river,x);assert(z<-48-20,'well north of the city at x='+x+': '+z.toFixed(1))}
for(const b of MAP.buildings)assert(riverDistance(b.x,b.z,river)>b.d/2+river.width/2+river.bank+3,'no building near the river: '+(b.name||b.x));
for(const [x,z] of [[-30,-86],[-34.9,-86],[-25.1,-80.5],[-30,-100],[-30,-60]])assert(isWalkable(x,z),`the bridge and road are walkable at ${x},${z}`);
for(const [x,z] of [[-35.1,-86],[-24.9,-86],[-100,-86],[100,-110],[0,-95],[-100,-80]])assert(!isWalkable(x,z),`the river is a wall at ${x},${z}`);
assert(inRiver(-30,-90)&&inRiver(0,-94.4)&&!inRiver(-30,-70)&&inRiver(0,-103,4)&&!inRiver(0,-110,4));
assert(riverDistance(0,-94.4,river)<.1);
assert.deepEqual(SHOPS,{market:{name:'Corner Market',x:19,z:-6.3},cafe:{name:'Alder Coffee',x:36,z:-6.3}});assert.deepEqual(MARKET,{name:'Corner Market',x:19,z:-6.3});assert.deepEqual([STUDIO.x,STUDIO.z],[1,-6.3]);
assert.deepEqual(MAP.spawn,{x:-5,y:.2,z:15});assert.deepEqual(MAP.minimap.view,{x0:-200,x1:180,z0:-250,z1:90});assert.equal(MAP.buildings.length,15,'nine city buildings and a backdrop row of six (none on the County Road)');
assert.deepEqual(MAP.buildings.filter(b=>b.shop).map(b=>[b.name,b.shop,b.x,b.z,b.w,b.d]),[['CORNER MARKET','market',19,-13.5,15,10],['ALDER COFFEE','cafe',36,-16,15,15]]);
assert.deepEqual(MAP.buildings.slice(-6).map(b=>[b.x,b.z,b.w,b.d,b.h]),[-48,-14,3,20,37,54].map(x=>[x,-61,13,17,12+((x+65)%4)*3]),'the backdrop row, minus the building that would stand on the County Road');
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
for(const [x,z,id] of [[0,0,'city'],[-60.9,10,'city'],[-61,0,'city'],[58,0,'city'],[-30,-48,'city'],[-30,-48.1,'county'],[-30,-100,'county'],[-100,-150,'farm'],[-35.1,-150,'farm'],[60,-150,'forest'],[-24.9,-150,'forest']])assert.equal(zoneAt(x,z).id,id,`${x},${z}`);
assert.equal(zoneAtPoint(-61.01,0),null);assert.equal(zoneAtPoint(0,-94),null,'the river is outside every zone');assert.equal(zoneAt(0,100).id,'city','outside every zone falls back to the city');assert.equal(zoneById('forest').grid,true);assert.equal(zoneById('county').grid,false);assert.equal(zoneById('nope'),null);
assert(isWalkable(0,0)&&!isWalkable(0,60)&&!isWalkable(-170.1,-150)&&!isWalkable(-30,-246.1));

// ── The validator catches broken maps ──────────────────────────────────────────
const broken=edit=>{const map=structuredClone(MAP);edit(map);return validateMap(map)};
const has=(problems,pattern)=>assert(problems.some(p=>pattern.test(p)),`expected ${pattern}, got ${JSON.stringify(problems)}`);
has(broken(m=>{m.zones[2].bounds.x1=-30}),/zones county and farm overlap/);
has(broken(m=>{m.zones[0].id='farm'}),/duplicate zone id/);
has(broken(m=>{m.zones[3].bounds.x1=999}),/outside the ground/);
has(broken(m=>{m.zones[0].bounds.x0=m.zones[0].bounds.x1}),/invalid bounds/);
has(broken(m=>{m.spawn={x:0,y:0,z:300}}),/spawn is outside/);
has(broken(m=>{m.roads.nodes.oakEast.z=20}),/not axis-aligned/);
has(broken(m=>{m.roads.edges[0].from='nowhere'}),/unknown node/);
has(broken(m=>{m.roads.edges[0].width=0}),/no width/);
has(broken(m=>{m.roads.edges[0].surface='lava'}),/unknown surface/);
has(broken(m=>{m.roads.edges.push({id:'island',from:'alderNorth',to:'alderSouth',width:1,surface:'dirt'});m.roads.nodes.alderNorth={x:500,z:-60};m.roads.nodes.alderSouth={x:500,z:60}}),/outside the ground/);
has(broken(m=>{m.fields[0].x0=-157.5}),/whole-cell/);
has(broken(m=>{m.fields[0]={...m.fields[0],x0:0,x1:10,z0:0,z1:10}}),/not inside a plot-grid zone/);
has(broken(m=>{m.fields[0]={...m.fields[0],x0:-130,x1:-120,z0:-165,z1:-155}}),/overlaps a dirt road/);
has(broken(m=>{m.fields[1].surface='lava'}),/unknown surface/);
has(broken(m=>{m.fields.push({...m.fields[0],id:'again'})}),/overlap/);
has(broken(m=>{m.buildings.push({...m.buildings[0],name:'COPY'})}),/overlap/);
has(broken(m=>{m.buildings[1].w=0}),/no size/);
has(broken(m=>{m.shops.market.x=30}),/door is not on its building/);
has(broken(m=>{m.shops.market.doorZ=-12}),/front wall/);
has(broken(m=>{m.shops.cafe.z=-12}),/in front of the door/);
has(broken(m=>{m.shops.cafe.hours=[1000,900]}),/invalid hours/);
has(broken(m=>{delete m.buildings[1].shop}),/shop market has no building/);
// Reserved plots: a good one passes, and the bad ones are each caught.
const plot=(over={})=>({id:'R1',kind:'residential',x0:60,z0:-240,x1:70,z1:-230,...over});
assert.deepEqual(broken(m=>{m.reserved.push(plot())}),[]);
has(broken(m=>{m.reserved.push(plot({kind:'castle'}))}),/unknown kind/);
has(broken(m=>{m.reserved.push(plot({x0:60.5}))}),/whole-cell/);
has(broken(m=>{m.reserved.push(plot({x0:-300,x1:-290}))}),/outside every zone/);
has(broken(m=>{m.reserved.push(plot({x0:0,z0:2,x1:5,z1:8}))}),/overlaps a road/);
has(broken(m=>{m.reserved.push(plot({x0:-150,z0:-190,x1:-140,z1:-185}))}),/overlaps a field/);
has(broken(m=>{m.reserved.push(plot({x0:15,z0:-20,x1:22,z1:-12}))}),/overlaps a building/);
has(broken(m=>{m.reserved.push(plot(),plot({x0:65,x1:75}))}),/duplicate reserved plot/);
has(broken(m=>{m.reserved.push(plot(),plot({id:'R2',x0:65,x1:75}))}),/overlap/);
// River, bridge, reachability and clearings.
has(broken(m=>{m.water.bridges=[]}),/zone county walks into river north-river where there is no bridge/);
has(broken(m=>{m.water.bridges[0].x0=-36}),/not exactly as wide as a walkable zone/);
has(broken(m=>{m.water.bridges[0].z0=-85}),/does not reach both banks/);
has(broken(m=>{m.water.bridges[0].river='nowhere'}),/crosses an unknown river/);
has(broken(m=>{m.water.rivers[0].points=[[0,0]]}),/needs at least two points and a width/);
has(broken(m=>{m.water.rivers[0].points.push([900,-150])}),/leaves the ground/);
has(broken(m=>{m.water.rivers[0].points[3]=[-30,-130]}),/zone (farm|forest|county) walks into river/);
has(broken(m=>{m.zones[2].bounds.x1=-40}),/zone farm cannot be reached on foot from the city/);
has(broken(m=>{m.zones[3].bounds.x0=-20}),/zone forest cannot be reached on foot from the city/);
has(broken(m=>{m.scenery.forest.clearings.push({x:140,z:-190,rx:30,rz:30})}),/clearing at 140,-190 reaches outside the forest/);
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
console.log('Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 60 broken maps are each caught.');
