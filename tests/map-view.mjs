import assert from 'node:assert/strict';
import {CLASSES} from '../dist/vehicle.js';
import * as M from '../dist/map-view.js';

// MM1 (notes/minimap-design.md section 8): pure view math for the minimap revamp. No canvas.
const near=(a,b,e,msg)=>assert(Math.abs(a-b)<=e,`${msg}: ${a} vs ${b}`);

// 1. worldToPx / pxToWorld round trip: 3 zooms x dpr 1 and 2 x 4 points.
for(const W of [75,150,300])for(const dpr of [1,2])for(const [x,z] of [[10,-20],[-440,590],[1000,-1190],[0,0]]){
 const v=M.makeView(37,-81,W,200*dpr,200*dpr),p=M.worldToPx(v,x,z),q=M.pxToWorld(v,p.x,p.y);near(q.x,x,1e-9,'x');near(q.z,z,1e-9,'z')}
const cv=M.makeView(100,-100,150,400,400);assert.deepEqual(M.worldToPx(cv,100,-100),{x:200,y:200},'the centre maps to the canvas centre');
assert(M.worldToPx(cv,100,-150).y<200,'north (-z) is up');

// 2. cropWindow: centred, never clamped at the world edge; source rect for BASE and tile coordinates; look-ahead <= 0.2 W.
const B=M.WORLD_BOUNDS,edge=M.cropWindow(B.x0,B.z0,150,1);
assert.equal(edge.cx,B.x0);assert.equal(edge.x0,B.x0-75);assert.equal(edge.z0,B.z0-75);
const src=M.cropSource(edge,B,M.BASE_MPP,400,400);
near(src.sx,0,1e-9,'src starts at the world corner');near(src.sw,75/2,1e-9,'half the window is in the world, in BASE px');near(src.dx,200,1e-9,'drawn from the canvas centre');near(src.dw,200,1e-9,'dest width');
assert.equal(M.cropSource(M.cropWindow(B.x0-500,0,150,1),B,2,400,400),null,'a window wholly outside the world has no source');
const mid=M.cropWindow(0,0,150,1),sm=M.cropSource(mid,B,M.BASE_MPP,400,400);near(sm.sx,(0-75-B.x0)/2,1e-9,'BASE source x');near(sm.sw,75,1e-9,'BASE source width 150 m / 2');
const st=M.cropSource(mid,{x0:0,z0:0,x1:128,z1:128},M.TILE_MPP,400,400);near(st.sx,0,1e-9,'tile source clipped to its own corner');near(st.sw,150,1e-9,'tile source: 75 m of the window inside the tile / 0.5');
let off={x:0,z:0};for(let i=0;i<2000;i++){off=M.lookAheadStep(off,25,-10,400,1/60);assert(Math.hypot(off.x,off.z)<=.2*400+1e-9,'look-ahead cap')}
near(Math.hypot(off.x,off.z),80,1,'look-ahead settles at 0.2 W');assert(off.x>0&&off.z<0,'look-ahead points along the velocity');
assert.deepEqual(M.lookAheadStep({x:30,z:0},0,0,150,.016,true).z,0);near(M.lookAheadStep({x:30,z:0},5,0,150,1,true).x,30*Math.exp(-1),1e-9,'on foot it eases back to 0 with tau 1 s');
const shrunk=M.lookAheadStep({x:80,z:0},25,0,150,.016);assert(Math.hypot(shrunk.x,shrunk.z)<=30+1e-9,'a shrinking W re-caps the offset');

// 3. tilesFor.
assert(M.tilesFor(M.cropWindow(100.5,-300.5,150,1)).length<=9,'150 m window: at most 9 tiles');
assert(M.tilesFor(M.cropWindow(100.5,-300.5,400,1)).length<=16,'400 m window: at most 16 tiles');
let worst=0;for(let x=-400;x<1000;x+=37.3)for(let z=-1100;z<500;z+=41.7){worst=Math.max(worst,M.tilesFor(M.cropWindow(x,z,150,1)).length)}assert(worst<=9&&worst>=4,'worst case over the world '+worst);
const corner=M.tilesFor(M.cropWindow(B.x0,B.z0,150,1));assert.equal(corner.length,1,'at the world corner only the one tile in the world is kept');assert.equal(corner[0].key,'0,0');
assert(M.tilesFor(M.cropWindow(5000,5000,150,1)).length===0,'far outside: none');
const ts=M.tilesFor(M.cropWindow(0,0,150,1));assert(ts.every((t,i)=>i===0||ts[i-1].d<=t.d),'nearest first');
const t0=ts[0];assert.equal(t0.x1-t0.x0,128);assert.equal((t0.x0-B.x0)%128,0,'tiles sit on the fixed grid');assert.equal(M.TILE_PX,256);

// 4. levelFor: 1.0 m per device px boundary.
assert.equal(M.levelFor(150,400),'L0');assert.equal(M.levelFor(400,200),'BASE');assert.equal(M.levelFor(400,400),'BASE','exactly 1.0 -> BASE');assert.equal(M.levelFor(399,400),'L0');
assert.equal(M.levelFor(400,400*2),'L0','dpr 2: 400 m is still tiles');assert.equal(M.levelFor(150,200),'L0','dpr 1 corner on foot');assert.equal(M.levelFor(300,200),'BASE');

// 5. zoomTarget.
const Z=M.zoomTarget;assert.equal(Z(0),150);assert.equal(Z(6),150);near(Z(17.5),275,1e-9,'midpoint of 6..29 m/s is 275 m (the note had 17 m/s for a 28 top)');near(Z(17),266.9,.1,'17 m/s');near(Z(28),400,1.5,'28 m/s is almost the top');assert.equal(Z(M.ZOOM_V_HIGH),400);assert.equal(Z(60),400);assert.equal(Z(-60),400,'reverse counts');
let prev=-1;for(let v=0;v<=60;v+=.25){assert(Z(v)>=prev,'monotonic');prev=Z(v)}
assert.equal(Z(0,.5),75);assert.equal(Z(0,2),300);assert.equal(Z(60,2),800,'clamped to 800');assert.equal(M.footTarget(.5),75);assert.equal(M.footTarget(2),300);assert.equal(M.footTarget(10),800);assert.equal(M.footTarget(.1),60);
// the real fastest class
const fastest=Math.max(...Object.values(CLASSES).map(c=>c.top));assert.equal(fastest,29,'the fastest class tops out at 29 m/s (shortbed)');assert.equal(M.ZOOM_V_HIGH,fastest,'the curve ends at the real top speed');

// 6. smoothZoom: frame-rate independence and the zoom-in hold.
const run=(fps,secs,target,s0)=>{let s=s0;const n=Math.round(fps*secs);for(let i=0;i<n;i++)s=M.smoothZoom(s,target,1/fps);return s};
near(run(60,1,400,M.freshZoom(150)).W,run(165,1,400,M.freshZoom(150)).W,.5,'zoom out, 60 vs 165 fps');near(run(60,1,400,M.freshZoom(150)).W,150+250*(1-Math.exp(-1/.8)),.01,'zoom out follows tau 0.8');
near(run(60,4,150,{W:400,lowFor:2}).W,run(165,4,150,{W:400,lowFor:2}).W,.5,'zoom in (hold already served), 60 vs 165 fps');
assert.equal(run(60,1.4,150,M.freshZoom(400)).W,400,'no zoom-in before the 1.5 s hold ends');assert(run(60,2.5,150,M.freshZoom(400)).W<400,'zoom-in starts after the hold');
let s=M.freshZoom(400);s=run(60,1.4,150,s);s=run(60,.1,400,s);assert.equal(s.lowFor,0,'a higher target resets the hold');assert.equal(run(60,1.4,150,s).W,s.W,'and the hold starts over');
assert.equal(M.stepUserZoom(1,1),2);assert.equal(M.stepUserZoom(2,1),2);assert.equal(M.stepUserZoom(0,-1),0);

// 7. pick.
const corner200=M.makeView(50,-60,150,400,400),rect={left:100,top:50,width:200,height:200};
const c=M.pick(corner200,rect,200,150);near(c.x,50,1e-9,'centre -> player x');near(c.z,-60,1e-9,'centre -> player z');
const tl=M.pick(corner200,rect,100,50),br=M.pick(corner200,rect,300,250);near(tl.x,-25,1e-9,'top-left x');near(tl.z,-135,1e-9,'top-left z');near(br.x,125,1e-9,'bottom-right x');near(br.z,15,1e-9,'bottom-right z');
assert.equal(M.pick(corner200,rect,99,150),null);assert.equal(M.pick(corner200,rect,200,251),null,'outside the canvas -> null');
let fm=M.makeView(300,-400,1500,900,720);fm=M.zoomAbout(fm,3,250,610);fm=M.panBy(fm,-120,35);
const wp=M.pick(fm,{left:0,top:0,width:450,height:360},180,90),back=M.worldToPx(fm,wp.x,wp.z);near(back.x,360,1e-9,'full map pick round-trips x (CSS 180 at scale 2)');near(back.y,180,1e-9,'y');
const zv=M.makeView(10,20,1500,900,720),zp=M.pxToWorld(zv,250,610),z2=M.zoomAbout(zv,4,250,610),zq=M.pxToWorld(z2,250,610);near(zq.x,zp.x,1e-9,'zoomAbout keeps the cursor point');near(zq.z,zp.z,1e-9,'zoomAbout z');near(z2.mpp,zv.mpp/4,1e-12,'zoomAbout factor');

// 8. edgeIndicator.
assert.equal(M.edgeIndicator(corner200,50,-60),null,'centre is inside');assert.equal(M.edgeIndicator(corner200,100,-100),null,'inside the frame');
const e=M.edgeIndicator(corner200,50+1000,-60);near(e.x,400-8,1e-9,'east target sits on the east edge (inset 8)');near(e.y,200,1e-9,'same height');near(e.angle,0,1e-9,'angle east');assert.equal(e.showDistance,true);near(e.dist,1000,1e-9,'distance');
const n=M.edgeIndicator(corner200,50,-60-200);near(n.y,8,1e-9,'north target on the top edge');near(n.angle,-Math.PI/2,1e-9,'angle north is up');assert.equal(n.showDistance,false,'200 m < 1.5 W');
const d=M.edgeIndicator(corner200,50+300,-60-300);near(d.x,392,1e-9,'diagonal reaches the frame at a corner');near(d.y,8,1e-9);near(d.angle,-Math.PI/4,1e-9);

// 9. cull.
const items=[{x:0,z:0,id:'c'},{x:60,z:0,id:'b'},{x:200,z:0,id:'out'},{x:-30,z:10,id:'a'},{x:80,z:0,id:'edge'}];
const w=M.cropWindow(0,0,150,1),ids=a=>a.map(i=>i.id).join();
assert.equal(ids(M.cull(items,w,0,10)),'c,a,b','off-window dropped (80 m is past the 75 m edge), nearest first');assert.equal(ids(M.cull(items,w,10,10)),'c,a,b,edge','a 10 m margin keeps the one just outside');assert.equal(ids(M.cull(items,w,0,10)).includes('out'),false);
assert.equal(ids(M.cull(items,w,200,10)).includes('out'),true,'margin keeps it');assert.equal(M.cull(items,w,0,2).length,2,'respects max');assert.equal(M.cull(items,w,0,0).length,0);
assert.equal(M.cull([{p:{x:1,z:1}}],w,0,5,i=>i.p).length,1,'custom position getter');

console.log('PASS map-view: view math, crop window, tiles, level, zoom curve (top 29 m/s), smoothing, pick, chevrons, cull');
