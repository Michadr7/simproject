import {ZONES} from './world.js';
import {MAP,roadGraph} from './map-definition.js';
import {roadDisplayName,viewConeAngle} from './hud-cards.js';
import {DEV_MODE} from './dev-flag.js';
import {sharedBake,relief,TILE_CACHE_FULL} from './map-bake.js';
import {BASE_MPP,TILE_MPP,TILE_GUTTER,tilesFor,levelFor,cropWindow,cropSource,zoomTarget,footTarget,freshZoom,smoothZoom,lookAheadStep,edgeIndicator} from './map-view.js';

// Whole-world map, north (-z) up: the city in the south, the river and bridge across the middle, Willow Fields (west) and Pine Ridge (east) north of it.
// MM3: the small corner map is now a LOCAL window: north up, centred on you (200 x 200, 150 m across on foot, wider when driving fast, shifted ahead of the car), never clamped at the world edge (dark fill + dashed border). The large mode (M key, phone GPS) still shows the whole view until MM6/MM7.
// MM2: the ground, water, buildings, plots and trees are no longer painted here: they come from the shared bake (map-bake.js: a 2 m/px BASE image and 0.5 m tiles, baked in slices) and this file draws crops of it, then the labels, route, pin, markers and player at ~12 fps.
const VIEW=MAP.minimap.view;
export {relief};
const SIZES={small:{w:200,h:200},large:{w:600,h:490}},EDGE='#0d1117',JOB='#f2ca79';
let labelCache=null; // one label per road name (its longest piece, at its middle), built once from the road graph
function roadLabels(){if(labelCache)return labelCache;const best=new Map();for(const e of Object.values(roadGraph(MAP).edges)){if(!e.poly||e.poly.length<2)continue;const name=roadDisplayName(e);if(!name)continue;const len=e.length||e.len||e.poly.length,old=best.get(name);if(!old||len>old.len){const idx=Math.floor((e.poly.length-1)/2),m=e.poly[idx],n=e.poly[Math.min(idx+1,e.poly.length-1)];let ang=Math.atan2(n[1]-m[1],n[0]-m[0]);if(ang>Math.PI/2)ang-=Math.PI;else if(ang<-Math.PI/2)ang+=Math.PI;best.set(name,{name,len,x:(m[0]+n[0])/2,z:(m[1]+n[1])/2,ang})}}return labelCache=[...best.values()]}

export function createMinimap(doc,{canvas,cityRoads=[],buildings=[],trees=()=>[],startSize='small',fixedDpr=0,bake=null}){
 if(!canvas)return {update(){},toggle(){},invalidate(){},invalidateAt(){},pick(){return null},get large(){return false}};
 const dpr=fixedDpr||Math.min(2,globalThis.devicePixelRatio||1);
 const B=bake||sharedBake(doc,{buildings,trees,cap:TILE_CACHE_FULL,onJob:DEV_MODE?i=>{if(i.ms>=25)console.debug('[map-bake]',i.kind,i.key,i.ms.toFixed(1)+' ms')}:null});
 let size=startSize,dirty=true,timer=0,seen=-1,zs=freshZoom(),look={x:0,z:0},win=null;
 function resize(){
  const {w,h}=SIZES[size];
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  canvas.style.width=w+'px';canvas.style.height=h+'px';dirty=true;
 }
 let cur={x0:VIEW.x0,z0:VIEW.z0,k:1}; // the window on screen: its west/north edge in metres and device pixels per metre
 const px=x=>(x-cur.x0)*cur.k,pz=z=>(z-cur.z0)*cur.k;
 // The ground: BASE first (never blank), then the 0.5 m tiles that are ready on top when the map is finer than 1 m per device pixel.
 function drawGround(ctx){
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle=size==='small'?EDGE:'#131920';ctx.fillRect(0,0,w,h);
  const blit=(img,box,mpp,g)=>{const c=cropSource(win,box,mpp,w,h);if(c)ctx.drawImage(img,c.sx+g,c.sy+g,c.sw,c.sh,c.dx,c.dy,c.dw,c.dh)};
  if(B.baseReady)blit(B.base,B.bounds,BASE_MPP,0);
  if(levelFor(win.W,w)==='L0'){
   const tiles=tilesFor(win,B.bounds);B.want(tiles,{x:win.cx,z:win.cz});
   for(const t of tiles){const e=B.tile(t.key);if(e)blit(e.canvas,t,TILE_MPP,TILE_GUTTER)}}
  else B.want([],{x:win.cx,z:win.cz});
  ctx.fillStyle='rgba(10,14,20,.22)';ctx.fillRect(0,0,w,h);
  if(size==='small'){const b=B.bounds;ctx.save();ctx.setLineDash([6*dpr,4*dpr]);ctx.strokeStyle='#c9d3c4aa';ctx.lineWidth=dpr;ctx.strokeRect(px(b.x0),pz(b.z0),(b.x1-b.x0)*cur.k,(b.z1-b.z0)*cur.k);ctx.restore()} // the edge of the mapped world
  // Labels stay crisp at any zoom, so they are drawn here and not baked: zone names, and the plot ids on the big map.
  if(size==='large'){const colour={residential:'#2fbf9f',commercial:'#b0529b',industrial:'#e0a02e'};ctx.fillStyle='#fff';ctx.font=`${Math.round(11*dpr)}px Arial`;ctx.textAlign='center';for(const plot of MAP.reserved){ctx.fillStyle=colour[plot.kind];ctx.fillText(plot.id,px((plot.x0+plot.x1)/2),pz((plot.z0+plot.z1)/2)+4*dpr)}}
  ctx.fillStyle='#ffffffcc';ctx.font=`${Math.round((size==='large'?13:8)*dpr)}px Arial`;ctx.textAlign='center';
  for(const zone of MAP.zones){const zx=px(zone.minimap.label.x),zz=pz(zone.minimap.label.z);if(zx>28*dpr&&zx<w-28*dpr&&zz>14*dpr&&zz<h-14*dpr&&!(size==='small'&&((zx>w-62*dpr&&zz<30*dpr)||(zx<72*dpr&&zz>h-26*dpr))))ctx.fillText(ZONES[zone.id].label,zx,zz)}
  ctx.font=`700 ${Math.round((size==='large'?9:7)*dpr)}px Arial`;ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=2.4*dpr;ctx.strokeStyle='rgba(9,12,16,.78)';ctx.fillStyle='rgba(220,228,236,.74)'; // street names (slop-newyork style), drawn only inside safe margins
  for(const r of roadLabels()){const x=px(r.x),z=pz(r.z);if(x>24*dpr&&x<w-24*dpr&&z>16*dpr&&z<h-16*dpr&&!(size==='small'&&((x>w-56*dpr&&z<30*dpr)||(x<72*dpr&&z>h-26*dpr)))){ctx.save();ctx.translate(x,z);ctx.rotate(r.ang);ctx.strokeText(r.name,0,0);ctx.fillText(r.name,0,0);ctx.restore()}}ctx.textBaseline='alphabetic';
 }
 // The GPS route (gps.js): a blue line from where you are along the points still ahead (route.points from index route.from, starting at route.start). Only a stroke of a few hundred points at 12 fps.
 function drawRoute(ctx,route){const P=route.points;if(!P||P.length<2)return;const w=Math.max(2.4,(size==='large'?3.6:2.8)*dpr),m=20,vis=(ax,az,bx,bz)=>Math.max(ax,bx)>=win.x0-m&&Math.min(ax,bx)<=win.x1+m&&Math.max(az,bz)>=win.z0-m&&Math.min(az,bz)<=win.z1+m;ctx.lineJoin='round';ctx.lineCap='round';
  for(const pass of [0,1]){ctx.strokeStyle=pass?'#ffc21a':'rgba(18,14,4,.86)';ctx.lineWidth=pass?w:w+2.4*dpr;ctx.beginPath();let ax=route.start[0],az=route.start[1],pen=false;
   for(let i=route.from;i<P.length;i++){const bx=P[i][0],bz=P[i][1];if(vis(ax,az,bx,bz)){if(!pen){ctx.moveTo(px(ax),pz(az));pen=true}ctx.lineTo(px(bx),pz(bz))}else pen=false;ax=bx;az=bz}ctx.stroke()}}
 // A target off the corner map: a chevron on the frame pointing at it, with the distance when it is far.
 function chevron(ctx,ind,color){const u=6*dpr;ctx.save();ctx.translate(ind.x,ind.y);ctx.rotate(ind.angle);ctx.fillStyle=color;ctx.strokeStyle='#10130f';ctx.lineWidth=dpr;ctx.beginPath();ctx.moveTo(u,0);ctx.lineTo(-u*.7,-u*.8);ctx.lineTo(-u*.3,0);ctx.lineTo(-u*.7,u*.8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  if(ind.showDistance){const t=Math.round(ind.dist/10)*10+' m';ctx.font=`bold ${Math.round(9*dpr)}px Arial`;ctx.textAlign='center';ctx.lineWidth=3*dpr;ctx.strokeStyle='#10130f';ctx.fillStyle='#fff';const x=ind.x-Math.cos(ind.angle)*18*dpr,y=ind.y-Math.sin(ind.angle)*14*dpr+3*dpr;ctx.strokeText(t,x,y);ctx.fillText(t,x,y)}}
 // The window for this frame: small = local (zoom eased by speed, centre shifted ahead), large = the whole view.
 function setWindow(dt,player,heading,speed,driving){
  const w=canvas.width,h=canvas.height;
  if(size==='large'){const W=VIEW.x1-VIEW.x0;win=cropWindow((VIEW.x0+VIEW.x1)/2,VIEW.z0+W*h/w/2,W,w/h)}
  else{zs=smoothZoom(zs,driving?zoomTarget(speed):footTarget(),dt);look=lookAheadStep(look,Math.sin(heading)*speed,Math.cos(heading)*speed,zs.W,dt,!driving);win=cropWindow((player?player.x:(VIEW.x0+VIEW.x1)/2)+look.x,(player?player.z:(VIEW.z0+VIEW.z1)/2)+look.z,zs.W,w/h)}
  cur={x0:win.x0,z0:win.z0,k:w/win.W};
 }
 function update(dt,{player,heading,yaw,markers=[],route=null,pin=null,speed=0,driving=false}){
  B.step(); // one sliced slice of baking per frame (3 ms at most, only while something is missing)
  setWindow(dt,player,heading,speed,driving); // smoothing runs every frame, drawing only at ~12 fps
  timer+=dt;if(timer<1/12&&!dirty&&seen===B.version)return;timer=0;seen=B.version;dirty=false;
  const ctx=canvas.getContext('2d'),k=cur.k,small=size==='small',ev={cx:win.cx,cz:win.cz,mpp:win.W/canvas.width,w:canvas.width,h:canvas.height};
  ctx.setTransform(1,0,0,1,0,0);drawGround(ctx);
  if(route)drawRoute(ctx,route);
  const pinInd=pin&&small?edgeIndicator(ev,pin.x,pin.z,10*dpr):null;
  if(pin&&!pinInd){const x=px(pin.x),z=pz(pin.z),u=(size==='large'?6:4)*dpr;ctx.fillStyle='#ff5a4d';ctx.strokeStyle='#fff';ctx.lineWidth=dpr;ctx.beginPath();ctx.arc(x,z-u,u*.7,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(x-u*.45,z-u*.55);ctx.lineTo(x,z);ctx.lineTo(x+u*.45,z-u*.55);ctx.fill()}
  for(const m of markers){if(small&&m.color===JOB){const ind=edgeIndicator(ev,m.x,m.z,10*dpr);if(ind){chevron(ctx,ind,m.color);continue}}ctx.fillStyle=m.color;ctx.beginPath();ctx.arc(px(m.x),pz(m.z),Math.max(2.5*dpr,k*1.4),0,Math.PI*2);ctx.fill()}
  if(pinInd)chevron(ctx,pinInd,'#ff5a4d');
  if(!player)return;
  const x=px(player.x),z=pz(player.z),u=(size==='large'?7.5:5.5)*dpr;
  // Soft light camera view cone (the camera looks along -sin(yaw), -cos(yaw)).
  const dir=viewConeAngle(yaw),coneR=u*5.4;
  const grad=ctx.createRadialGradient?.(x,z,0,x,z,coneR);
  if(grad?.addColorStop){grad.addColorStop(0,'rgba(255,255,255,.38)');grad.addColorStop(.55,'rgba(232,240,250,.15)');grad.addColorStop(1,'rgba(232,240,250,0)')}
  ctx.fillStyle=grad||'rgba(255,255,255,.22)';ctx.beginPath();ctx.moveTo(x,z);
  ctx.arc(x,z,coneR,dir-.42,dir+.42);ctx.closePath();ctx.fill();
  // Crisp white player arrow, pointing the way the character faces (+z is down on the map).
  ctx.save();ctx.translate(x,z);ctx.rotate(Math.PI-heading);
  ctx.fillStyle='#ffffff';ctx.strokeStyle='#0a1118';ctx.lineWidth=1.4*dpr;
  ctx.beginPath();ctx.moveTo(0,-u);ctx.lineTo(u*.72,u*.82);ctx.lineTo(0,u*.38);ctx.lineTo(-u*.72,u*.82);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
 resize();
 return {
  update,
  invalidate(){B.invalidateAll();dirty=true}, // rebake everything
  invalidateAt(x,z,r=3){B.invalidateAt(x,z,r);dirty=true}, // only what is under the circle (MM3 switches game.js to this)
  // A click or tap on the canvas as a world point {x,z}, or null.
  pick(clientX,clientY){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return null;const u=(clientX-r.left)/r.width,v=(clientY-r.top)/r.height;if(u<0||u>1||v<0||v>1)return null;if(size==='small'&&win)return {x:win.x0+u*win.W,z:win.z0+v*win.H};return {x:VIEW.x0+u*(VIEW.x1-VIEW.x0),z:VIEW.z0+v*(VIEW.z1-VIEW.z0)}},
  toggle(){size=size==='small'?'large':'small';canvas.classList.toggle('large',size==='large');resize()},
  get large(){return size==='large'}
 };
}