import assert from 'node:assert/strict';
import {MAP,validateMap,nearestRescuePoint,waterAt} from '../dist/map-definition.js';
let n=0;const ok=(c,m)=>{assert(c,m);n++};
const broken=edit=>{const map=structuredClone(MAP);edit(map);return validateMap(map)},has=(p,re)=>ok(p.some(m=>re.test(m)),`expected ${re}, got ${JSON.stringify(p)}`);

// RU2 (map-master 7.3, 7.4): rescue points per region, edge scenery bands, the new validateMap checks.
ok(validateMap(MAP).length===0,'the real map validates with rescue points and edge bands');
const R=Object.fromEntries(MAP.rescuePoints.map(p=>[p.id,p]));
ok(MAP.rescuePoints.length===9,'nine rescue points');
ok(R.ironwood.x===MAP.spawn.x&&R.ironwood.z===MAP.spawn.z,'the Ironwood point is the spawn');
ok(R['kaspian-harbor'].x===340&&R['kaspian-harbor'].z===400&&R['eden-gate'].x===690&&R['eden-gate'].z===-200&&R['lake-car-park'].x===620&&R['lake-car-park'].z===-420&&R.trailhead.x===830&&R.trailhead.z===-720,'design coordinates');
ok(R['camp-c1'].x===760&&R['camp-c2'].x===480&&R['camp-c3'].z===-1040,'camps C1..C3 (same as the hunting keep-outs)');
for(const p of MAP.rescuePoints)ok(waterAt(p.x,p.z,MAP)===null,`${p.id} is dry`);

// lookup
ok(nearestRescuePoint(0,0).id==='ironwood'&&nearestRescuePoint(300,380).id==='kaspian-harbor'&&nearestRescuePoint(700,-180).id==='eden-gate','nearest point');
ok(nearestRescuePoint(800,-1000).id.startsWith('camp-c')&&nearestRescuePoint(640,-430).id==='lake-car-park','nearest point in Blackstone and at the lake');
ok(nearestRescuePoint(0,0,{rescuePoints:[]})===null,'no points gives null');
ok(nearestRescuePoint(-200,-240).id==='husky-farmstead','ranch');

// edge bands
const B=MAP.scenery.edgeBands;
ok(B.length===3,'north, west and east bands (the sea closes the south)');
ok(B.every(b=>b[1]-b[0]===30||b[3]-b[2]===30),'each band is 30 m thick');
const W=MAP.wilds;
ok(B.every(b=>b[0]>=W.x0&&b[1]<=W.x1&&b[2]>=W.z0&&b[3]<=W.z1),'bands lie inside the wilds');

// broken maps
has(broken(m=>{m.rescuePoints.push({...m.rescuePoints[0]})}),/duplicate rescue point/);
has(broken(m=>{m.rescuePoints[1].x=5000}),/not a point inside the world/);
has(broken(m=>{m.rescuePoints[1].z=NaN}),/not a point inside the world/);
has(broken(m=>{m.rescuePoints[1].z=560;m.rescuePoints[1].x=300}),/water/);
has(broken(m=>{const b=m.buildings[0];m.rescuePoints[0]={...m.rescuePoints[0],x:b.x,z:b.z}}),/building/);
has(broken(m=>{m.rescuePoints=m.rescuePoints.filter(p=>p.id!=='ironwood')}),/no rescue point at the spawn/);
has(broken(m=>{m.scenery.edgeBands.push([0,10,5,5,5.5,.2,1])}),/edge band is not a valid/);
has(broken(m=>{m.scenery.edgeBands.push([-500,-400,0,50,5.5,.2,1])}),/outside the wilds/);
has(broken(m=>{m.scenery.edgeBands.push([0,30,0,30,5.5,.2,1])}),/lies on a zone/);
has(broken(m=>{m.scenery.edgeBands.push([820,840,-730,-710,5.5,.2,1])}),/covers a rescue point/);
console.log(`PASS rescue-ru2 (${n} checks)`);
