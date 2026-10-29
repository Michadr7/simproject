import {ZONES,WALKABLE,DIRT_ROADS,FIELDS} from './world.js';
import {MAP,riverPath} from './map-definition.js';

// Whole-world map, north (-z) up: the city in the south, the river and bridge across the middle, Willow Fields (west) and Pine Ridge (east) north of it.
// The static layer is drawn once (and again when a tree is felled); the
// player and markers are drawn on top at ~12 fps.
const VIEW=MAP.minimap.view;
const SIZES={small:{w:200,h:163},large:{w:600,h:490}};

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
  // Meadow, then the river, then each zone's ground, roads, fields, the bridge, buildings, trees and zone names.
  rect(ctx,VIEW,'#3d5a3c');
  for(const river of MAP.water.rivers){ctx.strokeStyle='#3f7ea3';ctx.lineWidth=river.width*k;ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();riverPath(river,6).forEach((p,i)=>i?ctx.lineTo(px(p.x),pz(p.z)):ctx.moveTo(px(p.x),pz(p.z)));ctx.stroke()}
  for(const w of WALKABLE)rect(ctx,w,ZONES[w.zone].color);
  for(const f of FIELDS)rect(ctx,f,{plowed:'#6b4f3a',wheat:'#d4b45a',green:'#82a653'}[f.surface]||'#a99348');
  for(const r of DIRT_ROADS)rect(ctx,r,'#9c8462');
  for(const r of cityRoads)rect(ctx,r,'#45494b');
  for(const b of MAP.water.bridges)rect(ctx,b,'#6f5b43');
  for(const b of buildings)rect(ctx,{x0:b.x-b.hx,x1:b.x+b.hx,z0:b.z-b.hz,z1:b.z+b.hz},'#33383a');
  ctx.fillStyle='#1f3a22';
  const r=Math.max(1,k*.55);
  for(const t of trees())if(t.standing)ctx.fillRect(px(t.x)-r/2,pz(t.z)-r/2,r,r);
  // Zone names.
  ctx.fillStyle='#ffffffcc';ctx.font=`${Math.round((size==='large'?13:8)*dpr)}px Arial`;ctx.textAlign='center';
  for(const zone of MAP.zones)ctx.fillText(ZONES[zone.id].label,px(zone.minimap.label.x),pz(zone.minimap.label.z));
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
