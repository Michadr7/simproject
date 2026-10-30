import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {terrain,SURFACE,roadCenterline} from '../dist/terrain.js';
import {createWorld} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// ── One connected network ──────────────────────────────────────────────────────────────────
// Every street, road, pavement, driveway, path and bridge is part of one paved network: nothing floats. Two bits of paving count as joined if they are within one cell (0.5 m) of each other.
const T=terrain(),PAVED=new Set([SURFACE.STREET,SURFACE.ROAD,SURFACE.DIRT,SURFACE.PAVEMENT,SURFACE.BRIDGE,SURFACE.DRIVEWAY,SURFACE.PATH]);
const isPaved=c=>PAVED.has(T.surface[c]);
const comp=new Int32Array(T.walk.length),sizes=[],seeds=[];
for(let c0=0;c0<comp.length;c0++){if(comp[c0]||!isPaved(c0))continue;const id=sizes.length+1;let n=0;const stack=[c0];comp[c0]=id;
 while(stack.length){const c=stack.pop(),i=c%T.cols,j=(c-i)/T.cols;n++;for(let dj=-2;dj<=2;dj++)for(let di=-2;di<=2;di++){const a=i+di,b=j+dj;if(a<0||b<0||a>=T.cols||b>=T.rows||Math.abs(di)+Math.abs(dj)>2)continue;const d=b*T.cols+a;if(!comp[d]&&isPaved(d)){comp[d]=id;stack.push(d)}}}
 sizes.push(n);seeds.push([T.x0+(c0%T.cols+.5)*T.cell,T.z0+(Math.floor(c0/T.cols)+.5)*T.cell])}
const floating=sizes.map((n,k)=>({n,at:seeds[k].map(v=>+v.toFixed(0)).join(',')})).slice(1);
assert.equal(sizes.length,1,`the paved network is one piece: ${sizes.length} pieces; the others are ${JSON.stringify(floating)} cells at (x,z) (the first is Oak Street's)`);

// ── Every walkable road can be walked along its whole centreline ─────────────────────────────────────────
const world=createWorld(new THREE.Scene(),{cullRadius:Infinity});
for(const edge of MAP.roads.edges.filter(e=>e.walkable)){const line=roadCenterline(edge);
 for(let i=0;i<line.length;i+=3){const [x,z]=line[i];assert(T.walkable(x,z),`${edge.id} is walkable at ${x.toFixed(1)},${z.toFixed(1)}`);assert(!world.blocked(x,z),`${edge.id} is not blocked at ${x.toFixed(1)},${z.toFixed(1)}`);assert([SURFACE.ROAD,SURFACE.STREET,SURFACE.BRIDGE,SURFACE.PAVEMENT].includes(T.surfaceAt(x,z)),`${edge.id} has road under it at ${x.toFixed(1)},${z.toFixed(1)}`)}}

// ── The joins: every road end is on another road, or is a declared dead end ───────────────────────────────────────────────
const deadEnds=new Set(['oak-street:from','alder-avenue:to','county-road:to','alder-street:to','freight-south:from','farm-road:from','woods-lane:from','woods-lane:to']); // Oak Street's west end, Alder Avenue's south end, the County Road's north end, Alder Street's north end, the Freight Road's west end, the farm gate and both ends of the woods lane
for(const edge of MAP.roads.edges){for(const [end,node] of [['from',MAP.roads.nodes[edge.from]],['to',MAP.roads.nodes[edge.to]]]){
 if(edge.closed||deadEnds.has(`${edge.id}:${end}`))continue;
 const others=MAP.roads.edges.filter(e=>e!==edge);let joined=false;
 for(const other of others){const line=roadCenterline(other);for(let i=1;i<line.length;i++){const [ax,az]=line[i-1],[bx,bz]=line[i],dx=bx-ax,dz=bz-az,u=Math.max(0,Math.min(1,((node.x-ax)*dx+(node.z-az)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(node.x-ax-dx*u,node.z-az-dz*u)<=other.width/2+.01)joined=true}}
 assert(joined,`the ${end} end of ${edge.id} (${node.x},${node.z}) lies on another road`)}}
console.log(`Roads: one paved network (${T.walk.length>0?'1':'?'} piece); every walkable road can be walked along its length; every road end joins another road or is a declared dead end.`);
