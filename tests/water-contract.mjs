// W1: the water data contract (MAP.water rivers/fords/lakes/sea/falls), waterAt, and the validation. Pure data, no world built.
import assert from 'node:assert/strict';
import {MAP,validateMap,waterAt,waterPoints,waterProblems,distanceAlong,riverLength,riverPath,riverIsLegacy,LEGACY_WATER,seaLineZ,fallPoolCentre,RIVER_PROFILE} from '../dist/map-definition.js';

// â”€â”€ The shipped map: old river through the new contract â”€â”€
const old=MAP.water.rivers[0];
assert(riverIsLegacy(old));assert.deepEqual(validateMap(MAP),[]);assert.deepEqual(waterProblems(MAP),[]);
{const P=waterPoints(old);assert.equal(P.length,old.points.length);
 assert.deepEqual([P[0].x,P[0].z,P[0].w,P[0].y,P[0].depth,P[0].speed],[old.points[0][0],old.points[0][1],12,LEGACY_WATER.y,LEGACY_WATER.depth,0]);
 const u=distanceAlong(old);assert.equal(u[0],0);assert(u.every((v,i)=>!i||v>u[i-1]));assert(Math.abs(u.at(-1)-riverLength(old))<1e-6);assert(riverLength(old)>500&&riverLength(old)<700)}
{const s=riverPath(old,3)[10];assert(s.w===12&&s.y===-.95&&s.speed===0&&Number.isFinite(s.u))}
// Water on the old river's centreline; dry well away from it. Flow is zero (legacy rivers do not move).
{const mid=riverPath(old,2)[40],w=waterAt(mid.x,mid.z);
 assert.equal(w.kind,'river');assert.equal(w.y,-.95);assert.equal(w.depth,LEGACY_WATER.depth);assert.deepEqual(w.flow,[0,0]);
 assert.equal(waterAt(mid.x+6.5*mid.tz*-1,mid.z+6.5*mid.tx),null,'the bank (beyond half the width) is dry');
 assert.equal(waterAt(0,0),null);assert.equal(waterAt(500,500),null,'no sea in the shipped map')}
// every point of the old river's centreline is water, and the old and new distance agree on the width
assert(riverPath(old,2).every(p=>waterAt(p.x,p.z)?.kind==='river'));

// â”€â”€ A full synthetic contract: river in flow order with a rapid and a ford, a lake, the sea, a fall â”€â”€
const river={id:'big-river',bank:2.6,shore:3,points:[
 {x:-330,z:-100,w:14,depth:.5,y:-.95,speed:.6},
 {x:-330,z:0,w:14,depth:.5,y:-.95,speed:.6},
 {x:-330,z:100,w:14,depth:.5,y:-.95,speed:.8,rapid:true},
 {x:-330,z:103,w:14,depth:.5,y:-1.3,speed:1.2},
 {x:-250,z:250,w:20,depth:.8,y:-1.3,speed:.5},
 {x:-100,z:380,w:25,depth:1,y:-2,speed:.3}]};
const lake={id:'blackstone-lake',outline:[[520,-660],[800,-660],[800,-440],[520,-440]],y:-.9,depth:2.5,shore:6,inflow:[700,-660],outflow:[540,-440]};
const sea={shoreline:[[-450,430],[0,440],[1050,440]],y:-2,beach:25,depth:.6,swell:{amp:.12,len:20,dir:0}};
const fall={id:'blackstone-falls',lip:{x:720,z:-770,y:6},drop:6,w:3,dir:[0,1],pool:{r:6}};
const ford={river:'big-river',x:-330,z:0,w:6,depth:.3};
const map={...MAP,water:{...MAP.water,rivers:[...MAP.water.rivers,river],fords:[ford],lakes:[lake],sea,falls:[fall]}};
assert.deepEqual(waterProblems(map),[]);assert.deepEqual(validateMap(map),[]);

// waterAt: kinds, levels, depth, flow direction
{const r=waterAt(-330,50,map);assert.equal(r.kind,'river');assert.equal(r.id,'big-river');assert(Math.abs(r.y+.95)<1e-9&&r.depth===.5);
 assert(Math.abs(r.flow[0])<1e-6&&r.flow[1]>.5&&r.flow[1]<.8,'flows south (+z) at about .6 m/s: '+r.flow);
 const f=waterAt(-330,0,map);assert.equal(f.kind,'ford');assert(f.depth<=.3);
 assert.equal(waterAt(-330,10,map).kind,'river','6 m ford: 10 m on is the river again');
 const rp=waterAt(-330,101.5,map);assert.equal(rp.kind,'river');assert(rp.y<-.95&&rp.y>-1.3,'the rapid slopes: '+rp.y);assert(rp.rapid,'the upper point is the rapid');
 assert.equal(waterAt(-330+7.5,50,map),null,'beyond half of 14 m is dry');
 // W2 (user 2026-11-17): the bed is deepest in the centre: depth = point depth x RIVER_PROFILE(d / half width), a cosine to 0 at the waterline; legacy rivers stay flat
 assert.equal(RIVER_PROFILE(0),1);assert(Math.abs(RIVER_PROFILE(1))<1e-12&&Math.abs(RIVER_PROFILE(.5)-.5)<1e-12&&RIVER_PROFILE(2)===RIVER_PROFILE(1));
 const q=waterAt(-330+3.5,50,map);assert(Math.abs(q.depth-.5*RIVER_PROFILE(.5))<1e-9,'quarter width in: '+q.depth);assert(waterAt(-330+6.9,50,map).depth<.01,'about 0 at the edge');
 assert(waterAt(-330,50,map).depth>q.depth&&q.depth>waterAt(-330+6,50,map).depth,'deeper towards the centre');
 const e=waterAt(-100,380,map);assert.equal(e.kind,'river');assert.equal(e.y,-2)}
{const l=waterAt(660,-550,map);assert.equal(l.kind,'lake');assert.equal(l.y,-.9);assert(Math.abs(l.depth-2.5)<1e-9);assert.deepEqual(l.flow,[0,0]);
 const edge=waterAt(522,-550,map);assert(edge.depth>0&&edge.depth<1,'shore slope: '+edge.depth);
 assert.equal(waterAt(500,-550,map),null)}
{assert.equal(seaLineZ(sea,-500),430);assert.equal(seaLineZ(sea,-225),435);assert.equal(seaLineZ(sea,2000),440);
 assert.equal(waterAt(300,430,map),null,'north of the line');
 const s=waterAt(300,520,map);assert.equal(s.kind,'sea');assert.equal(s.y,-2);assert(Math.abs(s.depth-.6)<1e-9);assert.deepEqual(s.flow,[0,0]);
 const b=waterAt(300,445,map);assert(b.depth>0&&b.depth<.3)}
{const c=fallPoolCentre(fall);assert.deepEqual(c,{x:720,z:-764});
 const p=waterAt(720,-764,map);assert.equal(p.kind,'fall');assert.equal(p.y,0);assert(p.depth>1.4);assert.equal(waterAt(720,-750,map),null)}
// u along the new river: monotone, equal to the sum of steps, rapid control points close together
{const u=distanceAlong(river);assert.equal(u[0],0);assert(Math.abs(u[1]-100)<2);assert(u[3]-u[2]>2.9&&u[3]-u[2]<3.3);assert(u.every((v,i)=>!i||v>u[i-1]))}
// Reverse flow flips the flow vector (direction = tangent to the next point)
{const back={...river,id:'back',points:[...river.points].reverse().map(p=>({...p,rapid:false,y:-.95}))},m2={...map,water:{rivers:[back]}};
 assert(waterAt(-330,50,m2).flow[1]<-.5)}

// â”€â”€ Validation catches bad data â”€â”€
const bust=(patch,part)=>{const w={...map.water,...patch},m={...map,water:w},p=waterProblems(m);assert(p.some(s=>s.includes(part)),`${part} not reported: ${JSON.stringify(p)}`);assert(validateMap(m).some(s=>s.includes(part)),`${part} not in validateMap`)};
const pts=(i,patch)=>river.points.map((p,k)=>k===i?{...p,...patch}:p);
bust({rivers:[{...river,points:pts(2,{y:-.5})}]},'flows uphill');
bust({rivers:[{...river,points:pts(2,{w:0})}]},'without finite');
bust({rivers:[{...river,points:pts(1,{x:-330,z:-100})}]},'same place');
bust({rivers:[{...river,points:pts(2,{rapid:false}).map((p,k)=>k===0?{...p,rapid:true}:p)}]},'rapid at point 0');
bust({rivers:[{...river,points:pts(5,{x:5000})}]},'outside the world');
bust({fords:[{...ford,x:0,z:0}]},'not on the water');
bust({fords:[{...ford,river:'nope'}]},'unknown river');
bust({lakes:[{...lake,outline:[[520,-660],[800,-440],[800,-660],[520,-440]]}]},'crosses itself');
bust({lakes:[{...lake,depth:0}]},'depth>0');
bust({lakes:[lake,{...lake,id:'twin',outline:[[600,-600],[700,-600],[700,-500]]}]},'overlap');
bust({lakes:[{...lake,outflow:[0,0]}]},'outflow');
bust({lakes:[{...lake,outline:[[-30,-60],[0,-60],[0,-30]]}]},'walks into lake');
bust({sea:{...sea,shoreline:[[0,440],[-10,440]]}},'west to east');
bust({sea:{...sea,beach:0}},'beach>0');
bust({lakes:[{...lake,outline:[[520,500],[800,500],[800,560],[520,560]]}]},'reaches into the sea');
bust({falls:[{...fall,drop:0}]},'drop>0');
bust({falls:[{...fall,dir:[0,0]}]},'dir');
bust({bridges:[...MAP.water.bridges,{id:'bad',axis:'q'}]},'axis');
// an x-axis bridge over the north-south reach is accepted by the bank check, a too-short one is not
{const zone={id:'bridge-zone',name:'B',label:'B',subtitle:'',color:'#000',grid:false,bounds:{x0:-352,x1:-308,z0:40,z1:60},minimap:{label:{x:-330,z:50}}};
 const ok={id:'west-bridge',river:'big-river',axis:'x',x0:-352,x1:-308,z0:40,z1:60},m3=(b)=>({...map,ground:{...map.ground,x0:-460,x1:300},zones:[...map.zones,zone],water:{...map.water,bridges:[...map.water.bridges,b]}});
 const long=validateMap(m3(ok)).filter(s=>s.includes('west-bridge')&&s.includes('reach both banks'));assert.deepEqual(long,[]);
 const short=validateMap(m3({...ok,x0:-335,x1:-325}));assert(short.some(s=>s.includes('west-bridge')&&s.includes('reach both banks')),JSON.stringify(short))}
console.log('water-contract ok');
