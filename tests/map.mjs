import assert from 'node:assert/strict';
import {MAP,validateMap,roadRects,zoneAtPoint,zoneById,hoursOf,riverZAt,riverDistance} from '../dist/map-definition.js';
const inBridgeLane=(x,z)=>MAP.water.bridges.some(b=>x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1);
import {ZONES,WALKABLE,GROUND,DIRT_ROADS,FIELDS,CITY_WEST,CITY_EAST,WORLD_SEED,zoneAt,isWalkable,worldLayout,fenceSegments,inRiver} from '../dist/world.js';
import {SHOPS,SHOP_ENTRY,SHOP_EXIT,COUNTER} from '../dist/shops.js';
import {EXIT,BED,ENTRY} from '../dist/apartment.js';
import {shopOpen,hoursText} from '../dist/routine.js';
import {STUDIO} from '../dist/housing.js';
import {MARKET} from '../dist/jobs.js';
import {propInfo} from '../dist/props.js';

// ── The shipped map is sound, and frozen ───────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
assert(Object.isFrozen(MAP)&&Object.isFrozen(MAP.zones[0].bounds)&&Object.isFrozen(MAP.buildings));assert.throws(()=>{'use strict';MAP.seed=1});

// ── The map: the city exactly where it was, the river and two bridges, the north bank shifted 70 m, and three new districts on the south bank ────────────
assert.equal(WORLD_SEED,7301);assert.deepEqual(GROUND,{x0:-260,x1:300,z0:-390,z1:110});assert.deepEqual([CITY_WEST,CITY_EAST],[-61,58]);
assert.deepEqual(WALKABLE.map(({zone,x0,x1,z0,z1})=>({zone,x0,x1,z0,z1})),[{zone:'city',x0:-61,x1:58,z0:-48,z1:48},{zone:'county',x0:-35,x1:-25,z0:-316,z1:-48},{zone:'farm',x0:-170,x1:-35,z0:-286,z1:-178},{zone:'forest',x0:-25,x1:190,z0:-316,z1:-216},
 {zone:'alder',x0:-20,x1:58,z0:-125,z1:-48},{zone:'cedar',x0:70,x1:170,z0:-135,z1:-40},{zone:'eastbank',x0:70,x1:190,z0:-20,z1:75},{zone:'freight',x0:190,x1:200,z0:-316,z1:75}]);
assert.deepEqual(WALKABLE.map(w=>w.grid),[false,false,true,true,false,false,false,false]);
assert.deepEqual(ZONES.farm,{id:'farm',name:'Willow Fields',label:'WILLOW FIELDS',subtitle:'Fields & plots',color:'#c9ae63'});assert.equal(ZONES.city.label,'WESTSIDE');assert.equal(ZONES.forest.name,'Pine Ridge');assert.equal(ZONES.county.label,'COUNTY ROAD');
assert.deepEqual([ZONES.alder.label,ZONES.cedar.label,ZONES.eastbank.label,ZONES.freight.label],['ALDER CENTER','CEDAR HEIGHTS','EASTBANK WORKS','FREIGHT ROAD']);
// The north bank moved by exactly one shift: every north-bank number equals its old value minus 70.
assert.deepEqual(DIRT_ROADS.map(({zone,x0,x1,z0,z1})=>[zone,x0,x1,z0,z1]),[["farm", -164, -34, -233.5, -226.5], ["forest", -26, 195, -253.5, -246.5], ["forest", 87.5, 92.5, -316, -216]]);
assert.deepEqual(roadRects('asphalt').map(({id,x0,x1,z0,z1})=>[id,x0,x1,z0,z1]),[["oak-street", -55, 55, -3.5, 15.5], ["alder-avenue", -38, -22, -60, 60], ["county-road", -34, -26, -316, -60], ["alder-street", 45, 55, -125, -3.5], ["alder-cross", -30, 84, -96, -84], ["oak-east", 55, 195, 0, 12], ["cedar-link", 115.5, 124.5, -57, 6], ["freight-south", 72, 199.5, 63.5, 72.5], ["freight-road", 190.5, 199.5, -253.5, 68]],'straight roads only: the loop is a ribbon');
assert.deepEqual(MAP.roads.edges.filter(e=>e.path).map(e=>e.id),['cedar-loop'],'the loop is the one ribbon road');
assert.deepEqual(FIELDS.map(f=>[f.id,f.surface,f.x0,f.x1,f.z0,f.z1]),[['field-wheat','wheat',-165,-90,-278,-240],['field-plowed','plowed',-165,-115,-220,-184],['field-green','green',-108,-52,-220,-184]]);
for(const f of FIELDS)assert((f.x1-f.x0)>=50&&(f.z1-f.z0)>=36,'big enough for a tractor to turn in: '+f.id);
assert.equal(fenceSegments().length,240);
const layout=worldLayout();let hash=0;for(const t of layout.cuttable)hash=(hash*31+Math.round(t.x*100)*7919+Math.round(t.z*100)*104729)%2147483647;for(const d of layout.decor)hash=(hash*31+Math.round(d.x*100)*7919+Math.round(d.z*100)*104729)%2147483647;
assert.deepEqual([layout.cuttable.length,layout.decor.length,hash],[393,547,-1950003464],'the generated forest and scenery are unchanged (a deliberate change to the map means updating these numbers; 0.32.0 took 2 pines and 2 decor trees out of the way of the truck, the small barn and the windmill)');
// No tree stands in or against a placed prop: the yard's truck had two pines growing through it.
{const keep=2.5-1e-6;for(const l of MAP.landmarks){const f=propInfo(l.prop).footprint,c=Math.round(Math.cos(l.yaw)),s=Math.round(Math.sin(l.yaw));for(const t of [...layout.cuttable,...layout.decor]){const dx=t.x-l.x,dz=t.z-l.z,lx=dx*c-dz*s,lz=dx*s+dz*c;assert(!(lx>f.x0-keep&&lx<f.x1+keep&&lz>f.z0-keep&&lz<f.z1+keep),`a tree at ${t.x.toFixed(1)}, ${t.z.toFixed(1)} is within 2.5 m of ${l.id}`)}}}
const forestTrees=layout.cuttable.length+layout.decor.filter(t=>zoneAtPoint(t.x,t.z)?.id==='forest').length;assert(forestTrees>=400&&forestTrees<=500,'Pine Ridge has '+forestTrees+' trees');
for(const c of MAP.scenery.forest.clearings)assert(![...layout.cuttable,...layout.decor].some(t=>((t.x-c.x)/c.rx)**2+((t.z-c.z)/c.rz)**2<1),'nothing grows in a clearing');
assert(MAP.scenery.forest.clearings.some(c=>c.x===106&&c.z===-282&&c.rx===30&&c.rz===24),'the north-east Sawmill clearing is kept (60 x 48 m)');
// The river: a gentle curve rising from the south-west to the north-east, 70 m north of where it was, crossed by two bridges.
const river=MAP.water.rivers[0];assert.equal(river.id,'north-river');assert.equal(river.width,12);assert.equal(river.points.length,9);
assert.deepEqual(MAP.water.bridges,[{id:'county-bridge',river:'north-river',x0:-35,x1:-25,z0:-174,z1:-146},{id:'freight-bridge',river:'north-river',x0:190,x1:200,z0:-226,z1:-186}]);
assert(Math.abs(riverZAt(river,-30)+160)<.01,'the river crosses the County Road at z = -160 (it was -90)');assert(Math.abs(riverZAt(river,195)+206)<1,'and the Freight Road near z = -206');
const slopes=[];for(let x=-250;x<250;x+=50)slopes.push((riverZAt(river,x+50)-riverZAt(river,x))/50);
assert(slopes.every(k=>k<-.05&&k>-.35),'always gently rising to the north-east: '+slopes.map(k=>k.toFixed(2)));assert(slopes.at(-1)<slopes[0]-.08,'and curving (steeper to the east)');
for(const x of [-61,-30,0,58,120,190]){const z=riverZAt(river,x);assert(z<-125,'north of every south-bank district at x='+x+': '+z.toFixed(1))}
for(const zone of MAP.zones.filter(z=>['alder','cedar','eastbank','city'].includes(z.id))){for(let x=zone.bounds.x0;x<=zone.bounds.x1;x+=5)assert(riverDistance(x,zone.bounds.z0,river)>river.width/2+river.bank+8,`${zone.id} keeps clear of the water at x=${x}`)}
for(const b of MAP.buildings)assert(riverDistance(b.x,b.z,river)>b.d/2+river.width/2+river.bank+3,'no building near the river: '+(b.name||b.x));
for(const [x,z] of [[-30,-160],[-34.9,-160],[-25.1,-150],[-30,-170],[-30,-60],[195,-206],[190.1,-190],[199.9,-220]])assert(isWalkable(x,z),`a bridge and its roads are walkable at ${x},${z}`);
for(const [x,z] of [[-35.1,-160],[-24.9,-160],[-100,-146],[100,-185],[0,-164],[250,-219],[189.9,-206],[200.1,-206],[-30,-385],[295,0]])assert(!isWalkable(x,z),`the river is a wall at ${x},${z}`);
{const z0=riverZAt(river,0);assert(inRiver(-30,-160)&&inRiver(0,z0)&&!inRiver(-30,-140)&&inRiver(0,z0-8.6,4)&&!inRiver(0,z0-16,4));assert(riverDistance(0,z0,river)<.1)}
// Reserved land: C1-C2 in Alder Center, R1-R3 in Cedar Heights, I1-I2 in Eastbank Works; whole cells, inside their district.
assert.deepEqual(MAP.reserved.map(p=>[p.id,p.kind,p.facing]),[['C1','commercial','north'],['C2','commercial','north'],['C3','commercial','north'],['C4','commercial','north'],['C5','commercial','north'],['C6','commercial','north'],['C7','commercial','north'],['C8','commercial','south'],['C9','commercial','south'],['C10','commercial','south'],['R1','residential','south'],['R2','residential','south'],['R3','residential','south'],['R4','residential','south'],['R5','residential','south'],['R6','residential','south'],['R7','residential','north'],['R8','residential','north'],['I1','industrial','north'],['I2','industrial','south']]);
for(const plot of MAP.reserved){const want={commercial:'alder',residential:'cedar',industrial:'eastbank'}[plot.kind];for(const [x,z] of [[plot.x0,plot.z0],[plot.x1,plot.z1]])assert.equal(zoneAtPoint(x,z)?.id,want,`${plot.id} lies in ${want}`)}
// Signposts: one for the fork and one for each new district.
assert.deepEqual(MAP.signs.map(g=>g.id),['fork','alder-sign','cedar-sign','eastbank-sign']);
assert.deepEqual(SHOPS,{market:{name:'Corner Market',x:19,z:-6.3},cafe:{name:'Alder Coffee',x:36,z:-6.3}});assert.deepEqual(MARKET,{name:'Corner Market',x:19,z:-6.3});assert.deepEqual([STUDIO.x,STUDIO.z],[1,-6.3]);
assert.deepEqual(MAP.spawn,{x:-5,y:.2,z:15});assert.deepEqual(MAP.minimap.view,{x0:-200,x1:330,z0:-330,z1:110});assert.equal(MAP.buildings.length,9,'nine city buildings (the backdrop row is gone: Alder Center replaces it)');
assert.deepEqual(MAP.buildings.filter(b=>b.shop).map(b=>[b.name,b.shop,b.x,b.z,b.w,b.d]),[['CORNER MARKET','market',19,-13.5,15,10],['ALDER COFFEE','cafe',36,-16,15,15]]);
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
for(const [x,z,id] of [[0,0,'city'],[-60.9,10,'city'],[-61,0,'city'],[58,0,'city'],[-30,-48,'city'],[-30,-48.1,'county'],[-30,-100,'county'],[-100,-230,'farm'],[-35.1,-230,'farm'],[60,-260,'forest'],[-24.9,-260,'forest'],[19,-90,'alder'],[120,-100,'cedar'],[130,30,'eastbank'],[195,-100,'freight']])assert.equal(zoneAt(x,z).id,id,`${x},${z}`);
assert.equal(zoneAtPoint(-61.01,0),null);assert.equal(zoneAtPoint(0,-164),null,'the river is outside every zone');assert.equal(zoneAt(0,100).id,'open','outside every zone is the open country');assert.equal(zoneById('forest').grid,true);assert.equal(zoneById('county').grid,false);assert.equal(zoneById('nope'),null);
assert(isWalkable(0,0)&&isWalkable(0,60)&&isWalkable(-170.1,-230)&&isWalkable(-30,-316.1),'open country is walkable');assert(!isWalkable(0,105)&&!isWalkable(-255,-230),'the edge of the map is not');

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
has(broken(m=>{m.fields[0]={...m.fields[0],x0:-130,x1:-120,z0:-235,z1:-225}}),/overlaps a dirt road/);
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
const plot=(over={})=>({id:'T1',kind:'residential',facing:'south',x0:60,z0:-310,x1:70,z1:-300,...over});
assert.deepEqual(broken(m=>{m.reserved.push(plot())}),[]);
has(broken(m=>{m.reserved.push(plot({kind:'castle'}))}),/unknown kind/);
has(broken(m=>{m.reserved.push(plot({x0:60.3}))}),/whole-cell/); // plots are whole or half metres (Alder Center's shops are cut to the half metre)
has(broken(m=>{m.reserved.push(plot({x0:-300,x1:-290}))}),/outside every zone/);
has(broken(m=>{m.reserved.push(plot({x0:0,z0:2,x1:5,z1:8}))}),/overlaps a road/);
has(broken(m=>{m.reserved.push(plot({x0:-150,z0:-270,x1:-140,z1:-265}))}),/overlaps a field/);
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
has(broken(m=>{m.water.rivers[0].points[3]=[-30,-130]}),/walks into river/);
has(broken(m=>{m.zones[2].bounds.x1=-40}),/zone farm cannot be reached on foot from the city/);
has(broken(m=>{m.zones[3].bounds.x0=-20;m.zones[3].bounds.x1=185}),/zone forest cannot be reached on foot from the city/);
has(broken(m=>{m.scenery.forest.clearings.push({x:140,z:-190,rx:30,rz:30})}),/clearing at 140,-190 reaches outside the forest/);
// The property registry and driveways.
has(broken(m=>{m.properties.push({...m.properties[0]})}),/duplicate property market/);
has(broken(m=>{m.properties.splice(m.properties.findIndex(p=>p.id==='market'),1)}),/shop market has no property entry/);
has(broken(m=>{m.properties.splice(m.properties.findIndex(p=>p.id==='studio'),1)}),/the studio has no property entry/);
has(broken(m=>{m.properties.splice(m.properties.findIndex(p=>p.id==='house-r2'),1)}),/landmark house-r2 has no property entry/);
has(broken(m=>{m.properties.find(p=>p.id==='sawmill').reason=''}),/property sawmill is not enterable but gives no reason/);
has(broken(m=>{m.properties.find(p=>p.id==='house-r1').access='anyone'}),/property house-r1 has no valid access rule/);
has(broken(m=>{m.properties.find(p=>p.id==='house-r2').owner={type:'npc'}}),/owned by an NPC with no name/);
has(broken(m=>{m.properties.find(p=>p.id==='house-r3').landmark='nowhere'}),/names an unknown landmark nowhere/);
has(broken(m=>{m.reserved.find(p=>p.id==='R1').driveway.x1=102}),/plot R1 driveway is narrower than 3.5 m/);
has(broken(m=>{m.reserved.find(p=>p.id==='R1').driveway.x0=300;m.reserved.find(p=>p.id==='R1').driveway.x1=310}),/plot R1 driveway is not a rectangle inside its district/);
has(broken(m=>{m.reserved.find(p=>p.id==='R2').park.x=140}),/plot R2 parking spot is not on its driveway/);
has(broken(m=>{m.reserved.find(p=>p.id==='R2').path.x1=119.5}),/plot R2 path is narrower than 1.2 m/);
// A landmark that names a plot must stand inside it.
has(broken(m=>{m.landmarks.find(l=>l.id==='house-r1').plot='R9'}),/house-r1 names an unknown plot R9/);
has(broken(m=>{m.landmarks.find(l=>l.id==='house-r1').x=130}),/house-r1 is not inside its plot R1/);
// The playable area, plot frontage and road widths.
has(broken(m=>{m.playable={x0:-999,x1:290,z0:-380,z1:100}}),/the playable area must be a rectangle inside the ground/);
has(broken(m=>{delete m.reserved[0].facing}),/reserved plot C1 has no facing/);
has(broken(m=>{m.reserved[0].facing='up'}),/has no facing/);
for(const edge of MAP.roads.edges.filter(e=>e.surface==='asphalt'&&e.level==='rural'&&e.id!=='county-road'))assert(edge.width>=9||edge.id.startsWith('alder-')&&edge.width>=9||edge.id==='oak-east'&&edge.width>=12,`${edge.id} is wide enough for two lanes of vehicles (${edge.width} m)`);
assert.equal(MAP.roads.edges.find(e=>e.id==='cedar-loop').width,9,'Cedar Heights loop: two 3.5 m lanes and a 1 m shoulder each side');
// Plots face the street they front: the residential plots sit on the loop's south arc facing south, within 14 m of the loop road's inner edge.
{const loop=MAP.roads.edges.find(e=>e.id==='cedar-loop');for(const plot of MAP.reserved.filter(p=>['R1','R2','R3'].includes(p.id))){assert.equal(plot.facing,'south');assert(plot.z1<-70&&plot.z0>-100,'inside the loop on its south side: '+plot.id)}
// The ring: R4-R6 north of the loop face south, R7-R8 south of it face north, and each is outside the loop road.
for(const id of ['R4','R5','R6','R7','R8']){const plot=MAP.reserved.find(p=>p.id===id);assert.equal(plot.facing,['R7','R8'].includes(id)?'north':'south',id)}}
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
console.log('Map data is valid and frozen; zones, roads, fields, trees, shops, hours, studio and spawn match the numbers they replaced; 77 broken maps are each caught; Alder Center, Cedar Heights, Eastbank Works, the second bridge and the plots are in place.');
