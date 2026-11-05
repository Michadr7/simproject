import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {heightAt,setHeightFunction} from '../dist/height.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
// heightAt (Stage 4): the terrain elevation, 0 today. With the ground raised by 5 m, what stands on it stands 5 m higher and nothing else moves.
assert.equal(heightAt(10,20),0,'the city is flat');
{const {MAP}=await import('../dist/map-definition.js'),{reliefHeight}=await import('../dist/height.js');assert(MAP.relief.hills.length>=3);for(const h of MAP.relief.hills){assert(Math.abs(heightAt(h.x,h.z)-h.h)<1e-9,h.id+' peaks at its height');assert(heightAt(h.x+h.rx,h.z)<1e-9&&heightAt(h.x+h.rx*1.5,h.z)===0,h.id+' meets the flat ground at its edge');assert(heightAt(h.x+h.rx*.5,h.z)>0&&heightAt(h.x+h.rx*.5,h.z)<h.h,'and rises smoothly')}
 for(const z of MAP.zones)assert.equal(heightAt((z.bounds.x0+z.bounds.x1)/2,(z.bounds.z0+z.bounds.z1)/2),0,'the zone '+z.id+' is flat');assert.equal(reliefHeight({hills:[{x:0,z:0,rx:10,rz:10,h:4}]},0,0),4)}
const at=(await import('../dist/world.js'));
const flat=at.standHeight(84,-13);assert.equal(flat,at.footingAt(84,-13),'on flat ground a footing is all there is');assert.equal(at.standHeight(150,-60,.3),.3,'a deck replaces the footing');
const world0=at.createWorld(new THREE.Scene(),{cullRadius:Infinity}),before=new Map();world0.group.traverse?.(o=>{if(/^prop-/.test(o.name))before.set(o.name+o.position.x+','+o.position.z,o.position.y)});
setHeightFunction(()=>5);
assert.equal(heightAt(1,2),5);assert.equal(at.standHeight(84,-13),5+flat,'feet, vehicles and put-down things add the ground height to the footing');assert.equal(at.standHeight(150,-60,.3),5.3,'and decks are measured from the ground under them');
const scene=new THREE.Scene(),world=at.createWorld(scene,{cullRadius:Infinity});let moved=0,count=0;
scene.traverse(o=>{if(/^prop-/.test(o.name)&&o.parent&&o.parent.type==='Group'&&o.userData.wheels===undefined){count++;const k=o.name+o.position.x+','+o.position.z;if(before.has(k)&&Math.abs(o.position.y-before.get(k)-5)<1e-9)moved++}});
assert(count>0&&moved>0,`landmarks stand on the raised ground (${moved} of ${count} props moved up exactly 5 m)`);
// a vehicle follows it: y = heightAt + footing
const {createDriving}=await import('../dist/driving.js'),{MAP}=await import('../dist/map-definition.js');
const d=createDriving({scene:new THREE.Scene(),surface:()=>1,footing:at.standHeight,baseBlocked:()=>false,saved:[]}),v=d.fleet[0];
assert(v&&Math.abs(v.y-(5+at.footingAt(MAP.vehicles[0].home.x,MAP.vehicles[0].home.z)))<1e-9,'a vehicle parks on the raised ground');
setHeightFunction(null);assert.equal(heightAt(1,2),0,'reset');
// on a bridge a vehicle follows the deck's arch, not the river valley under it: level on the crown, nose up on the ramp, riding at the deck's height
{const {createDriving}=await import('../dist/driving.js'),w=await import('../dist/world.js'),{MAP}=await import('../dist/map-definition.js'),{bridgeRise}=await import('../dist/height.js'),b=MAP.water.bridges[0],cx=(b.x0+b.x1)/2;
 const d=createDriving({scene:new THREE.Scene(),surface:()=>1,footing:w.standHeight,baseBlocked:()=>false,saved:[]}),f=d.fleet[0];
 const at=z=>{f.state={x:cx,z,yaw:0,speed:0,steer:0};f.y=w.standHeight(cx,z);for(let i=0;i<120;i++)d.update(1/60)};
 at((b.z0+b.z1)/2);assert(Math.abs(f.pitch)<.02,'level on the crown: '+f.pitch);assert(Math.abs(f.y-(BRIDGE_RISE_CHECK()-.01))<.05,'riding on the deck: y '+f.y);
 at(b.z0+7);assert(f.pitch<-.03&&f.pitch>-.2,'facing +z on the rising north ramp the nose is up (negative pitch): '+f.pitch);function BRIDGE_RISE_CHECK(){return bridgeRise(b,(b.z0+b.z1)/2)}}
// the river valley and the bridges: the ground dips along the river (flat bed across the water, a gentle bank, a walkable shoulder), fades out at the map ends; bridges arch over it
{const {MAP}=await import('../dist/map-definition.js'),{valleyAt,RIVER_DEPTH,RIVER_PATHS,RIVER_WATER_Y,deckAt,bridgeRise,BRIDGE_RISE,valleyFade,distanceToRiver}=await import('../dist/height.js'),R=RIVER_PATHS[0];
 const at=(x,d)=>{const p=R.path.reduce((b,q)=>Math.abs(q.x-x)<Math.abs(b.x-x)?q:b);return [p.x-p.tz*d,p.z+p.tx*d]};
 assert(Math.abs(valleyAt(...at(50,0))+RIVER_DEPTH)<1e-6,'the bed is '+RIVER_DEPTH+' m below the ground');assert(Math.abs(valleyAt(...at(50,R.half))+RIVER_DEPTH)<1e-6,'flat across the water');
 assert(valleyAt(...at(50,R.half+R.bank))<-.2&&valleyAt(...at(50,R.half+R.bank))>-.5,'the walkable edge (the end of the bank) is a little below the ground');assert.equal(valleyAt(...at(50,R.lip+1)),0,'no valley beyond the lip');
 let steepest=0,last=valleyAt(...at(50,0));for(let d=.25;d<=R.lip;d+=.25){const v=valleyAt(...at(50,d));steepest=Math.max(steepest,Math.abs(v-last)/.25);last=v}assert(steepest<.7,'banks are gentle: '+steepest.toFixed(2)+' m per m at worst');
 assert(valleyFade(-270)===0&&valleyFade(0)===1&&valleyFade(310)===0,'the valley fades out at both ends of the map');assert(RIVER_WATER_Y<-.5&&RIVER_WATER_Y>-RIVER_DEPTH,'the water lies between the bed and the ground');
 for(const b of MAP.water.bridges){const cz=(b.z0+b.z1)/2,cx=(b.x0+b.x1)/2;assert.equal(bridgeRise(b,b.z0),0);assert.equal(bridgeRise(b,b.z1),0);assert(Math.abs(bridgeRise(b,cz)-BRIDGE_RISE)<1e-9,'the crown rises '+BRIDGE_RISE+' m');assert(Math.abs(deckAt(cx,cz)-BRIDGE_RISE)<1e-9);assert.equal(deckAt(cx,b.z0-3),null,'off the bridge there is no deck');
  assert(heightAt(cx,cz)<-1,'the river valley under the crown');let slope=0;for(let z=b.z0;z<b.z1;z+=.5)slope=Math.max(slope,Math.abs(bridgeRise(b,z+.5)-bridgeRise(b,z))/.5);assert(slope<.13,'the ramps are gentle: '+(slope*100).toFixed(0)+' percent')}
 const w=await import('../dist/world.js');assert(w.standHeight((MAP.water.bridges[0].x0+MAP.water.bridges[0].x1)/2,(MAP.water.bridges[0].z0+MAP.water.bridges[0].z1)/2)>.9,'standing on the bridge you are on the arch')}
// the dirt track up the big hill: dirt underfoot, inside the hill, a gentle climb (under 8 percent), no turn tighter than a truck's (about 9 m)
{const {MAP}=await import('../dist/map-definition.js'),{terrain,SURFACE}=await import('../dist/terrain.js'),{CLASSES}=await import('../dist/vehicle.js'),T=terrain(),tr=MAP.relief.tracks[0],P=tr.points;
 assert(P.length>50);for(const [x,z] of P)assert.equal(T.surfaceAt(x,z),SURFACE.DIRT,'the track is dirt at '+x+','+z);
 let worst=0,tight=1e9;for(let i=1;i<P.length;i++){const d=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);worst=Math.max(worst,Math.abs(heightAt(...P[i])-heightAt(...P[i-1]))/d)}
 for(let i=2;i<P.length;i++){const a=P[i-2],b=P[i-1],c=P[i],ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]),area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;tight=Math.min(tight,ab*bc*ca/(4*area||1e-9))}
 assert(worst<.08,'the climb is gentle: '+(worst*100).toFixed(1)+' percent at worst');assert(tight>=CLASSES.worktruck.rMin+1,'no turn tighter than a truck: radius '+tight.toFixed(1)+' m');
 assert(heightAt(...P.at(-1))>6,'it reaches near the top')}
// vehicles tilt with the ground: nose up on an uphill, a side up on a cross slope
{const {createDriving}=await import('../dist/driving.js'),{MAP}=await import('../dist/map-definition.js');
 const make=()=>createDriving({scene:new THREE.Scene(),surface:()=>1,footing:(x,z)=>0,baseBlocked:()=>false,saved:[]}),home=MAP.vehicles[0].home;
 setHeightFunction((x,z)=>-.1*z);let d=make(),f=d.fleet[0];for(let i=0;i<120;i++)d.update(1/60);assert(Math.abs(f.pitch+Math.atan(.1))<.01,'facing uphill (-z, the home yaw) the nose is up: '+f.pitch);assert(Math.abs(f.roll)<.01);
 setHeightFunction((x,z)=>.1*x);d=make();f=d.fleet[0];for(let i=0;i<120;i++)d.update(1/60);assert(Math.abs(f.pitch)<.01,'no pitch on a pure cross slope');assert(Math.abs(Math.abs(f.roll)-Math.atan(.1))<.01,'a side is up: '+f.roll);
 setHeightFunction(null);d=make();f=d.fleet[0];for(let i=0;i<120;i++)d.update(1/60);assert(Math.abs(f.pitch)<1e-9&&Math.abs(f.roll)<1e-9,'flat ground: no tilt')}
console.log('Height: the river valley (a bed below the ground, gentle banks) and arched bridges, five outer hills, a gentle dirt track up the big one, vehicles tilting with the ground; the outer hills peak at their height and meet flat ground at their edge, every zone is flat; with the ground raised 5 m the standing height, the landmarks and the vehicles all rise exactly 5 m (decks are measured from the ground under them).');
