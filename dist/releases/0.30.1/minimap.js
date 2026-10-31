import {ZONES,WALKABLE,DIRT_ROADS,FIELDS} from './world.js';
import {MAP,riverPath} from './map-definition.js';
import {terrain,MINIMAP_COLOUR} from './terrain.js';
import {propInfo} from './props.js';

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
  // The ground comes from the terrain mask (terrain.js): each pixel takes its cell's surface, or its zone's colour on walkable grass, or meadow.
  {const t=terrain(),w=layer.width,h=layer.height,img=ctx.createImageData?.(w,h),rgb=c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)];
   const surfaceRgb=Object.fromEntries(Object.entries(MINIMAP_COLOUR).map(([k,c])=>[k,rgb(c)])),zoneRgb=MAP.zones.map(z=>rgb(z.color)),meadow=rgb('#3d5a3c');
   if(img?.data)for(let y=0;y<h;y++)for(let x=0;x<w;x++){const wx=VIEW.x0+(x+.5)/k,wz=VIEW.z0+(y+.5)/k,c=t.index(wx,wz);let col=meadow;
    if(c>=0){const s=t.surface[c];if(surfaceRgb[s])col=surfaceRgb[s];else if(t.walk[c]&&t.zone[c])col=zoneRgb[t.zone[c]-1]}
    const o=(y*w+x)*4;img.data[o]=col[0];img.data[o+1]=col[1];img.data[o+2]=col[2];img.data[o+3]=255}
   if(img?.data)ctx.putImageData(img,0,0)}
  for(const b of buildings)rect(ctx,{x0:b.x-b.hx,x1:b.x+b.hx,z0:b.z-b.hz,z1:b.z+b.hz},'#33383a');
  // Buildings placed from models (houses, shops, barns, the sawmill): their footprints, turned to face the way they stand. Vehicles and yard props are left off.
  ctx.fillStyle='#3f4548';for(const l of MAP.landmarks){if(l.decor)continue;const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),xs=[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>l.x+x*c+z*s)),zs=[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>l.z-x*s+z*c));
   ctx.fillRect(px(Math.min(...xs)),pz(Math.min(...zs)),(Math.max(...xs)-Math.min(...xs))*k,(Math.max(...zs)-Math.min(...zs))*k)}
  // Reserved plots: a coloured outline (and the id on the big map).
  {const colour={residential:'#2fbf9f',commercial:'#b0529b',industrial:'#e0a02e'};ctx.lineWidth=Math.max(1,dpr);for(const plot of MAP.reserved){ctx.strokeStyle=colour[plot.kind];ctx.strokeRect(px(plot.x0),pz(plot.z0),(plot.x1-plot.x0)*k,(plot.z1-plot.z0)*k);if(size==='large'){ctx.fillStyle=colour[plot.kind];ctx.font=`${Math.round(11*dpr)}px Arial`;ctx.textAlign='center';ctx.fillText(plot.id,px((plot.x0+plot.x1)/2),pz((plot.z0+plot.z1)/2)+4*dpr)}}}
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
