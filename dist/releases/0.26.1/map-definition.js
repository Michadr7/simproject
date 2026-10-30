// The world as data. world.js, the minimap, the shops and game.js read this file; nothing else hard-codes zone edges, roads,
// fields, shop doors or building footprints. Coordinates are metres: +x east, -z north (the default camera looks north up
// Oak Street). Adding a district means adding data here (and, later, scenery code that reads it), not editing the engine.
// The map is flat: there is no elevation in version 1.

// Zones tile the walkable world. `bounds` is the walkable rectangle, `grid` turns on the 1x1 plot grid (farm and forest),
// `minimap.label` is where the map writes the zone's name. Zones must not overlap; edges may touch.
// The world, north (-z) up: the city in the south; a gently curving river rising from the south-west to the north-east, north of the city;
// the County Road crossing the river by the bridge and reaching the north bank, where Willow Fields (the farm) lies to the north-west and
// Pine Ridge (the forest) to the north-east.
// The north bank (the river and everything beyond it) sits NORTH metres further north than it first did, to leave the south bank room for three more districts.
// Every north-bank coordinate below is written as n(its old z), so the shift is one number and cannot drift between files.
const NORTH=70,n=z=>z-NORTH;
const zones=[
 {id:'city',name:'Westside',label:'WESTSIDE',subtitle:'Oak & Alder',color:'#8d9294',grid:false,bounds:{x0:-61,x1:58,z0:-48,z1:48},minimap:{label:{x:-1,z:44}}},
 {id:'county',name:'County Road',label:'COUNTY ROAD',subtitle:'Bridge & crossroads',color:'#7a7f83',grid:false,bounds:{x0:-35,x1:-25,z0:n(-246),z1:-48},minimap:{label:{x:-30,z:-60}}},
 {id:'farm',name:'Willow Fields',label:'WILLOW FIELDS',subtitle:'Fields & plots',color:'#c9ae63',grid:true,bounds:{x0:-170,x1:-35,z0:n(-216),z1:n(-108)},minimap:{label:{x:-102,z:n(-205)}}},
 {id:'forest',name:'Pine Ridge',label:'PINE RIDGE',subtitle:'Timber & trails',color:'#3f6a3c',grid:true,bounds:{x0:-25,x1:190,z0:n(-246),z1:n(-146)},minimap:{label:{x:82,z:n(-236)}}},
 // The south bank, north of Oak Street and east of the County Road: Alder Center (a town square), Cedar Heights (a quiet loop of homes) and Eastbank Works (workshops and freight).
 {id:'alder',name:'Alder Center',label:'ALDER CENTER',subtitle:'Town square',color:'#a39d8c',grid:false,bounds:{x0:-20,x1:58,z0:-125,z1:-48},minimap:{label:{x:19,z:-131}}},
 {id:'cedar',name:'Cedar Heights',label:'CEDAR HEIGHTS',subtitle:'Quiet homes',color:'#9aa57e',grid:false,bounds:{x0:70,x1:170,z0:-135,z1:-40},minimap:{label:{x:120,z:-141}}},
 {id:'eastbank',name:'Eastbank Works',label:'EASTBANK WORKS',subtitle:'Workshops & freight',color:'#8e8a82',grid:false,bounds:{x0:70,x1:190,z0:-20,z1:75},minimap:{label:{x:130,z:83}}},
 {id:'freight',name:'Freight Road',label:'FREIGHT ROAD',subtitle:'The cargo route',color:'#7a7f83',grid:false,bounds:{x0:190,x1:200,z0:n(-246),z1:75},minimap:{label:{x:218,z:-60}}}
];

// An edge may also carry `path: [[x, z], ...]` points between its nodes (and `curve: true` to smooth them; `closed: true` for a loop that returns to its first node): the terrain mask (terrain.js)
// then lays it as a ribbon of its width along that centreline. `level` is 'street' (the city's raised streets, built in game.js) or 'rural' (built in world.js);
// `walkable: true` makes the road's own ground walkable outside any zone, and `zone` names the zone it counts as.
const roads={
 nodes:{
  oakWest:{x:-55,z:6},oakEast:{x:55,z:6},alderNorth:{x:-30,z:-60},alderSouth:{x:-30,z:60},countyEnd:{x:-30,z:n(-246)},
  farmGate:{x:-164,z:n(-160)},farmJoin:{x:-34,z:n(-160)},woodsJoin:{x:-26,z:n(-180)},woodsEnd:{x:189,z:n(-180)},woodsLaneNorth:{x:90,z:n(-246)},woodsLaneSouth:{x:90,z:n(-146)},
  alderMainS:{x:20,z:-48},alderMainN:{x:20,z:-125},alderCrossW:{x:-20,z:-90},alderCrossE:{x:58,z:-90},
  oakEastEnd:{x:190,z:6},cedarLinkS:{x:120,z:6},cedarLoopStart:{x:120,z:-57},alderCedarA:{x:58,z:-90},alderCedarB:{x:83,z:-85},
  freightW:{x:72,z:68},freightS:{x:195,z:68},freightN:{x:195,z:n(-246)}
 },
 edges:[
  {id:'oak-street',from:'oakWest',to:'oakEast',width:19,surface:'asphalt',level:'street'},
  {id:'alder-avenue',from:'alderNorth',to:'alderSouth',width:16,surface:'asphalt',level:'street'},
  {id:'county-road',from:'alderNorth',to:'countyEnd',width:8,surface:'asphalt',level:'rural'},
  {id:'farm-road',from:'farmGate',to:'farmJoin',width:7,surface:'dirt'},
  {id:'woods-road',from:'woodsJoin',to:'woodsEnd',width:7,surface:'dirt'},
  {id:'woods-lane',from:'woodsLaneNorth',to:'woodsLaneSouth',width:5,surface:'dirt'},
  // Alder Center: a main street north from Oak Street and a cross street.
  {id:'alder-main',from:'alderMainS',to:'alderMainN',width:10,surface:'asphalt',level:'rural',walkable:true,zone:'alder'},
  {id:'alder-cross',from:'alderCrossW',to:'alderCrossE',width:10,surface:'asphalt',level:'rural',walkable:true,zone:'alder'},
  // Oak Street continues east through Eastbank Works to the Freight Road; Cedar Heights hangs off it to the north and off Alder Center's cross street.
  {id:'oak-east',from:'oakEast',to:'oakEastEnd',width:12,surface:'asphalt',level:'rural',walkable:true,zone:'eastbank'},
  {id:'cedar-link',from:'cedarLinkS',to:'cedarLoopStart',width:9,surface:'asphalt',level:'rural',walkable:true},
  {id:'alder-cedar',from:'alderCedarA',to:'alderCedarB',width:9,surface:'asphalt',level:'rural',walkable:true,path:[]},
  // Cedar Heights' loop: a closed, smoothed oval around (120, -85), 76 m by 56 m, 9 m wide (two 3.5 m lanes and a 1 m shoulder each side). Its tightest bend has a
  // radius of about 20 m, comfortable for cars and a small truck.
  {id:'cedar-loop',from:'cedarLoopStart',to:'cedarLoopStart',width:9,surface:'asphalt',level:'rural',walkable:true,zone:'cedar',curve:true,closed:true,
   path:[[101.0,-60.8],[87.1,-71.0],[82.0,-85.0],[87.1,-99.0],[101.0,-109.2],[120.0,-113.0],[139.0,-109.2],[152.9,-99.0],[158.0,-85.0],[152.9,-71.0],[139.0,-60.8]]},
  // The Freight Road: along the south side of Eastbank Works, then north up its own corridor, over the east bridge, to Pine Ridge.
  {id:'freight-south',from:'freightW',to:'freightS',width:9,surface:'asphalt',level:'rural',walkable:true,zone:'eastbank'},
  {id:'freight-road',from:'freightS',to:'freightN',width:9,surface:'asphalt',level:'rural',walkable:true,zone:'freight'}
 ]
};

// The river is a centreline through `points` (smoothed into a gentle curve), `width` across with `bank` metres of mud on each side. It rises from
// the south-west to the north-east, north of the south bank's three districts, is flat water and a hard barrier (it lies outside every zone); the only ways across
// are the two bridges: the County Bridge carries the County Road, the Freight Bridge the Freight Road. A bridge's deck is axis-aligned and exactly as wide as the zone it carries.
const water={
 rivers:[{id:'north-river',width:12,bank:2.6,points:[[-270,-58],[-190,-66],[-110,-78],[-30,-90],[40,-101],[110,-117],[190,-135],[270,-154]].map(([x,z])=>[x,n(z)]).concat([[318,-233]])}],
 bridges:[{id:'county-bridge',river:'north-river',x0:-35,x1:-25,z0:n(-104),z1:n(-76)},{id:'freight-bridge',river:'north-river',x0:190,x1:200,z0:-226,z1:-186}]
};

// Willow Fields: three big open rectangles (whole cells) with their own ground, plowed soil, wheat and young crops, and no fences between them, so
// tractors can cross them later. Nothing grows in them yet. Only the farm's perimeter is fenced (see fenceSegments in world.js), with a gap wherever a
// dirt road crosses it. `surface` picks the ground texture: 'plowed', 'wheat' or 'green'.
const fields=[
 {id:'field-wheat',surface:'wheat',x0:-165,x1:-90,z0:n(-208),z1:n(-170)},
 {id:'field-plowed',surface:'plowed',x0:-165,x1:-115,z0:n(-150),z1:n(-114)},
 {id:'field-green',surface:'green',x0:-108,x1:-52,z0:n(-150),z1:n(-114)}
];

// Buildings: footprint centre (x, z), width (x), depth (z), height, colour. `shop` ties a building to an entry in `shops`.
const buildings=[
 {x:1,z:-15,w:17,d:13,h:17,color:'#b08b74',name:'OAK STREET APARTMENTS'},
 {x:19,z:-13.5,w:15,d:10,h:9,color:'#c2bc9b',name:'CORNER MARKET',shop:'market'},
 {x:36,z:-16,w:15,d:15,h:13,color:'#82948d',name:'ALDER COFFEE',shop:'cafe'},
 {x:-13,z:-18,w:8,d:19,h:12,color:'#9b9f98',name:'LAUNDRY'},
 {x:-4,z:31,w:20,d:19,h:11,color:'#c4b298'},{x:19,z:33,w:17,d:23,h:15,color:'#929e9a'},{x:39,z:31,w:17,d:19,h:10,color:'#b5a38d'},
 {x:-48,z:-19,w:18,d:21,h:19,color:'#899c9b'},{x:-49,z:26,w:18,d:20,h:12,color:'#af9d8c'},

];

// The doorway of a shop, in world metres. A 2.6 m gap in the building's collision lets you walk up to the glass; a blocker shuts it
// while the door is closed and a short back wall stops you at the threshold. Reaching the threshold with the door open fades you inside.
//   halfWidth      half the width of the open gap (also the blocker's and back wall's half width)
//   approach       the zone in front of the door where the door slides open (half width, and z from z0 to z1)
//   threshold      walking past this z (with the door open) goes in
//   closedTouch    touching this z while the door is shut shows the shop's hours
//   enterHalfWidth how far off-centre you can be and still go in
//   blocker/backWall  z and half depth of the two thin colliders
//   beaconZ        where the objective beacon stands for this door
//   exit           where you step out to (z), and the most you are shifted sideways (clamp)
const doorway=()=>({halfWidth:1.3,approach:{halfWidth:2.6,z0:-9.2,z1:-5.4},threshold:-8.4,closedTouch:-7.6,enterHalfWidth:.9,blocker:{z:-8.5,depth:.25},backWall:{z:-9.3,depth:.2},beaconZ:-8.3,exit:{z:-7.6,clamp:.8}});
// A shop's interior, in the room's own coordinates (x across, z deep; the front wall is at frontWallZ).
//   origin    where the room sits in the world (x is the shop's door x); origin.z + frontWallZ must be the building's front
//   entry     where you appear when you walk in; spawn / exit are used after a reset and for the exit prompt
//   counter   the clerk's counter; exitDoor is the sliding door you leave by, with its approach zone and trigger line
const interior=()=>({origin:{y:.165,z:-13.5},frontWallZ:5,entry:{x:0,z:3.9},spawn:{x:0,z:3.1},exit:{x:0,z:4},counter:{x:0,z:-2},exitDoor:{z:4.96,width:2.2,height:2.7,near:{halfWidth:2.4,z:2.7},trigger:{halfWidth:.9,z:4.3}}});
// Shops you can walk into. x is the door centre, z is where you stand outside it, doorZ is the door plane on the building's
// front, hours are [opens, closes) in minutes since midnight, sign is the text over the door.
const shops={
 market:{name:'Corner Market',x:19,z:-6.3,doorZ:-8.46,door:{width:2.3,height:2.5},hours:[420,1320],sign:'MARKET 7AM–10PM',doorway:doorway(),interior:interior()},
 cafe:{name:'Alder Coffee',x:36,z:-6.3,doorZ:-8.46,door:{width:2.3,height:2.5},hours:[480,1080],sign:'CAFE 8AM–6PM',doorway:doorway(),interior:interior()}
};

// Land set aside for later (ownership, preset buildings). Whole-cell rectangles; kind is 'residential', 'commercial' or
// 'industrial'. None are reserved on the current map; validateMap checks any you add.
const reserved=[
 // Reserved land (whole cells; the ground overlay on the O key and the minimap show them): kept as data until buildings or ownership arrive. `facing` is the side the
 // plot's door and driveway are on: the street it fronts.
 {id:'C1',name:'Commercial plot C1',kind:'commercial',facing:'east',x0:-16,x1:2,z0:-82,z1:-62},{id:'C2',name:'Commercial plot C2',kind:'commercial',facing:'east',x0:-16,x1:2,z0:-118,z1:-98},
 {id:'R1',name:'Residential plot R1',kind:'residential',facing:'south',x0:94,x1:106,z0:-85,z1:-73},{id:'R2',name:'Residential plot R2',kind:'residential',facing:'south',x0:114,x1:126,z0:-83,z1:-71},{id:'R3',name:'Residential plot R3',kind:'residential',facing:'south',x0:134,x1:146,z0:-85,z1:-73},
 {id:'I1',name:'Industrial plot I1',kind:'industrial',facing:'north',x0:150,x1:176,z0:18,z1:46},{id:'I2',name:'Industrial plot I2',kind:'industrial',facing:'south',x0:150,x1:176,z0:-18,z1:-2}
];

function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const key of Object.keys(value))deepFreeze(value[key])}return value}

export const MAP=deepFreeze({
 id:'oak-and-alder',version:1,
 seed:7301, // changing it moves every generated tree and orphans saved forest plots
 spawn:{x:-5,y:.2,z:15},

 ground:{x0:-260,x1:300,z0:-390,z1:110},
 // Where you can walk: everywhere inside this rectangle except water (and trees, fences and buildings, which are solid objects). The zones name and shape the districts; they no longer fence them in.
 playable:{x0:-250,x1:290,z0:-380,z1:100},
 openCountry:{id:'open',name:'Open Country',label:'OPEN COUNTRY',subtitle:'Meadows between districts',color:'#6e8a5c'}, // how far the ground is drawn (scenery fades into fog beyond the walkable zones)
 zones,roads,water,fields,buildings,shops,reserved,
 // The city's raised pavements (footing 0.165 m): either side of Oak Street, and beside Alder Avenue.
 pavements:[{x0:-38,x1:54,z0:-8.5,z1:-3.5},{x0:-38,x1:54,z0:15.5,z1:20.5},{x0:-21.5,x1:-16.5,z0:-74,z1:24},{x0:28,x1:52,z0:-120,z1:-98}], // the last one is Alder Center's town square
 // Buildings placed from converted models or placeholders (props.js): yaw is a multiple of 90 degrees so the collision boxes stay axis-aligned. The farmstead (a barn,
 // a farmhouse, a silo and a shed; a placeholder for now) fills the free north-east strip of Willow Fields and faces the farm road; the sawmill stands in Pine Ridge's empty clearing.
 landmarks:[
  {id:'farmstead',prop:'farmstead',zone:'farm',x:-62,z:n(-191),yaw:0},
  {id:'sawmill',prop:'sawmill',zone:'forest',x:104,z:n(-208),yaw:0}
 ],
 // Signposts: boards are read from the front (yaw 0 faces south, towards walkers arriving from the bridge).
 signs:[
  {id:'fork',zone:'county',x:-25.5,z:n(-170),yaw:0,boards:[{text:'← WILLOW FIELDS',y:2.1},{text:'PINE RIDGE →',y:2.9}]},
  {id:'alder-sign',zone:'alder',x:26.5,z:-56,yaw:0,boards:[{text:'ALDER CENTER',y:2.4}]},
  {id:'cedar-sign',zone:'cedar',x:127,z:-44,yaw:0,boards:[{text:'CEDAR HEIGHTS',y:2.4}]},
  {id:'eastbank-sign',zone:'eastbank',x:74,z:-5,yaw:-1.5707963267948966,boards:[{text:'EASTBANK WORKS →',y:2.4}]}
 ],
 studio:{x:1,z:-6.3,doorZ:-8.25,interior:{entry:{x:0,z:3.3},exit:{x:0,z:4.45},bed:{x:-3.6,z:-2.3}}},
 minimap:{view:{x0:-200,x1:330,z0:-330,z1:110}},
 // Procedural dressing parameters (world.js): how the generated trees are laid out.

 scenery:{
  // Pine Ridge: one cuttable pine per 4x4-cell block at `density` (varied by `wobble`), an occasional decor pine in the blocks without one,
  // nothing in the clearings (ellipses) or beside roads. The big clearing at the north-east is kept open for the Sawmill.
  forest:{density:.55,wobble:.14,decorChance:.25,roadMargin:2.4,clearings:[
   {x:106,z:n(-212),rx:30,rz:24},{x:30,z:n(-170),rx:20,rz:11},{x:56,z:n(-222),rx:15,rz:12},{x:128,z:n(-164),rx:15,rz:11},{x:2,z:n(-222),rx:11,rz:14},{x:165,z:-285,rx:14,rz:14}
  ]},
  // Dense scenery outside the walkable zones that hides the end of the world: [x0, x1, z0, z1, spacing, chance, salt]. Never on a road, in the river or on a building.
  belts:[[-125,-61,-60,105,5.5,.09,11],[-61,58,48,105,5.5,.09,13],[58,300,75,110,5.5,.09,23],[200,300,-130,75,5.5,.09,24],[200,300,-390,-130,5.5,.09,18],
   [-235,300,-390,-316,5.5,.09,16],[-235,-170,-316,-130,5.5,.09,17],[-170,-35,-316,-286,5.5,.09,22],[-170,-35,-178,-140,5,.12,15],[-25,190,-216,-150,5.5,.1,21],
   [-62,-36,-170,-48,5,.1,19],[58,200,-190,-135,5.5,.1,20],[-20,58,-170,-125,5.5,.1,25],[60,200,-40,-20,5,.1,26],[58,70,-125,-40,5,.1,27]],
  view:{distance:158}, // trees farther than this from the player are not drawn (the fog fully hides them at 155 m)
  farmShade:{count:30,clearOfRoad:8}
 }
});

// ── Rivers ────────────────────────────────────────────────────────────────────
// The smoothed centreline: a Catmull-Rom curve through the control points, sampled about every `step` metres, with the unit tangent of each sample.
const pathCache=new WeakMap();
export function riverPath(river,step=3){
 const key=pathCache.get(river)||new Map();pathCache.set(river,key);if(key.has(step))return key.get(step);
 const p=river.points,at=i=>p[Math.max(0,Math.min(p.length-1,i))],out=[];
 for(let i=0;i<p.length-1;i++){
  const [p0,p1,p2,p3]=[at(i-1),at(i),at(i+1),at(i+2)],len=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),n=Math.max(1,Math.ceil(len/step));
  for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t,c=j=>.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3);out.push({x:c(0),z:c(1)})}
 }
 out.push({x:p.at(-1)[0],z:p.at(-1)[1]});
 for(let i=0;i<out.length;i++){const a=out[Math.max(0,i-1)],b=out[Math.min(out.length-1,i+1)],l=Math.hypot(b.x-a.x,b.z-a.z)||1;out[i].tx=(b.x-a.x)/l;out[i].tz=(b.z-a.z)/l}
 key.set(step,Object.freeze(out.map(Object.freeze)));return key.get(step);
}
// Distance from a point to the river's centreline.
export function riverDistance(x,z,river){
 const path=riverPath(river,3);let best=Infinity;
 for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-(a.x+dx*t),z-(a.z+dz*t)))}
 return best;
}
// The river's centreline height at x (rivers here run mostly west to east).
export function riverZAt(river,x){const path=riverPath(river,2);for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1];if(x>=a.x&&x<=b.x)return a.z+(b.z-a.z)*(x-a.x)/((b.x-a.x)||1)}return null}

// ── Derived data ──────────────────────────────────────────────────────────────
export const zoneById=(id,map=MAP)=>map.zones.find(z=>z.id===id)||null;
// The zone whose walkable rectangle contains the point (edges belong to the zone on their west/north side first).
export function zoneAtPoint(x,z,map=MAP){return map.zones.find(zone=>x>=zone.bounds.x0&&x<=zone.bounds.x1&&z>=zone.bounds.z0&&z<=zone.bounds.z1)||null}
export function roadRect(edge,map=MAP){
 const a=map.roads.nodes[edge.from],b=map.roads.nodes[edge.to],half=edge.width/2;
 return a.z===b.z?{x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),z0:a.z-half,z1:a.z+half}:{x0:a.x-half,x1:a.x+half,z0:Math.min(a.z,b.z),z1:Math.max(a.z,b.z)};
}
// The rectangles of the straight, axis-aligned road edges (a road with a `path` is a ribbon: see roadCenterline in terrain.js).
export const roadRects=(surface,map=MAP)=>map.roads.edges.filter(e=>(!surface||e.surface===surface)&&!e.path).map(e=>({id:e.id,...roadRect(e,map)}));
export const hoursOf=(kind,map=MAP)=>map.shops[kind].hours;

// ── Validation ────────────────────────────────────────────────────────────────
// Returns a list of problems (empty when the map is sound). Run by tests/map.mjs; call it from the console after editing.
export function validateMap(map=MAP){
 const problems=[],bad=(message)=>problems.push(message);
 const rectOk=r=>r&&[r.x0,r.x1,r.z0,r.z1].every(Number.isFinite)&&r.x0<r.x1&&r.z0<r.z1;
 const overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z0<a.z1;
 const inside=(r,outer)=>r.x0>=outer.x0&&r.x1<=outer.x1&&r.z0>=outer.z0&&r.z1<=outer.z1;
 const footprint=b=>({x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2});
 const roadPoints=edge=>{const a=map.roads.nodes[edge.from],b=map.roads.nodes[edge.to];return [[a.x,a.z],...(edge.path||[]),[b.x,b.z]]};
 if(!rectOk(map.ground))bad('ground is not a valid rectangle');
 if(!rectOk(map.playable)||!inside(map.playable,map.ground))bad('the playable area must be a rectangle inside the ground');
 const ids=new Set();
 for(const zone of map.zones){
  if(ids.has(zone.id))bad(`duplicate zone id ${zone.id}`);ids.add(zone.id);
  if(!rectOk(zone.bounds))bad(`zone ${zone.id} has invalid bounds`);else if(!inside(zone.bounds,map.ground))bad(`zone ${zone.id} reaches outside the ground`);
 }
 for(const [i,a] of map.zones.entries())for(const b of map.zones.slice(i+1))if(rectOk(a.bounds)&&rectOk(b.bounds)&&overlaps(a.bounds,b.bounds))bad(`zones ${a.id} and ${b.id} overlap`);
 if(!zoneAtPoint(map.spawn.x,map.spawn.z,map))bad('spawn is outside every zone');
 // Every zone can be reached on foot from the city: zones that touch along an edge (at least 2 m of it) are connected.
 {const touches=(a,b)=>{const w=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),h=Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0);return (w===0&&h>=2)||(h===0&&w>=2)||(w>0&&h>0)};
  // A walkable road also joins the zones its points lie in.
  const linked=new Map(map.zones.map(z=>[z.id,new Set()]));
  for(const edge of map.roads.edges.filter(e=>e.walkable)){const ids=[...new Set(roadPoints(edge).map(([x,z])=>zoneAtPoint(x,z,map)?.id).filter(Boolean))];for(const a of ids)for(const b of ids)if(a!==b)linked.get(a).add(b)}
  const city=map.zones.find(z=>z.id==='city')||map.zones[0],seen=new Set([city.id]),queue=[city];
  while(queue.length){const here=queue.pop();for(const other of map.zones)if(!seen.has(other.id)&&rectOk(here.bounds)&&rectOk(other.bounds)&&(touches(here.bounds,other.bounds)||linked.get(here.id)?.has(other.id))){seen.add(other.id);queue.push(other)}}
  for(const zone of map.zones)if(!seen.has(zone.id))bad(`zone ${zone.id} cannot be reached on foot from the city`)}
 // Water: rivers are flat hard barriers (outside every zone); the only way across is a bridge whose deck is exactly the width of the zone it carries.
 {const rivers=map.water?.rivers||[],bridges=map.water?.bridges||[];
  for(const river of rivers){
   if(!(river.points?.length>=2)||!(river.width>0)){bad(`river ${river.id} needs at least two points and a width`);continue}
   const path=riverPath(river,2),reach=river.width/2+river.bank;
   if(path.some(p=>p.x<map.ground.x0-20||p.x>map.ground.x1+20||p.z<map.ground.z0||p.z>map.ground.z1))bad(`river ${river.id} leaves the ground`);
   // Both banks and the middle of the river, all along it, must stay out of every zone except under a bridge.
   for(const zone of map.zones){
    const hit=path.some(p=>[-1,-.5,0,.5,1].some(k=>{const x=p.x-p.tz*k*reach,z=p.z+p.tx*k*reach;
     return x>=zone.bounds.x0&&x<=zone.bounds.x1&&z>=zone.bounds.z0&&z<=zone.bounds.z1&&!bridges.some(b=>b.river===river.id&&x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1)}));
    if(hit)bad(`zone ${zone.id} walks into river ${river.id} where there is no bridge`)}
  }
  for(const bridge of bridges){
   const river=rivers.find(r=>r.id===bridge.river);
   if(!river){bad(`bridge ${bridge.id} crosses an unknown river`);continue}
   const reach=river.width/2+river.bank,edges=riverPath(river,1).filter(p=>p.x>=bridge.x0-2&&p.x<=bridge.x1+2).flatMap(p=>[p.z+p.tx*reach,p.z-p.tx*reach]);
   if(!edges.length||!(bridge.z0<Math.min(...edges)&&bridge.z1>Math.max(...edges)))bad(`bridge ${bridge.id} does not reach both banks`);
   if(!inside(bridge,map.ground))bad(`bridge ${bridge.id} reaches outside the ground`);
   if(!map.zones.some(z=>z.bounds.x0===bridge.x0&&z.bounds.x1===bridge.x1&&z.bounds.z0<=bridge.z0&&z.bounds.z1>=bridge.z1))bad(`bridge ${bridge.id} is not exactly as wide as a walkable zone that crosses the river`);
  }}
 // Landmarks and signs stand inside the zone they name; buildings face one of the four directions.
 {const ids=new Set();for(const item of [...(map.landmarks||[]),...(map.signs||[])]){
  if(ids.has(item.id))bad(`duplicate landmark or sign ${item.id}`);ids.add(item.id);
  const zone=map.zones.find(z=>z.id===item.zone);if(!zone||item.x<zone.bounds.x0||item.x>zone.bounds.x1||item.z<zone.bounds.z0||item.z>zone.bounds.z1)bad(`${item.id} is not inside zone ${item.zone}`);
  if(item.prop!==undefined&&Math.abs(Math.sin(item.yaw*2))>1e-9)bad(`${item.id} must face north, east, south or west`)}}
 // Forest clearings are ellipses inside the forest zone.
 for(const clearing of map.scenery?.forest?.clearings||[]){const forest=map.zones.find(z=>z.id===map.scenery.forest.zone||z.id==='forest');
  if(!forest||clearing.x-clearing.rx<forest.bounds.x0||clearing.x+clearing.rx>forest.bounds.x1||clearing.z-clearing.rz<forest.bounds.z0||clearing.z+clearing.rz>forest.bounds.z1)bad(`clearing at ${clearing.x},${clearing.z} reaches outside the forest`)}

 // Roads: straight edges are axis-aligned rectangles; an edge with a `path` is a ribbon along its points (checked as points). Every road touches a zone and stays on the ground.
 const edgeIds=new Set();
 for(const edge of map.roads.edges){
  const a=map.roads.nodes[edge.from],b=map.roads.nodes[edge.to];
  if(edgeIds.has(edge.id))bad(`duplicate road ${edge.id}`);edgeIds.add(edge.id);
  if(!a||!b){bad(`road ${edge.id} uses an unknown node`);continue}
  if(!edge.path&&a.x!==b.x&&a.z!==b.z)bad(`road ${edge.id} is not axis-aligned`);
  if(!(edge.width>0))bad(`road ${edge.id} has no width`);
  if(!['asphalt','dirt'].includes(edge.surface))bad(`road ${edge.id} has an unknown surface`);
  if(edge.zone&&!map.zones.some(z=>z.id===edge.zone))bad(`road ${edge.id} names an unknown zone ${edge.zone}`);
  if(edge.path){
   if(roadPoints(edge).some(([x,z])=>x<map.ground.x0||x>map.ground.x1||z<map.ground.z0||z>map.ground.z1))bad(`road ${edge.id} reaches outside the ground`);
   if(!roadPoints(edge).some(([x,z])=>zoneAtPoint(x,z,map)))bad(`road ${edge.id} does not touch any zone`);
  }else{
   const rect=roadRect(edge,map);if(!inside(rect,map.ground))bad(`road ${edge.id} reaches outside the ground`);
   if(!map.zones.some(zone=>overlaps(rect,zone.bounds)))bad(`road ${edge.id} does not touch any zone`); // roads may run on past a zone's edge into the scenery
  }
 }
 // Fields sit on whole cells inside a gridded zone, clear of dirt roads and of each other.
 const dirt=roadRects('dirt',map);
 for(const field of map.fields){
  if(![field.x0,field.x1,field.z0,field.z1].every(Number.isInteger)||!rectOk(field)){bad(`field ${field.id} is not a whole-cell rectangle`);continue}
  const zone=zoneAtPoint((field.x0+field.x1)/2,(field.z0+field.z1)/2,map);
  if(!zone?.grid||!inside(field,zone.bounds))bad(`field ${field.id} is not inside a plot-grid zone`);
  if(dirt.some(r=>overlaps(field,r)))bad(`field ${field.id} overlaps a dirt road`);
  if(!['plowed','wheat','green'].includes(field.surface))bad(`field ${field.id} has an unknown surface`);
 }
 for(const [i,a] of map.fields.entries())for(const b of map.fields.slice(i+1))if(overlaps(a,b))bad(`fields ${a.id} and ${b.id} overlap`);
 // Buildings do not overlap each other; shops point at a real building and have sane hours.
 for(const [i,a] of map.buildings.entries()){if(!(a.w>0&&a.d>0&&a.h>0))bad(`building ${i} has no size`);for(const b of map.buildings.slice(i+1))if(overlaps(footprint(a),footprint(b)))bad(`buildings ${a.name||i} and ${b.name||map.buildings.indexOf(b)} overlap`)}
 for(const [kind,shop] of Object.entries(map.shops)){
  const building=map.buildings.find(b=>b.shop===kind);
  if(!building){bad(`shop ${kind} has no building`);continue}
  const front=footprint(building).z1;
  if(Math.abs(shop.x-building.x)>building.w/2-1.5)bad(`shop ${kind} door is not on its building`);
  if(shop.doorZ<front-.5||shop.doorZ>front+.5)bad(`shop ${kind} door is not on the front wall (${shop.doorZ} vs ${front})`);
  if(!(shop.z>front))bad(`shop ${kind} entrance spot is not in front of the door`);
  const [open,close]=shop.hours;if(!(Number.isInteger(open)&&Number.isInteger(close)&&open>=0&&close<=1440&&open<close))bad(`shop ${kind} has invalid hours`);
  // Doorway and interior: everything has to be reachable and in the right order along z.
  const d=shop.doorway,room=shop.interior,R=.33; // R: the player's collision radius
  if(!d||!room){bad(`shop ${kind} needs a doorway and an interior`);continue}
  if(d.enterHalfWidth>d.halfWidth-R+1e-9)bad(`shop ${kind} doorway is too narrow to reach its entry trigger`);
  if(d.approach.halfWidth<d.halfWidth)bad(`shop ${kind} approach zone is narrower than the doorway`);
  if(!(d.threshold>d.backWall.z+d.backWall.depth+R))bad(`shop ${kind} threshold is behind the back wall (you could never reach it)`);
  if(Math.abs(d.threshold-shop.doorZ)>.2)bad(`shop ${kind} threshold is not at the door`);
  if(!(d.closedTouch>d.blocker.z+d.blocker.depth+R))bad(`shop ${kind} closed-door line is behind the blocker (you could never reach it)`);
  if(!(d.approach.z0<d.threshold&&d.threshold<d.approach.z1&&d.approach.z0<d.closedTouch&&d.closedTouch<d.approach.z1))bad(`shop ${kind} approach zone does not contain its threshold and closed-door line`);
  if(d.exit.z-d.threshold<.5)bad(`shop ${kind} leaving puts you back inside the entry trigger`);
  if(Math.abs(room.origin.z+room.frontWallZ-front)>.05)bad(`shop ${kind} interior front wall is not on the building's front (${room.origin.z+room.frontWallZ} vs ${front})`);
  const trigger=room.exitDoor.trigger;
  if(!(room.entry.z<trigger.z&&room.spawn.z<trigger.z))bad(`shop ${kind} entry or spawn is inside the exit trigger`);
  if(!(room.exitDoor.near.z<trigger.z))bad(`shop ${kind} exit door would open after its trigger line`);
  if(!(Math.abs(room.counter.x)<5.5&&Math.abs(room.counter.z)<4.5))bad(`shop ${kind} counter is outside the room`);
 }
 const studio=map.studio.interior;
 if(!studio||![studio.entry,studio.exit,studio.bed].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)))bad('studio interior needs an entry, exit and bed');
 // Reserved plots: whole cells, inside a zone, not on top of roads, fields, buildings or each other.
 const reservedIds=new Set();
 for(const plot of map.reserved){
  if(reservedIds.has(plot.id))bad(`duplicate reserved plot ${plot.id}`);reservedIds.add(plot.id);
  if(!['residential','commercial','industrial'].includes(plot.kind))bad(`reserved plot ${plot.id} has an unknown kind`);
  if(!['north','south','east','west'].includes(plot.facing))bad(`reserved plot ${plot.id} has no facing`);
  if(![plot.x0,plot.x1,plot.z0,plot.z1].every(Number.isInteger)||!rectOk(plot)){bad(`reserved plot ${plot.id} is not a whole-cell rectangle`);continue}
  if(!zoneAtPoint(plot.x0,plot.z0,map)||!zoneAtPoint(plot.x1,plot.z1,map))bad(`reserved plot ${plot.id} is outside every zone`);
  if(map.roads.edges.some(e=>!e.path&&map.roads.nodes[e.from]&&map.roads.nodes[e.to]&&overlaps(plot,roadRect(e,map))))bad(`reserved plot ${plot.id} overlaps a road`);
  if(map.fields.some(f=>overlaps(plot,f)))bad(`reserved plot ${plot.id} overlaps a field`);
  if(map.buildings.some(b=>overlaps(plot,footprint(b))))bad(`reserved plot ${plot.id} overlaps a building`);
 }
 for(const [i,a] of map.reserved.entries())for(const b of map.reserved.slice(i+1))if(overlaps(a,b))bad(`reserved plots ${a.id} and ${b.id} overlap`);
 return problems;
}
