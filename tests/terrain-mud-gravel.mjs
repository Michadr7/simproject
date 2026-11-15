import assert from 'node:assert/strict';
import {MAP,validateMap} from '../dist/map-definition.js';
import {buildTerrain,SURFACE,FOOTING,MINIMAP_COLOUR} from '../dist/terrain.js';
import {SURFACE_LABEL,surfaceSpeed,CLASSES} from '../dist/vehicle.js';
import {SURFACE_SPEED_BY_GROUP,GRIP,ROLL_DRAG,GROUPS,gripOf,rollDragOf} from '../dist/surface-table.js';

// TR3: the MUD surface as real map data (map.mud) and the GRAVEL surface (table rows, validateMap, mask); no road uses gravel yet.
const S=SURFACE;
assert.deepEqual(validateMap(MAP),[],'the real map is valid');
assert.equal(S.GRAVEL,15);
assert.ok(MAP.mud.length>=3&&MAP.mud.length<=5,'3 to 5 mud patches');

// 1. Mud patches rasterise to MUD, and nothing else on the map changed.
const t=buildTerrain(MAP),dry=buildTerrain({...MAP,mud:[]});
const inPatch=(x,z)=>MAP.mud.some(m=>x>=m.x0&&x<=m.x1&&z>=m.z0&&z<=m.z1);
for(const m of MAP.mud){const x=(m.x0+m.x1)/2,z=(m.z0+m.z1)/2;assert.equal(t.surfaceAt(x,z),S.MUD,`${m.id} is mud at its centre`);assert.ok(t.walkable(x,z),`${m.id} stays walkable`);
 assert.notEqual(dry.surfaceAt(x,z),S.MUD);assert.equal(t.footingAt(x,z),FOOTING[S.MUD])}
let changed=0,muddy=0;
for(let i=0;i<t.surface.length;i++){if(t.surface[i]===S.MUD)muddy++;if(t.surface[i]!==dry.surface[i]){changed++;assert.equal(t.surface[i],S.MUD,'only mud cells differ from the dry map');
 assert.ok(inPatch(t.x0+((i%t.cols)+.5)*t.cell,t.z0+(Math.floor(i/t.cols)+.5)*t.cell),'and only inside a patch')}
 assert.equal(t.walk[i],dry.walk[i],'walkability is unchanged everywhere')}
assert.ok(changed>0&&muddy===changed||muddy>=changed,'mud cells exist');
for(const m of MAP.mud){const w=m.x1-m.x0,d=m.z1-m.z0;assert.ok(w>=2&&w<=16&&d>=2&&d<=16,`${m.id} is small (${w} x ${d} m)`)}
// the river bank stays blocked and unpainted by mud
for(let i=0;i<t.surface.length;i++)if(t.surface[i]===S.BANK)assert.equal(t.walk[i],0,'bank stays blocked');

// 2. Label, colour, footing; gravel too.
assert.equal(SURFACE_LABEL[S.MUD],'Mud');assert.equal(SURFACE_LABEL[S.GRAVEL],'Gravel');
assert.equal(MINIMAP_COLOUR[S.MUD],'#5b4630');assert.ok(MINIMAP_COLOUR[S.GRAVEL]);
assert.ok(FOOTING[S.MUD]!=null&&FOOTING[S.GRAVEL]!=null);

// 3. Gravel table rows sit between dirt and road for every group.
for(const g of GROUPS){const d=SURFACE_SPEED_BY_GROUP[S.DIRT][g],v=SURFACE_SPEED_BY_GROUP[S.GRAVEL][g],r=SURFACE_SPEED_BY_GROUP[S.ROAD][g];assert.ok(v>=d&&v<=r,`gravel speed for ${g} is between dirt and road`);
 assert.ok(rollDragOf(S.GRAVEL,g)<=rollDragOf(S.DIRT,g)&&rollDragOf(S.GRAVEL,g)>=rollDragOf(S.ROAD,g));
 assert.ok(gripOf(S.GRAVEL,g)>=gripOf(S.DIRT,g)&&gripOf(S.GRAVEL,g)<=gripOf(S.ROAD,g),`gravel grip for ${g}`)}
assert.deepEqual(SURFACE_SPEED_BY_GROUP[S.GRAVEL],{road:.9,offroad:1,heavy:.85,atv:1,fork:.6});
assert.equal(GRIP[S.GRAVEL],.85);assert.equal(ROLL_DRAG[S.GRAVEL],.2);
assert.equal(surfaceSpeed(S.GRAVEL,CLASSES.shortbed),.9);assert.equal(surfaceSpeed(S.GRAVEL,{}),.9);

// 4. validateMap: gravel roads are accepted; bad mud is reported.
const withRoad=surface=>({...MAP,roads:{...MAP.roads,edges:MAP.roads.edges.map(e=>e.id==='woods-lane'?{...e,surface}:e)}});
assert.deepEqual(validateMap(withRoad('gravel')),[],'a gravel road is valid');
assert.ok(validateMap(withRoad('cobbles')).some(p=>/unknown surface/.test(p)));
const bad=m=>validateMap({...MAP,mud:[...MAP.mud,{id:'bad',...m}]}).filter(p=>/mud patch bad/.test(p));
assert.ok(bad({x0:-166,x1:-156,z0:-231,z1:-229}).some(p=>/centre line/.test(p)),'mud on a road centre line');
assert.ok(bad({x0:-20,x1:-10,z0:-20,z1:-10}).some(p=>/building/.test(p)),'mud on a building');
assert.ok(bad({x0:-100,x1:-90,z0:-160,z1:-150}).some(p=>/water/.test(p)),'mud in the river');
assert.ok(bad({x0:130,x1:132,z0:-25,z1:-21}).some(p=>/overlap/.test(p)),'overlapping patches');
assert.ok(bad({x0:0,x1:1,z0:0,z1:1}).some(p=>/2 to 16/.test(p)),'a tiny patch');
console.log('mud and gravel ok:',MAP.mud.length,'patches,',muddy,'cells');