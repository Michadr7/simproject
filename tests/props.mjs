import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS} from '../dist/props-assets.js';
import {propInfo,propGeometry} from '../dist/props.js';
import {createWorld,DIRT_ROADS,FIELDS,zoneAt} from '../dist/world.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import {terrain,SURFACE} from '../dist/terrain.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// ── The converted models: [triangles, width, height] each (scripts/build-props.mjs; a deliberate change means updating this table) ──────────────
const EXPECT={sawmill:[4333,12,6.74],'house-a':[1174,10.4,6.7],'house-e':[1731,10.4,9.1],'house-h':[770,10.4,5.9],'house-c':[1196,10.3,8.3],'house-j':[1210,11,8.3],'house-l':[1310,8.3,8.4],'house-o':[1326,10.2,9.1],'house-r':[1030,8.2,9.1],'house-t':[2062,10.5,9.3],
 'shop-e':[1509,13.1,7.1],'shop-i':[2544,9.9,13.4],'shop-l':[3512,11,18.2],'shop-a':[1252,7.1,10.3],'shop-c':[1195,7.1,7.1],'shop-d':[1100,6.7,10.3],'shop-f':[1794,6.7,13.5],'shop-g':[2006,7.8,13.5],'shop-h':[1512,7.1,10.3],store:[528,13,7],barn:[2910,12,9.3],'small-barn':[2176,9.4,7.7],'open-barn':[1612,8.9,7.4],'silo-house':[2880,8.3,14.1],coop:[948,3.6,2.8],windmill:[4070,9.9,14.3],hut:[632,6.5,5.7],log:[202,2.8,.8],
 car:[2764,1.8,1.2],suv:[3062,2.2,1.7],'sports-car':[2842,1.8,1.3],'police-car':[3016,2,1.5],taxi:[2804,1.8,1.4],'car-2':[2894,2,1.5],'sports-car-2':[2948,1.9,1.3],pickup:[4442,2.3,1.8],flatbed:[3024,4.2,3.8],
 // furniture (Kenney Furniture Kit, 2 m per model unit)
 'f-bed-double':[364,1.9,.8],'f-bed-single':[314,1.1,.7],'f-sofa':[256,2,.9],'f-coffee-table':[248,1.3,.5],'f-table':[240,1.7,.7],'f-chair':[340,.4,.9],'f-tv':[144,1.4,.9],'f-tv-cabinet':[308,1.6,.6],'f-bookcase':[640,.8,1.8],'f-wardrobe':[536,.8,1.7],'f-desk':[352,1.5,.8],'f-desk-chair':[656,.7,1.2],
 'f-cabinet':[188,.9,.9],'f-sink':[596,.9,1],'f-stove':[1604,.9,.9],'f-fridge':[584,1,1.8],'f-toilet':[440,.6,.9],'f-bath':[1204,2.4,.8],'f-bath-sink':[632,.7,1.1],'f-lamp':[152,.3,1.7],'f-rug':[56,3.1,0],'f-plant':[104,.4,1.3],'f-stairs':[616,3.6,2.7],'f-side-table':[236,1.1,.8]};
assert.deepEqual(Object.keys(PROPS).sort(),Object.keys(EXPECT).sort(),'every converted prop is in the table, and nothing else ships');
let triangles=0;
for(const [id,[tris,width,height]] of Object.entries(EXPECT)){
 const info=propInfo(id),g=propGeometry(id),coloured=!!info.col;
 assert(Math.abs(info.triangles-tris)<=tris*.02+2,`${id}: ${info.triangles} triangles (expected about ${tris})`);assert.equal(g.index.count/3,info.triangles);triangles+=info.triangles;
 assert(Math.abs(info.width-width)<.15,`${id}: ${info.width} m wide`);assert(Math.abs(info.height-height)<.2,`${id}: ${info.height} m tall`);
 for(const a of coloured?['position','normal','color']:['position','normal','uv'])assert(g.attributes[a].array.every(Number.isFinite),`${id}: finite ${a}`);
 assert(g.index.array.every(i=>i<g.attributes.position.count),`${id}: indices in range`);
 const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position);
 assert(box.min.y>=-1&&box.min.y<.4,`${id}: stands on the ground (lowest point ${box.min.y.toFixed(2)})`);{let under=0;const pos=g.attributes.position;for(let i=0;i<pos.count;i++)if(pos.getY(i)<-.15)under++;assert(under<pos.count*.05,`${id}: little of it is underground`)}assert(Math.abs(box.max.y-info.height)<.01);
 assert(Math.abs((box.min.x+box.max.x)/2)<.01&&Math.abs((box.min.z+box.max.z)/2)<.01,`${id}: centred`);
 if(coloured){assert(!info.texture&&info.col&&info.norQ,`${id}: baked colours, compact normals`);assert(g.attributes.normal.array.every(v=>v>=-1.001&&v<=1.001),`${id}: unit-range normals`)}
 else assert(info.texture.startsWith(/^(house|shop)-/.test(id)?'data:image/png;base64,':'data:image/jpeg;base64,')&&info.texture.length<400e3,`${id}: texture ${(info.texture.length/1024).toFixed(0)} KB`);
 assert(info.colliders.length>=(id==='f-rug'?0:1)&&info.colliders.length<=40,`${id}: ${info.colliders.length} collision boxes`);
 for(const c of info.colliders)assert(c.x-c.hx>=info.footprint.x0-1.01&&c.x+c.hx<=info.footprint.x1+1.01&&c.z-c.hz>=info.footprint.z0-1.01&&c.z+c.hz<=info.footprint.z1+1.01,`${id}: a collision box lies outside the model`);
 assert(propGeometry(id)===g,'geometry is shared');
}
// Budgets: cars keep their wheels, so about 2,800-3,100 triangles each (flat-shaded models cannot be simplified without losing the small parts, which is what the first conversion did: no tyres), trucks up to 4,600, every building under 4,400.
for(const id of ['car','suv','sports-car','police-car','taxi','car-2','sports-car-2'])assert(propInfo(id).triangles<=3200,`${id} is a light car`);for(const id of ['pickup','flatbed'])assert(propInfo(id).triangles<=4600);
// Every vehicle still has its wheels: a good number of dark triangles standing on the ground, at the four corners.
for(const id of ['car','suv','sports-car','police-car','taxi','car-2','sports-car-2','pickup','flatbed']){const g=propGeometry(id),pos=g.attributes.position,col=g.attributes.color,idx=g.index;let tyres=0;const corners=new Set();
 for(let t=0;t<idx.count;t+=3){const v=[0,1,2].map(k=>idx.getX(t+k)),top=Math.max(...v.map(i=>pos.getY(i))),dark=Math.max(...v.map(i=>col.getX(i)+col.getY(i)+col.getZ(i)))<.1;if(top<.9&&dark){tyres++;const cx=(pos.getX(v[0])+pos.getX(v[1])+pos.getX(v[2]))/3,cz=(pos.getZ(v[0])+pos.getZ(v[1])+pos.getZ(v[2]))/3;corners.add((cx<0?'L':'R')+(cz<0?'B':'F'))}}
 assert(tyres>=120,`${id} has its tyres (${tyres} dark triangles at wheel height)`);assert(corners.size===4,`${id} has a wheel at each of its four corners: ${[...corners]}`)}
for(const [id,p] of Object.entries(PROPS))if(!/^(car|car-2|suv|sports-car|sports-car-2|police-car|taxi|pickup|flatbed|log|f-.*)$/.test(id))assert(p.triangles<=4400,`${id} is under the building budget`);
// The sawmill is walkable under its roof: only posts, rails, machinery and log stacks are solid, and the deck is a floor you stand on. No other prop has a deck.
{const info=propInfo('sawmill');assert(info.colliders.length>=15&&info.colliders.length<=40,'posts, rails and machinery: '+info.colliders.length+' boxes');
 assert(info.floor&&Math.abs(info.floor.y-.54)<.06&&info.floor.x1-info.floor.x0>8,'a raised deck about half a metre high');for(const [id,p] of Object.entries(PROPS))if(id!=='sawmill')assert.equal(p.floor,null,id+' has no deck')}
// Houses have a front door; shops, farm buildings and vehicles do not.
for(const id of Object.keys(PROPS))if(/^house-/.test(id)){const d=propInfo(id).door;assert(d&&d.width>=1.2&&d.height>=2&&Math.abs(d.z-propInfo(id).footprint.z1)<.011,id+' has its front door on the front wall')}else assert.equal(propInfo(id).door,null,id+' has no door');

// ── Placed in the world ───────────────────────────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
const T=terrain(),zoneOf=id=>MAP.zones.find(z=>z.id===id).bounds;
const rotated=l=>{const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),pts=[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]].map(([x,z])=>[l.x+x*c+z*s,l.z-x*s+z*c]);
 return {x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),z0:Math.min(...pts.map(p=>p[1])),z1:Math.max(...pts.map(p=>p[1]))}};
const inside=(r,b)=>r.x0>=b.x0&&r.x1<=b.x1&&r.z0>=b.z0&&r.z1<=b.z1,overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z1>b.z0&&b.z0<a.z1;
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
const rects=MAP.landmarks.map(l=>({l,r:rotated(l)}));
for(const {l,r} of rects){
 assert(inside(r,zoneOf(l.zone)),`${l.id} stands inside its zone ${l.zone}`);
 for(const road of DIRT_ROADS)assert(!overlaps(r,road),`${l.id} is clear of the dirt roads`);for(const f of FIELDS)assert(!overlaps(r,f),`${l.id} is clear of the field ${f.id}`);
 for(const b of l.decor?[]:propInfo(l.prop).colliders){const s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw));for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const lx=b.x+dx*b.hx*.98,lz=b.z+dz*b.hz*.98,x=l.x+lx*c+lz*s,z=l.z-lx*s+lz*c,k=T.surfaceAt(x,z);
  assert(![SURFACE.ROAD,SURFACE.STREET,SURFACE.BRIDGE,SURFACE.WATER,SURFACE.BANK,...(/^house-/.test(l.prop)?[SURFACE.PAVEMENT]:[])].includes(k),`${l.id}: solid ground-level boxes never stand on a road, bridge or water (and a house's never on a pavement; a shop's walls may touch its sidewalk) (${x.toFixed(1)},${z.toFixed(1)} is ${k})`)}}
 assert(world.blocked(l.x+Math.round(Math.cos(l.yaw))*propInfo(l.prop).colliders[0].x+Math.round(Math.sin(l.yaw))*propInfo(l.prop).colliders[0].z,l.z-Math.round(Math.sin(l.yaw))*propInfo(l.prop).colliders[0].x+Math.round(Math.cos(l.yaw))*propInfo(l.prop).colliders[0].z),`${l.id} is solid`);
}
// No two landmarks overlap, except a parked vehicle or a log beside another prop's yard.
for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert(!overlaps(rects[i].r,rects[j].r),`${rects[i].l.id} and ${rects[j].l.id} do not overlap`);
// Plot buildings stand inside their plot; houses keep a front yard of at least 2 m and the front faces the street the plot faces.
const facingYaw={south:0,north:Math.PI,east:Math.PI/2,west:-Math.PI/2};
for(const {l,r} of rects.filter(x=>x.l.plot)){const plot=MAP.reserved.find(p=>p.id===l.plot);assert(inside(r,plot),`${l.id} stands inside its plot ${l.plot}`);
 assert(Math.abs(Math.sin(l.yaw-facingYaw[plot.facing]))<1e-9&&Math.abs(Math.cos(l.yaw-facingYaw[plot.facing])-1)<1e-9,`${l.id} faces ${plot.facing}, like its plot`);
 const yard=plot.facing==='south'?plot.z1-r.z1:plot.facing==='north'?r.z0-plot.z0:0;assert(!/^house-/.test(l.prop)||plot.facing!=='south'&&plot.facing!=='north'||yard>=2,`${l.id} keeps a front yard of ${yard.toFixed(1)} m (shops stand at the pavement)`)}
// Culling: far buildings are not drawn.
{const camera=new THREE.PerspectiveCamera(),s2=new THREE.Scene(),w2=createWorld(s2,{}),at=(x,z)=>w2.update(.016,camera,new THREE.Vector3(x,0,z));
 at(0,0);assert.equal(s2.getObjectByName('prop-barn').visible,false,'the barn is not drawn from the city');assert.equal(s2.getObjectByName('prop-sawmill').visible,false);
 at(-62,-220);assert.equal(s2.getObjectByName('prop-barn').visible,true,'but is drawn from the farm road');assert.equal(s2.getObjectByName('prop-sawmill').visible,false);at(104,-250);assert.equal(s2.getObjectByName('prop-sawmill').visible,true)}
// The signpost at the fork.
{const sign=MAP.signs[0];assert.equal(sign.zone,'county');assert(world.blocked(sign.x,sign.z),'the post is solid');assert.deepEqual(sign.boards.map(b=>b.text),['← WILLOW FIELDS','PINE RIDGE →'])}
// The sawmill is solid: flood-fill from open ground around it and the deck, posts and machinery cannot be reached (you cannot walk through it).
{const sawmill=MAP.landmarks.find(l=>l.id==='sawmill'),info=propInfo('sawmill'),step=.5,x0=info.footprint.x0-3,x1=info.footprint.x1+3,z0=info.footprint.z0-3,z1=info.footprint.z1+3,nx=Math.round((x1-x0)/step)+1,nz=Math.round((z1-z0)/step)+1;
 const blockedAt=(i,j)=>world.blocked(sawmill.x+x0+i*step,sawmill.z+z0+j*step),seen=new Uint8Array(nx*nz),queue=[[0,0]];seen[0]=1;
 while(queue.length){const [i,j]=queue.pop();for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz||seen[b*nx+a]||blockedAt(a,b))continue;seen[b*nx+a]=1;queue.push([a,b])}}
 let deckOpen=0,deckReached=0,blocked=0;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=x0+i*step,z=z0+j*step,f=info.floor;if(blockedAt(i,j)){if(x>=f.x0&&x<=f.x1&&z>=f.z0&&z<=f.z1)blocked++}else if(x>=f.x0+.5&&x<=f.x1-.5&&z>=f.z0+.5&&z<=f.z1-.5){deckOpen++;if(seen[j*nx+i])deckReached++}}
 assert(blocked>100,'posts, rails and machinery are solid ('+blocked+' cells on the deck)');assert(deckReached<=deckOpen*.25,'only the north-east corner of the deck can be walked onto, not the machinery: '+deckReached+' of '+deckOpen+' open deck cells are reachable from outside');
 const f=info.floor;assert.equal(world.floorAt(sawmill.x+(f.x0+f.x1)/2,sawmill.z+(f.z0+f.z1)/2),f.y,'standing on the deck');assert.equal(world.floorAt(sawmill.x+30,sawmill.z),null,'and not beside it');const barn=MAP.landmarks.find(l=>l.id==='farm-barn');assert.equal(world.floorAt(barn.x,barn.z),null,'the barn has no deck')}
// Cedar Heights: doors face the road with a clear approach; the homes' yards and the road stay open.
for(const {l} of rects.filter(x=>x.l.plot&&/^house-/.test(x.l.prop))){const plot=MAP.reserved.find(p=>p.id===l.plot),info=propInfo(l.prop),s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),front=[l.x+info.door.x*c+info.door.z*s,l.z-info.door.x*s+info.door.z*c];
 for(const d of [1,2,3]){const x=front[0]+s*d,z=front[1]+c*d;assert(!world.blocked(x,z),`${l.id}: you can stand ${d} m in front of the door`)}assert(plot.path.x0<front[0]&&front[0]<plot.path.x1,`${l.id}: the front path leads to the door`)}
console.log(`Props: ${Object.keys(EXPECT).length} converted models (${triangles} triangles in all: 12 houses and 9 shops and offices, the farm set, the timber yard, nine vehicles and 24 pieces of furniture), every landmark inside its zone and plot, clear of roads and of each other, solid with open yards, houses facing their street; the sawmill (solid posts, a 0.54 m deck) and the culling.`);
