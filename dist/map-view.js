// Map view math (MM1): pure functions for the minimap revamp (crop window, zoom curve, world <-> pixel, pick, tiles, edge chevrons, culling). Implements notes/minimap-design.md sections 2-4, 8 and 9. No DOM, no three.js, no globals; time only through dt arguments.
// Conventions: north is -z and points UP the screen, so screen y grows with world z. A "view" is {cx,cz,mpp,w,h}: world centre, metres per DEVICE pixel, canvas size in device pixels.
export const WORLD_BOUNDS=Object.freeze({x0:-450,z0:-1200,x1:1050,z1:600}); // the planned 1500 x 1800 m world (map-master 1.x); callers may pass their own bounds
export const BASE_MPP=2,TILE_SIZE=128,TILE_MPP=.5,TILE_PX=TILE_SIZE/TILE_MPP,TILE_GUTTER=1; // BASE 2 m/px; tiles 128 m = 256 px (+1 px gutter, drawn from the inner 256)
export const LEVEL_SWITCH_MPDP=1; // a tile level is used when the view needs finer than 1.0 m per device pixel
export const FOOT_WIDTH=150; // metres across on foot, even sprinting
export const ZOOM_MAX_EXTRA=250,ZOOM_V_LOW=6; // driving: 150 m up to 6 m/s, 400 m at the top speed
// Fastest vehicle class today: shortbed (Kasumuchi S70), top 29 m/s (dist/vehicle.js CLASSES). The note said 28 and "lower if the fastest is lower"; the real top is HIGHER, so the curve ends at 29 and the full 400 m is reached at flat-out speed.
export const ZOOM_V_HIGH=29;
export const USER_ZOOM_STEPS=Object.freeze([.5,1,2]),ZOOM_MIN_W=60,ZOOM_MAX_W=800;
export const ZOOM_TAU_OUT=.8,ZOOM_TAU_IN=2.5,ZOOM_IN_HOLD=1.5; // seconds
export const LOOKAHEAD_MAX=.2,LOOKAHEAD_TAU=1,LOOKAHEAD_V_LOW=2,LOOKAHEAD_V_HIGH=10; // up to 0.2 W ahead, smoothed over 1 s, fading in between 2 and 10 m/s
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const ease=(dt,tau)=>1-Math.exp(-Math.max(0,dt)/tau); // frame-rate independent blend factor

// ---- views: world <-> device pixel -------------------------------------------------------------------------------------------
export const makeView=(cx,cz,widthM,w,h)=>({cx,cz,mpp:widthM/w,w,h}); // widthM = metres across the whole canvas width
export const viewWidthM=v=>v.mpp*v.w,viewHeightM=v=>v.mpp*v.h;
export const worldToPx=(v,x,z)=>({x:v.w/2+(x-v.cx)/v.mpp,y:v.h/2+(z-v.cz)/v.mpp});
export const pxToWorld=(v,px,py)=>({x:v.cx+(px-v.w/2)*v.mpp,z:v.cz+(py-v.h/2)*v.mpp});
// Zoom the view by factor (>1 = closer) keeping the world point under pixel (px,py) fixed: the full map's wheel zoom.
export const zoomAbout=(v,factor,px,py)=>{const p=pxToWorld(v,px,py),mpp=v.mpp/factor;return {...v,mpp,cx:p.x-(px-v.w/2)*mpp,cz:p.z-(py-v.h/2)*mpp}};
export const panBy=(v,dxPx,dyPx)=>({...v,cx:v.cx-dxPx*v.mpp,cz:v.cz-dyPx*v.mpp}); // drag by a pixel delta

// ---- pick: a pointer position on the canvas -> world x,z (or null outside) -----------------------------------------------------
// rect = the canvas' CSS box {left,top,width,height} (getBoundingClientRect); the view is in device pixels, so the CSS offset is scaled up.
export const pick=(v,rect,clientX,clientY)=>{
 const u=(clientX-rect.left)/rect.width,t=(clientY-rect.top)/rect.height;
 if(!(u>=0&&u<=1&&t>=0&&t<=1))return null;
 return pxToWorld(v,u*v.w,t*v.h)};

// ---- the crop window -----------------------------------------------------------------------------------------------------------
// Window of W metres across (aspect = w/h of the canvas) centred on (cx,cz); NEVER clamped at the world edge (the player stays centred).
export const cropWindow=(cx,cz,W,aspect=1)=>{const H=W/aspect;return {cx,cz,W,H,x0:cx-W/2,x1:cx+W/2,z0:cz-H/2,z1:cz+H/2}};
// Look-ahead step: the centre offset {x,z} eases toward the velocity direction * up to 0.2 W (fading in with speed), tau 1 s. On foot pass onFoot=true: the target is 0.
export const lookAheadStep=(prev,vx,vz,W,dt,onFoot=false)=>{
 const sp=Math.hypot(vx,vz),m=onFoot||sp<1e-6?0:LOOKAHEAD_MAX*W*smoothstep(LOOKAHEAD_V_LOW,LOOKAHEAD_V_HIGH,sp);
 const tx=sp>1e-6?vx/sp*m:0,tz=sp>1e-6?vz/sp*m:0,k=ease(dt,LOOKAHEAD_TAU);
 let x=prev.x+(tx-prev.x)*k,z=prev.z+(tz-prev.z)*k;
 const len=Math.hypot(x,z),cap=LOOKAHEAD_MAX*W; // W may have shrunk: never beyond 0.2 W
 if(len>cap){x*=cap/len;z*=cap/len}
 return {x,z}};
// Source rectangle of a baked image (covering `bounds`, at mpp metres per image pixel) for a window, with the matching destination rectangle on a w x h canvas.
// The part of the window outside the world is simply not covered (caller fills it with the off-world colour). null when the window misses the world entirely.
export const cropSource=(win,bounds,mpp,w,h)=>{
 const x0=Math.max(win.x0,bounds.x0),x1=Math.min(win.x1,bounds.x1),z0=Math.max(win.z0,bounds.z0),z1=Math.min(win.z1,bounds.z1);
 if(x1<=x0||z1<=z0)return null;
 return {sx:(x0-bounds.x0)/mpp,sy:(z0-bounds.z0)/mpp,sw:(x1-x0)/mpp,sh:(z1-z0)/mpp,
  dx:(x0-win.x0)/win.W*w,dy:(z0-win.z0)/win.H*h,dw:(x1-x0)/win.W*w,dh:(z1-z0)/win.H*h}};

// ---- tiles and level -----------------------------------------------------------------------------------------------------------
// Fixed world grid: tile i = floor((x - x0) / size). Returns the tiles touching the window that lie inside the world, nearest the window centre first.
export const tilesFor=(win,bounds=WORLD_BOUNDS,size=TILE_SIZE)=>{
 const nx=Math.ceil((bounds.x1-bounds.x0)/size),nz=Math.ceil((bounds.z1-bounds.z0)/size);
 const i0=Math.max(0,Math.floor((win.x0-bounds.x0)/size)),i1=Math.min(nx-1,Math.floor((win.x1-bounds.x0)/size));
 const j0=Math.max(0,Math.floor((win.z0-bounds.z0)/size)),j1=Math.min(nz-1,Math.floor((win.z1-bounds.z0)/size));
 const out=[];
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x0=bounds.x0+i*size,z0=bounds.z0+j*size;out.push({i,j,key:i+','+j,x0,z0,x1:x0+size,z1:z0+size,d:Math.hypot(x0+size/2-win.cx,z0+size/2-win.cz)})}
 return out.sort((a,b)=>a.d-b.d)};
// 'L0' (0.5 m tiles) when the window needs finer than 1.0 m per device pixel, else 'BASE' (boundary exactly 1.0 -> BASE).
export const levelFor=(W,devicePx)=>W/devicePx<LEVEL_SWITCH_MPDP?'L0':'BASE';

// ---- zoom ----------------------------------------------------------------------------------------------------------------------
// Target window width for a driving speed v (m/s, abs taken): 150 m to 6 m/s, smoothstep to 400 m at ZOOM_V_HIGH. userFactor is 0.5 / 1 / 2 (the '-' and '=' keys). On foot use footTarget.
export const zoomTarget=(v,userFactor=1)=>clamp((FOOT_WIDTH+ZOOM_MAX_EXTRA*smoothstep(ZOOM_V_LOW,ZOOM_V_HIGH,Math.abs(v)))*userFactor,ZOOM_MIN_W,ZOOM_MAX_W);
export const footTarget=(userFactor=1)=>clamp(FOOT_WIDTH*userFactor,ZOOM_MIN_W,ZOOM_MAX_W);
export const freshZoom=(W=FOOT_WIDTH)=>({W,lowFor:0});
// One smoothing step, frame-rate independent: W eases to the target with tau 0.8 s zooming out, 2.5 s zooming in; zooming in only starts once the target has been lower for 1.5 s (no pumping when braking at a junction).
export const smoothZoom=(s,target,dt)=>{
 if(target>=s.W){return {W:s.W+(target-s.W)*ease(dt,ZOOM_TAU_OUT),lowFor:0}}
 const lowFor=s.lowFor+Math.max(0,dt);
 if(lowFor<ZOOM_IN_HOLD)return {W:s.W,lowFor};
 return {W:s.W+(target-s.W)*ease(dt,ZOOM_TAU_IN),lowFor}};
// A user step: dir +1 zooms out (bigger factor), -1 in; returns the new index into USER_ZOOM_STEPS (clamped).
export const stepUserZoom=(idx,dir)=>clamp(idx+dir,0,USER_ZOOM_STEPS.length-1);

// ---- chevrons and culling ------------------------------------------------------------------------------------------------------
// A target off the view: null when inside the frame (inset px from the edge), else the point where the line from the centre to the target meets the inset frame, the screen angle (radians, atan2(dy,dx)), the distance in metres and whether to print it (> 1.5 W away).
export const edgeIndicator=(v,x,z,inset=8)=>{
 const p=worldToPx(v,x,z),cx=v.w/2,cy=v.h/2,dx=p.x-cx,dy=p.y-cy,hw=cx-inset,hh=cy-inset;
 if(Math.abs(dx)<=hw&&Math.abs(dy)<=hh)return null;
 const s=Math.min(dx!==0?hw/Math.abs(dx):Infinity,dy!==0?hh/Math.abs(dy):Infinity);
 const dist=Math.hypot(x-v.cx,z-v.cz);
 return {x:cx+dx*s,y:cy+dy*s,angle:Math.atan2(dy,dx),dist,showDistance:dist>1.5*viewWidthM(v)}};
// Items inside the window grown by margin metres, nearest the window centre first, at most max. pos(item) gives {x,z}; the default reads item.x and item.z.
export const cull=(items,win,margin,max,pos=it=>it)=>{
 const out=[];
 for(const it of items){const p=pos(it);
  if(p.x<win.x0-margin||p.x>win.x1+margin||p.z<win.z0-margin||p.z>win.z1+margin)continue;
  out.push({it,d:Math.hypot(p.x-win.cx,p.z-win.cz)})}
 out.sort((a,b)=>a.d-b.d);
 return out.slice(0,Math.max(0,max)).map(o=>o.it)};
