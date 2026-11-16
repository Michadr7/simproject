import assert from 'node:assert/strict';
import {MAP,validateMap,waterAt,polyDistance} from '../dist/map-definition.js';
import {buildTerrain,validateTerrain,SURFACE} from '../dist/terrain.js';

// Basin walkability: the terrain mask paints lakes and waterfall pools as unwalkable water (the shipped map has no lake yet, so this uses a test map with one lake and one fall).
const S=SURFACE;
const lake={id:'t-lake',outline:[[560,-640],[760,-640],[790,-540],[740,-460],[600,-460],[540,-540]],y:-.9,depth:2.5,shore:25};
const fall={id:'t-fall',lip:{x:850,z:-900,y:20},drop:6,w:6,dir:[0,1],pool:{r:6}};
const map={...MAP,water:{...MAP.water,lakes:[lake],falls:[fall]}};
assert.deepEqual(validateMap(MAP),[],'the real map is valid');
const win={x0:500,x1:900,z0:-950,z1:-420};
const T=buildTerrain(map,{window:win}),P=buildTerrain(MAP,{window:win});

// the lake: water and unwalkable inside the outline, walkable grass just outside it
assert.equal(T.surfaceAt(660,-550),S.WATER);assert.ok(!T.walkable(660,-550),'the middle is not walkable');
assert.ok(!T.walkable(570,-540)&&!T.walkable(745,-480),'cells just inside the outline are not walkable');
assert.ok(T.walkable(530,-600)&&T.surfaceAt(530,-600)===S.GRASS,'the shore outside the outline is walkable grass');
assert.ok(T.walkable(660,-455),'the south bank (outside the outline) is walkable');
// every cell inside the outline agrees with waterAt (kind lake) and no walkable cell is water
let wet=0,bad=0;for(let x=520;x<800;x+=2)for(let z=-660;z<-440;z+=2){const w=waterAt(x,z,map);if(w?.kind==='lake'&&polyDistance(lake.outline,x,z)>=1){wet++;if(T.walkable(x,z))bad++}}
assert.ok(wet>9000,'the lake is big: '+wet);assert.equal(bad,0,'no lake cell is walkable');
// the same place without the lake is open grass
assert.ok(P.walkable(660,-550)&&P.surfaceAt(660,-550)!==S.WATER,'without the lake data the basin is open ground');
// the shipped map is unchanged by the new step
assert.equal(buildTerrain(MAP).walk.reduce((a,b)=>a+b,0),buildTerrain({...MAP,water:{...MAP.water,lakes:[],falls:[]}}).walk.reduce((a,b)=>a+b,0),'no lake, no fall: same walkable cell count');

// the fall: pool and curtain are water, the ground beside them is not
assert.equal(T.surfaceAt(850,-894),S.WATER);assert.ok(!T.walkable(850,-894),'pool centre');
assert.equal(T.surfaceAt(850,-899),S.WATER);assert.ok(!T.walkable(850,-899),'curtain');
assert.ok(T.walkable(850+9,-894)&&T.walkable(850-9,-894),'beside the pool is walkable');
assert.ok(P.walkable(850,-894),'no fall data, no pool');

// a bridge deck still wins over water, and the sea/river passes keep working
const wb=MAP.water.bridges.find(b=>b.id==='estuary-bridge'),C=buildTerrain(map,{window:{x0:80,x1:170,z0:380,z1:420}});
assert.equal(C.surfaceAt((wb.x0+wb.x1)/2,400),S.BRIDGE);

// validateTerrain stays quiet about walkable water
const probs=validateTerrain(T,map).filter(p=>p.startsWith('walkable water'));assert.deepEqual(probs,[]);
console.log('PASS basin-walk: lake and fall pool masks ('+wet+' lake samples all unwalkable)');
