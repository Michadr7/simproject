import {ZONES,WALKABLE,DIRT_ROADS,FIELDS,CITY_WEST,CITY_EAST} from './world.js';

// Whole-world strip map: farm (west) · city · forest (east), north (-z) up.
// The static layer is drawn once (and again when a tree is felled); the
// player and markers are drawn on top at ~12 fps.
const VIEW={x0:-176,x1:176,z0:-62,z1:62};
const SIZES={small:{w:264,h:94},large:{w:720,h:256}};

export function createMinimap(doc,{canvas,cityRoads=[],buildings=[],trees=()=>[]}){
 if(!canvas)return {update(){},toggle(){},invalidate(){},get large(){return false}};
 const dpr=Math.min(2,globalThis.devicePixelRatio||1);
 const layer=doc.createElement('canvas');
 let size='small',dirty=true,timer=0;
 function resize(){
  const {w,h}=SIZES[size];
  for(const c of [canvas,layer]){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
  canvas.style.width=w+'px';canvas.style.height=h+'px';dirty=true;
 }
 const scale=()=>canvas.width/(VIEW.x1-VIEW.x0);
 const px=x=>(x-VIEW.x0)*scale(),pz=z=>(z-VIEW.z0)*scale();
 function rect(ctx,r,color){ctx.fillStyle=color;ctx.fillRect(px(r.x0),pz(r.z0),(r.x1-r.x0)*scale(),(r.z1-r.z0)*scale())}
 function drawStatic(){
  const ctx=layer.getContext('2d'),k=scale();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#1d2b26';ctx.fillRect(0,0,layer.width,layer.height);
  // Zone ground colours: brown/yellow farm, grey city, green forest.
  rect(ctx,{x0:VIEW.x0,x1:CITY_WEST,z0:VIEW.z0,z1:VIEW.z1},'#8d7a45');
  rect(ctx,{x0:CITY_WEST,x1:CITY_EAST,z0:VIEW.z0,z1:VIEW.z1},'#5d6265');
  rect(ctx,{x0:CITY_EAST,x1:VIEW.x1,z0:VIEW.z0,z1:VIEW.z1},'#2f4f2e');
  for(const w of WALKABLE)rect(ctx,w,w.zone==='farm'?ZONES.farm.color:w.zone==='forest'?ZONES.forest.color:ZONES.city.color);
  for(const f of FIELDS){rect(ctx,f,'#a99348');ctx.strokeStyle='#6b5530';ctx.lineWidth=Math.max(1,k*.5);ctx.strokeRect(px(f.x0),pz(f.z0),(f.x1-f.x0)*k,(f.z1-f.z0)*k)}
  for(const r of DIRT_ROADS)rect(ctx,r,'#9c8462');
  for(const r of cityRoads)rect(ctx,r,'#45494b');
  for(const b of buildings)rect(ctx,{x0:b.x-b.hx,x1:b.x+b.hx,z0:b.z-b.hz,z1:b.z+b.hz},'#33383a');
  ctx.fillStyle='#1f3a22';
  const r=Math.max(1,k*.55);
  for(const t of trees())if(t.standing)ctx.fillRect(px(t.x)-r/2,pz(t.z)-r/2,r,r);
  // Zone names.
  ctx.fillStyle='#ffffffcc';ctx.font=`${Math.round((size==='large'?13:8)*dpr)}px Arial`;ctx.textAlign='center';
  ctx.fillText(ZONES.farm.label,px(-114),pz(-50));ctx.fillText(ZONES.city.label,px(-1),pz(-52));ctx.fillText(ZONES.forest.label,px(113),pz(-50));
  dirty=false;
 }
 function update(dt,{player,heading,yaw,markers=[]}){
  timer+=dt;if(timer<1/12&&!dirty)return;timer=0;
  if(dirty)drawStatic();
  const ctx=canvas.getContext('2d'),k=scale();
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,0,0);
  for(const m of markers){ctx.fillStyle=m.color;ctx.beginPath();ctx.arc(px(m.x),pz(m.z),Math.max(2.5*dpr,k*1.4),0,Math.PI*2);ctx.fill()}
  if(!player)return;
  const x=px(player.x),z=pz(player.z),u=(size==='large'?7:5)*dpr;
  // Camera view wedge (the camera looks along -sin(yaw), -cos(yaw)).
  ctx.fillStyle='#ffffff22';ctx.beginPath();ctx.moveTo(x,z);
  ctx.arc(x,z,u*4,Math.atan2(-Math.cos(yaw),-Math.sin(yaw))-.5,Math.atan2(-Math.cos(yaw),-Math.sin(yaw))+.5);ctx.closePath();ctx.fill();
  // Player arrow, pointing the way the character faces (+z is down on the map).
  ctx.save();ctx.translate(x,z);ctx.rotate(Math.PI-heading);
  ctx.fillStyle='#fff6c8';ctx.strokeStyle='#1d2b26';ctx.lineWidth=dpr;
  ctx.beginPath();ctx.moveTo(0,-u);ctx.lineTo(u*.7,u*.8);ctx.lineTo(0,u*.4);ctx.lineTo(-u*.7,u*.8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 }
 resize();
 return {
  update,
  invalidate(){dirty=true},
  toggle(){size=size==='small'?'large':'small';canvas.classList.toggle('large',size==='large');resize()},
  get large(){return size==='large'}
 };
}
