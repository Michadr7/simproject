// The live main-menu scene, the pure part (notes/menu-scene-design.md): every animation rule is a function of time in seconds, so it can be tested
// without a renderer; plus the swap point for the vehicle and the small controller that decides when the scene draws. No three.js, no DOM.
// menu-scene.js builds the three.js scene from these; game.js draws it behind #welcome.
export const MENU_FPS=24,MENU_FPS_LOW=15; // the frame-rate cap (Settings > quality low uses the lower one)
const TAU=Math.PI*2,smooth=x=>{const c=Math.max(0,Math.min(1,x));return c*c*(3-2*c)};

// ── THE SWAP POINT ───────────────────────────────────────────────────────────────────────────────────────────────────
// The vehicle the character leans on. To drop in the ATV (side by side): change `prop` to its prop id (props.js) and set `lean` to where the
// character stands against it. Nothing else in the scene names the vehicle. x/z in metres, the vehicle centred on the origin, yaw in radians.
// lean.side: which side of the hull the character's back rests on (+1 = the +x side); lean.along: metres along the hull from its centre;
// lean.gap: metres between the hull and the character's centre; lean.angle: how far the spine tips back (radians).
export const MENU_VEHICLE={prop:'offroad',yaw:0,lean:{side:1,along:.7,gap:.24,angle:.13}};
// Where the character stands for a vehicle `width` metres wide: {x, z, yaw} with the back to the hull.
export function leanSpot(vehicle,width){
 const {side,along,gap}=vehicle.lean,lx=side*(width/2+gap),lz=along,c=Math.cos(vehicle.yaw),s=Math.sin(vehicle.yaw);
 return {x:lx*c+lz*s,z:-lx*s+lz*c,yaw:vehicle.yaw+side*Math.PI/2};
}

// ── Animation rules: t in seconds, every result bounded and continuous ────────────────────────────────────────────────
// Breathing: 0..1, one breath every 4.2 s.
export const breath=t=>.5-.5*Math.cos(t*TAU/4.2);
// Weight shift from one leg to the other: -1..1, slow and uneven (two sines that do not line up).
export const weightShift=t=>.65*Math.sin(t*TAU/11)+.35*Math.sin(t*TAU/17.3+1.1);
// The head: down at the plans most of the time, up to the horizon for a few seconds in every 16. look: 0 = plans, 1 = horizon.
export const HEAD_CYCLE=16;
export function headTurn(t){
 const p=((t%HEAD_CYCLE)+HEAD_CYCLE)%HEAD_CYCLE,look=smooth((p-9)/1.4)*(1-smooth((p-13.6)/1.4));
 return {look,yaw:look*.6,pitch:.34-look*.4};
}
// The plans in the hands: a small flutter that swells with the wind gusts. Radians of tilt and roll.
export function planRustle(t){const g=gust(t);return {tilt:(.02+.05*g)*Math.sin(t*9.1),roll:(.015+.04*g)*Math.sin(t*6.3+.7)}}
// Wind gusts: 0..1.
export const gust=t=>.5+.3*Math.sin(t*TAU/7.5)+.2*Math.sin(t*TAU/3.1+2);
// A tree's sway (radians) for its own phase: never more than 0.035 rad (2 degrees).
export const windSway=(t,phase=0)=>(.008+.022*gust(t+phase*.6))*Math.sin(t*1.3+phase);
// The camera: a slow drift on a small ellipse around its home, always looking at the same point. Returns offsets in metres.
export const cameraDrift=t=>({x:.45*Math.sin(t*TAU/38),y:.12*Math.sin(t*TAU/29+1),z:.3*Math.cos(t*TAU/38)});
// The light: a late afternoon that warms and cools over 4 minutes. warmth 0..1; intensity of the sun; sky colour as linear-ish r,g,b 0..1.
export function lightAt(t){
 const warmth=.5-.5*Math.cos(t*TAU/240);
 return {warmth,sun:2.6-.7*warmth,sky:[.62+.2*warmth,.72-.1*warmth,.8-.28*warmth],angle:.5+.25*warmth};
}
// Dust mote i of n at time t: drifts downwind and wraps inside a box 8 x 2.4 x 8 m around the scene. Deterministic.
export function hazeAt(t,i){
 const a=Math.sin(i*12.9898)*43758.5453,b=Math.sin(i*78.233)*12543.123,r1=a-Math.floor(a),r2=b-Math.floor(b),wrap=(v,size)=>((v%size)+size)%size-size/2;
 return {x:wrap(r1*8+t*(.12+.1*r2),8),y:.3+2.4*(.5+.5*Math.sin(t*.21+i*1.7))*r2,z:wrap(r2*8+t*.05*(r1-.5),8)};
}
// Everything the scene needs for one frame.
export const menuPose=t=>({breath:breath(t),shift:weightShift(t),head:headTurn(t),plans:planRustle(t),camera:cameraDrift(t),light:lightAt(t)});

// ── When to draw ─────────────────────────────────────────────────────────────────────────────────────────────────────
// 'live' = draw the scene; 'paused' = keep what is on screen (menu covered, tab in the background); 'static' = the picture (assets/menu-background.jpg).
export function menuMode({menuVisible,pageHidden,reducedMotion,ready,failed}){
 if(failed||reducedMotion||!ready)return 'static';
 return menuVisible&&!pageHidden?'live':'paused';
}
// True when a frame is due at `fps` (ms clocks). A little slack so a 60 Hz screen gives 20 or 30, not 15.
export const frameDue=(now,last,fps)=>now-last>=1000/fps-2;

// The controller game.js ticks every animation frame while the menu is up. build() -> {update(t,dt),render(),setAppearance(a),dispose()} or throws;
// setLive(on) shows the canvas through the menu (on) or the still picture (off). It never throws: any failure falls back to the picture for good.
export function createMenuLive({build,ready=()=>true,menuVisible=()=>true,pageHidden=()=>false,reducedMotion=()=>false,setLive=()=>{},fps=()=>MENU_FPS}){
 let scene=null,failed=false,disposed=false,last=-Infinity,start=null,live=false,frames=0;
 const show=on=>{if(on!==live){live=on;try{setLive(on)}catch{}}};
 function tick(now){
  if(disposed)return 'off';
  const mode=menuMode({menuVisible:menuVisible(),pageHidden:pageHidden(),reducedMotion:reducedMotion(),ready:ready(),failed});
  if(mode==='static'){show(false);return mode}
  if(mode==='paused'||!frameDue(now,last,fps()))return mode==='paused'?mode:'wait';
  try{
   if(!scene){scene=build();start=now}
   const dt=Math.min(.1,Math.max(0,(now-last)/1000))||0;last=now;
   scene.update((now-start)/1000,dt);scene.render();frames++;show(true);
  }catch(e){failed=true;show(false);try{scene?.dispose()}catch{}scene=null;return 'static'}
  return 'live';
 }
 return {tick,
  setAppearance(a){try{scene?.setAppearance(a)}catch{}},
  // The game has started: free the scene, for good (going back to the menu reloads the page).
  dispose(){if(disposed)return;disposed=true;try{scene?.dispose()}catch{}scene=null;show(false)},
  get live(){return live},get frames(){return frames},get built(){return !!scene},get failed(){return failed},get disposed(){return disposed}};
}
