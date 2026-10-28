// The world as data. world.js, the minimap, the shops and game.js read this file; nothing else hard-codes zone edges, roads,
// fields, shop doors or building footprints. Coordinates are metres: +x east, -z north (the default camera looks north up
// Oak Street). Adding a district means adding data here (and, later, scenery code that reads it), not editing the engine.
// The map is flat: there is no elevation in version 1.

// Zones tile the walkable world. `bounds` is the walkable rectangle, `grid` turns on the 1x1 plot grid (farm and forest),
// `minimap` holds how the map draws it. Zones must not overlap; edges may touch.
const zones=[
 {id:'city',name:'Westside',label:'WESTSIDE',subtitle:'Oak & Alder',color:'#8d9294',grid:false,bounds:{x0:-61,x1:58,z0:-48,z1:48},minimap:{surround:'#5d6265',label:{x:-1,z:-52}}},
 {id:'farm',name:'Oak Farms',label:'OAK FARMS',subtitle:'Fields & plots',color:'#c9ae63',grid:true,bounds:{x0:-168,x1:-61,z0:-56,z1:56},minimap:{surround:'#8d7a45',label:{x:-114,z:-50}}},
 {id:'forest',name:'Alder Woods',label:'ALDER WOODS',subtitle:'Timber & trails',color:'#3f6a3c',grid:true,bounds:{x0:58,x1:168,z0:-56,z1:56},minimap:{surround:'#2f4f2e',label:{x:113,z:-50}}}
];

// Road graph: named points joined by straight, axis-aligned segments with a width and a surface. The drawable rectangles
// (roadRects) come from it, and it is the structure NPC walking and traffic will route on.
const roads={
 nodes:{
  oakWest:{x:-55,z:6},oakEast:{x:55,z:6},alderNorth:{x:-30,z:-60},alderSouth:{x:-30,z:60},
  farmGate:{x:-168,z:6},farmLaneNorth:{x:-110,z:-56},farmLaneSouth:{x:-110,z:56},
  woodsGate:{x:168,z:6},woodsLaneNorth:{x:113.5,z:-56},woodsLaneSouth:{x:113.5,z:56}
 },
 edges:[
  {id:'oak-street',from:'oakWest',to:'oakEast',width:19,surface:'asphalt'},
  {id:'alder-avenue',from:'alderNorth',to:'alderSouth',width:16,surface:'asphalt'},
  {id:'farm-road',from:'farmGate',to:'oakWest',width:7,surface:'dirt'},
  {id:'farm-lane',from:'farmLaneNorth',to:'farmLaneSouth',width:4,surface:'dirt'},
  {id:'woods-road',from:'oakEast',to:'woodsGate',width:7,surface:'dirt'},
  {id:'woods-lane',from:'woodsLaneNorth',to:'woodsLaneSouth',width:5,surface:'dirt'}
 ]
};

// Fenced farm fields, in whole cells. gateSide says which side faces the farm road (the fence has a 3-cell gap there).
const fieldGrid=(columns,rows)=>columns.flatMap(([x0,x1])=>rows.map(([z0,z1],i)=>({id:`field-${x0}-${z0}`,x0,x1,z0,z1,gateSide:i===0?'south-of-road':'north-of-road'})));
const fields=fieldGrid([[-156,-138],[-132,-114],[-104,-86],[-82,-66]],[[-15,-2],[12,25]]);

// Buildings: footprint centre (x, z), width (x), depth (z), height, colour. `shop` ties a building to an entry in `shops`.
// The row at z = -61 is backdrop beyond the walkable city edge.
const backdrop=[];for(let x=-48;x<=54;x+=17)backdrop.push({x,z:-61,w:13,d:17,h:12+((x+65)%4)*3,color:'#a3ada3'});
const buildings=[
 {x:1,z:-15,w:17,d:13,h:17,color:'#b08b74',name:'OAK STREET APARTMENTS'},
 {x:19,z:-13.5,w:15,d:10,h:9,color:'#c2bc9b',name:'CORNER MARKET',shop:'market'},
 {x:36,z:-16,w:15,d:15,h:13,color:'#82948d',name:'ALDER COFFEE',shop:'cafe'},
 {x:-13,z:-18,w:8,d:19,h:12,color:'#9b9f98',name:'LAUNDRY'},
 {x:-4,z:31,w:20,d:19,h:11,color:'#c4b298'},{x:19,z:33,w:17,d:23,h:15,color:'#929e9a'},{x:39,z:31,w:17,d:19,h:10,color:'#b5a38d'},
 {x:-48,z:-19,w:18,d:21,h:19,color:'#899c9b'},{x:-49,z:26,w:18,d:20,h:12,color:'#af9d8c'},
 ...backdrop
];

// Shops you can walk into. x is the door centre, z is where you stand outside it, doorZ is the door plane on the building's
// front, hours are [opens, closes) in minutes since midnight, sign is the text over the door.
const shops={
 market:{name:'Corner Market',x:19,z:-6.3,doorZ:-8.46,door:{width:2.3,height:2.5},hours:[420,1320],sign:'MARKET 7AM–10PM'},
 cafe:{name:'Alder Coffee',x:36,z:-6.3,doorZ:-8.46,door:{width:2.3,height:2.5},hours:[480,1080],sign:'CAFE 8AM–6PM'}
};

// Land set aside for later (ownership, preset buildings). Whole-cell rectangles; kind is 'residential', 'commercial' or
// 'industrial'. None are reserved on the current map; validateMap checks any you add.
const reserved=[];

function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const key of Object.keys(value))deepFreeze(value[key])}return value}

export const MAP=deepFreeze({
 id:'oak-and-alder',version:1,
 seed:7301, // changing it moves every generated tree and orphans saved forest plots
 spawn:{x:-5,y:.2,z:15},
 ground:{x0:-190,x1:190,z0:-90,z1:90}, // how far the ground is drawn (scenery fades into fog beyond the walkable zones)
 zones,roads,fields,buildings,shops,reserved,
 studio:{x:1,z:-6.3,doorZ:-8.25},
 minimap:{view:{x0:-176,x1:176,z0:-62,z1:62}},
 // Procedural dressing parameters (world.js): how the generated trees are laid out.
 scenery:{
  forestClearingX:66, // no pines this close to the city edge
  // Dense tree belts outside the walkable edges: [x0, x1, z0, z1, spacing, chance, salt]
  belts:[[58,186,57.5,80,3.2,.85,11],[58,186,-80,-57.5,3.2,.85,12],[169.5,186,-56,57,3.2,.9,13],[-186,-61,58.5,74,4.2,.75,21],[-186,-61,-74,-58.5,4.2,.75,22],[-186,-170,-56,57,4,.8,23]],
  farmShade:{count:34,clearOfCity:5}
 }
});

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
  if(!['south-of-road','north-of-road'].includes(field.gateSide))bad(`field ${field.id} has no gate side`);
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
 }
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
