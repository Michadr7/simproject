// MM3: the corner minimap is a local window (north up, centred on you, 150 m on foot, wider and shifted ahead when driving fast, world edge dark + dashed border, route culled, off-window pin/job chevrons, invalidateAt).
import assert from 'node:assert/strict';
import {createMinimap} from '../dist/minimap.js';
import {MAP} from '../dist/map-definition.js';
const VIEW=MAP.minimap.view,calls={draw:[],lineTo:0,dash:0,strokeRect:0,fill:0},bakeCalls={at:[],all:0};
const ctx=new Proxy({drawImage:(...a)=>calls.draw.push(a),lineTo:()=>{calls.lineTo++},setLineDash:a=>{if(a.length)calls.dash++},strokeRect:()=>{calls.strokeRect++}},{get:(o,k)=>o[k]??(()=>{}),set:()=>true});
const canvas={width:0,height:0,style:{},classList:{toggle(){}},getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:200,height:200})};
const bake={baseReady:true,base:{},bounds:VIEW,version:0,want(){},tile:()=>null,step(){},invalidateAll(){bakeCalls.all++},invalidateAt(x,z,r){bakeCalls.at.push([x,z,r])}};
const mm=createMinimap({},{canvas,fixedDpr:1,bake}),frame=(o,n=1)=>{for(let i=0;i<n;i++)mm.update(1/60,{yaw:0,heading:0,...o})};
assert.equal(canvas.width,200);assert.equal(canvas.height,200,'the corner map is 200 x 200');
const span=()=>{const a=mm.pick(0,0),b=mm.pick(200,200);return {w:b.x-a.x,h:b.z-a.z,cx:(a.x+b.x)/2,cz:(a.z+b.z)/2}};
// on foot: 150 m across, centred on the player, one BASE blit that covers the whole canvas
frame({player:{x:0,z:-100}},30);let s=span();assert(Math.abs(s.w-150)<.01&&Math.abs(s.h-150)<.01,'150 m both ways');assert(Math.abs(s.cx)<.01&&Math.abs(s.cz+100)<.01,'centred');
const d=calls.draw.at(-1);assert.equal(d[5],0);assert.equal(d[6],0);assert.equal(d[7],200);assert.equal(d[8],200,'inside the world the crop covers the canvas');
assert(calls.dash>0&&calls.strokeRect>0,'dashed world border drawn');
// at the west edge of the world the window is NOT clamped: the player stays centred and the ground covers half the canvas
calls.draw.length=0;frame({player:{x:VIEW.x0,z:-100}},30);s=span();assert(Math.abs(s.cx-VIEW.x0)<.01,'player stays centred at the edge');const e=calls.draw.at(-1);assert(Math.abs(e[5]-100)<1e-6&&Math.abs(e[7]-100)<1e-6,'ground covers only the in-world half: '+e.slice(5));
// sprinting on foot does not zoom; driving flat out zooms toward 400 m and looks ahead
frame({player:{x:0,z:-100},speed:9,driving:false},300);assert(Math.abs(span().w-150)<.01,'on foot never zooms');
frame({player:{x:0,z:-100},speed:29,driving:true,heading:Math.PI/2},60*12);s=span();assert(s.w>390&&s.w<=400.01,'driving fast: about 400 m, got '+s.w);assert(s.cx>.15*s.w&&s.cx<=.2*s.w+.5,'centre shifted ahead (+x) by up to 0.2 W, got '+s.cx);
// braking: the window does not shrink at once (zoom-in hold 1.5 s)
frame({player:{x:0,z:-100},speed:0,driving:true,heading:Math.PI/2},60);assert(span().w>385,'no pumping when braking: '+span().w);
frame({player:{x:0,z:-100},speed:0,driving:false},60*15);assert(span().w<160,'back to 150 m eventually: '+span().w);
// the route is culled: far points draw no line, near points do
const far={start:[900,900],from:0,points:[[910,900],[920,900],[930,905]]},near={start:[0,-100],from:0,points:[[10,-100],[20,-100],[30,-95]]};
calls.lineTo=0;frame({player:{x:0,z:-100}},13);const base=calls.lineTo; // the player arrow's own lines
calls.lineTo=0;frame({player:{x:0,z:-100},route:far},13);assert.equal(calls.lineTo,base,'far route culled');
calls.lineTo=0;frame({player:{x:0,z:-100},route:near},13);assert(calls.lineTo>base+5,'near route drawn (both passes), lineTo '+calls.lineTo+' vs '+base);
// off-window pin and job marker still render (chevrons) without error; the pin on screen draws the pin
frame({player:{x:0,z:-100},pin:{x:300,z:-100},markers:[{x:-300,z:-100,color:'#f2ca79'}]},13);frame({player:{x:0,z:-100},pin:{x:10,z:-100}},13);
// invalidateAt reaches the bake; invalidate rebakes all
mm.invalidateAt(5,6);mm.invalidateAt(7,8,4);mm.invalidate();assert.deepEqual(bakeCalls.at,[[5,6,3],[7,8,4]]);assert.equal(bakeCalls.all,1);
console.log('PASS minimap-local: 200x200 local window, 150 m on foot, speed zoom + look-ahead, no clamp at the world edge, dashed border, route culling, chevrons, invalidateAt');
