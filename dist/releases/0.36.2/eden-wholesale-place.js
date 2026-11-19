// eden-wholesale-place.js: how EDEN WHOLESALE stands in the world (stage W-PLACE; notes/eval/outbox/eden-wholesale.md wiring option A): the prop info world.js reads for its landmark, the GLB triangle split game.js applies (body, window glass, lamp lenses) and when windows and lamps glow.
// Pure: no DOM, no three.js, no globals. placeholders.js turns PROP_INFO into the 'eden-wholesale' prop (an empty group game.js fills with the GLB), so world.js, town.js, map-bake.js and the ground cover treat it like any landmark.
import {ID,MODEL,SIZE,DOOR,SOLIDS} from './eden-wholesale.js';
import {windowsLit,isDark,WINDOW} from './night-lights-rules.js';

export const PROP_ID=ID;
export const POSE=Object.freeze({x:36,z:-67.5,yaw:0}); // site 1, behind the Pharmacy and Bank (owner 2026-11-19): footprint x 30..42, z -72..-63, front, door and dock facing south onto the car park
// The props-assets.js record shape: size, footprint, colliders {x,z,hx,hz} (here the registry's SOLIDS, local), no walkable floor (the 0.15 m dock apron is walked as ground), the shop door.
export const PROP_INFO=Object.freeze({placeholder:true,model:MODEL,width:SIZE.w,depth:SIZE.d,height:SIZE.h,floor:null,
 footprint:Object.freeze({x0:-SIZE.w/2,x1:SIZE.w/2,z0:-SIZE.d/2,z1:SIZE.d/2}),
 door:Object.freeze({x:DOOR.x,z:DOOR.z,width:DOOR.width,height:DOOR.height}),
 colliders:Object.freeze(SOLIDS.map(s=>Object.freeze({id:s.id,x:+((s.x0+s.x1)/2).toFixed(4),z:+((s.z0+s.z1)/2).toFixed(4),hx:+((s.x1-s.x0)/2).toFixed(4),hz:+((s.z1-s.z0)/2).toFixed(4),h:s.y})))});

// Window glass in the GLB: the build script paints panes with two colours (sRGB #3b5566 and #6c8a99), toned by .85..1.12; COLOR_0 holds them as linear bytes.
// A colour is glass when it is one of the two times a tone k in that range, within 7 sRGB units per channel (the dark linear bytes are coarse).
const GLASS=[[59,85,102],[108,138,153]],TONE=[.85,1.12],TOL=7;
const toSrgb=v=>{const c=v/255;return 255*(c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055)};
export function isGlassSrgb(r,g,b){for(const [gr,gg,gb] of GLASS){const k=b/gb;if(k<TONE[0]||k>TONE[1])continue;if(Math.abs(r-gr*k)<=TOL&&Math.abs(g-gg*k)<=TOL)return true}return false}
export const isGlassLinear=(r,g,b)=>isGlassSrgb(toSrgb(r),toSrgb(g),toSrgb(b));
// index: the primitive's triangle indices; colors: its COLOR_0 array (linear bytes 0..255, itemSize 3 or 4); glow: the mesh extras {from, count} (the lamp lenses, the last triangles).
// Returns {index (same type, reordered), groups:[{start,count,material}], counts:{body,windows,lenses}}: material 0 = body, 1 = window glass, 2 = lamp lenses (triangles).
export function splitTriangles(index,colors,itemSize=4,glow=null){
 const n=index.length,lensFrom=glow&&Number.isInteger(glow.from)?glow.from:n,body=[],win=[],lens=[];
 for(let t=0;t<n;t+=3){const v=index[t]*itemSize,list=t>=lensFrom?lens:isGlassLinear(colors[v],colors[v+1],colors[v+2])?win:body;list.push(index[t],index[t+1],index[t+2])}
 const out=new index.constructor(n);out.set(body,0);out.set(win,body.length);out.set(lens,body.length+win.length);
 return {index:out,groups:[{start:0,count:body.length,material:0},{start:body.length,count:win.length,material:1},{start:body.length+win.length,count:lens.length,material:2}],counts:{body:body.length/3,windows:win.length/3,lenses:lens.length/3}};
}
// Night glow: the windows follow the night-lights.js shop rule with staff hours (06:00-19:30: stocking before 07:00, closing up after 17:00; the 07:00-17:00 trade hours alone fall wholly in daylight);
// the lamp lenses glow fully in the dark and stay faint by day. sky: the sky state ({sunHeight}). key changes only when something must be redrawn.
export const WINDOW_HOURS=Object.freeze([360,1170]),WINDOW_GLOW=Object.freeze({colour:WINDOW.colour,strength:WINDOW.strength}),LAMP_GLOW=Object.freeze({night:2,day:.15});
export function glowAt(minutes,sky){const dark=!!sky&&isDark(sky),on=windowsLit(ID,minutes,{kind:'shop',dark,hours:WINDOW_HOURS});
 return {windows:on?WINDOW.strength:0,lamps:dark?LAMP_GLOW.night:LAMP_GLOW.day,key:(on?1:0)+(dark?2:0)}}
