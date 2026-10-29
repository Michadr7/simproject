import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS} from '../dist/props-assets.js';
import {propInfo,propGeometry} from '../dist/props.js';
import {createWorld,DIRT_ROADS,FIELDS,zoneAt} from '../dist/world.js';
import {MAP,validateMap} from '../dist/map-definition.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// ── The converted models ──────────────────────────────────────────────────────────
assert.deepEqual(Object.keys(PROPS),['sawmill'],'the rough farmyard model is not shipped (a placeholder farmstead stands in)');
for(const [id,expect] of Object.entries({sawmill:{tris:[4000,4500],width:12,height:[5,8]}})){
 const info=propInfo(id),g=propGeometry(id);
 assert(info.triangles>=expect.tris[0]&&info.triangles<=expect.tris[1],`${id}: ${info.triangles} triangles`);assert.equal(g.index.count/3,info.triangles);
 assert(Math.abs(info.width-expect.width)<.05,`${id}: ${info.width} m wide`);assert(info.height>=expect.height[0]&&info.height<=expect.height[1],`${id}: ${info.height} m tall`);
 for(const a of ['position','normal','uv'])assert(g.attributes[a].array.every(Number.isFinite),`${id}: finite ${a}`);
 assert(g.index.array.every(i=>i<g.attributes.position.count),`${id}: indices in range`);
 const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position);
 assert(box.min.y>=-1&&box.min.y<.4,`${id}: stands on the ground (lowest point ${box.min.y.toFixed(2)}; anything below it is hidden by the terrain)`);{let under=0;const pos=g.attributes.position;for(let i=0;i<pos.count;i++)if(pos.getY(i)<-.15)under++;assert(under<pos.count*.05,`${id}: little of it is underground (${under} of ${pos.count} vertices)`)}assert(Math.abs(box.max.y-info.height)<.01);
 assert(Math.abs((box.min.x+box.max.x)/2)<.01&&Math.abs((box.min.z+box.max.z)/2)<.01,`${id}: centred`);
 assert(info.texture.startsWith('data:image/jpeg;base64,')&&info.texture.length<400e3,`${id}: texture ${(info.texture.length/1024).toFixed(0)} KB`);
 assert(info.colliders.length>=3&&info.colliders.length<=40,`${id}: ${info.colliders.length} collision boxes`);
 for(const c of info.colliders)assert(c.x-c.hx>=info.footprint.x0-1.01&&c.x+c.hx<=info.footprint.x1+1.01&&c.z-c.hz>=info.footprint.z0-1.01&&c.z+c.hz<=info.footprint.z1+1.01,`${id}: a collision box lies outside the model`);
 assert(propGeometry(id)===g,'geometry is shared');
}
// The sawmill is walkable under its roof: only posts, rails, machinery and log stacks are solid, and the deck is a floor you stand on.
{const info=propInfo('sawmill');assert(info.colliders.length>=15&&info.colliders.length<=40,'posts, rails and machinery: '+info.colliders.length+' boxes');
 assert(info.floor&&Math.abs(info.floor.y-.54)<.06&&info.floor.x1-info.floor.x0>8,'a raised deck about half a metre high');}

// ── Placed in the world ───────────────────────────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
const farmZone=MAP.zones.find(z=>z.id==='farm').bounds,forestZone=MAP.zones.find(z=>z.id==='forest').bounds;
const rect=(l)=>{const info=propInfo(l.prop);return {x0:l.x+info.footprint.x0,x1:l.x+info.footprint.x1,z0:l.z+info.footprint.z0,z1:l.z+info.footprint.z1}};
const overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z0<a.z1;
const farmyard=MAP.landmarks.find(l=>l.id==='farmstead'),sawmill=MAP.landmarks.find(l=>l.id==='sawmill');
{const r=rect(farmyard);assert(r.x0>=farmZone.x0&&r.x1<=farmZone.x1&&r.z0>=farmZone.z0&&r.z1<=farmZone.z1,'the farmyard is inside Willow Fields');
 for(const road of DIRT_ROADS)assert(!overlaps(r,road),'the farmyard is clear of the dirt roads');for(const f of FIELDS)assert(!overlaps(r,f),'and of the three fields: '+f.id);
 assert(farmyard.yaw===0&&r.z1<-163.5-.5,'it faces south, toward the farm road (z -160), and does not cover it')}
{const r=rect(sawmill);assert(r.x0>=forestZone.x0&&r.x1<=forestZone.x1&&r.z0>=forestZone.z0&&r.z1<=forestZone.z1,'the sawmill is inside Pine Ridge');
 const c=MAP.scenery.forest.clearings.find(c=>c.x===106&&c.z===-212);for(const [x,z] of [[r.x0,r.z0],[r.x1,r.z0],[r.x0,r.z1],[r.x1,r.z1]])assert(((x-c.x)/c.rx)**2+((z-c.z)/c.rz)**2<1,'the sawmill stands wholly inside the empty clearing');
 for(const road of DIRT_ROADS)assert(!overlaps(r,road),'the sawmill is clear of the dirt roads')}
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
for(const id of ['farmstead','sawmill'])assert(scene.getObjectByName('prop-'+id),id+' is in the scene');
// Solid where the walls are, open where they are not.
for(const l of MAP.landmarks){const info=propInfo(l.prop);for(const c of info.colliders)assert(world.blocked(l.x+c.x,l.z+c.z),`${l.id}: solid at a collision box`);
 const front=l.z+info.footprint.z1+2;assert(!world.blocked(l.x,front)||l.id==='sawmill','the front of '+l.id+' is open');}
assert(zoneAt(farmyard.x,farmyard.z).id==='farm'&&zoneAt(sawmill.x,sawmill.z).id==='forest');
// Far buildings are not drawn.
{const culled=createWorld(new THREE.Scene(),{});const camera=new THREE.PerspectiveCamera();const yard=(culled,x,z)=>{culled.update(.016,camera,new THREE.Vector3(x,0,z))};
 const s2=new THREE.Scene(),w2=createWorld(s2,{});yard(w2,0,0);assert.equal(s2.getObjectByName('prop-farmstead').visible,false,'not drawn from the city');assert.equal(s2.getObjectByName('prop-sawmill').visible,false);
 yard(w2,-62,-150);assert.equal(s2.getObjectByName('prop-farmstead').visible,true,'drawn from the farm road');assert.equal(s2.getObjectByName('prop-sawmill').visible,false);
 yard(w2,104,-180);assert.equal(s2.getObjectByName('prop-sawmill').visible,true);}
// The signpost at the fork.
{const sign=MAP.signs[0];assert.equal(sign.zone,'county');assert(world.blocked(sign.x,sign.z),'the post is solid');assert.deepEqual(sign.boards.map(b=>b.text),['← WILLOW FIELDS','PINE RIDGE →'])}
// The sawmill is solid: flood-fill from open ground around it and the deck, posts and machinery cannot be reached (you cannot walk through it).
{const info=propInfo('sawmill'),step=.5,x0=info.footprint.x0-3,x1=info.footprint.x1+3,z0=info.footprint.z0-3,z1=info.footprint.z1+3,nx=Math.round((x1-x0)/step)+1,nz=Math.round((z1-z0)/step)+1;
 const blockedAt=(i,j)=>world.blocked(sawmill.x+x0+i*step,sawmill.z+z0+j*step),seen=new Uint8Array(nx*nz),queue=[[0,0]];seen[0]=1;
 while(queue.length){const [i,j]=queue.pop();for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz||seen[b*nx+a]||blockedAt(a,b))continue;seen[b*nx+a]=1;queue.push([a,b])}}
 let deckOpen=0,deckReached=0,blocked=0;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+i*step,z=z0+j*step,f=info.floor;if(blockedAt(i,j)){if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1)blocked++}else if(x>=f.x0+.5&&x<=f.x1-.5&&z>=f.z0+.5&&z<=f.z1-.5){deckOpen++;if(seen[j*nx+i])deckReached++}}
 assert(blocked>100,'posts, rails and machinery are solid ('+blocked+' cells on the deck)');assert(deckReached<=deckOpen*.25,'only the north-east corner of the deck can be walked onto, not the machinery: '+deckReached+' of '+deckOpen+' open deck cells are reachable from outside');
 const f=info.floor;assert.equal(world.floorAt(sawmill.x+(f.x0+f.x1)/2,sawmill.z+(f.z0+f.z1)/2),f.y,'standing on the deck');assert.equal(world.floorAt(sawmill.x+30,sawmill.z),null,'and not beside it');assert.equal(world.floorAt(farmyard.x,farmyard.z),null,'the farmstead has no deck')}
const triangles=Object.values(PROPS).reduce((n,p)=>n+p.triangles,0);
console.log(`Props: the sawmill (${triangles} triangles; solid posts, rails and machinery you cannot walk through, a 0.54 m deck) and a placeholder farmstead, placed inside their zones clear of roads and fields, drawn only when near.`);
