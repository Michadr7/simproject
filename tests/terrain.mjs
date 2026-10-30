import assert from 'node:assert/strict';
import {MAP,riverZAt} from '../dist/map-definition.js';
import {buildTerrain,terrain,validateTerrain,roadCenterline,SURFACE,FOOTING} from '../dist/terrain.js';
import {isWalkable,footingAt} from '../dist/world.js';

// ── Built once, quickly ───────────────────────────────────────────────────────
const t0=performance.now(),built=buildTerrain(MAP),ms=performance.now()-t0;
assert(ms<2000,`the mask builds in ${ms.toFixed(0)} ms`);assert.equal(built.cell,.5);assert.equal(built.walk.length,built.cols*built.rows);
assert.equal(terrain(),terrain(),'the shipped terrain is built once and shared');
assert.deepEqual(validateTerrain(terrain()),[],'every district is reachable on foot from the spawn point, over both bridges, and no water is walkable');
const T=terrain(),at=(x,z)=>T.surfaceAt(x,z);

// ── The city is exactly as it was: walking and footing match the old rectangle rules at every sampled point of the city zone ────────────────────
const oldFooting=(px,pz)=>{const sidewalk=(px>=-38&&px<=54&&((pz>=-8.5&&pz<=-3.5)||(pz>=15.5&&pz<=20.5)))||(px>=-21.5&&px<=-16.5&&pz>=-74&&pz<=24),road=(Math.abs(px)<=55&&pz>=-3.5&&pz<=15.5)||(px>=-38&&px<=-22&&Math.abs(pz)<=60);return sidewalk?.165:road?.01:-.095};
let cityPoints=0,bad=[];for(let x=-60.9;x<54.9;x+=.37)for(let z=-47.9;z<48;z+=.43){cityPoints++;if(!isWalkable(x,z)||Math.abs(footingAt(x,z)-oldFooting(x,z))>1e-9){if(bad.length<5)bad.push([+x.toFixed(2),+z.toFixed(2),footingAt(x,z),oldFooting(x,z)])}}
assert(cityPoints>70000&&bad.length===0,`the city (up to where Oak Street East takes over at x = 55): ${cityPoints} points sampled, differences ${JSON.stringify(bad)}`);

// ── Open country: everything inside the playable area is walkable except water; nothing outside it is; no invisible walls where the green starts ─────────────────
let landCells=0,waterCells=0,outsideCells=0,odd=[];const play=MAP.playable;
for(let x=MAP.ground.x0+.2;x<MAP.ground.x1;x+=1.1)for(let z=MAP.ground.z0+.3;z<MAP.ground.z1;z+=1.3){
 const s=at(x,z),w=isWalkable(x,z),inPlay=x>=play.x0&&x<=play.x1&&z>=play.z0&&z<=play.z1;
 if(s===SURFACE.WATER||s===SURFACE.BANK){waterCells++;if(w&&odd.length<5)odd.push(['water is walkable',x,z])}
 else if(inPlay){landCells++;if(!w&&odd.length<5)odd.push(['land is not walkable',x,z,s])}
 else{outsideCells++;if(w&&odd.length<5)odd.push(['outside the playable area is walkable',x,z])}}
assert.deepEqual(odd,[]);assert(landCells>150000&&waterCells>1000&&outsideCells>10000,`${landCells} land, ${waterCells} water, ${outsideCells} outside samples`);
// Every district can be walked into from open ground on every side (the old bug: Alder Center could not be entered from the County Road).
for(const [id,sides] of Object.entries({alder:[[-22,-90],[19,-47.9],[59,-110]],cedar:[[69,-100],[120,-39],[171,-100],[120,-136]],eastbank:[[69,30],[130,-21],[130,76]],farm:[[-171,-230],[-100,-179]],forest:[[0,-215],[60,-317]]})){
 const zone=MAP.zones.find(z=>z.id===id);for(const [x,z] of sides)assert(isWalkable(x,z),`${id} can be entered from ${x},${z}`);assert(isWalkable((zone.bounds.x0+zone.bounds.x1)/2,(zone.bounds.z0+zone.bounds.z1)/2))}
const walkFromSpawn=T.reach(MAP.spawn.x,MAP.spawn.z);for(const [x,z] of [[-22,-90],[69,-100],[130,-21],[0,100-1],[-240,0]])assert(walkFromSpawn[T.index(x,z)],`${x},${z} is on the spawn's side of the river`);

// ── Named places: the surfaces are where the map says ──────────────────────────────────────────────
assert.equal(at(0,6),SURFACE.STREET);assert.equal(at(0,-6),SURFACE.PAVEMENT);assert.equal(at(-30,-230),SURFACE.ROAD);assert.equal(at(-30,-160),SURFACE.BRIDGE);assert.equal(at(195,-206),SURFACE.BRIDGE);assert.equal(at(-100,-230),SURFACE.DIRT);
assert.equal(at(-130,-260),SURFACE.WHEAT);assert.equal(at(-140,-200),SURFACE.PLOWED);assert.equal(at(-80,-200),SURFACE.GREEN);assert.equal(at(0,riverZAt(MAP.water.rivers[0],0)),SURFACE.WATER);assert.equal(at(60,-290),SURFACE.GRASS);
assert.equal(at(40,-110),SURFACE.PAVEMENT,"Alder Center's town square is paved");assert.equal(at(20,-70),SURFACE.ROAD,'Alder Center main street');assert.equal(at(20,-90),SURFACE.ROAD,'and the crossing');
assert.equal(at(100,6),SURFACE.ROAD,'Oak Street East');assert.equal(at(120,-30),SURFACE.ROAD,'the link up to Cedar Heights');assert.equal(at(195,0),SURFACE.ROAD,'the Freight Road');assert.equal(at(130,68),SURFACE.ROAD,'and its south side');
assert.equal(T.zoneAt(-100,-230).id,'farm');assert.equal(T.zoneAt(19,-90).id,'alder');assert.equal(T.zoneAt(120,-100).id,'cedar');assert.equal(T.zoneAt(130,30).id,'eastbank');assert.equal(T.zoneAt(195,-100).id,'freight');assert.equal(T.zoneAt(0,-164),null);assert.equal(FOOTING[SURFACE.PAVEMENT],.165);
assert(!isWalkable(MAP.ground.x0-5,0)&&!isWalkable(0,MAP.ground.z1+5));assert.equal(footingAt(9999,9999),FOOTING[SURFACE.GRASS]);

// ── Alignment: each bridge spans its river, meets its road at both ends, and has water on both sides ───────────────────────
const river=MAP.water.rivers[0];
for(const bridge of MAP.water.bridges){
 const cx=(bridge.x0+bridge.x1)/2;
 for(let z=bridge.z0;z<=bridge.z1;z+=.5)assert(isWalkable(cx,z),`${bridge.id}: the road is walkable all the way across at z=${z}`);
 const zWater=riverZAt(river,cx);assert(at(cx,zWater)===SURFACE.BRIDGE,`${bridge.id}: the deck is over the river's centre`);
 assert(at(cx,bridge.z0-.5)!==SURFACE.WATER&&at(cx,bridge.z1+.5)!==SURFACE.WATER,`${bridge.id}: its ends are on dry land`);
 assert(at(cx,bridge.z0-.5)===SURFACE.ROAD&&at(cx,bridge.z1+.5)===SURFACE.ROAD,`${bridge.id}: a road meets each end of the deck`);
 for(const side of [bridge.x0-1,bridge.x1+1])assert(!isWalkable(side,zWater),`${bridge.id}: water, not ground, on both sides of the deck`);
 assert(T.zoneAt(cx,zWater)&&T.zoneAt(cx,bridge.z0-.5)&&T.zoneAt(cx,bridge.z1+.5),`${bridge.id}: both ends and the deck are inside the zone it carries`);
}
// The County Road and the Freight Road really join their districts: a flood fill from the city reaches Pine Ridge only over a bridge.
{const noBridges=structuredClone(MAP);noBridges.water.bridges=[];const t=buildTerrain(noBridges),reached=t.reach(MAP.spawn.x,MAP.spawn.z),forestCell=t.index(60,-290);assert(!reached[forestCell],'without the bridges, Pine Ridge cannot be reached');assert(terrain().reach(MAP.spawn.x,MAP.spawn.z)[terrain().index(60,-290)],'with them it can')}

// ── Cedar Heights' loop: a closed, smooth, walkable road around (120, -85), clear of the plots ───────────────────────────────────────────────
{const loop=MAP.roads.edges.find(e=>e.id==='cedar-loop'),line=roadCenterline(loop);
 assert.deepEqual(line[0],line.at(-1),'the loop returns to its start');assert(line.length>80,'a smooth curve ('+line.length+' points)');
 for(const [x,z] of line){assert(isWalkable(x,z)&&at(x,z)===SURFACE.ROAD,`the loop is a walkable road at ${x.toFixed(1)},${z.toFixed(1)}`);const d=Math.hypot((x-120)/38,(z+85)/28);assert(d>.8&&d<1.2,'and stays near its oval ('+d.toFixed(2)+')')}
 let turn=0;for(let i=2;i<line.length;i++){const a=Math.atan2(line[i-1][1]-line[i-2][1],line[i-1][0]-line[i-2][0]),b=Math.atan2(line[i][1]-line[i-1][1],line[i][0]-line[i-1][0]);let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;assert(Math.abs(d)<.35,'no sharp corners');turn+=d}
 assert(Math.abs(Math.abs(turn)-2*Math.PI)<.3,'one full turn round ('+(turn/Math.PI).toFixed(2)+' pi)');
 // Room for vehicles: nowhere does the road bend tighter than a 17 m radius (a car turns in about 6 m, a small truck in 12), and it is two 3.5 m lanes plus shoulders wide.
 let minRadius=1e9;for(let i=3;i<line.length-3;i++){const a=line[i-3],b=line[i],c=line[i+3],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ca=Math.hypot(a[0]-c[0],a[1]-c[1]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;if(area>1e-9)minRadius=Math.min(minRadius,ab*bc*ca/(4*area))}
 assert(minRadius>=17,'the tightest bend has a radius of '+minRadius.toFixed(1)+' m');assert(loop.width>=9)}
// Reserved plots are open ground inside their district: never on a road, a pavement, water or a bridge.
for(const plot of MAP.reserved)for(let x=plot.x0+.25;x<plot.x1;x+=.5)for(let z=plot.z0+.25;z<plot.z1;z+=.5){const s=at(x,z);assert(isWalkable(x,z)&&s===SURFACE.GRASS,`${plot.id} is open grass at ${x},${z} (surface ${s})`)}

// ── What rectangles could not do: a curved, walkable road anywhere (here on spare ground in the east) ──────────────────────────────────────
const curvy=structuredClone(MAP);
curvy.roads.nodes.loopA={x:230,z:-50};curvy.roads.nodes.loopB={x:290,z:-50};
curvy.roads.edges.push({id:'test-curve',from:'loopA',to:'loopB',width:8,surface:'asphalt',level:'rural',walkable:true,curve:true,path:[[245,-80],[275,-80]]});
const ct=buildTerrain(curvy),line=roadCenterline(curvy.roads.edges.at(-1),curvy);
assert(line.length>20,'the path is smoothed into a curve ('+line.length+' points)');
for(const [x,z] of line)assert(ct.walkable(x,z)&&ct.surfaceAt(x,z)===SURFACE.ROAD,`the curve is a walkable road at ${x.toFixed(1)},${z.toFixed(1)}`);
const mid=line[Math.floor(line.length/2)];assert(mid[1]<-65,'it really bends (its middle is at z '+mid[1].toFixed(1)+')');
assert.notEqual(ct.surfaceAt(260,-50),SURFACE.ROAD,'the inside of the bend is not road');assert.notEqual(ct.surfaceAt(mid[0],mid[1]-6),SURFACE.ROAD,'nor is ground 6 m off the centreline');
assert(ct.walkable(250,-60)&&ct.walkable(280,-45),'and the meadow around it is open country, so it joins everything');
console.log(`Terrain mask: ${built.cols} x ${built.rows} cells in ${ms.toFixed(0)} ms; the city identical to the old rules at ${cityPoints} points; open country walkable (no invisible walls), the river and the map edge not; both bridges aligned; the Cedar Heights loop closed and smooth; plots on open grass; all districts reachable.`);
