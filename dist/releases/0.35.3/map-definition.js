
import {WAREHOUSE_INTERIOR} from './warehouse-layout.js';// The world as data. world.js, the minimap, the shops and game.js read this file; nothing else hard-codes zone edges, roads,
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
 {id:'eastbank',name:'Eastbank Works',label:'EASTBANK WORKS',subtitle:'Workshops & freight',color:'#8e8a82',grid:false,bounds:{x0:70,x1:190,z0:-38,z1:75},minimap:{label:{x:130,z:83}}},
 {id:'freight',name:'Freight Road',label:'FREIGHT ROAD',subtitle:'The cargo route',color:'#7a7f83',grid:false,bounds:{x0:190,x1:200,z0:n(-246),z1:75},minimap:{label:{x:218,z:-60}}}
];

// An edge may also carry `path: [[x, z], ...]` points between its nodes (and `curve: true` to smooth them; `closed: true` for a loop that returns to its first node): the terrain mask (terrain.js)
// then lays it as a ribbon of its width along that centreline. `level` is 'street' (the city's raised streets, built in game.js) or 'rural' (built in world.js);
// `walkable: true` makes the road's own ground walkable outside any zone, and `zone` names the zone it counts as.
const roads={
 nodes:{
  oakWest:{x:-55,z:6},oakEast:{x:55,z:6},alderNorth:{x:-30,z:-60},alderSouth:{x:-30,z:60},countyEnd:{x:-30,z:n(-246)},
  farmGate:{x:-164,z:n(-160)},farmJoin:{x:-34,z:n(-160)},woodsJoin:{x:-26,z:n(-180)},woodsEnd:{x:195,z:n(-180)},woodsLaneNorth:{x:90,z:n(-246)},woodsLaneSouth:{x:90,z:n(-146)},
  alderStreetS:{x:50,z:-3.5},alderStreetN:{x:50,z:-125},alderCrossW:{x:-30,z:-90},alderCrossE:{x:84,z:-90},
  oakEastEnd:{x:195,z:6},cedarLinkS:{x:120,z:6},cedarLoopStart:{x:120,z:-57},
  freightW:{x:72,z:68},freightS:{x:195,z:68},freightE:{x:199.5,z:68},outEast:{x:290,z:68}, // outEast: Freight South carried on to the ground's east edge (0.35): the road customer trucks come and go by (MAP.exits)
freightN:{x:195,z:n(-180)-3.5},
  worksN:{x:102,z:6},worksS:{x:102,z:68} // Works Lane (0.33): from Oak Street East's centreline to Freight South's
 },
 edges:[
  {id:'oak-street',from:'oakWest',to:'oakEast',width:19,surface:'asphalt',level:'street'},
  {id:'alder-avenue',from:'alderNorth',to:'alderSouth',width:16,surface:'asphalt',level:'street'},
  {id:'county-road',from:'alderNorth',to:'countyEnd',width:8,surface:'asphalt',level:'rural'},
  {id:'farm-road',from:'farmGate',to:'farmJoin',width:7,surface:'dirt'},
  {id:'woods-road',from:'woodsJoin',to:'woodsEnd',width:7,surface:'dirt'},
  {id:'woods-lane',from:'woodsLaneNorth',to:'woodsLaneSouth',width:5,surface:'dirt'},
  // Alder Center: Alder Street runs north from Oak Street's pavement (between the cafe and the city's east edge) to the cross street, which joins the County Road in the west and meets
  // Cedar Heights' loop at a T in the east (the loop's west side is vertical there, so the join is square).
  {id:'alder-street',from:'alderStreetS',to:'alderStreetN',width:10,surface:'asphalt',level:'rural',walkable:true},
  {id:'alder-cross',from:'alderCrossW',to:'alderCrossE',width:12,surface:'asphalt',level:'rural',walkable:true},
  // Oak Street continues east through Eastbank Works to the Freight Road; Cedar Heights hangs off it to the north and off Alder Center's cross street.
  {id:'oak-east',from:'oakEast',to:'oakEastEnd',width:12,surface:'asphalt',level:'rural',walkable:true,zone:'eastbank'},
  {id:'cedar-link',from:'cedarLinkS',to:'cedarLoopStart',width:9,surface:'asphalt',level:'rural',walkable:true},
  // Cedar Heights' loop: a closed, smoothed oval around (120, -85), 76 m by 56 m, 9 m wide (two 3.5 m lanes and a 1 m shoulder each side). Its tightest bend has a
  // radius of about 20 m, comfortable for cars and a small truck.
  {id:'cedar-loop',from:'cedarLoopStart',to:'cedarLoopStart',width:9,surface:'asphalt',level:'rural',walkable:true,zone:'cedar',curve:true,closed:true,
   path:[[101.0,-60.8],[87.1,-71.0],[82.0,-85.0],[87.1,-99.0],[101.0,-109.2],[120.0,-113.0],[139.0,-109.2],[152.9,-99.0],[158.0,-85.0],[152.9,-71.0],[139.0,-60.8]]},
  // The Freight Road: along the south side of Eastbank Works, then north up its own corridor, over the east bridge, to Pine Ridge.
  {id:'freight-south',from:'freightW',to:'freightE',width:12,surface:'asphalt',level:'rural',walkable:true,zone:'eastbank'}, // 12 m since 0.33 (was 9): every Eastbank yard opens onto it and the flatbed turns in from the Freight Road
  {id:'freight-out',from:'freightE',to:'outEast',width:12,surface:'asphalt',level:'rural',walkable:true}, // 0.35: Freight South continued east to the playable edge (x 290; walkable ground stops there): trucks leave the map along it
  {id:'freight-road',from:'freightS',to:'freightN',width:9,surface:'asphalt',level:'rural',walkable:true,zone:'freight'},
  // Works Lane (0.33): Eastbank's own connector, a straight 12 m road closing the loop Oak Street East -> Works Lane -> Freight South -> Freight Road.
  {id:'works-lane',from:'worksN',to:'worksS',width:12,surface:'asphalt',level:'rural',walkable:true,zone:'eastbank'}
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
const interior=(doorKind='sliding')=>({origin:{y:.165,z:-13.5},frontWallZ:5,entry:{x:0,z:3.9},spawn:{x:0,z:3.1},exit:{x:0,z:4},counter:{x:0,z:-2},exitDoor:{kind:doorKind,z:4.96,width:2.2,height:2.7,near:{halfWidth:2.4,z:2.7},trigger:{halfWidth:.9,z:4.3}}});
// Shops you can walk into. x is the door centre, z is where you stand outside it, doorZ is the door plane on the building's
// front, hours are [opens, closes) in minutes since midnight, sign is the text over the door.
const shops={
 market:{name:'Corner Market',x:19,z:-6.3,doorZ:-8.46,door:{width:2.3,height:2.5},hours:[420,1320],sign:'MARKET 7AM–10PM',doorway:doorway(),interior:interior()},
 cafe:{name:'Alder Coffee',x:36,z:-6.3,doorZ:-8.46,door:{width:2.3,height:2.5},hours:[480,1080],sign:'CAFE 8AM–6PM',doorway:doorway(),interior:interior('double')}
};

// Land set aside for later (ownership, preset buildings). Whole-cell rectangles; kind is 'residential', 'commercial' or
// 'industrial'. None are reserved on the current map; validateMap checks any you add.
const reserved=[
 // A residential plot also has a `driveway` (3.5 m wide, from the house front to the loop road, where it runs under the road), a front `path` to the door, and a `park` spot (car nose toward the house).
 // Reserved land (whole cells; the ground overlay on the O key and the minimap show them): kept as data until buildings or ownership arrive. `facing` is the side the
 // plot's door and driveway are on: the street it fronts.
 // Alder Center: C1-C7 along the south side of the cross street (facing north), C8-C10 along the north side (facing south): half-metre plots, shoulder to shoulder.
 {id:'C1',name:'Commercial plot C1',kind:'commercial',facing:'north',x0:-20,x1:-7,z0:-81,z1:-63.5},
 {id:'C2',name:'Commercial plot C2',kind:'commercial',facing:'north',x0:-7,x1:3,z0:-81,z1:-70},
 {id:'C3',name:'Commercial plot C3',kind:'commercial',facing:'north',x0:3,x1:14,z0:-81,z1:-69},
 {id:'C4',name:'Commercial plot C4',kind:'commercial',facing:'north',x0:14,x1:21.5,z0:-81,z1:-71.5},
 {id:'C5',name:'Commercial plot C5',kind:'commercial',facing:'north',x0:21.5,x1:28.5,z0:-81,z1:-73},
 {id:'C6',name:'Commercial plot C6',kind:'commercial',facing:'north',x0:28.5,x1:36,z0:-81,z1:-72.5},
 {id:'C7',name:'Commercial plot C7',kind:'commercial',facing:'north',x0:36,x1:43,z0:-81,z1:-72},
 {id:'C8',name:'Commercial plot C8',kind:'commercial',facing:'south',x0:-20,x1:-6.5,z0:-108,z1:-99},
 {id:'C9',name:'Commercial plot C9',kind:'commercial',facing:'south',x0:-6.5,x1:1,z0:-108,z1:-99},
 {id:'C10',name:'Commercial plot C10',kind:'commercial',facing:'south',x0:1,x1:9,z0:-107,z1:-99},
 {id:'R1',name:'Residential plot R1',kind:'residential',facing:'south',x0:94,x1:106,z0:-85,z1:-73,
  driveway:{x0:101.6,x1:105.1,z0:-75.9,z1:-63.5},path:{x0:99.25,x1:100.75,z0:-75.9,z1:-63.5},park:{x:103.35,z:-73.3,heading:'north'}},{id:'R2',name:'Residential plot R2',kind:'residential',facing:'south',x0:114,x1:126,z0:-83,z1:-71,
  driveway:{x0:121.6,x1:125.1,z0:-73.9,z1:-61},path:{x0:119.25,x1:120.75,z0:-73.9,z1:-61},park:{x:123.35,z:-71.3,heading:'north'}},{id:'R3',name:'Residential plot R3',kind:'residential',facing:'south',x0:134,x1:146,z0:-85,z1:-73,
  driveway:{x0:141.6,x1:145.1,z0:-76.4,z1:-65.5},path:{x0:139.25,x1:140.75,z0:-76.4,z1:-65.5},park:{x:143.35,z:-73.8,heading:'north'}},
 // The ring: R4-R6 north of the loop (facing south), R7-R8 south of it (facing north).
 {id:'R4',name:'Residential plot R4',kind:'residential',facing:'south',x0:92,x1:104,z0:-129,z1:-115,driveway:{x0:99.6,x1:103.1,z0:-120.78,z1:-112},path:{x0:97.25,x1:98.75,z0:-120.78,z1:-112},park:{x:101.35,z:-118.08,heading:'north'}},
 {id:'R5',name:'Residential plot R5',kind:'residential',facing:'south',x0:114,x1:126,z0:-134,z1:-120,driveway:{x0:121.6,x1:125.1,z0:-124.88,z1:-116},path:{x0:119.25,x1:120.75,z0:-124.88,z1:-116},park:{x:123.35,z:-122.18,heading:'north'}},
 {id:'R6',name:'Residential plot R6',kind:'residential',facing:'south',x0:136,x1:148,z0:-129,z1:-115,driveway:{x0:136.9,x1:140.4,z0:-119.88,z1:-110},path:{x0:144.35,x1:145.85,z0:-119.88,z1:-110},park:{x:138.65,z:-117.18,heading:'north'}},
 {id:'R7',name:'Residential plot R7',kind:'residential',facing:'north',x0:88,x1:100,z0:-55,z1:-43,driveway:{x0:95.6,x1:99.1,z0:-61.5,z1:-52.06},path:{x0:91.25,x1:92.75,z0:-61.5,z1:-52.06},park:{x:97.35,z:-54.76,heading:'south'}},
 {id:'R8',name:'Residential plot R8',kind:'residential',facing:'north',x0:140,x1:152,z0:-55,z1:-43,driveway:{x0:147.6,x1:151.1,z0:-64,z1:-52.06},path:{x0:144.05,x1:145.55,z0:-64,z1:-52.06},park:{x:149.35,z:-54.76,heading:'south'}},
 {id:'I1',name:'Industrial plot I1',kind:'industrial',facing:'north',x0:150,x1:176,z0:18,z1:46},{id:'I2',name:'Industrial plot I2',kind:'industrial',facing:'south',x0:150,x1:180,z0:-18,z1:-2},
 // Eastbank Works (0.33): I3 the building supplier and I4 the vehicle workshop front Oak Street East (facing north), I5 the timber yard fronts Freight South (facing south), I6 is the open freight yard (no building).
 {id:'I3',name:'Industrial plot I3',kind:'industrial',facing:'north',x0:72,x1:94,z0:14,z1:40},{id:'I4',name:'Industrial plot I4',kind:'industrial',facing:'north',x0:110,x1:142,z0:14,z1:40},
 {id:'I5',name:'Industrial plot I5',kind:'industrial',facing:'east',x0:72,x1:94,z0:42,z1:62},{id:'I6',name:'Industrial plot I6',kind:'industrial',facing:'south',x0:110,x1:188,z0:48,z1:62}
];

// ── Eastbank Works paving, bays and yards (0.33) ─────────────────────────────────────────────────────────────────────────────────────
// `paving`: asphalt you can walk and drive on (terrain surface DRIVEWAY), drawn as one merged mesh: truck yards (at least 8 m per truck, 12 m deep), aprons, the gas station's forecourt, the depot lot, and the 8 m
// driveway cuts between a yard and its road. Paving never lies under a building. `kind: 'island'` is the pump island (a lighter slab, still drivable ground; its bollards and later its pumps are the solid parts).
const paving=[
 {id:'depot',x0:80,x1:114,z0:-18,z1:-3},{id:'depot-cut',x0:96,x1:104,z0:-3,z1:0},
 {id:'supply-apron',x0:72,x1:94,z0:14,z1:31.2},{id:'supply-cut',x0:76,x1:84,z0:12,z1:14},
 {id:'workshop-apron',x0:112,x1:142,z0:14,z1:27.5},{id:'workshop-cut-w',x0:112,x1:120,z0:12,z1:14},{id:'workshop-cut-e',x0:133,x1:141,z0:12,z1:14},
 {id:'warehouse-yard',x0:152,x1:174,z0:18,z1:31.5},{id:'warehouse-in',x0:156,x1:164,z0:12,z1:18},{id:'warehouse-out',x0:166,x1:174,z0:12,z1:18},
 {id:'gas-in',x0:142,x1:150,z0:-9,z1:0},{id:'gas-west',x0:150,x1:161.5,z0:-18,z1:0},{id:'gas-east',x0:161.5,x1:179,z0:-10,z1:0},{id:'gas-island',x0:154.5,x1:158.5,z0:-9.15,z1:-7.35,kind:'island'},
 {id:'timber-yard',x0:80,x1:94,z0:44,z1:60},{id:'timber-out',x0:82,x1:90,z0:60,z1:62},{id:'timber-in',x0:94,x1:96,z0:46,z1:54},
 {id:'freight-yard',x0:110,x1:188,z0:48,z1:60},{id:'freight-cut-w',x0:120,x1:128,z0:60,z1:62},{id:'freight-cut-e',x0:160,x1:168,z0:60,z1:62},{id:'freight-link',x0:108,x1:110,z0:50,z1:58}
];
// Painted parking bays: `count` bays `width` wide and `depth` deep from (x0, z0); lines between them and along the back (the side away from the way in).
const bayRows=[
 {id:'supply-bays',x0:76.4,z0:22,count:6,width:2.7,depth:5,back:'south'},{id:'workshop-bays',x0:113,z0:21,count:2,width:2.7,depth:5,back:'south'},
 {id:'depot-car-bays',x0:95.5,z0:-18,count:6,width:2.7,depth:5,back:'north'},{id:'depot-truck-bays',x0:82,z0:-18,count:3,width:4.5,depth:10,back:'north'} // the Riden Deals lot: 10 display slots (2 truck bays, where the worktruck (84.25) and the pickup (88.75) stand, and 8 car bays, 2 of them spare); the showroom stands behind the bays' back line
];
// Yards: each is one chunk of props (one InstancedMesh per model, eastbank.js), drawn only within `cull` metres (80) of the yard's rectangle, with caps checked by validateMap (at most YARD_CAPS.perModel of one model
// in a yard, YARD_CAPS.total in all of them). An item is {prop, x, z, yaw, y}: y > 0 is a stacked pallet (only the bottom one is solid).
export const YARD_CAPS=Object.freeze({perModel:32,total:160});
const PI=Math.PI,fixed=v=>+v.toFixed(2);
const rowOf=(prop,x,z,dx,count,yaw=0)=>Array.from({length:count},(_,i)=>({prop,x:fixed(x+dx*i),z,yaw,y:0}));
const stackOf=(x,z,count)=>Array.from({length:count},(_,i)=>({prop:'prop.pallet',x,z,yaw:0,y:fixed(.144*i)}));
const LOADED=['prop.pallet-small-boxes','prop.pallet-medium-boxes','prop.pallet-crate'];
const loadedRow=(x,z,dx,count)=>Array.from({length:count},(_,i)=>({prop:LOADED[i%3],x:fixed(x+dx*i),z,yaw:0,y:0}));
const yards=[
 // The warehouse's truck yard. The model has ONE loading door, a ground-level garage opening 3.7 m wide and 2.15 m high, 1.2 m right of the building's centre seen from the front (propInfo('industrial-q').door); the warehouse faces north, so
 // the dock is at world x = 163 - 1.2 = 161.8 on the north wall (z 31.52). The dock plate's lip (its local z -0.6) lies against the wall and its ramp end faces the truck. The inbound driveway (x 156..164) lines up with the dock lane, the outbound
 // one (x 166..174) leaves to the east. Pickup sign and bollards flank the lane; loaded pallets stand against the wall on the left, a stack of empty pallets on the right.
 {id:'warehouse-yard',bounds:{x0:152,x1:174,z0:18,z1:31.5},cull:80,items:[
  {prop:'prop.dock-plate',x:161.8,z:30.92,yaw:PI,y:0},{prop:'prop.zone-sign-pickup',x:165.6,z:28,yaw:PI,y:0},
  ...[159.3,164.3].map(x=>({prop:'prop.zone-bollard',x,z:30.4,yaw:0,y:0})),
  ...loadedRow(153,30.9,1.3,4),...loadedRow(153,29.7,1.3,4),...stackOf(169.5,30.9,6)]},
 // The freight yard behind the workshop and warehouse: eight containers in a row, stacks of empty pallets, loaded pallets and crates.
 {id:'freight-yard',bounds:{x0:110,x1:188,z0:48,z1:60},cull:80,items:[
  ...Array.from({length:8},(_,k)=>({prop:['container-a','container-b','container-c'][k%3],x:114+7*k,z:51,yaw:PI/2,y:0})),
  ...stackOf(171,50.5,6),...stackOf(173,50.5,6),...stackOf(175,50.5,6),
  ...loadedRow(170,55,1.4,6),...loadedRow(170,56.4,1.4,6),
  ...Array.from({length:10},(_,i)=>({prop:'prop.crate-large',x:i%2?182.6:181.2,z:fixed(50.5+1.3*Math.floor(i/2)),yaw:0,y:0})),
  ...[119.4,128.6,159.4,168.6].map(x=>({prop:'prop.zone-bollard',x,z:59.6,yaw:0,y:0}))]},
 // The timber yard (plank dock): the UNLOAD sign, bollards at its two driveways, empty pallets and crates; the planks themselves arrive in 0.35.
 {id:'timber-yard',bounds:{x0:80,x1:94,z0:44,z1:60},cull:80,items:[
  {prop:'prop.zone-sign-unload',x:80.8,z:50,yaw:PI/2,y:0},
  ...[[81.4,59.6],[90.6,59.6],[93.6,45.4],[93.6,54.6]].map(([x,z])=>({prop:'prop.zone-bollard',x,z,yaw:0,y:0})),
  ...rowOf('prop.pallet',82.4,45.2,1.4,6),...rowOf('prop.crate-large',91.2,45.4,1.3,2)]},
 // The workshop's apron: boxes and crates by the building, two empty pallets.
 {id:'workshop-apron',bounds:{x0:112,x1:142,z0:14,z1:27.5},cull:80,items:[
  ...rowOf('prop.box-small',113,26.8,.6,6),...rowOf('prop.box-medium',118,26.8,.8,4),...rowOf('prop.crate-large',136.5,26.5,1.4,2),
  {prop:'prop.pallet',x:140,z:26,yaw:0,y:0},{prop:'prop.pallet',x:140,z:24.9,yaw:0,y:0}]},
 // The gas station: bollards at the ends of the pump island (the pumps and the canopy come with the user's models).
 {id:'gas-station',bounds:{x0:150,x1:161.5,z0:-18,z1:0},cull:80,items:[...[[154,-9.3],[154,-7.2],[159,-9.3],[159,-7.2]].map(([x,z])=>({prop:'prop.zone-bollard',x,z,yaw:0,y:0})),{prop:'prop.pump-island',x:156.5,z:-8.25,yaw:0,y:0},{prop:'prop.forecourt-canopy',x:156.5,z:-8.25,yaw:Math.PI/2,y:0}]}
];

function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const key of Object.keys(value))deepFreeze(value[key])}return value}

// The property registry: every building that can be entered, and the rule for its door. `access`: 'public' (open in its hours: the shops), 'tenant' (the studio, for its renter) or 'owner'
// (only its owner). `owner`: null (vacant, for sale), {type:'npc', name} or {type:'city'|'landlord'}. A building that is not enterable says so and why (`enterable: false, reason`): nothing is left out by accident.
// A vacant house may carry a `listing` (weekly rent, deposit, price, all in cents): the Homes app on the phone offers it, and ownership.js turns it into `progress.properties` (0.30).
const properties=[
 {id:'market',type:'shop',name:'Corner Market',access:'public',owner:{type:'city'}},
 {id:'cafe',type:'shop',name:'Alder Coffee',access:'public',owner:{type:'city'}},
 {id:'studio',type:'apartment',name:'Studio 2B',access:'tenant',owner:{type:'landlord',name:'the landlord'}},
 // Cedar Heights: R1, R3, R5 and R7 are vacant (for sale); the others belong to residents.
 {id:'house-r1',type:'house',size:'small',landmark:'house-r1',plot:'R1',name:'1 Cedar Loop',access:'owner',owner:null,listing:{rentCents:16000,depositCents:32000,priceCents:1250000}},
 {id:'house-r2',type:'house',size:'small',landmark:'house-r2',plot:'R2',name:'2 Cedar Loop',access:'owner',owner:{type:'npc',name:'Marta Ellison'}},
 {id:'house-r3',type:'house',size:'small',landmark:'house-r3',plot:'R3',name:'3 Cedar Loop',access:'owner',owner:null,listing:{rentCents:14000,depositCents:28000,priceCents:1100000}},
 {id:'house-r4',type:'house',size:'small',landmark:'house-r4',plot:'R4',name:'4 Cedar Loop',access:'owner',owner:{type:'npc',name:'Tom Reyes'}},
 {id:'house-r5',type:'house',size:'small',landmark:'house-r5',plot:'R5',name:'5 Cedar Loop',access:'owner',owner:null,listing:{rentCents:19000,depositCents:38000,priceCents:1500000}},
 {id:'house-r6',type:'house',size:'small',landmark:'house-r6',plot:'R6',name:'6 Cedar Loop',access:'owner',owner:{type:'npc',name:'Priya Nair'}},
 {id:'house-r7',type:'house',size:'small',landmark:'house-r7',plot:'R7',name:'7 Cedar Loop',access:'owner',owner:null,listing:{rentCents:17500,depositCents:35000,priceCents:1350000}},
 {id:'house-r8',type:'house',size:'small',landmark:'house-r8',plot:'R8',name:'8 Cedar Loop',access:'owner',owner:{type:'npc',name:'Grace Whitfield'}},
 // Alder Center: shop and office interiors arrive with later updates.
 {id:'alder-store',type:'shop',landmark:'alder-store',plot:'C1',name:'Alder Store',enterable:false,reason:'Shop interiors arrive with the store jobs update (cashier shifts).'},
 {id:'alder-offices',type:'commercial',landmark:'alder-offices',plot:'C2',name:'Alder Offices',enterable:false,reason:'Office interiors arrive with a later update.'},
 {id:'alder-tower',type:'commercial',landmark:'alder-tower',plot:'C3',name:'Alder Tower',enterable:false,reason:'Office interiors arrive with a later update.'},
 {id:'alder-bakery',type:'shop',landmark:'alder-bakery',plot:'C4',name:'Alder Bakery',enterable:false,reason:'Shop interiors arrive with the store jobs update.'},
 {id:'alder-barber',type:'shop',landmark:'alder-barber',plot:'C5',name:'Alder Barber',enterable:false,reason:'Shop interiors arrive with the store jobs update.'},
 {id:'alder-pharmacy',type:'shop',landmark:'alder-pharmacy',plot:'C6',name:'Alder Pharmacy',enterable:false,reason:'Shop interiors arrive with the store jobs update.'},
 {id:'alder-bank',type:'commercial',landmark:'alder-bank',plot:'C7',name:'Alder Bank',enterable:false,reason:'Office interiors arrive with a later update.'},
 {id:'police-station',type:'civic',landmark:'police-station',plot:'C8',name:'Police Station',enterable:false,reason:'Its interior arrives with a later update.'},
 {id:'alder-books',type:'shop',landmark:'alder-books',plot:'C9',name:'Alder Books',enterable:false,reason:'Shop interiors arrive with the store jobs update.'},
 {id:'alder-cinema',type:'commercial',landmark:'alder-cinema',plot:'C10',name:'Alder Cinema',enterable:false,reason:'Its interior arrives with a later update.'},
 // The farm and the timber yard.
 {id:'farm-house',type:'farm',landmark:'farm-house',name:'Willow Farmhouse',access:'owner',owner:{type:'npc',name:'Hal Brennan'}},
 {id:'farm-barn',type:'farm',landmark:'farm-barn',name:'The Barn',enterable:false,reason:'Barn interiors (storage, animal pens) arrive with the farming update.'},
 {id:'farm-small-barn',type:'farm',landmark:'farm-small-barn',name:'The Small Barn',enterable:false,reason:'Barn interiors arrive with the farming update.'},
 {id:'farm-open-barn',type:'farm',landmark:'farm-open-barn',name:'The Open Barn',enterable:false,reason:'An open shelter for machinery; you can already walk in.'},
 {id:'farm-silo',type:'farm',landmark:'farm-silo',name:'The Silo',enterable:false,reason:'A grain silo; the little shed beside it is storage only.'},
 {id:'farm-coop',type:'farm',landmark:'farm-coop',name:'The Chicken Coop',enterable:false,reason:'Too small to enter; chickens arrive with the farming update.'},
 {id:'farm-windmill',type:'farm',landmark:'farm-windmill',name:'The Windmill',enterable:false,reason:'A landmark; no interior.'},
 {id:'sawmill',type:'industrial',landmark:'sawmill',name:'Sawmill',enterable:false,reason:'An open-sided working yard; the machinery is its inside.'},
 // Eastbank Works: the Kenney Industrial buildings have no interiors.
 {id:'eastbank-warehouse',type:'industrial',landmark:'eastbank-warehouse',plot:'I1',name:'Eastbank Warehouse',enterable:false,reason:'Freight pickups (stock, furniture boxes) arrive with cargo in 0.35; the work happens at the docks outside.'},
 {id:'eastbank-workshop',type:'industrial',landmark:'eastbank-workshop',plot:'I4',name:'Eastbank Vehicle Workshop',enterable:false,reason:'Repairs arrive with tool wear and repairs (0.37).'},
 {id:'eastbank-supply',type:'shop',landmark:'eastbank-supply',plot:'I3',name:'Eastbank Building Supplier',enterable:false,reason:"The supplier's counter (blades, tools, whetstones) arrives with 0.35-0.37; the plank dock is in the timber yard behind."},
 {id:'eastbank-gas-kiosk',type:'shop',landmark:'eastbank-gas-kiosk',plot:'I2',name:'Eastbank Gas Station',enterable:false,reason:'Paying for fuel arrives with the fuel system (0.35).'},
 {id:'ridgeline-office',type:'industrial',landmark:'ridgeline-office',plot:'I5',name:'Ridgeline Timber Office',enterable:false,reason:'The company office has its own door on the timber yard side (see MAP.offices); it opens from 6 AM to 6 PM.'},
 {id:'riden-deals',type:'shop',landmark:'riden-deals',name:'Riden Deals',enterable:false,reason:'The showroom opens later: buy a vehicle on the lot (E at its driver door) or order one from the phone Store.'}
];
// Drivable vehicles (0.33, DESIGN 4.13 D): the two depot vehicles, parked nose to the back wall (north, so yaw pi: a model's front is +z) in the depot's first truck and car bays. Anyone can drive them (no keys yet). `model` is a converted
// prop and a vehicle class (vehicle.js CLASSES); the id is the save key (`progress.vehicles`). The parked scenery cars and trucks elsewhere are not drivable.
export const DRIVABLE_MODELS=Object.freeze(['worktruck','offroad','flatbed']);
// RULE: every vehicle model needs a `sale` field (DESIGN 4.14). 'dealership': a display vehicle on the Riden Deals lot, bought there only. 'online': in the phone Store only, no display slot and no `home`. 'both': display slot and Store.
// The lot holds one display vehicle per dealership or both model, in the depot's bays (validateMap checks there are enough bays).
export const SALE_MODES=Object.freeze(['dealership','online','both']);
// The forecourt canopy's four steel columns, from the canopy's origin when it is not turned (the 0.8 m column boxes the map adds, see eastbank.js, which turns them with the canopy: x and z offsets in metres).
export const CANOPY_MODEL_X=5,CANOPY_COLUMN_X=0; // the model's columns stand 5 m from its centre (across the lanes), in pairs; eastbank.js moves each pair together onto the island's centre line, so one column stands at each end of the island and both lanes under the roof are open
export const CANOPY_COLUMNS=Object.freeze([[CANOPY_COLUMN_X,3.2],[-CANOPY_COLUMN_X,3.2],[CANOPY_COLUMN_X,-3.2],[-CANOPY_COLUMN_X,-3.2]]);
// The Eastbank gas station (0.35, fuel.js): one pump island (two pumps: N=0 gas at its x -0.8 side, N=1 diesel at +0.8, the island's own anchors read from the model). A drive-through: you come in from the west (the gas-in paving), pass along the island's south side with your driver's door to the island, and leave east. The nozzles hang on the south (+z, the model's -Y) face.
export const FUEL_STATIONS=Object.freeze([{id:'eastbank-gas',island:{prop:'prop.pump-island',x:156.5,z:-8.25,yaw:0},face:'ny',pumps:[{n:0,fuel:'gas'},{n:1,fuel:'diesel'}]}]);
// Terrain relief (0.34): smooth elliptical hills in open country only, far from every road, zone, field, plot and the river (terrain.js validateTerrain checks it). height = h at the centre, 0 at the ellipse edge (a cosine falloff).
// rx, rz: radii in metres; h: peak height in metres. The ground under everything built stays flat. heightAt (height.js) reads this.
// A track winds up a hill as a spiral (a gentle climb, no tighter than a truck can turn): from rom to 	o of the hill's radius (0 = summit, 1 = edge), 	urns times round, starting due east.
const spiral=(cx,cz,rx,rz,from,to,turns)=>{const out=[],n=Math.ceil(turns*2*Math.PI/.07);for(let i=0;i<=n;i++){const t=i/n,a=turns*2*Math.PI*t,r=from+(to-from)*t;out.push(Object.freeze([+(cx+r*rx*Math.cos(a)).toFixed(2),+(cz+r*rz*Math.sin(a)).toFixed(2)]))}return Object.freeze(out)};
const relief=Object.freeze({hills:Object.freeze([
 {id:'west-hill',x:-192,z:5,rx:52,rz:48,h:9},
 {id:'west-knoll',x:-160,z:84,rx:30,rz:22,h:5},
 {id:'north-west-hill',x:-212,z:-356,rx:32,rz:30,h:8},
 // beyond Pine Ridge's east edge (past the Freight Road), north of the river
 {id:'ridge-east-hill',x:264,z:-300,rx:22,rz:32,h:8},
 {id:'ridge-east-knoll',x:266,z:-356,rx:20,rz:16,h:6}
]),tracks:Object.freeze([
 {id:'west-hill-track',half:3,points:Object.freeze([[-58.5,5],[-100,5],...spiral(-192,5,52,48,.95,.2,1.8)])} // a dirt track from the west end of Oak Street, out across the meadow and up the big west hill: drivable, DIRT underfoot, joined to the street at x = -55
])});
const vehicles=[
 {id:'eastbank-worktruck',model:'worktruck',name:'Worktruck',sale:'both',home:{x:84.25,z:-13,yaw:PI},fuel:{type:'diesel',tankMgal:21000,port:{x:1.2,z:-2.2}}},
 {id:'eastbank-offroad',model:'offroad',name:'Pevrolet Off Road Pickup',sale:'both',home:{x:88.75,z:-13,yaw:PI},fuel:{type:'diesel',tankMgal:18000,port:{x:1.4,z:-2.2}}},
 // the Tylan Flatbed (0.35): the third truck bay; for sale from Lumberjack level 5 (shown, locked, before that). The fuel port is the model's anchor_fuel_port.
 {id:'eastbank-flatbed',model:'flatbed',name:'Tylan Flatbed',sale:'both',requires:{skill:'lumberjack',level:5},home:{x:93.25,z:-13,yaw:PI},fuel:{type:'diesel',tankMgal:30000,port:{x:1.22,z:-.235}}}
];
// Employers (0.35, DESIGN 4.15): a company with one owner (an NPC at the start), a skill, an office building, the places that count as "on site" (a zone, a plot or an
// interior room), opening hours in game minutes (6 AM to 6 PM; the last clock-in half an hour before closing) and its ranks. A rank: what it needs (skill level,
// shifts worked, reputation 0-100), its wage in cents per game hour on site, the tools handed over once when it is reached (item ids), the task kinds it adds.
// Names are defaults: a save may rename a company (careers.js employerName). Placeholder numbers (Haiku tunes).
// Company offices (0.35): a building with a door you walk up to (E, open during the employer's hours) and an interior room that sits far from the map and is shown only while you are inside (like a shop's).
// door: where you stand outside, and the yaw you face leaving; sign: the company's name board above the door. The room is the shops' layout (market interior numbers), so its entry, exit and counter are the same.
const offices=[
 {id:'ridgeline-office',employer:'ridgeline',building:'ridgeline-office',door:{x:80.9,z:58.3,out:{x:81.5,z:58.3},yaw:Math.PI/2},sign:{x:78.66,y:3.2,z:53.5,yaw:Math.PI/2},interior:{...interior('double'),origin:{x:420,y:.165,z:300}}},
 {id:'ridgeline-warehouse',kind:'warehouse',name:'Ridgeline Warehouse',employer:'ridgeline',building:'eastbank-warehouse',door:{x:166.9,z:31.5,face:32.52,out:{x:166.9,z:30.2},yaw:Math.PI},sign:{x:166.9,y:3.72,z:32.62,yaw:Math.PI},interior:{origin:{x:440,y:.165,z:300},...WAREHOUSE_INTERIOR}} // the lumber warehouse (4.16): a person door on the north wall beside the loading door (the model has no person door: it is drawn there), open in the employer's hours
];
// Map exits (0.35, DESIGN 4.15 K): where NPC vehicles (customer trucks) come onto the map and leave it. `path` runs from the far end (off the map, where a vehicle appears and is
// removed) inward; its first point must lie outside the playable rectangle (validateMap), so making the map bigger means moving the exit too. Lanes: Freight South is centred on
// z 68, 12 m wide; westbound traffic keeps to z 65, eastbound to z 71 (drive on the right).
const exits=[{id:'east',road:'freight-out',in:[[322,65],[296,65],[200,65],[120,65],[95,65]],out:[[95,71],[200,71],[296,71],[322,71]]}];
const employers=[
 {id:'ridgeline',name:'Ridgeline Timber Co.',skill:'lumberjack',office:'ridgeline-office',owner:{kind:'npc',id:'walt-hargrove',name:'Walt Hargrove',title:'Owner'},
  hours:{from:360,to:1080,lastIn:1050},
  store:[{item:'chainsaw',rank:6},{item:'logging-chainsaw',rank:6}], // the company store at the office: sold to this rank and above (an item may also need a skill level: items.js `requires`)
  sites:[{zone:'forest'},{plot:'I5'},{plot:'I1'},{room:'ridgeline-office'},{room:'ridgeline-warehouse'}],
  ranks:[
   {id:'trainee',name:'Trainee',needs:{level:1,shifts:0,rep:0},wage:800,grants:['axe'],tasks:['fell','landing','gather']},
   {id:'feller',name:'Feller',needs:{level:3,shifts:3,rep:20},wage:1000,grants:[],tasks:['mill','stumps']},
   {id:'hauler',name:'Hauler',needs:{level:5,shifts:6,rep:35},wage:1200,grants:['logging-axe'],tasks:['haul','load']},
   {id:'yard-hand',name:'Yard hand',needs:{level:7,shifts:10,rep:50},wage:1400,grants:[],tasks:['stack','pick']},
   {id:'sawyer',name:'Sawyer',needs:{level:10,shifts:15,rep:60},wage:1600,grants:['steel-axe'],tasks:['deliver','replant']},
   {id:'foreman',name:'Foreman',needs:{level:15,shifts:25,rep:75},wage:1800,grants:[],tasks:[]}
  ]}
];
export const MAP=deepFreeze({
 id:'oak-and-alder',version:1,
 seed:7301, // changing it moves every generated tree and orphans saved forest plots
 spawn:{x:-5,y:.2,z:15},

 ground:{x0:-260,x1:300,z0:-390,z1:110},
 // Where you can walk: everywhere inside this rectangle except water (and trees, fences and buildings, which are solid objects). The zones name and shape the districts; they no longer fence them in.
 playable:{x0:-250,x1:290,z0:-380,z1:100},
 openCountry:{id:'open',name:'Open Country',label:'OPEN COUNTRY',subtitle:'Meadows between districts',color:'#6e8a5c'}, // how far the ground is drawn (scenery fades into fog beyond the walkable zones)
 zones,roads,water,fields,buildings,shops,reserved,properties,paving,bayRows,yards,vehicles,relief,employers,offices,exits,
 // The marked parking lot behind the south row of shops: bays 2.7 m wide and 5 m deep along its north edge, an aisle to Alder Street, the lot's own asphalt.
 lots:[{id:'alder-lot',x0:-14,x1:45,z0:-63,z1:-52,bays:{x0:-13.5,z0:-63,count:20,width:2.7,depth:5}}],
 // Parking lanes on the cross street (6 m bays, nose in the direction of traffic: eastbound on the south side, westbound on the north), and the lane edge lines.
 parking:[{id:'cross-s',z:-85.25,edge:-86.5,x0:-19,x1:37,bay:6,face:'east'},{id:'cross-n',z:-94.75,edge:-93.5,x0:-19,x1:37,bay:6,face:'west'}],
 // Crosswalks: `road` is the way the road runs; stripes 3 m long along it, 0.5 m wide, one every metre across `span`, centred on (x, z). Stop lines: a bar across the approaching lane.
 crossings:[
  {x:50,z:-98.5,road:'z',span:10},{x:50,z:-81.5,road:'z',span:10},{x:41,z:-90,road:'x',span:12},{x:59,z:-90,road:'x',span:12},{x:-23,z:-90,road:'x',span:12},{x:50,z:-10.5,road:'z',span:10},
  {x:-41,z:6,road:'x',span:19},{x:-13,z:6,road:'x',span:19},{x:44,z:6,road:'x',span:19},{x:-30,z:-12,road:'z',span:16},{x:-30,z:24,road:'z',span:16},{x:120,z:-3,road:'z',span:9},{x:110,z:6,road:'x',span:12},{x:130,z:6,road:'x',span:12}],
 stopLines:[{x:46.5,z:-102,along:'x',w:4.5},{x:53.5,z:-78,along:'x',w:4.5},{x:37.5,z:-93.2,along:'z',w:6},{x:62.5,z:-86.8,along:'z',w:6}],
 // The street furniture rows: each `frontage` is a line (a to b) along a pavement kerb; items are placed every `lamp`, `hydrant`, `bin`, `bench`, `tree`, `meter` metres from `at` (a phase) in that
 // order of priority, and an item is dropped if it would stand within 1.5 m of another or of a door, a crossing or a building. `face` is the way benches and the like face (toward the road).
 frontages:[
  {id:'oak-n',a:[-36,-4.1],b:[52,-4.1],face:[0,1],lamp:24,lampAt:5,hydrant:40,hydrantAt:17,bin:44,binAt:35},
  {id:'oak-s',a:[-36,16.2],b:[52,16.2],face:[0,-1],lamp:24,lampAt:17,hydrant:40,hydrantAt:29,bin:44,binAt:8},
  {id:'ave-e',a:[-20.9,-56],b:[-20.9,20],face:[-1,0],lamp:24,lampAt:8,hydrant:40,hydrantAt:21,bin:44,binAt:34},
  {id:'cross-s',a:[-19,-83.4],b:[42,-83.4],face:[0,-1],lamp:24,lampAt:9,hydrant:61,hydrantAt:21,bin:30,binAt:24,meter:12,meterAt:6,tree:12,treeAt:2},
  {id:'cross-sb',a:[-19,-81.6],b:[42,-81.6],face:[0,-1],bench:15,benchAt:7.5},
  {id:'cross-n',a:[-19,-96.6],b:[9,-96.6],face:[0,1],lamp:24,lampAt:9,bin:30,binAt:20,meter:12,meterAt:6,tree:12,treeAt:2},
  {id:'cross-ne',a:[38.5,-96.6],b:[42.5,-96.6],face:[0,1],bin:30,binAt:2},
  {id:'st-w-n',a:[44.5,-121],b:[44.5,-100],face:[1,0],lamp:24,lampAt:4,bin:30,binAt:14},
  {id:'st-w-s',a:[44.5,-83],b:[44.5,-65],face:[1,0],lamp:24,lampAt:3,hydrant:60,hydrantAt:12},
  {id:'st-e-n',a:[55.5,-121],b:[55.5,-97],face:[-1,0],lamp:24,lampAt:4,bin:30,binAt:15},
  {id:'st-e-s',a:[55.5,-83],b:[55.5,-53],face:[-1,0],lamp:24,lampAt:3,hydrant:60,hydrantAt:20,bench:16,benchAt:7,tree:14,treeAt:12}],
 // The town square (a raised paved square north of the cross street): a fountain in the middle, a ring path, planters at the corners, benches round the edge, trees and bollards on its street side.
 plazas:[{id:'alder-square',x0:9,x1:38,z0:-122,z1:-96,fountain:{x:23.5,z:-109,r:3.4},
  planters:[[11.5,-119.5],[35.5,-119.5],[11.5,-98.5],[35.5,-98.5]],trees:[[14,-114],[33,-114],[14,-104],[33,-104]],
  benches:[{x:18,z:-120.2,yaw:0},{x:23.5,z:-120.2,yaw:0},{x:29,z:-120.2,yaw:0},{x:10.2,z:-109,yaw:Math.PI/2},{x:36.8,z:-109,yaw:-Math.PI/2},{x:17,z:-98.2,yaw:Math.PI},{x:30,z:-98.2,yaw:Math.PI}],
  bollards:{z:-96.5,x0:11,x1:36,every:3}}],
 // The bus stop on Alder Street's east sidewalk, facing the road.
 busStop:{x:56.4,z:-72,yaw:-Math.PI/2},
 // The city's raised pavements (footing 0.165 m): either side of Oak Street, and beside Alder Avenue.
 // (0.34) rounded kerbs inside Westside: the inside corners where Alder Avenue and Alder Street meet Oak Street (x, z: the road corner; sx, sz: which side of it the pavement or ground lies; r: radius in metres).
 // junctions.js cornerRegion gives the little quarter-round of asphalt that fills each; game.js cuts the pavement slabs around it and terrain.js paints it as street.
 roundedCorners:[{id:'ave-oak-ne',x:-22,z:-3.5,sx:1,sz:-1,r:4},{id:'ave-oak-se',x:-22,z:15.5,sx:1,sz:1,r:4},{id:'ave-oak-nw',x:-38,z:-3.5,sx:-1,sz:-1,r:4},{id:'ave-oak-sw',x:-38,z:15.5,sx:-1,sz:1,r:4},{id:'street-oak-nw',x:45,z:-3.5,sx:-1,sz:-1,r:4}],
 // (0.34) no pavement crosses a road: the pavements stop at the kerb of every street that meets them (Alder Avenue, Alder Street and Oak Street), so nothing stands or drives over a road on a slab.
 pavements:[{x0:-22,x1:45,z0:-8.5,z1:-3.5},{x0:-22,x1:54,z0:15.5,z1:20.5},{x0:-21.5,x1:-16.5,z0:-60,z1:-8.5},{x0:-21.5,x1:-16.5,z0:20.5,z1:24},
  // Alder Center's own (drawn by world.js, `draw: true`): sidewalks 3 m wide along the cross street (the police station's side stops at the town square, which runs flush to the road),
  // 2 m wide along Alder Street, and the town square itself.
  {x0:-20,x1:43,z0:-84,z1:-80.7,draw:true},{x0:-20,x1:9,z0:-99.3,z1:-96,draw:true},{x0:38,x1:43,z0:-99.3,z1:-96,draw:true},{x0:9,x1:38,z0:-122,z1:-96,draw:true,plaza:true},
  {x0:43,x1:45,z0:-122,z1:-99,draw:true},{x0:43,x1:45,z0:-84,z1:-64,draw:true},{x0:55,x1:57,z0:-122,z1:-96,draw:true},{x0:55,x1:57,z0:-84,z1:-52,draw:true}],
 // Buildings placed from converted models or placeholders (props.js): yaw is a multiple of 90 degrees so the collision boxes stay axis-aligned. The farmstead (a barn,
 // a farmhouse, a silo and a shed; a placeholder for now) fills the free north-east strip of Willow Fields and faces the farm road; the sawmill stands in Pine Ridge's empty clearing.
 landmarks:[
  // The timber yard: the sawmill, a hut for lumber and logs (the parked flatbed truck was removed in 0.33).
  {id:'sawmill',prop:'sawmill-v4',zone:'forest',x:104,z:n(-208),yaw:-Math.PI/2}, // the rigged Blender model (rigged-props.js); its root is the main deck's centre. Turned -90 degrees: its front (switch, player) faces the woods lane to the west, the belt-clearing end faces the yard to the east, the log pile and log feed are on the open north side
  {id:'yard-hut',prop:'hut',zone:'forest',x:124,z:-280,yaw:0,decor:true},{id:'yard-log-1',prop:'log',zone:'forest',x:131,z:-278.2,yaw:0,decor:true},{id:'yard-log-2',prop:'log',zone:'forest',x:131,z:-279.8,yaw:0,decor:true},{id:'yard-log-3',prop:'log',zone:'forest',x:131,z:-281.4,yaw:0,decor:true},
  // Willow Farmstead (Quaternius barns, 1.55 times their size): the barn, the small barn, the open barn, the silo, the coop and the windmill, with a Kenney house as the farmhouse.
  {id:'farm-barn',prop:'barn',zone:'farm',x:-66,z:-270,yaw:0},{id:'farm-small-barn',prop:'small-barn',zone:'farm',x:-84,z:-262,yaw:0},{id:'farm-open-barn',prop:'open-barn',zone:'farm',x:-83,z:-246,yaw:0},
  {id:'farm-silo',prop:'silo-house',zone:'farm',x:-48,z:-272,yaw:0},{id:'farm-coop',prop:'coop',zone:'farm',x:-52,z:-256,yaw:0},{id:'farm-windmill',prop:'windmill',zone:'farm',x:-44,z:-282,yaw:0},
  {id:'farm-house',prop:'house-t',zone:'farm',x:-62,z:-244,yaw:0},
  // Alder Center: a street wall of Kenney commercial buildings and the Store along both sides of the cross street, each flush with the sidewalk behind it (CC0 / Poly Pizza).
  {id:'alder-store',prop:'store',plot:'C1',zone:'alder',x:-13.5,z:-72.40,yaw:Math.PI},
  {id:'alder-offices',prop:'shop-i',plot:'C2',zone:'alder',x:-2,z:-75.50,yaw:Math.PI},
  {id:'alder-tower',prop:'shop-l',plot:'C3',zone:'alder',x:8.5,z:-75.10,yaw:Math.PI},
  {id:'alder-bakery',prop:'shop-c',plot:'C4',zone:'alder',x:17.75,z:-76.35,yaw:Math.PI},
  {id:'alder-barber',prop:'shop-d',plot:'C5',zone:'alder',x:25,z:-77.10,yaw:Math.PI},
  {id:'alder-pharmacy',prop:'shop-a',plot:'C6',zone:'alder',x:32.25,z:-76.95,yaw:Math.PI},
  {id:'alder-bank',prop:'shop-f',plot:'C7',zone:'alder',x:39.5,z:-76.60,yaw:Math.PI},
  {id:'police-station',prop:'shop-e',plot:'C8',zone:'alder',x:-13.25,z:-103.35,yaw:0},
  {id:'alder-books',prop:'shop-h',plot:'C9',zone:'alder',x:-2.75,z:-103.35,yaw:0},
  {id:'alder-cinema',prop:'shop-g',plot:'C10',zone:'alder',x:5,z:-103.00,yaw:0},
  // Cedar Heights: Kenney houses (CC0) on R1-R8, set toward the back of their plots so each keeps a front yard facing the loop road. `plot` names the plot a landmark stands on.
  {id:'house-r1',prop:'house-a',plot:'R1',zone:'cedar',x:100,z:-80,yaw:0},{id:'house-r2',prop:'house-e',plot:'R2',zone:'cedar',x:120,z:-78,yaw:0},{id:'house-r3',prop:'house-h',plot:'R3',zone:'cedar',x:140,z:-80,yaw:0},
  {id:'house-r4',prop:'house-j',plot:'R4',zone:'cedar',x:98,z:-124.34,yaw:0},{id:'house-r5',prop:'house-c',plot:'R5',zone:'cedar',x:120,z:-128.89,yaw:0},{id:'house-r6',prop:'house-o',plot:'R6',zone:'cedar',x:142,z:-123.89,yaw:0},
  {id:'house-r7',prop:'house-r',plot:'R7',zone:'cedar',x:94,z:-48.08,yaw:Math.PI},{id:'house-r8',prop:'house-l',plot:'R8',zone:'cedar',x:146,z:-48.08,yaw:Math.PI},
  // Cars parked on the cross street, in the marked lot and along Oak Street (props now, drivable later); the police car stands outside the police station.
  {id:'park-cs-1',prop:'taxi',zone:'alder',x:-4,z:-85.25,yaw:Math.PI/2,decor:true},{id:'park-cs-2',prop:'car',zone:'alder',x:14,z:-85.25,yaw:Math.PI/2,decor:true},{id:'park-cs-3',prop:'suv',zone:'alder',x:32,z:-85.25,yaw:Math.PI/2,decor:true},
  {id:'park-cn-1',prop:'police-car',zone:'alder',x:-10,z:-94.75,yaw:-Math.PI/2,decor:true},{id:'park-cn-2',prop:'sports-car',zone:'alder',x:2,z:-94.75,yaw:-Math.PI/2,decor:true},{id:'park-cn-3',prop:'car-2',zone:'alder',x:26,z:-94.75,yaw:-Math.PI/2,decor:true},
  {id:'park-lot-1',prop:'car',zone:'alder',x:-4.05,z:-60.5,yaw:Math.PI,decor:true},{id:'park-lot-2',prop:'suv',zone:'alder',x:4.05,z:-60.5,yaw:Math.PI,decor:true},{id:'park-lot-3',prop:'sports-car-2',zone:'alder',x:9.45,z:-60.5,yaw:Math.PI,decor:true},
  {id:'park-lot-4',prop:'taxi',zone:'alder',x:20.25,z:-60.5,yaw:Math.PI,decor:true},{id:'park-lot-5',prop:'car-2',zone:'alder',x:28.35,z:-60.5,yaw:Math.PI,decor:true},{id:'park-lot-6',prop:'sports-car',zone:'alder',x:36.45,z:-60.5,yaw:Math.PI,decor:true},
  {id:'park-oak-1',prop:'car-2',zone:'city',x:-4,z:-1.9,yaw:-Math.PI/2,decor:true},{id:'park-oak-2',prop:'suv',zone:'city',x:30,z:13.9,yaw:Math.PI/2,decor:true},{id:'park-oak-3',prop:'sports-car',zone:'city',x:6,z:13.9,yaw:Math.PI/2,decor:true},
  // Cars parked on their driveways (props now, drivable later): R2, R4, R6 and R8 are lived in, R1, R3, R5 and R7 are vacant.
  {id:'car-r2',prop:'suv',zone:'cedar',x:123.35,z:-71.3,yaw:Math.PI,decor:true},{id:'car-r4',prop:'car',zone:'cedar',x:101.35,z:-118.08,yaw:Math.PI,decor:true},{id:'car-r6',prop:'sports-car',zone:'cedar',x:138.65,z:-117.18,yaw:Math.PI,decor:true},{id:'car-r8',prop:'car',zone:'cedar',x:149.35,z:-54.76,yaw:0,decor:true},
  // Eastbank Works (0.33): Kenney Industrial buildings (CC0), each standing at the back of its plot with its front (door side) on the yard; a plot facing north puts the front at -z (yaw pi). None can be entered.
  {id:'eastbank-warehouse',prop:'industrial-q',plot:'I1',zone:'eastbank',x:163,z:38.6,yaw:Math.PI},{id:'eastbank-workshop',prop:'industrial-t',plot:'I4',zone:'eastbank',x:126,z:33.5,yaw:Math.PI},
  {id:'eastbank-supply',prop:'industrial-s',plot:'I3',zone:'eastbank',x:83,z:35.4,yaw:Math.PI},{id:'eastbank-gas-kiosk',prop:'industrial-p',plot:'I2',zone:'eastbank',x:172,z:-14,yaw:0},
  {id:'ridgeline-office',prop:'industrial-p',plot:'I5',zone:'eastbank',x:76,z:53.5,yaw:Math.PI/2}, // the company office (0.35): a small industrial building turned to face the timber yard (+x); it replaced the open-sided shed
  {id:'riden-deals',prop:'store',zone:'eastbank',x:97,z:-28.5,yaw:0}, // the dealership showroom: a second copy of the Alder Store model (528 triangles), front to the south over the lot
 {id:'eastbank-tank',prop:'tank-small',zone:'eastbank',x:137,z:34,yaw:0,decor:true}
 ], // Signposts: boards are read from the front (yaw 0 faces south, towards walkers arriving from the bridge).
 signs:[
  {id:'fork',zone:'county',x:-25.5,z:n(-170),yaw:0,boards:[{text:'← WILLOW FIELDS',y:2.1},{text:'PINE RIDGE →',y:2.9}]},
  {id:'alder-sign',zone:'alder',x:57,z:-56,yaw:0,boards:[{text:'ALDER CENTER',y:2.4}]},
  {id:'cedar-sign',zone:'cedar',x:127,z:-44,yaw:0,boards:[{text:'CEDAR HEIGHTS',y:2.4}]},
  {id:'eastbank-sign',zone:'eastbank',x:74,z:-5,yaw:-1.5707963267948966,boards:[{text:'EASTBANK WORKS →',y:2.4}]},
  {id:'riden-deals-sign',zone:'eastbank',x:78,z:-1.5,yaw:0,boards:[{pictures:true,y:3.0,h:1.0,bg:'#111111'},{text:'RIDEN DEALS',y:2.1,bg:'#111111',fg:'#f5c518'},{text:'NEW & USED VEHICLES',y:1.45,bg:'#111111',fg:'#f1ebd9'}]} // on the grass at the lot's south-west side, beside Oak Street East, read from the road (keep it off the strip in front of the lot: trucks turning out of the bays swing over it)
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
  if(item.prop!==undefined&&Math.abs(Math.sin(item.yaw*2))>1e-9)bad(`${item.id} must face north, east, south or west`);
  if(item.plot!==undefined){const plot=(map.reserved||[]).find(p=>p.id===item.plot);if(!plot)bad(`${item.id} names an unknown plot ${item.plot}`);else if(item.x<plot.x0||item.x>plot.x1||item.z<plot.z0||item.z>plot.z1)bad(`${item.id} is not inside its plot ${item.plot}`)}}}
 // The property registry: nothing enterable is left out, and a door rule is complete.
 {const ids=new Set(),owners=['npc','city','landlord'];
  for(const p of map.properties||[]){
   if(ids.has(p.id))bad(`duplicate property ${p.id}`);ids.add(p.id);
   if(!['shop','apartment','house','industrial','farm','civic','commercial'].includes(p.type))bad(`property ${p.id} has an unknown type`);
   if(p.landmark!==undefined&&!(map.landmarks||[]).some(l=>l.id===p.landmark))bad(`property ${p.id} names an unknown landmark ${p.landmark}`);
   if(p.type==='house'&&!['small','medium','large'].includes(p.size))bad(`house ${p.id} needs a size (small, medium or large): it sets how many vehicles the home holds`);
   if(p.enterable===false){if(!p.reason)bad(`property ${p.id} is not enterable but gives no reason`);continue}
   if(!['public','tenant','owner'].includes(p.access))bad(`property ${p.id} has no valid access rule`);
   if(p.owner!==null&&!(p.owner&&owners.includes(p.owner.type)))bad(`property ${p.id} has an invalid owner`);
   if(p.owner?.type==='npc'&&!p.owner.name)bad(`property ${p.id} is owned by an NPC with no name`);
   if(p.listing){const L=p.listing;if(p.owner!==null)bad(`property ${p.id} has a listing but is not vacant`);for(const k of ['rentCents','depositCents','priceCents'])if(!Number.isSafeInteger(L[k])||L[k]<=0)bad(`property ${p.id} listing has no ${k}`);if(L.priceCents<=L.rentCents*20)bad(`property ${p.id} costs less than 20 weeks of rent`)}
   if(p.type==='house'){const l=(map.landmarks||[]).find(x=>x.id===p.landmark);if(!l||!l.plot)bad(`house ${p.id} must stand on a plot`)}
  }
  for(const l of map.landmarks||[])if(l.prop&&!l.decor&&!(map.properties||[]).some(p=>p.landmark===l.id))bad(`landmark ${l.id} has no property entry (an enterable building needs a door rule, or enterable: false and a reason; vehicles and yard props are marked decor: true)`);
  for(const kind of Object.keys(map.shops||{}))if(!(map.properties||[]).some(p=>p.id===kind&&p.type==='shop'))bad(`shop ${kind} has no property entry`);
  if(!(map.properties||[]).some(p=>p.id==='studio'))bad('the studio has no property entry')}
 // Driveways: a driveway, a front path and a parking spot are whole-rectangles inside the plot's own zone, wide enough for a car, with the spot on the driveway.
 for(const plot of map.reserved||[]){if(!plot.driveway&&!plot.path&&!plot.park)continue;
  const zone=zoneAtPoint((plot.x0+plot.x1)/2,(plot.z0+plot.z1)/2,map);
  for(const key of ['driveway','path'])if(plot[key]){const r=plot[key];if(!rectOk(r)||!zone||!inside(r,zone.bounds))bad(`plot ${plot.id} ${key} is not a rectangle inside its district`)}
  if(plot.driveway&&plot.driveway.x1-plot.driveway.x0<3.5-1e-9)bad(`plot ${plot.id} driveway is narrower than 3.5 m`);
  if(plot.path&&plot.path.x1-plot.path.x0<1.2-1e-9)bad(`plot ${plot.id} path is narrower than 1.2 m`);
  if(plot.park){const q=plot.park,d=plot.driveway;if(!d||q.x<d.x0||q.x>d.x1||q.z<d.z0||q.z>d.z1)bad(`plot ${plot.id} parking spot is not on its driveway`);if(!['north','south','east','west'].includes(q.heading))bad(`plot ${plot.id} parking spot has no heading`)}}
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
  if(![plot.x0,plot.x1,plot.z0,plot.z1].every(v=>Number.isInteger(v*2))||!rectOk(plot)){bad(`reserved plot ${plot.id} is not a whole-cell rectangle`);continue}
  if(!zoneAtPoint(plot.x0,plot.z0,map)||!zoneAtPoint(plot.x1,plot.z1,map))bad(`reserved plot ${plot.id} is outside every zone`);
  if(map.roads.edges.some(e=>!e.path&&map.roads.nodes[e.from]&&map.roads.nodes[e.to]&&overlaps(plot,roadRect(e,map))))bad(`reserved plot ${plot.id} overlaps a road`);
  if(map.fields.some(f=>overlaps(plot,f)))bad(`reserved plot ${plot.id} overlaps a field`);
  if(map.buildings.some(b=>overlaps(plot,footprint(b))))bad(`reserved plot ${plot.id} overlaps a building`);
 }
 for(const [i,a] of map.reserved.entries())for(const b of map.reserved.slice(i+1))if(overlaps(a,b))bad(`reserved plots ${a.id} and ${b.id} overlap`);
 // Eastbank paving, painted bays and yard props (0.33): paving lies inside a zone and is not a duplicate; a bay row lies on paving; a yard's centre-point items lie inside its bounds and on paving, and the caps hold
 // (at most YARD_CAPS.perModel of one model in a yard and YARD_CAPS.total in all), so a yard that asks for too much is an error, not a silent clip.
 {const pave=map.paving||[],pids=new Set();
  for(const p of pave){if(pids.has(p.id))bad(`duplicate paving ${p.id}`);pids.add(p.id);
   if(!rectOk(p)){bad(`paving ${p.id} is not a valid rectangle`);continue}
   const zone=zoneAtPoint((p.x0+p.x1)/2,(p.z0+p.z1)/2,map);if(!zone||!inside(p,zone.bounds))bad(`paving ${p.id} is not inside one zone`);
   if(p.kind!==undefined&&p.kind!=='island')bad(`paving ${p.id} has an unknown kind`)}
  const onPaving=(x,z)=>pave.some(p=>p.kind!=='island'&&rectOk(p)&&x>=p.x0&&x<=p.x1&&z>=p.z0&&z<=p.z1);
  const bayIds=new Set();
  for(const row of map.bayRows||[]){if(bayIds.has(row.id))bad(`duplicate bay row ${row.id}`);bayIds.add(row.id);
   const r={x0:row.x0,x1:row.x0+row.count*row.width,z0:row.z0,z1:row.z0+row.depth};
   if(!(Number.isInteger(row.count)&&row.count>=1&&row.width>0&&row.depth>0)||!['north','south'].includes(row.back)){bad(`bay row ${row.id} is not valid`);continue}
   if(!pave.some(p=>p.kind!=='island'&&rectOk(p)&&inside(r,p)))bad(`bay row ${row.id} is not on paving`)} // the whole row on one paving rectangle
  const yardIds=new Set();let total=0;
  for(const yard of map.yards||[]){if(yardIds.has(yard.id))bad(`duplicate yard ${yard.id}`);yardIds.add(yard.id);
   if(!rectOk(yard.bounds)||!(yard.cull>0)){bad(`yard ${yard.id} has no valid bounds or cull distance`);continue}
   if(!pave.some(p=>rectOk(p)&&inside(yard.bounds,p)))bad(`yard ${yard.id} is not on one paving rectangle`);
   const perModel=new Map();
   for(const it of yard.items||[]){
    if(typeof it.prop!=='string'||![it.x,it.z,it.yaw,it.y].every(Number.isFinite)||it.y<0){bad(`yard ${yard.id} has an invalid item`);continue}
    if(it.x<yard.bounds.x0||it.x>yard.bounds.x1||it.z<yard.bounds.z0||it.z>yard.bounds.z1)bad(`yard ${yard.id}: ${it.prop} at ${it.x}, ${it.z} is outside the yard`);
    else if(!onPaving(it.x,it.z))bad(`yard ${yard.id}: ${it.prop} at ${it.x}, ${it.z} is not on paving`);
    if(Math.abs(Math.sin(it.yaw*2))>1e-9)bad(`yard ${yard.id}: ${it.prop} must face north, east, south or west`);
    perModel.set(it.prop,(perModel.get(it.prop)||0)+1)}
   for(const [prop,count] of perModel)if(count>YARD_CAPS.perModel)bad(`yard ${yard.id} has ${count} ${prop} (the cap is ${YARD_CAPS.perModel} of one model per yard)`);
   total+=(yard.items||[]).length}
  if(total>YARD_CAPS.total)bad(`the yards hold ${total} props (the cap is ${YARD_CAPS.total})`)
  // drivable vehicles (0.33): a unique id, a known model, a finite home pose standing on paving (their bays) inside the playable rectangle
  const carIds=new Set();let displays=0;
  for(const v of map.vehicles||[]){if(typeof v.id!=='string'||!v.id||carIds.has(v.id))bad(`vehicle ${v.id} has a missing or duplicate id`);carIds.add(v.id);
   if(!DRIVABLE_MODELS.includes(v.model))bad(`vehicle ${v.id} has an unknown model ${v.model}`);
   if(!SALE_MODES.includes(v.sale)){bad(`vehicle ${v.id} needs a sale field: dealership, online or both`);continue}
   if(v.sale==='online')continue; // online-only: no display slot, so no home pose
   displays++;
   if(!v.home||![v.home.x,v.home.z,v.home.yaw].every(Number.isFinite)){bad(`vehicle ${v.id} has no valid home pose`);continue}
   if(!onPaving(v.home.x,v.home.z))bad(`vehicle ${v.id} does not start on paving`);
   if(v.home.x<map.playable.x0||v.home.x>map.playable.x1||v.home.z<map.playable.z0||v.home.z>map.playable.z1)bad(`vehicle ${v.id} starts outside the playable rectangle`)}
  const slots=(map.bayRows||[]).filter(r=>r.id.startsWith('depot-')).reduce((s,r)=>s+r.count,0);if(displays>slots)bad(`the dealership lot has ${slots} bays but ${displays} models have a display slot (sale: dealership or both): build another lot or sell the newest online only`)}
 // exits (0.35): a known road; the first point in and the last point out lie outside the playable rectangle, so the vehicle is gone before the map ends
 for(const x of map.exits||[]){if(!map.roads.edges.some(e=>e.id===x.road))bad(`exit ${x.id} names an unknown road ${x.road}`);const outside=([px,pz])=>px<map.playable.x0||px>map.playable.x1||pz<map.playable.z0||pz>map.playable.z1;
  if(!x.in?.length||!x.out?.length||!outside(x.in[0])||!outside(x.out[x.out.length-1]))bad(`exit ${x.id} must start and end outside the playable map (enlarged the map? move the exit)`)}
 // offices (0.35): a known employer and building, a door on the plot that is outside the building, an interior origin far from the playable map
 for(const o of map.offices||[]){const e=(map.employers||[]).find(x=>x.id===o.employer),l=(map.landmarks||[]).find(x=>x.id===o.building),plot=l&&(map.reserved||[]).find(p=>p.id===l.plot);
  if(!e)bad(`office ${o.id} has an unknown employer ${o.employer}`);if(!l)bad(`office ${o.id} has an unknown building ${o.building}`);if(e&&e.office!==o.id&&o.kind!=='warehouse')bad(`office ${o.id} is not its employer's office (${e.office})`);
  if(plot&&!(o.door.x>=plot.x0&&o.door.x<=plot.x1&&o.door.z>=plot.z0&&o.door.z<=plot.z1))bad(`office ${o.id}'s door is outside plot ${plot.id}`);
  if(![o.door.x,o.door.z,o.door.yaw,o.sign.x,o.sign.z].every(Number.isFinite))bad(`office ${o.id} has a bad door or sign`);
  const oi=o.interior.origin;if(oi.x<=map.playable.x1&&oi.x>=map.playable.x0&&oi.z<=map.playable.z1&&oi.z>=map.playable.z0)bad(`office ${o.id}'s interior stands inside the playable map`)}
 // employers (0.35, DESIGN 4.15): unique ids, an office that is a property (a building with a name), sites that name a known zone or plot (or an interior room), sane hours, and ranks whose needs climb
 const employerIds=new Set();
 for(const e of map.employers||[]){if(typeof e.id!=='string'||!e.id||employerIds.has(e.id))bad(`employer ${e.id} has a missing or duplicate id`);employerIds.add(e.id);
  if(!e.name||!e.owner?.name||!['npc','player'].includes(e.owner.kind))bad(`employer ${e.id} needs a name and an owner (kind npc or player)`);
  if(!(map.properties||[]).some(b=>b.id===e.office))bad(`employer ${e.id} has an unknown office ${e.office}`);
  for(const s of e.sites||[])if(!(s.zone&&map.zones.some(z=>z.id===s.zone))&&!(s.plot&&(map.reserved||[]).some(p=>p.id===s.plot))&&!(typeof s.room==='string'&&s.room))bad(`employer ${e.id} has a site that names nothing known (${JSON.stringify(s)})`);
  const h=e.hours||{};if(![h.from,h.to,h.lastIn].every(Number.isInteger)||!(0<=h.from&&h.from<h.lastIn&&h.lastIn<h.to&&h.to<=1440))bad(`employer ${e.id} has bad hours`);
  if(!(e.ranks||[]).length)bad(`employer ${e.id} has no ranks`);
  for(const s of e.store||[])if(!Number.isInteger(s.rank)||s.rank<1||s.rank>(e.ranks||[]).length||typeof s.item!=='string')bad(`employer ${e.id} sells ${s.item} to a rank that does not exist`);
  (e.ranks||[]).forEach((r,i)=>{const p=e.ranks[i-1];if(!r.id||!r.name||!Number.isSafeInteger(r.wage)||r.wage<=0||!Array.isArray(r.grants)||!Array.isArray(r.tasks))bad(`employer ${e.id} rank ${r.id} is incomplete`);
   if(p&&!(r.needs.level>=p.needs.level&&r.needs.shifts>=p.needs.shifts&&r.needs.rep>=p.needs.rep&&r.wage>=p.wage))bad(`employer ${e.id} rank ${r.id} needs or pays less than the rank below`)})}
 return problems;
}
