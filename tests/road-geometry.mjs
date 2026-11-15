// R2: road heights over relief and water, per real chunk (pure data). The shipped map's roads stay flat at 0; synthetic maps carry hills, a bridge, a ford and a lake.
import assert from 'node:assert/strict';
import {MAP,validateMap,roadChunkPieces} from '../dist/map-definition.js';
import {heightAt,deckAt,BRIDGE_RISE,bridgeRise} from '../dist/height.js';
import {CHUNK,FRAME,chunkBounds} from '../dist/chunks.js';
import {roadHeightAt,roadProfile,roadChunkGeometry,roadGradeAt,roadGeometryProblems,subdividePolyline,ROAD_STEP,ROAD_SHOULDER,MAX_ROAD_GRADE} from '../dist/road-geometry.js';

// Shipped map: every road piece sits at y 0 (relief is outside the roads), the old bridges carry the deck arch exactly, no problems
{const P=roadChunkGeometry(MAP);assert(P.length>0);assert.deepEqual(roadGeometryProblems(MAP),[]);
 for(const p of P)for(const q of p.points){const d=deckAt(q.x,q.z);assert(Math.abs(q.y-(d===null?0:d))<1e-9,`${p.edge} ${q.x},${q.z} y ${q.y}`);assert.equal(q.kind==='bridge',d!==null)}
 assert(P.some(p=>p.points.some(q=>q.kind==='bridge'&&Math.abs(q.y-BRIDGE_RISE)<.2)),'a deck crown at about BRIDGE_RISE');
 for(const p of P)assert(p.maxGrade<MAX_ROAD_GRADE,p.edge+' grade '+p.maxGrade);
 assert.deepEqual(validateMap(MAP),[])}

// Real chunk constants: pieces stay inside their chunk, the frame is passed (not the defaults of R1), and the cut points match on both sides
{const P=roadChunkGeometry(MAP,{size:CHUNK,x0:FRAME.x0,z0:FRAME.z0});assert.deepEqual(P.map(p=>p.chunk),roadChunkPieces(MAP,{size:CHUNK,x0:FRAME.x0,z0:FRAME.z0}).map(p=>p.chunk));
 for(const p of P){const b=chunkBounds(p.i,p.j);for(const q of p.points)assert(q.x>=b.x0-1e-6&&q.x<=b.x1+1e-6&&q.z>=b.z0-1e-6&&q.z<=b.z1+1e-6,`${p.edge} ${p.chunk} point outside`)}
 for(let k=1;k<P.length;k++)if(P[k].edge===P[k-1].edge){const a=P[k-1].points.at(-1),b=P[k].points[0];assert(Math.hypot(a.x-b.x,a.z-b.z)<1e-6&&Math.abs(a.y-b.y)<1e-9&&Math.abs(a.s-b.s)<1e-6,'continuous across a chunk border')}
 for(const p of P)for(let k=1;k<p.points.length;k++)assert(Math.hypot(p.points[k].x-p.points[k-1].x,p.points[k].z-p.points[k-1].z)<=ROAD_STEP+1e-6,'step')}
assert.deepEqual(subdividePolyline([[0,0],[10,0]],3).length,5);

// Synthetic map: a hill, a lake, a river with a bridge on a west-east road, a river with a ford on a north-south road
const hill={x:400,z:0,rx:150,rz:150,h:12};
const river={id:'r',bank:2.6,shore:3,points:[{x:200,z:-200,w:14,depth:.8,y:-.95,speed:.6},{x:200,z:200,w:14,depth:.8,y:-.95,speed:.6}]};
const river2={id:'r2',bank:2.6,shore:3,points:[{x:-300,z:-300,w:10,depth:.8,y:-.95,speed:.6},{x:300,z:-300,w:10,depth:.8,y:-.95,speed:.6}]};
const lake={id:'lake',outline:[[700,-100],[800,-100],[800,100],[700,100]],y:-.9,depth:2.5,shore:6};
const bridge={id:'b1',river:'r',axis:'x',x0:190,x1:210,z0:-6,z1:6};
const nodes={a:{x:0,z:0},b:{x:600,z:0},c:{x:-100,z:-400},d:{x:-100,z:-200}};
const edges=[{id:'e1',from:'a',to:'b',width:10,surface:'asphalt'}];
const base={...MAP,relief:{hills:[hill]},roads:{nodes,edges},water:{...MAP.water,rivers:[river,river2],bridges:[bridge],fords:[],lakes:[lake]}};
// hill: the road follows the relief centreline, flat across the width
assert(Math.abs(roadHeightAt(base,400,0).y-12)<1e-9&&roadHeightAt(base,400,0).kind==='ground');
{const pts=roadProfile(base,[[0,0],[600,0]],10);for(const q of pts){assert(Math.abs(q.l[0]-q.r[0])<1e-9);assert.equal(typeof q.y,'number')}
 assert(pts.some(q=>q.y>11.9),'climbs to the hill');assert.equal(pts[0].y,0);assert(Math.abs(pts.at(-1).s-600)<1e-6)}
// bridge: joins the two banks (relief at x 190 and 210), arches BRIDGE_RISE at the middle, 0 extra at the ends
{const rise=x=>roadHeightAt(base,x,0);assert.equal(rise(200).kind,'bridge');assert(Math.abs(rise(200).y-((rise(190).y+rise(210).y)/2+BRIDGE_RISE))<1e-3,'crown');
 assert(Math.abs(rise(190.001).y-rise(189).y)<.05,'meets the road at the west end');assert(Math.abs(rise(209.999).y-rise(211).y)<.05,'meets the road at the east end');
 assert.equal(roadHeightAt(base,200,4).kind,'bridge');assert.equal(roadHeightAt(base,150,0).kind,'ground')}
// the same road without the bridge lies in water: reported
{const bare={...base,water:{...base.water,bridges:[]}};assert.equal(roadHeightAt(bare,200,0).kind,'water');assert(roadGeometryProblems(bare).some(m=>m.includes('lies in water')));
 assert(!roadGeometryProblems(base).some(m=>m.includes('lies in water')),'the bridge carries the road')}
// bridge that carries no road, and a grade over the limit
{const lone={...base,water:{...base.water,bridges:[bridge,{id:'lone',river:'r',axis:'x',x0:190,x1:210,z0:100,z1:112}]}};assert(roadGeometryProblems(lone).some(m=>m.includes('lone carries no road')));
 const steep={...base,relief:{hills:[{...hill,h:60,rx:40,rz:40}]}};assert(roadGeometryProblems(steep).some(m=>m.includes('climbs')))}
// ford: the road follows the ford bed (never dry, never a problem)
{const fordMap={...base,roads:{nodes,edges:[{id:'e2',from:'c',to:'d',width:6,surface:'gravel'}]},water:{...base.water,bridges:[],fords:[{river:'r2',x:-100,z:-300,w:12,depth:.3}]}};
 const w=roadHeightAt(fordMap,-100,-300);assert.equal(w.kind,'ford');assert(Math.abs(w.y-(-.95-.3))<1e-9,'ford bed '+w.y);
 assert.deepEqual(roadGeometryProblems(fordMap).filter(m=>m.includes('lies in water')),[]);
 const noFord={...fordMap,water:{...fordMap.water,fords:[]}};assert(roadGeometryProblems(noFord).some(m=>m.includes('lies in water')))}
// ground under the road: 1 on the road, eased over the shoulder, nothing beyond
{const pieces=roadChunkGeometry(base);assert(Math.abs(roadGradeAt(pieces,400,0).y-12)<.05&&roadGradeAt(pieces,400,0).w===1);
 const s=roadGradeAt(pieces,400,5+ROAD_SHOULDER/2);assert(Math.abs(s.w-.5)<1e-6);assert.equal(roadGradeAt(pieces,400,5+ROAD_SHOULDER+.1),null)}
console.log('road-geometry ok');
