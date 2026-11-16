// RV1 (river bank polish, user playtest 2026-11-15): a sloped bank with a 1 m mesh where it meets the water (no saw-tooth waterline), mud only on the wet bank (grass colour on the shoulder, so no sand patch),
// the road arrives at a bridge straight and centred, and a vehicle turns back softly from water and banks instead of hitting a wall. Walking is not changed.
import assert from 'node:assert/strict';
import {MAP,riverPath,riverBank,nearestOnRiver} from '../dist/map-definition.js';
import {heightAt,BANK_LIFT,RIVER_SHOULDER} from '../dist/height.js';
import {digGrid,dugMeshData,shoreCell,DUG_GRASS,DUG_MUD,DUG_Y,DUG_SHORE_FINE,DUG_MUD_TOP} from '../dist/dug-ground.js';
import {chunkIndex,chunkBounds} from '../dist/chunks.js';
import {buildTerrain,roadCenterline,bridgeAlign,BRIDGE_LEAD,SURFACE} from '../dist/terrain.js';
import {CLASSES,freshVehicle,stepVehicle,shoreGuard} from '../dist/vehicle.js';
let checks=0;const ok=(c,m)=>{assert(c,m);checks++};
const R=MAP.water.rivers[0],P=riverPath(R,2),bank=riverBank(R);

// 1. the profile: a real slope at the waterline, still the same waterline and shoulder, nothing steep on the 12 m reaches
{const s=P.find(p=>p.x<-100&&p.x>-120),half=s.w/2,at=d=>heightAt(s.x-s.tz*d,s.z+s.tx*d),slope=(d,e=.05)=>(at(d+e)-at(d))/e;
 ok(BANK_LIFT>0,'the bank has a straight share');ok(Math.abs(at(half)-s.y)<1e-6,'the waterline is still the water y');ok(Math.abs(at(half+bank)+RIVER_SHOULDER)<1e-6,'the bank still ends on the shoulder');
 ok(slope(half)>.08,'the ground slopes up from the waterline: '+slope(half).toFixed(3)+' (the old bank left it flat)');
 let steepest=0,last=at(half);for(let d=half+.05;d<half+bank+6;d+=.05){const v=at(d);ok(v>=last-1e-9,'the bank only rises, at '+d.toFixed(2));steepest=Math.max(steepest,(v-last)/.05);last=v}
 ok(steepest<.35,'the 12 m reach bank is gentle: '+steepest.toFixed(3));ok(Math.abs(at(half+bank+6))<1e-9,'level with the ground at the lip')}

// 2. the mesh: bank cells are 1 m, and the waterline the mesh makes is steady (it was a saw 0.27 m wide with the 2 m lattice)
{const g=digGrid(MAP),s0=P.find(p=>p.x<-100&&p.x>-120),c=chunkIndex(s0.x,s0.z),b=chunkBounds(c.i,c.j),d=dugMeshData(MAP,g,b),n=d.pos.length/3;
 ok(DUG_SHORE_FINE===1&&shoreCell(MAP,s0.x-s0.tz*7,s0.z+s0.tx*7),'a cell at the water is a shore cell');ok(!shoreCell(MAP,s0.x-s0.tz*40,s0.z+s0.tx*40),'a cell 40 m away is not');
 let whole=0;for(let k=0;k<n;k++)if(Math.abs(d.pos[k*3]-Math.round(d.pos[k*3]))<1e-9&&Math.abs(d.pos[k*3+2]-Math.round(d.pos[k*3+2]))<1e-9)whole++;ok(whole>400,'whole-metre vertices (the 1 m shore lattice): '+whole);
 // triangle lookup by 1 m buckets
 const tris=[],bucket=new Map(),key=(i,j)=>i+','+j;for(let k=0;k<d.idx.length;k+=3){const t=[0,1,2].map(q=>d.idx[k+q]*3).map(v=>[d.pos[v],d.pos[v+1],d.pos[v+2]]),id=tris.push(t)-1;
  for(let i=Math.floor(Math.min(...t.map(v=>v[0])));i<=Math.floor(Math.max(...t.map(v=>v[0])));i++)for(let j=Math.floor(Math.min(...t.map(v=>v[2])));j<=Math.floor(Math.max(...t.map(v=>v[2])));j++){const kk=key(i,j);if(!bucket.has(kk))bucket.set(kk,[]);bucket.get(kk).push(id)}}
 const meshY=(x,z)=>{for(const id of bucket.get(key(Math.floor(x),Math.floor(z)))||[]){const [a,bb,cc]=tris[id],den=(bb[2]-cc[2])*(a[0]-cc[0])+(cc[0]-bb[0])*(a[2]-cc[2]),l1=((bb[2]-cc[2])*(x-cc[0])+(cc[0]-bb[0])*(z-cc[2]))/den,l2=((cc[2]-a[2])*(x-cc[0])+(a[0]-cc[0])*(z-cc[2]))/den,l3=1-l1-l2;
   if(l1>=-1e-9&&l2>=-1e-9&&l3>=-1e-9)return l1*a[1]+l2*bb[1]+l3*cc[1]}return null};
 const lines=[];for(const s of P){if(s.x<b.x0+10||s.x>b.x1-10||s.z<b.z0+10||s.z>b.z1-10||Math.abs(s.w-12)>.1)continue;let cross=null;for(let t=4;t<=10;t+=.02){const y=meshY(s.x-s.tz*t,s.z+s.tx*t);if(y!==null&&y>s.y){cross=t;break}}if(cross)lines.push(cross)}
 const m=lines.reduce((a,v)=>a+v,0)/lines.length,sd=Math.sqrt(lines.reduce((a,v)=>a+(v-m)**2,0)/lines.length),spread=Math.max(...lines)-Math.min(...lines);
 console.log('  waterline across '+lines.length+' samples: mean '+m.toFixed(2)+' m from the middle, sd '+sd.toFixed(3)+' m, spread '+spread.toFixed(2)+' m');
 ok(lines.length>=10,'enough samples: '+lines.length);ok(sd<.12&&spread<.4,'the waterline is steady: sd '+sd.toFixed(3)+', spread '+spread.toFixed(2));
 // 3. the colour: grass on the shoulder and the lip, mud only on the wet bank
 const near=(a,b2)=>a.every((v,i)=>Math.abs(v-b2[i])<1e-9);let grass=0,mud=0,between=0;
 for(let k=0;k<n;k++){const h=d.pos[k*3+1]-DUG_Y,col=[d.col[k*3],d.col[k*3+1],d.col[k*3+2]];if(h>-DUG_MUD_TOP){ok(near(col,DUG_GRASS),'shoulder and lip are grass colour at height '+h.toFixed(2));grass++}else if(h<-.8){ok(near(col,DUG_MUD),'the bank toe is mud');mud++}else between++}
 ok(grass>200&&mud>20&&between>20,'grass '+grass+', mud '+mud+', blend '+between)}

// 4. the road meets the bridge straight and centred (the west bank lane came in up to 1.4 m off the deck's middle, 10 to 20 degrees off its axis)
{const B=MAP.water.bridges.find(b=>b.id==='west-bank-bridge'),cz=(B.z0+B.z1)/2,E=MAP.roads.edges.find(e=>e.id==='west-bank-lane'),L=roadCenterline(E),raw=bridgeAlign([[B.x1+2,cz+1.4]],{...MAP,water:{...MAP.water,bridges:[]}});
 ok(BRIDGE_LEAD>=8&&BRIDGE_LEAD<=16,'the lead-in is '+BRIDGE_LEAD+' m');ok(raw[0][1]===cz+1.4,'with no bridge nothing moves');
 const lateral=(x0,x1)=>L.filter(p=>p[0]>x0&&p[0]<x1).map(p=>Math.abs(p[1]-cz));
 ok(Math.max(...lateral(B.x1,B.x1+3))<.2&&Math.max(...lateral(B.x0-3,B.x0))<.2,'within 3 m of either end the road is on the deck middle: '+Math.max(...lateral(B.x1,B.x1+3),...lateral(B.x0-3,B.x0)).toFixed(3)+' m off');
 for(const [x0,x1] of [[B.x1,B.x1+2],[B.x0-2,B.x0]]){let w=0;for(let i=1;i<L.length;i++){const a=L[i-1],c=L[i];if(a[0]>=x0-.01&&a[0]<=x1&&c[0]>=x0-.01&&c[0]<=x1)w=Math.max(w,Math.atan(Math.abs(c[1]-a[1])/Math.abs(c[0]-a[0])))}ok(w<.06,'the road runs along the deck axis within 2 m of the end: '+(w*180/Math.PI).toFixed(1)+' degrees')}
 const farBefore=roadCenterline({...E,curve:true},{...MAP,water:{...MAP.water,bridges:[]}});ok(L.length===farBefore.length,'same number of points');let moved=0,maxMove=0;L.forEach((p,i)=>{const dd=Math.hypot(p[0]-farBefore[i][0],p[1]-farBefore[i][1]);if(dd>1e-9)moved++;maxMove=Math.max(maxMove,dd);
  ok(dd<1e-9||Math.abs(p[0]-(p[0]<B.x0?B.x0:B.x1))<BRIDGE_LEAD,'only points within the lead-in move')});ok(moved>0&&maxMove<2,'the lane moved '+moved+' points by at most '+maxMove.toFixed(2)+' m');
 const T=buildTerrain(MAP,{window:{x0:-380,x1:-290,z0:-20,z1:30}});ok(T.walkable(B.x1+1,cz)&&T.walkable(B.x0-1,cz)&&T.surfaceAt((B.x0+B.x1)/2,cz)===SURFACE.BRIDGE,'the deck and both ends are walkable')}

// 5. vehicles turn back softly from the shore; walkers are unchanged
{const wet=x=>x>50,env={blocked:(x,z)=>x>50,surface:x=>x>50?(x>56?SURFACE.WATER:SURFACE.BANK):SURFACE.GRASS},flat={blocked:(x,z)=>x>50,surface:()=>SURFACE.ROAD};
 const drive=(model,state,input,seconds,e,dt=1/60)=>{let s=state,hits=0,maxX=-1e9,minSpeed=1e9;for(let t=0;t<seconds-1e-9;t+=dt){const r=stepVehicle(s,input,dt,CLASSES[model],e);s=r.state;if(r.hit)hits++;maxX=Math.max(maxX,s.x)}return {s,hits,maxX}};
 for(const model of ['worktruck','offroad','atv']){const c=CLASSES[model];
  const start={x:0,z:0,yaw:Math.PI/2,speed:0,steer:0},soft=drive(model,start,{throttle:1},14,env),hard=drive(model,start,{throttle:1},14,flat);
  ok(soft.hits===0,model+': a full-throttle drive at the river never hits the wall ('+soft.hits+' hits)');ok(soft.maxX<50-c.hz+1,model+': it stays short of the bank: x '+soft.maxX.toFixed(1));
  ok(Math.abs(soft.s.yaw-Math.PI/2)>.35,model+': the wheel was turned away (yaw '+(soft.s.yaw*180/Math.PI).toFixed(0)+' degrees from 90)');ok(hard.hits>0,model+': without the guard (dry ground, same wall) it does hit: '+hard.hits);
  const diag=drive(model,{x:0,z:0,yaw:Math.PI/4,speed:0,steer:0},{throttle:1},20,env);ok(diag.hits<=3,model+': at 45 degrees it slides or turns, '+diag.hits+' hits');ok(diag.maxX<50,model+': never over the wall');
  const rev=drive(model,{x:0,z:0,yaw:-Math.PI/2,speed:0,steer:0},{throttle:-1},14,env);ok(rev.hits===0&&rev.maxX<50-c.hz+2,model+': reversing at the river is soft too (x '+rev.maxX.toFixed(1)+', '+rev.hits+' hits)');
  // the player can still drive away and along the shore; the guard fades out with distance
  const away=drive(model,{x:30,z:0,yaw:-Math.PI/2,speed:0,steer:0},{throttle:1},4,env);ok(away.s.x<30-5,model+': driving away is not slowed down to a crawl')}
 const t=drive('worktruck',start0(),{throttle:1},8,env);function start0(){return {x:44,z:0,yaw:0,speed:0,steer:0}}
 ok(t.s.z>15&&t.hits===0&&t.s.x<50,'driving parallel to the shore 6 m from it is free: z '+t.s.z.toFixed(1)+', '+t.hits+' hits');
 // frame-rate independent
 const runs=[1/30,1/60,1/144].map(dt=>drive('worktruck',{x:0,z:0,yaw:Math.PI/2,speed:0,steer:0},{throttle:1},12,env,dt).s);for(const r of runs.slice(1))ok(Math.hypot(r.x-runs[0].x,r.z-runs[0].z)<3,'the turn-back is the same at 30, 60 and 144 slices a second ('+Math.hypot(r.x-runs[0].x,r.z-runs[0].z).toFixed(2)+' m apart)');
 // a bridge deck is never a hazard
 const bridge={blocked:()=>false,surface:x=>x>50?SURFACE.BRIDGE:SURFACE.GRASS},cross=drive('worktruck',{x:0,z:0,yaw:Math.PI/2,speed:0,steer:0},{throttle:1},14,bridge);ok(cross.hits===0&&cross.s.x>80&&Math.abs(cross.s.yaw-Math.PI/2)<1e-6,'a vehicle drives straight onto a deck');
 ok(shoreGuard({x:0,z:0,yaw:Math.PI/2},0,CLASSES.worktruck,env)===null&&shoreGuard({x:0,z:0,yaw:Math.PI/2},.3,CLASSES.worktruck,env)===null,'a vehicle at rest is not guarded');
 ok(shoreGuard({x:0,z:0,yaw:0},10,CLASSES.worktruck,env)===null,'nothing ahead, nothing happens');const g=shoreGuard({x:44,z:0,yaw:Math.PI/2},8,CLASSES.worktruck,env);ok(g&&g.c>0&&g.c<=1&&Math.abs(g.turn)===1,'close to the bank it asks for a turn');
 // walking: the mask still blocks the water and its bank
 const s=P.find(q=>q.x<-150&&q.x>-160),T=buildTerrain(MAP,{window:{x0:Math.floor(s.x)-30,x1:Math.floor(s.x)+30,z0:Math.floor(s.z)-30,z1:Math.floor(s.z)+30}});ok(!T.walkable(s.x-s.tz*3,s.z+s.tx*3)&&!T.walkable(s.x-s.tz*(s.w/2+bank-.5),s.z+s.tx*(s.w/2+bank-.5))&&T.walkable(s.x-s.tz*(s.w/2+bank+1),s.z+s.tx*(s.w/2+bank+1)),'walking: water and bank still blocked, the shoulder is walkable')}

console.log('PASS river-bank.mjs: '+checks+' checks (sloped bank, 1 m shore mesh and a steady waterline, grass shoulder with mud only on the wet bank, the road meets the bridge straight and centred, soft turn-back for three vehicles forwards, in reverse and at 45 degrees, at 30/60/144 Hz, decks never a hazard, walking unchanged)');
