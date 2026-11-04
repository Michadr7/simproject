import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap,YARD_CAPS,roadRect} from '../dist/map-definition.js';
import {propInfo} from '../dist/props.js';
import {createWorld} from '../dist/world.js';
import {terrain,SURFACE} from '../dist/terrain.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// ── Eastbank Works (0.33): the data, the layout rules, the yards and what they cost ──────────────────────────────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
const T=terrain(),world=createWorld(new THREE.Scene(),{cullRadius:Infinity}),eb=world.eastbank;
const zone=MAP.zones.find(z=>z.id==='eastbank').bounds,roads=Object.fromEntries(MAP.roads.edges.map(e=>[e.id,e]));
const touches=(a,b)=>{const w=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),h=Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0);return (w>0&&h>=0)||(h>0&&w>=0)};
const overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z0<a.z1;
const rotated=l=>{const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),pts=[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]].map(([x,z])=>[l.x+x*c+z*s,l.z-x*s+z*c]);
 return {x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),z0:Math.min(...pts.map(p=>p[1])),z1:Math.max(...pts.map(p=>p[1]))}};

// Roads: straight and 9 m or more everywhere, 12 m where trucks turn; no new curves (the one ribbon is still Cedar Heights' loop, whose tightest bend is about 20 m).
assert.equal(roads['freight-south'].width,12);assert.equal(roads['works-lane'].width,12);assert.equal(roads['oak-east'].width,12);assert.deepEqual(MAP.roads.edges.filter(e=>e.path).map(e=>e.id),['cedar-loop']);
assert.deepEqual(roadRect(roads['works-lane']),{x0:96,x1:108,z0:6,z1:68},'Works Lane joins Oak Street East and Freight South');
// The loop Oak East -> Works Lane -> Freight South -> Freight Road is drivable end to end: flood the asphalt, driveway and bridge cells from Oak East.
const drivable=new Set([SURFACE.ROAD,SURFACE.STREET,SURFACE.DRIVEWAY,SURFACE.BRIDGE]),seen=new Uint8Array(T.walk.length);
{const start=T.index(102,9),stack=[start];assert(drivable.has(T.surface[start]));seen[start]=1;
 while(stack.length){const c=stack.pop(),i=c%T.cols,j=(c-i)/T.cols;for(const [a,b] of [[i+1,j],[i-1,j],[i,j+1],[i,j-1]]){if(a<0||b<0||a>=T.cols||b>=T.rows)continue;const d=b*T.cols+a;if(!seen[d]&&drivable.has(T.surface[d])&&T.walk[d]){seen[d]=1;stack.push(d)}}}}
const reached=(x,z)=>seen[T.index(x,z)]===1;
for(const [x,z] of [[195,40],[195,68],[102,40],[140,68],[195,-100]])assert(reached(x,z),`asphalt is drivable from Oak Street East to ${x}, ${z} (Freight Road, Works Lane, Freight South)`);
// Every paving rectangle is asphalt you can drive onto from a road, and walk to from the spawn.
const walkReach=T.reach(MAP.spawn.x,MAP.spawn.z);
for(const p of MAP.paving){assert(p.x0>=zone.x0&&p.x1<=zone.x1&&p.z0>=zone.z0&&p.z1<=zone.z1,`${p.id} lies in Eastbank`);
 for(let x=p.x0+.25;x<p.x1;x+=1)for(let z=p.z0+.25;z<p.z1;z+=1){assert.equal(T.surfaceAt(x,z),SURFACE.DRIVEWAY,`${p.id} is asphalt at ${x}, ${z}`);assert(reached(x,z),`${p.id} at ${x}, ${z} is connected to the road network by asphalt`);assert(walkReach[T.index(x,z)],`${p.id} at ${x}, ${z} can be walked to`)}}
// Cuts: the paving that joins a yard to a road is 8 m wide (trucks).
for(const id of ['depot-cut','supply-cut','workshop-cut-w','workshop-cut-e','warehouse-in','warehouse-out','timber-out','freight-cut-w','freight-cut-e'])assert(Math.abs(MAP.paving.find(p=>p.id===id).x1-MAP.paving.find(p=>p.id===id).x0-8)<1e-9,`${id} is an 8 m cut`);
assert.equal(MAP.paving.find(p=>p.id==='timber-in').z1-MAP.paving.find(p=>p.id==='timber-in').z0,8);

// Plots and buildings: five new landmarks, each inside its plot, facing the way the plot faces, with a front yard of at least the truck-yard depth (12 m) where trucks work.
const L=id=>MAP.landmarks.find(l=>l.id===id),plot=id=>MAP.reserved.find(p=>p.id===id);
for(const id of ['eastbank-warehouse','eastbank-workshop','eastbank-supply','eastbank-gas-kiosk','eastbank-lumber-shed']){const l=L(id),r=rotated(l),p=plot(l.plot);
 assert(r.x0>=p.x0&&r.x1<=p.x1&&r.z0>=p.z0&&r.z1<=p.z1,`${id} stands inside plot ${l.plot}`);
 for(const q of MAP.paving)assert(!overlaps(r,q),`${id} does not stand on paving ${q.id}`);
 for(const e of MAP.roads.edges)assert(!overlaps(r,roadRect(e)),`${id} is clear of ${e.id}`);
 const prop=MAP.properties.find(q=>q.landmark===id);assert(prop&&prop.enterable===false&&prop.reason.length>20,`${id} is in the registry with a reason`)}
{const wh=rotated(L('eastbank-warehouse')),yard=MAP.paving.find(p=>p.id==='warehouse-yard');assert(wh.z0-yard.z0>=12&&yard.z1<=wh.z0+1e-9,`the warehouse's truck yard is ${wh.z0-yard.z0} m deep (12 m or more)`);
 // one dock, at the warehouse model's one loading door (door.x is seen from the front; the warehouse faces north, so world x = landmark x - door.x); the plate's lip (local z -0.6) lies against the wall, its ramp end toward the yard
 const door=propInfo('industrial-q').door,docks=MAP.yards.find(y=>y.id==='warehouse-yard').items.filter(i=>i.prop==='prop.dock-plate'),doorX=L('eastbank-warehouse').x-door.x;assert.equal(docks.length,1);
 {const d=docks[0],f=propInfo('prop.dock-plate').footprint;assert(Math.abs(d.x-doorX)<.01,`the dock plate is at the loading door (x ${d.x} vs ${doorX})`);assert(d.x-1>=doorX-door.width/2&&d.x+1<=doorX+door.width/2,'the 2 m plate fits the 3.7 m door');assert.equal(Math.round(Math.cos(d.yaw)),-1,'turned to face the yard');assert(Math.abs((d.z-f.z0)-wh.z0)<.01,`the lip of the plate lies against the wall (z ${(d.z-f.z0).toFixed(2)} vs ${wh.z0.toFixed(2)})`)}
 // and the inbound driveway lines up with the dock lane (a 4.2 m truck centred on the door)
 assert(MAP.paving.find(p=>p.id==='warehouse-in').x0<=doorX-2.1&&MAP.paving.find(p=>p.id==='warehouse-in').x1>=doorX+2.1,'the in driveway is wide enough for a truck lined up on the dock'); const timber=MAP.paving.find(p=>p.id==='timber-yard');assert(timber.x1-timber.x0>=8&&timber.z1-timber.z0>=12,'the timber yard is 8 m wide per truck and 12 m deep');
 const supply=rotated(L('eastbank-supply'));assert(supply.z0-MAP.paving.find(p=>p.id==='supply-apron').z0>=12,'the supplier has a 12 m forecourt')}

// Yards: the caps hold, every item is inside its yard and the yards are clear of each other and of the buildings; a truck can drive straight through every cut and across every yard.
assert.equal(MAP.yards.length,5);const counts=MAP.yards.map(y=>y.items.length),total=counts.reduce((a,b)=>a+b,0);assert(total<=YARD_CAPS.total,`${total} props in all yards`);assert.deepEqual(counts,[18,52,13,14,6]);
for(const y of MAP.yards){const per={};for(const i of y.items)per[i.prop]=(per[i.prop]||0)+1;for(const [prop,n] of Object.entries(per))assert(n<=YARD_CAPS.perModel,`${y.id}: ${n} ${prop}`)}
{const footprints=[];for(const y of MAP.yards)for(const i of y.items){if(i.y>0)continue;const f=propInfo(i.prop).footprint,s=Math.round(Math.sin(i.yaw)),c=Math.round(Math.cos(i.yaw)),pts=[[f.x0,f.z0],[f.x1,f.z1]].map(([x,z])=>[i.x+x*c+z*s,i.z-x*s+z*c]);
  footprints.push({id:y.id+':'+i.prop,x0:Math.min(pts[0][0],pts[1][0]),x1:Math.max(pts[0][0],pts[1][0]),z0:Math.min(pts[0][1],pts[1][1]),z1:Math.max(pts[0][1],pts[1][1]),plate:i.prop==='prop.dock-plate'||i.prop==='prop.forecourt-canopy'})} // a canopy is a roof on four columns (its bollards and the island stand under it): not a solid footprint
 for(let a=0;a<footprints.length;a++){for(const l of MAP.landmarks.filter(l=>l.id.startsWith('eastbank')))assert(!overlaps(footprints[a],rotated(l)),`${footprints[a].id} is clear of ${l.id}`);
  for(let b=a+1;b<footprints.length;b++)if(!footprints[a].plate&&!footprints[b].plate)assert(!overlaps(footprints[a],footprints[b]),`${footprints[a].id} and ${footprints[b].id} do not overlap`)}}
{ // a truck (4.2 m wide) can drive along the middle of every cut and every yard's lane: nothing solid in a 3.6 m strip down the cut's centre (blocked() adds the player's 0.33 m)
 for(const id of ['depot-cut','supply-cut','workshop-cut-w','workshop-cut-e','warehouse-in','warehouse-out','timber-out','freight-cut-w','freight-cut-e']){const p=MAP.paving.find(q=>q.id===id),cx=(p.x0+p.x1)/2;for(let z=p.z0;z<=p.z1;z+=.5)for(let dx=-1.8;dx<=1.8;dx+=.6)assert(!world.blocked(cx+dx,z),`${id} is open at ${cx+dx}, ${z}`)}
 const t=MAP.paving.find(p=>p.id==='timber-in');for(let x=t.x0;x<=t.x1;x+=.5)for(let dz=-1.8;dz<=1.8;dz+=.6)assert(!world.blocked(x,50+dz),'timber-in is open');
 // the truck lane through the warehouse yard (a dock's centreline from the cut to the dock) and the freight yard's aisle (z 57..59.5) are open
 for(const dockX of [161.8])for(let z=18;z<=28;z+=.5)for(let dx=-1.8;dx<=1.8;dx+=.6)assert(!world.blocked(dockX+dx,z),`the lane to the dock at x ${dockX} is open at z ${z}`);
 for(let x=111;x<=187;x+=.5)for(let z=57.5;z<=59;z+=.5)assert(!world.blocked(x,z)||(x>=118.5&&x<=129.5)||(x>=158.5&&x<=170),`the freight yard's aisle is open at ${x}, ${z}`)}
// Solid where it should be: the buildings, a pallet, a container, a bollard, a sign post; walk-over where it should be: the dock plate; a stack is one solid footprint.
for(const [x,z,what] of [[163,38.6,'warehouse'],[126,33.5,'workshop'],[83,35.4,'supplier'],[168.5,-14,'kiosk'],[137,34,'tank'],[114,51,'container'],[159.3,30.4,'bollard'],[169.5,30.9,'pallet stack'],[165.6,28,'sign post']])assert(world.blocked(x,z),`${what} is solid at ${x}, ${z}`);
assert(!world.blocked(161.8,30.4),'the dock plate is walked over (its ramp end; the lip is against the wall, within the wall\'s own reach)');
// Culling and cost. From the spawn nothing of Eastbank is drawn; in the warehouse yard its own chunk and the neighbours within 90 m are.
{const camera=new THREE.PerspectiveCamera(),at=(x,z)=>{world.update(.016,camera,new THREE.Vector3(x,0,z));return Object.fromEntries(eb.chunks.map(c=>[c.id,c.holder.visible]))};
 assert(Object.values(at(-5,15)).every(v=>!v),'no yard is drawn from the spawn');
 const here=at(163,25);assert(here['warehouse-yard']&&here['freight-yard']&&here['gas-station'],'the warehouse yard, the freight yard and the gas station are drawn from the warehouse');
 assert(!at(-30,-100)['warehouse-yard'],'and not from Alder Center');
 const s=at(163,25)&&eb.stats(163,25),far=eb.stats(-5,15);assert.equal(far.chunksOn,0);assert.equal(far.instances,0);
 // one InstancedMesh per model per yard, never one per prop: warehouse 7 models (dock plate, sign, bollard, three loaded pallets, empty pallet), freight yard 9 (three containers, empty and three loaded pallets, crate, bollard), timber yard 4, workshop 4, gas station 1
 assert.deepEqual(eb.chunks.map(c=>c.meshes.length),[7,9,4,4,4]); // the gas station: its bollards, the pump island and the canopy (a roof and its columns, two meshes, 0.35)
 assert(s.instances===103&&s.triangles<=30000&&s.drawCalls<=31,`worst case, standing among all five yards: ${s.instances} instances, ${s.triangles} triangles, ${s.drawCalls} draw calls`);
 // Eastbank is compact (about 120 x 95 m): from the depot all five yards are within 80 m, so standing anywhere in it you pay for all 107 props. The city and Alder Center pay nothing.
 const depot=eb.stats(95,-10);assert.equal(depot.chunksOn,5);assert.equal(depot.instances,103);for(const [x,z] of [[0,0],[20,-100],[-30,60]])assert.equal(eb.stats(x,z).chunksOn,0,`no yard is drawn from ${x}, ${z}`);console.log(`Eastbank cost: from the depot ${JSON.stringify(depot)}; from the spawn ${JSON.stringify(far)}`)}
// The validator catches a bad yard.
{const broken=edit=>{const map=structuredClone(MAP);edit(map);return validateMap(map)},has=(problems,pattern)=>assert(problems.some(p=>pattern.test(p)),`expected ${pattern}, got ${JSON.stringify(problems)}`);
 has(broken(m=>{const y=m.yards.find(q=>q.id==='freight-yard');for(let i=0;i<20;i++)y.items.push({prop:'prop.pallet',x:112+i*.5,z:49,yaw:0,y:0})}),/the cap is 32 of one model per yard/);
 has(broken(m=>{for(let k=0;k<4;k++){const y=m.yards[1];for(let i=0;i<30;i++)y.items.push({prop:['prop.box-small','prop.box-medium','prop.crate-large','prop.zone-bollard'][k],x:112+i*.5,z:49,yaw:0,y:0})}}),/the yards hold \d+ props \(the cap is 160\)/);
 has(broken(m=>{m.yards[0].items.push({prop:'prop.pallet',x:200,z:20,yaw:0,y:0})}),/outside the yard/);
 has(broken(m=>{m.yards[0].items.push({prop:'prop.pallet',x:162,z:20,yaw:.3,y:0})}),/must face north, east, south or west/);
 has(broken(m=>{m.paving.find(p=>p.id==='supply-apron').z1=14.1}),/not on paving/);
 has(broken(m=>{m.paving.push({id:'lost',x0:300,x1:310,z0:0,z1:10})}),/not inside one zone/);
 has(broken(m=>{m.paving.push({...m.paving[0]})}),/duplicate paving/);
 has(broken(m=>{m.bayRows[0].count=20}),/bay row supply-bays is not on paving/);
 has(broken(m=>{m.yards[2].bounds={x0:70,x1:96,z0:40,z1:62}}),/not on one paving rectangle/);
 has(broken(m=>{m.properties.splice(m.properties.findIndex(p=>p.id==='eastbank-warehouse'),1)}),/landmark eastbank-warehouse has no property entry/)}
// the forecourt roof fades to a faint ghost while the player stands under it (it eases, a few frames), and is solid again when they step out
{assert.equal(eb.canopies.length,1,'one forecourt canopy');const roof=eb.canopies[0].mesh,op=()=>[].concat(roof.material)[0].opacity,step=(x,z)=>{for(let i=0;i<40;i++)eb.update(x,z)};
 step(156.5,-8.25);assert(op()<.3&&roof.visible,'standing under the canopy fades its roof to a ghost (still there)');
 step(159.5,-8.25);assert(op()<.3,'and in the lane near the roof edge (3 m east of its centre)');
 step(162,-8.25);assert.equal(op(),1,'outside the roof it is solid again');assert.equal([].concat(roof.material)[0].transparent,false);step(140,-4);assert.equal(op(),1,'and from the road to the west')}
// the columns stay drawn when the roof dissolves (you can see what you would run into), and stand beside the island's ends, not in the lanes
{const c=eb.canopies[0];eb.update(156.5,-8.25);assert.equal(c.columns.visible,true,'the columns are drawn under the roof');const {splitCanopy}=await import('../dist/eastbank.js'),{propGeometry}=await import('../dist/props.js'),whole=propGeometry('prop.forecourt-canopy'),parts=splitCanopy(whole);
 assert.equal(parts.roof.index.count+parts.columns.index.count,whole.index.count,'every triangle is in the roof or the columns');
 assert(parts.columns.index.count>0&&parts.roof.index.count>parts.columns.index.count);const P=parts.columns.attributes.position,used=[...parts.columns.index.array];const xs=used.map(i=>P.getX(i)),ys=used.map(i=>P.getY(i));assert(Math.max(...xs.map(Math.abs))<1.5,'the columns stand within 1.5 m of the canopy centre (the model had them 5 m out)');assert(Math.min(...ys)<.3&&Math.max(...ys)>=4.5,'full height')}
console.log('Eastbank Works: Works Lane and a 12 m Freight South close a drivable loop; 5 buildings in their plots (all in the registry with reasons), 20 paving rectangles that are asphalt, connected to the roads and walkable; 8 m driveway cuts clear for a truck; 101 yard props in 5 chunks under the caps; solid and walk-over parts; culling; 10 broken yards and maps caught.');
