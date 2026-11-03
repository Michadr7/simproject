import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,worldLayout,DIRT_ROADS} from '../dist/world.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import {terrain} from '../dist/terrain.js';
import {propInfo} from '../dist/props.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};

// Where the rigged sawmill stands in Pine Ridge: the map's own coordinates (no retyped numbers), the whole bounds clear of trees, roads, reserved land and the rest of the yard.
assert.deepEqual(validateMap(MAP),[]);
const sawmill=MAP.landmarks.find(l=>l.id==='sawmill'),info=propInfo(sawmill.prop),f=info.footprint,c=Math.round(Math.cos(sawmill.yaw)),s=Math.round(Math.sin(sawmill.yaw));
assert.equal(sawmill.prop,'sawmill-v4');assert.equal(sawmill.x,104);assert.equal(sawmill.z,-278,'still where the old sawmill stood (104, n(-208))');
const toWorld=(x,z)=>[sawmill.x+x*c+z*s,sawmill.z-x*s+z*c],toModel=(x,z)=>[(x-sawmill.x)*c-(z-sawmill.z)*s,(x-sawmill.x)*s+(z-sawmill.z)*c];
const corners=[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]].map(([x,z])=>toWorld(x,z)),R={x0:Math.min(...corners.map(p=>p[0])),x1:Math.max(...corners.map(p=>p[0])),z0:Math.min(...corners.map(p=>p[1])),z1:Math.max(...corners.map(p=>p[1]))};
const gap=(a,b)=>Math.max(b.x0-a.x1,a.x0-b.x1,b.z0-a.z1,a.z0-b.z1); // distance between two axis-aligned rectangles (negative: they overlap)

// 1. Inside the forest zone and its sawmill clearing (an ellipse), with room to spare.
const forest=MAP.zones.find(z=>z.id==='forest').bounds,clearing=MAP.scenery.forest.clearings.find(e=>e.x===106);
assert(R.x0>forest.x0&&R.x1<forest.x1&&R.z0>forest.z0&&R.z1<forest.z1,'inside Pine Ridge');
for(const [x,z] of corners)assert(((x-clearing.x)/clearing.rx)**2+((z-clearing.z)/clearing.rz)**2<1,`corner (${x.toFixed(1)}, ${z.toFixed(1)}) is inside the clearing`);

// 2. No generated tree (cuttable pine or decor) within the full bounds, with the same 1 m margin the world uses for props, and none inside a collider.
{const layout=worldLayout(),trees=[...layout.cuttable,...layout.decor];let nearest=1e9;
 for(const t of trees){const [lx,lz]=toModel(t.x,t.z);nearest=Math.min(nearest,Math.max(f.x0-lx,lx-f.x1,f.z0-lz,lz-f.z1));
  assert(!(lx>f.x0-1&&lx<f.x1+1&&lz>f.z0-1&&lz<f.z1+1),`a tree stands at (${t.x.toFixed(1)}, ${t.z.toFixed(1)}), inside the sawmill's bounds`)}
 console.log(`  nearest tree to the sawmill's bounds: ${nearest.toFixed(1)} m (${trees.length} trees checked)`)}

// 3. Walkability: the whole footprint is open walkable country, and the world's colliders block exactly the solid parts.
const T=terrain(),scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
for(let x=R.x0;x<=R.x1;x+=.5)for(let z=R.z0;z<=R.z1;z+=.5)assert(T.walkable(x,z),`(${x},${z}) is walkable ground`);
for(const b of info.colliders){const [x,z]=toWorld(b.x,b.z);assert(world.blocked(x,z),`collider at model (${b.x}, ${b.z}) blocks`)}
{const open=[[0,2],[-2,2],[-6.75,-1.5],[6.4,2.8]].map(([x,z])=>toWorld(x,z));for(const [x,z] of open)assert(!world.blocked(x,z),`(${x.toFixed(1)}, ${z.toFixed(1)}) is open`)} // in front of the bench, beside the pile, beside the belt

// 4. The yard around it: the woods road, the lane, the hut, the logs and the flatbed are clear, nothing reserved is under it.
const rect=l=>{const p=propInfo(l.prop).footprint,pts=[[p.x0,p.z0],[p.x1,p.z0],[p.x0,p.z1],[p.x1,p.z1]].map(([x,z])=>[l.x+x*Math.round(Math.cos(l.yaw))+z*Math.round(Math.sin(l.yaw)),l.z-x*Math.round(Math.sin(l.yaw))+z*Math.round(Math.cos(l.yaw))]);return {x0:Math.min(...pts.map(q=>q[0])),x1:Math.max(...pts.map(q=>q[0])),z0:Math.min(...pts.map(q=>q[1])),z1:Math.max(...pts.map(q=>q[1]))}};
const gaps={};
for(const l of MAP.landmarks.filter(l=>l.zone==='forest'&&l.id!==sawmill.id)){gaps[l.id]=gap(R,rect(l));assert(gaps[l.id]>=5,`${l.id} is ${gaps[l.id].toFixed(1)} m from the sawmill (need 5 m of yard)`)}
for(const road of DIRT_ROADS){const g=gap(R,road);gaps[road.id||'road']=Math.min(gaps[road.id||'road']??1e9,g);assert(g>=5,`the dirt road (${road.id||'unnamed'}) is ${g.toFixed(1)} m away`)}
const reservedHere=(MAP.reserved||[]).filter(p=>gap(R,p)<0);assert.equal(reservedHere.length,0,'no reserved plot is under the sawmill (Pine Ridge reserves none)');
assert.equal((MAP.reserved||[]).filter(p=>MAP.zones.find(z=>z.id==='forest')&&p.x0>=forest.x0&&p.x1<=forest.x1&&p.z0>=forest.z0&&p.z1<=forest.z1).length,0,'Pine Ridge has no reserved log-pile or truck-bay land to clash with');

// 5. Orientation: the front (+z, switch and player) faces west to the lane, the belt-clearing end faces east to the yard, the log feed is on the open north side. Each stands on open ground.
{const at=name=>toWorld(info.anchors[name][0],info.anchors[name][2]);
 const dir=(a,b)=>{const [ax,az]=at(a),[bx,bz]=at(b);return [bx-ax,bz-az]};
 assert(toWorld(0,1)[0]<toWorld(0,0)[0],'the model\'s front (+z) points west');
 assert(at('anchor_belt_clear')[0]>at('anchor_belt_0')[0],'the belt is cleared at its east end, slot 0 (where planks land) is at the west end');
 assert(at('anchor_belt_clear')[1]>at('anchor_plank_out')[1],'the planks leave the bench on its north side, the belt end is south of it');
 assert(at('anchor_log_in')[1]<sawmill.z,'logs are fed in on the north side');
 const lane=DIRT_ROADS.find(r=>r.id==='woods-lane'),road=DIRT_ROADS.find(r=>r.id==='woods-road');
 console.log(`  yaw ${sawmill.yaw.toFixed(3)} rad; front (switch) ${at('anchor_switch').map(v=>v.toFixed(1))}, belt clear ${at('anchor_belt_clear').map(v=>v.toFixed(1))}, log in ${at('anchor_log_in').map(v=>v.toFixed(1))}`);
 console.log('  gaps (m):',Object.entries(gaps).map(([k,v])=>`${k} ${v.toFixed(1)}`).join(', '))}
console.log('Sawmill placement: at the old sawmill\'s map position, turned -90 degrees, the whole bounds inside Pine Ridge\'s clearing, no trees, walkable, 5 m or more from the roads, the hut, the logs and the flatbed; nothing reserved in the way.');
