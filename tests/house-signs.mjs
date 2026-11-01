// "For rent or sale" signs: where they stand, what they say, and that they go away when you take the house and come back when you leave it.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {doorOf} from '../dist/properties.js';
import {terrain,SURFACE} from '../dist/terrain.js';
import {createWorld,isWalkable} from '../dist/world.js';
import {createHouseSigns,signLines,findSignSpot} from '../dist/house-signs.js';
import {propertyTransaction} from '../dist/ownership.js';
import {bootGame} from './support/boot-game.mjs';
const drawn=[];globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(_,k)=>k==='fillText'?(...a)=>drawn.push(a[0]):()=>{}})})};

const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity}),T=terrain();
const solids=[],blocked=(x,z)=>!isWalkable(x,z)||world.blocked(x,z)||solids.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33);
const listed=MAP.properties.filter(p=>p.listing&&!p.owner),houses=createHouseSigns({scene,properties:MAP.properties,doorOf,surfaceAt:(x,z)=>T.surfaceAt(x,z),GRASS:SURFACE.GRASS,blocked,solids});
assert.deepEqual(listed.map(p=>p.id),['house-r1','house-r3','house-r5','house-r7'],'four houses are for rent or sale');
assert.deepEqual(houses.signs.map(s=>s.id),listed.map(p=>p.id),'each gets a sign, and the houses with residents do not');
for(const s of houses.signs){
 const property=MAP.properties.find(p=>p.id===s.id),door=doorOf(property),plot=MAP.reserved.find(r=>r.id===property.plot);
 assert.equal(T.surfaceAt(s.x,s.z),SURFACE.GRASS,`${s.id}: on grass`);
 for(const area of [plot.driveway,plot.path])if(area)assert(!(s.x>area.x0-1.1&&s.x<area.x1+1.1&&s.z>area.z0-1.1&&s.z<area.z1+1.1),`${s.id}: clear of the driveway and the front path`);
 const dx=s.x-door.x,dz=s.z-door.z;assert(Math.hypot(dx,dz)<8&&Math.hypot(dx,dz)>2,`${s.id}: a few metres from its own door (${Math.hypot(dx,dz).toFixed(1)} m)`);assert(dx*door.faceX+dz*door.faceZ>2,`${s.id}: in front of the house, not beside or behind it`);
 const board=s.group.children[1];assert(board.isMesh&&Array.isArray(board.material),'a board with a lettered face');
 const out=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0),s.group.rotation.y);assert(out.x*door.faceX+out.z*door.faceZ>.99,`${s.id}: the lettering faces the street`);
 assert(solids.includes(s.solid)&&s.solid.hx>0,`${s.id}: the post is solid`)}
// what it says
{const p=MAP.properties.find(x=>x.id==='house-r1'),l=signLines(p);assert.equal(l.address,'1 CEDAR LOOP');assert.equal(l.head,'FOR RENT OR SALE');assert.match(l.rent,/Rent \$160 a week .* deposit \$320/);assert.equal(l.buy,'Buy $12,500');assert.match(l.foot,/Homes app/);
 assert(drawn.includes('1 CEDAR LOOP')&&drawn.includes('FOR RENT OR SALE')&&drawn.includes('Buy $12,500'),'and it is drawn on the board')}
// held homes hide their sign (and its post stops being solid); the rest stay
houses.sync(['house-r3']);const by=id=>houses.signs.find(s=>s.id===id);
assert.equal(by('house-r3').group.visible,false);assert.equal(by('house-r1').group.visible,true);assert(by('house-r3').solid.hx<0&&by('house-r1').solid.hx>0);
assert(!blocked(by('house-r3').x,by('house-r3').z),'you can walk where the taken house\'s sign stood');
houses.sync([]);assert(houses.signs.every(s=>s.group.visible&&s.solid.hx>0),'let go of it and the sign is back');
// a house with no grass anywhere near its door gets no sign rather than a bad one
assert.equal(findSignSpot({x:0,z:0,faceX:0,faceZ:1},{surfaceAt:()=>SURFACE.STREET,GRASS:SURFACE.GRASS,blocked:()=>false}),null);

// ── In the game: renting and leaving, through the real transactions
const g=await bootGame(),S=g.GameState,sign=id=>g.scene().getObjectByName('house-sign-'+id);
for(const id of ['house-r1','house-r3','house-r5','house-r7'])assert(sign(id)?.visible,id+' has its sign in the world');assert.equal(sign('house-r2'),undefined,'a resident\'s house does not');
S.progress={...S.progress,cash:5_000_000};let r=propertyTransaction(S.progress,'rent','house-r1');assert(!r.error,r.error);S.progress=r.state;g.pump(.1);
assert.equal(sign('house-r1').visible,false,'rent it and its sign is gone');assert(sign('house-r3').visible,'the others stay');
r=propertyTransaction(S.progress,'buy','house-r5');assert(!r.error,r.error);S.progress=r.state;g.pump(.1);assert.equal(sign('house-r5').visible,false,'buy another and that sign goes too');
r=propertyTransaction(S.progress,'leave','house-r1');assert(!r.error,r.error);S.progress=r.state;g.pump(.1);assert(sign('house-r1').visible,'move out and the sign is back');assert.equal(sign('house-r5').visible,false);
await g.done();
console.log('House signs: four listed houses each have a sign on grass in front, clear of the driveway and path, facing the street, with the address, rent and deposit, and price; houses with residents have none; a sign (and its post) goes when you rent or buy the house and returns when you leave it, in the real game.');
process.exit(0);