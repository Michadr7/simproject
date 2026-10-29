// The world as data. world.js, the minimap, the shops and game.js read this file; nothing else hard-codes zone edges, roads,
// fields, shop doors or building footprints. Coordinates are metres: +x east, -z north (the default camera looks north up
// Oak Street). Adding a district means adding data here (and, later, scenery code that reads it), not editing the engine.
// The map is flat: there is no elevation in version 1.

// Zones tile the walkable world. `bounds` is the walkable rectangle, `grid` turns on the 1x1 plot grid (farm and forest),
// `minimap.label` is where the map writes the zone's name. Zones must not overlap; edges may touch.
// The world, north (-z) up: the city in the south; a gently curving river rising from the south-west to the north-east, north of the city;
// the County Road crossing the river by the bridge and reaching the north bank, where Willow Fields (the farm) lies to the north-west and
// Pine Ridge (the forest) to the north-east.
const zones=[
 {id:'city',name:'Westside',label:'WESTSIDE',subtitle:'Oak & Alder',color:'#8d9294',grid:false,bounds:{x0:-61,x1:58,z0:-48,z1:48},minimap:{label:{x:-1,z:44}}},
 {id:'county',name:'County Road',label:'COUNTY ROAD',subtitle:'Bridge & crossroads',color:'#7a7f83',grid:false,bounds:{x0:-35,x1:-25,z0:-246,z1:-48},minimap:{label:{x:-30,z:-60}}},
 {id:'farm',name:'Willow Fields',label:'WILLOW FIELDS',subtitle:'Fields & plots',color:'#c9ae63',grid:true,bounds:{x0:-170,x1:-35,z0:-216,z1:-108},minimap:{label:{x:-102,z:-205}}},
 {id:'forest',name:'Pine Ridge',label:'PINE RIDGE',subtitle:'Timber & trails',color:'#3f6a3c',grid:true,bounds:{x0:-25,x1:150,z0:-246,z1:-146},minimap:{label:{x:62,z:-236}}}
];

// Road graph: named points joined by straight, axis-aligned segments with a width and a surface. The drawable rectangles
// (roadRects) come from it, and it is the structure NPC walking and traffic will route on.
const roads={
 nodes:{
  oakWest:{x:-55,z:6},oakEast:{x:55,z:6},alderNorth:{x:-30,z:-60},alderSouth:{x:-30,z:60},countyEnd:{x:-30,z:-246},
  farmGate:{x:-164,z:-160},farmJoin:{x:-34,z:-160},woodsJoin:{x:-26,z:-180},woodsEnd:{x:150,z:-180},woodsLaneNorth:{x:90,z:-246},woodsLaneSouth:{x:90,z:-146}
 },
 edges:[
  {id:'oak-street',from:'oakWest',to:'oakEast',width:19,surface:'asphalt'},
  {id:'alder-avenue',from:'alderNorth',to:'alderSouth',width:16,surface:'asphalt'},
  {id:'county-road',from:'alderNorth',to:'countyEnd',width:8,surface:'asphalt'},
  {id:'farm-road',from:'farmGate',to:'farmJoin',width:7,surface:'dirt'},
  {id:'woods-road',from:'woodsJoin',to:'woodsEnd',width:7,surface:'dirt'},
  {id:'woods-lane',from:'woodsLaneNorth',to:'woodsLaneSouth',width:5,surface:'dirt'}
 ]
};

// The river is a centreline through `points` (smoothed into a gentle curve), `width` across with `bank` metres of mud on each side. It rises from
// the south-west to the north-east, passing north of the city, is flat water and a hard barrier (it lies outside every zone); the only way across
// is a bridge, which carries the County Road. A bridge's deck is axis-aligned and exactly as wide as the zone it carries.
const water={
 rivers:[{id:'north-river',width:12,bank:2.6,points:[[-270,-58],[-190,-66],[-110,-78],[-30,-90],[40,-101],[110,-117],[190,-135],[270,-154]]}],
 bridges:[{id:'county-bridge',river:'north-river',x0:-35,x1:-25,z0:-104,z1:-76}]
};

// Willow Fields: three big open rectangles (whole cells) with their own ground, plowed soil, wheat and young crops, and no fences between them, so
// tractors can cross them later. Nothing grows in them yet. Only the farm's perimeter is fenced (see fenceSegments in world.js), with a gap wherever a
// dirt road crosses it. `surface` picks the ground texture: 'plowed', 'wheat' or 'green'.
const fields=[
 {id:'field-wheat',surface:'wheat',x0:-165,x1:-90,z0:-208,z1:-170},
 {id:'field-plowed',surface:'plowed',x0:-165,x1:-115,z0:-150,z1:-114},
 {id:'field-green',surface:'green',x0:-108,x1:-52,z0:-150,z1:-114}
];

// Buildings: footprint centre (x, z), width (x), depth (z), height, colour. `shop` ties a building to an entry in `shops`.
// The row at z = -61 is backdrop beyond the walkable city edge.
const backdrop=[];for(let x=-48;x<=54;x+=17)if(x!==-31)backdrop.push( // the building at x = -31 would stand on the County Road
 {x,z:-61,w:13,d:17,h:12+((x+65)%4)*3,color:'#a3ada3'});
const buildings=[
 {x:1,z:-15,w:17,d:13,h:17,color:'#b08b74',name:'OAK STREET APARTMENTS'},
 {x:19,z:-13.5,w:15,d:10,h:9,color:'#c2bc9b',name:'CORNER MARKET',shop:'market'},
 {x:36,z:-16,w:15,d:15,h:13,color:'#82948d',name:'ALDER COFFEE',shop:'cafe'},
 {x:-13,z:-18,w:8,d:19,h:12,color:'#9b9f98',name:'LAUNDRY'},
 {x:-4,z:31,w:20,d:19,h:11,color:'#c4b298'},{x:19,z:33,w:17,d:23,h:15,color:'#929e9a'},{x:39,z:31,w:17,d:19,h:10,color:'#b5a38d'},
 {x:-48,z:-19,w:18,d:21,h:19,color:'#899c9b'},{x:-49,z:26,w:18,d:20,h:12,color:'#af9d8c'},
 ...backdrop
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
const reserved=[];

function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const key of Object.keys(value))deepFreeze(value[key])}return value}

export const MAP=deepFreeze({
 id:'oak-and-alder',version:1,
 seed:7301, // changing it moves every generated tree and orphans saved forest plots
 spawn:{x:-5,y:.2,z:15},

 ground:{x0:-260,x1:260,z0:-310,z1:110}, // how far the ground is drawn (scenery fades into fog beyond the walkable zones)
 zones,roads,water,fields,buildings,shops,reserved,
 // Buildings placed from converted models (props.js): yaw is a multiple of 90 degrees so the collision boxes stay axis-aligned. The farmyard (a barn, a
 // farmhouse, two silos, sheds) fills the free north-east strip of Willow Fields and faces the farm road; the sawmill stands in Pine Ridge's empty clearing.
 landmarks:[
  {id:'farmyard',prop:'farmyard',zone:'farm',x:-62,z:-191,yaw:0},
  {id:'sawmill',prop:'sawmill',zone:'forest',x:104,z:-208,yaw:0}
 ],
 // Signposts: boards are read from the front (yaw 0 faces south, towards walkers arriving from the bridge).
 signs:[{id:'fork',zone:'county',x:-25.5,z:-170,yaw:0,boards:[{text:'← WILLOW FIELDS',y:2.1},{text:'PINE RIDGE →',y:2.9}]}],
 studio:{x:1,z:-6.3,doorZ:-8.25,interior:{entry:{x:0,z:3.3},exit:{x:0,z:4.45},bed:{x:-3.6,z:-2.3}}},
 minimap:{view:{x0:-200,x1:180,z0:-250,z1:90}},
 // Procedural dressing parameters (world.js): how the generated trees are laid out.

 scenery:{
  // Pine Ridge: one cuttable pine per 4x4-cell block at `density` (varied by `wobble`), an occasional decor pine in the blocks without one,
  // nothing in the clearings (ellipses) or beside roads. The big clearing at the north-east is kept open for the Sawmill.
  forest:{density:.7,wobble:.14,decorChance:.25,roadMargin:2.4,clearings:[
   {x:106,z:-212,rx:30,rz:24},{x:30,z:-170,rx:20,rz:11},{x:56,z:-222,rx:15,rz:12},{x:128,z:-164,rx:15,rz:11},{x:2,z:-222,rx:11,rz:14}
  ]},
  // Dense scenery outside the walkable zones that hides the end of the world: [x0, x1, z0, z1, spacing, chance, salt]
  belts:[[-125,-61,-60,105,5.5,0.085,11],[58,125,-62,105,5.5,0.085,12],[-61,58,48,105,5.5,0.085,13],[-110,110,-80,-48,5.5,0.061,14],
   [-170,-35,-108,-80,5,0.136,15],[-25,150,-146,-84,5.5,0.102,21],[-235,195,-306,-246,5.5,0.102,16],[-170,-35,-246,-216,5.5,0.102,22],
   [-235,-170,-246,-90,5.5,0.102,17],[150,235,-246,-100,5.5,0.102,18],[-62,-35,-48,-100,5,0.082,19],[-25,5,-48,-100,5,0.082,20]],
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
export const roadRects=(surface,map=MAP)=>map.roads.edges.filter(e=>!surface||e.surface===surface).map(e=>({id:e.id,...roadRect(e,map)}));
export const hoursOf=(kind,map=MAP)=>map.shops[kind].hours;

// ── Validation ────────────────────────────────────────────────────────────────
// Returns a list of problems (empty when the map is sound). Run by tests/map.mjs; call it from the console after editing.
export function validateMap(map=MAP){
 const problems=[],bad=(message)=>problems.push(message);
 const rectOk=r=>r&&[r.x0,r.x1,r.z0,r.z1].every(Number.isFinite)&&r.x0<r.x1&&r.z0<r.z1;
 const overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z0<a.z1;
 const inside=(r,outer)=>r.x0>=outer.x0&&r.x1<=outer.x1&&r.z0>=outer.z0&&r.z1<=outer.z1;
 const footprint=b=>({x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2});
 if(!rectOk(map.ground))bad('ground is not a valid rectangle');
 const ids=new Set();
 for(const zone of map.zones){
  if(ids.has(zone.id))bad(`duplicate zone id ${zone.id}`);ids.add(zone.id);
  if(!rectOk(zone.bounds))bad(`zone ${zone.id} has invalid bounds`);else if(!inside(zone.bounds,map.ground))bad(`zone ${zone.id} reaches outside the ground`);
 }
 for(const [i,a] of map.zones.entries())for(const b of map.zones.slice(i+1))if(rectOk(a.bounds)&&rectOk(b.bounds)&&overlaps(a.bounds,b.bounds))bad(`zones ${a.id} and ${b.id} overlap`);
 if(!zoneAtPoint(map.spawn.x,map.spawn.z,map))bad('spawn is outside every zone');
 // Every zone can be reached on foot from the city: zones that touch along an edge (at least 2 m of it) are connected.
 {const touches=(a,b)=>{const w=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),h=Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0);return (w===0&&h>=2)||(h===0&&w>=2)||(w>0&&h>0)};
  const city=map.zones.find(z=>z.id==='city')||map.zones[0],seen=new Set([city.id]),queue=[city];
  while(queue.length){const here=queue.pop();for(const other of map.zones)if(!seen.has(other.id)&&rectOk(here.bounds)&&rectOk(other.bounds)&&touches(here.bounds,other.bounds)){seen.add(other.id);queue.push(other)}}
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
 // Roads
 const edgeIds=new Set();
 for(const edge of map.roads.edges){
  const a=map.roads.nodes[edge.from],b=map.roads.nodes[edge.to];
  if(edgeIds.has(edge.id))bad(`duplicate road ${edge.id}`);edgeIds.add(edge.id);
  if(!a||!b){bad(`road ${edge.id} uses an unknown node`);continue}
  if(a.x!==b.x&&a.z!==b.z)bad(`road ${edge.id} is not axis-aligned`);
  if(!(edge.width>0))bad(`road ${edge.id} has no width`);
  if(!['asphalt','dirt'].includes(edge.surface))bad(`road ${edge.id} has an unknown surface`);
  const rect=roadRect(edge,map);if(!inside(rect,map.ground))bad(`road ${edge.id} reaches outside the ground`);
  if(!map.zones.some(zone=>overlaps(rect,zone.bounds)))bad(`road ${edge.id} does not touch any zone`); // roads may run on past a zone's edge into the scenery
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
  if(![plot.x0,plot.x1,plot.z0,plot.z1].every(Number.isInteger)||!rectOk(plot)){bad(`reserved plot ${plot.id} is not a whole-cell rectangle`);continue}
  if(!zoneAtPoint(plot.x0,plot.z0,map)||!zoneAtPoint(plot.x1,plot.z1,map))bad(`reserved plot ${plot.id} is outside every zone`);
  if(map.roads.edges.some(e=>overlaps(plot,roadRect(e,map))))bad(`reserved plot ${plot.id} overlaps a road`);
  if(map.fields.some(f=>overlaps(plot,f)))bad(`reserved plot ${plot.id} overlaps a field`);
  if(map.buildings.some(b=>overlaps(plot,footprint(b))))bad(`reserved plot ${plot.id} overlaps a building`);
 }
 for(const [i,a] of map.reserved.entries())for(const b of map.reserved.slice(i+1))if(overlaps(a,b))bad(`reserved plots ${a.id} and ${b.id} overlap`);
 return problems;
}
