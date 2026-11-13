// The live main-menu scene, the pure part (notes/menu-scene-design.md): every animation rule is a function of time in seconds, so it can be tested
// without a renderer; plus the swap point for the vehicle and the small controller that decides when the scene draws. No three.js, no DOM.
// menu-scene.js builds the three.js scene from these; game.js draws it behind #welcome.
// The frame-rate cap (Settings > quality low uses the lower one). 60 so the character and the wind move smoothly: the scene is about 16 draw calls and one skinned character,
// roughly a twentieth of the game's own load, so even a GTX 1060 draws it in about 2 ms. frameDue gives 55 on a 165 Hz screen, 60 on a 60 Hz one.
export const MENU_FPS=60,MENU_FPS_LOW=30;
// The old still picture: the fallback when the scene cannot run (the page itself starts on a plain dark backdrop, never this picture, so there is no flash of it while loading).
export const MENU_STILL='linear-gradient(90deg,#0c0b08f2 0%,#0c0b08cc 32%,#0c0b0855 62%,#0c0b0810 100%),url(assets/menu-background.jpg)',STILL_AFTER_MS=6000;
const TAU=Math.PI*2,smooth=x=>{const c=Math.max(0,Math.min(1,x));return c*c*(3-2*c)};

// ── THE SWAP POINT ───────────────────────────────────────────────────────────────────────────────────────────────────
// The vehicle the character leans on. To drop in the ATV (side by side): change `prop` to its prop id (props.js) and set `lean` to where the
// character stands against it. Nothing else in the scene names the vehicle. x/z in metres, the vehicle centred on the origin, yaw in radians.
// lean.side: which side of the hull the character's back rests on (+1 = the +x side); lean.along: metres along the hull from its centre;
// lean.gap: metres between the hull and the character's centre; lean.angle: how far the spine tips back (radians).
export const MENU_VEHICLE={prop:'offroad',yaw:0,lean:{side:1,along:.7,gap:.24,angle:.13}};
// Which vehicle the menu shows: the newest one you own (highest "v<number>" uid) that has a stance below, with its paint; with none, MENU_VEHICLE. Unknown models and bad uids are skipped.
// along is about a quarter of the hull length from its centre, so the character stands by the door end of the side.
export const MENU_VEHICLES={offroad:MENU_VEHICLE,worktruck:{prop:'worktruck',yaw:0,lean:{side:1,along:.75,gap:.24,angle:.13}},flatbed:{prop:'flatbed',yaw:0,lean:{side:1,along:1.1,gap:.24,angle:.13}}};
export function menuVehicleFor(owned){
 let best=null,top=-1;
 for(const v of Array.isArray(owned)?owned:[]){const m=v&&typeof v.uid==='string'?/^v(\d{1,6})$/.exec(v.uid):null;if(!m||!Object.hasOwn(MENU_VEHICLES,v.model))continue;if(+m[1]>top){top=+m[1];best=v}}
 return best?{...MENU_VEHICLES[best.model],colour:typeof best.colour==='string'?best.colour:undefined}:MENU_VEHICLE;
}
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
export const menuPose=t=>({breath:breath(t),shift:weightShift(t),head:headTurn(t),plans:planRustle(t),camera:cameraDrift(t),light:lightAt(t),gust:gust(t)});

// ── The plans sheet: the day's cut plan, drawn in the colours of the game's map (terrain.js MINIMAP_COLOUR; a test keeps them equal) ──────────
// Units are millimetres on the 460 x 320 sheet. plansOps() turns the data into a flat list of drawing steps; menu-scene.js only replays them on a canvas.
export const PLANS_INK={paper:'#efe7cf',forest:'#82a653',cut:'#d4b45a',road:'#45494b',track:'#9c8462',water:'#3f7ea3',landing:'#8f9396',ink:'#2f3a33',today:'#b8442f'};
export const MENU_PLANS={width:460,height:320,margin:14,title:'CUT PLAN  RIDGELINE TIMBER',
 creek:[[14,70],[70,96],[104,150],[92,214],[128,270],[120,306]],
 road:[[300,306],[292,250],[262,206]], // the haul road: from the south edge up to the landing
 landing:{x:262,y:196,r:20},
 // state: 'cut' (felled, filled), 'today' (red outline), 'planned' (dashed)
 blocks:[{id:'A1',state:'cut',points:[[150,62],[228,52],[244,114],[170,130]]},{id:'A2',state:'today',points:[[262,52],[348,60],[340,136],[268,126]]},
  {id:'B1',state:'planned',points:[[330,170],[420,160],[432,240],[346,250]]},{id:'B2',state:'planned',points:[[150,180],[222,170],[226,250],[160,262]]}]};
export const blockCentre=points=>[points.reduce((s,p)=>s+p[0],0)/points.length,points.reduce((s,p)=>s+p[1],0)/points.length];
// Drawing steps, back to front: {op:'fill',colour,points} | {op:'line',colour,width,points,dash} | {op:'circle',colour,x,y,r} | {op:'text',colour,size,x,y,text,align}.
export function plansOps(plan=MENU_PLANS){
 const {width:w,height:h,margin:m,landing:L}=plan,K=PLANS_INK,ops=[],box=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
 ops.push({op:'fill',colour:K.paper,points:box(0,0,w,h)},{op:'fill',colour:K.forest,points:box(m,m,w-m,h-m)},{op:'line',colour:K.water,width:7,points:plan.creek});
 for(const b of plan.blocks)if(b.state==='cut'){ops.push({op:'fill',colour:K.cut,points:b.points});
  const [p0,p1,p2,p3]=b.points;for(let i=0;i<8;i++){const u=.2+.6*((i*5)%8)/7,v=.2+.6*((i*3)%8)/7;ops.push({op:'circle',colour:K.track,r:2,x:(p0[0]*(1-u)+p1[0]*u)*(1-v)+(p3[0]*(1-u)+p2[0]*u)*v,y:(p0[1]*(1-u)+p1[1]*u)*(1-v)+(p3[1]*(1-u)+p2[1]*u)*v})}} // stumps
 for(const b of plan.blocks)ops.push({op:'line',colour:K.track,width:4,points:[[L.x,L.y],blockCentre(b.points)]}); // skid tracks: landing to each block
 ops.push({op:'line',colour:K.road,width:8,points:plan.road});
 for(const b of plan.blocks){const c=blockCentre(b.points),today=b.state==='today';
  ops.push({op:'line',colour:today?K.today:K.ink,width:today?4:2,points:[...b.points,b.points[0]],dash:b.state==='planned'?[8,6]:null},{op:'text',colour:K.ink,size:16,x:c[0],y:c[1]-8,text:b.id,align:'center'})}
 ops.push({op:'circle',colour:K.landing,x:L.x,y:L.y,r:L.r});
 for(let i=-1;i<=1;i++)ops.push({op:'line',colour:K.ink,width:2.5,points:[[L.x-11,L.y+i*6],[L.x+11,L.y+i*6]]}); // the log deck
 ops.push({op:'text',colour:K.ink,size:10,x:L.x,y:L.y-L.r-4,text:'LANDING',align:'center'},{op:'text',colour:K.ink,size:13,x:m+8,y:m+18,text:plan.title,align:'left'});
 ops.push({op:'line',colour:K.ink,width:2,points:[[w-36,62],[w-36,34]]},{op:'fill',colour:K.ink,points:[[w-42,40],[w-36,26],[w-30,40]]},{op:'text',colour:K.ink,size:11,x:w-36,y:76,text:'N',align:'center'});
 ops.push({op:'line',colour:K.ink,width:2,points:[[160,292],[240,292]]},{op:'text',colour:K.ink,size:10,x:200,y:288,text:'100 m',align:'center'},{op:'line',colour:K.ink,width:2,points:[...box(m,m,w-m,h-m),[m,m]]});
 return ops;
}

// ── Ground cover: grass tufts and ferns around the clearing, bent by the wind in the vertex shader ────────────────────────────────────
// How many, and where: a ring from just inside the dirt's edge out into the trees, thickest near the clearing. Low quality draws 40%.
export const MENU_COVER={grass:1500,ferns:70,inner:6.3,outer:24,dirt:7.5};
const rnd=(i,k)=>{const v=Math.sin(i*12.9898+k*78.233)*43758.5453;return v-Math.floor(v)};
// keepOut: circles {x,z,r} nothing may stand in (the camera). amount: 0..1 of the counts. Deterministic: [{kind,x,z,yaw,scale}].
export function groundCover({grass,ferns,inner,outer,dirt}=MENU_COVER,keepOut=[],amount=1){
 const out=[],free=(x,z)=>keepOut.every(k=>Math.hypot(x-k.x,z-k.z)>=k.r);
 const add=(kind,want,k,r0,r1,pow)=>{for(let i=0,n=0;n<want&&i<want*3;i++){const a=rnd(i,k)*TAU,r=r0+(r1-r0)*rnd(i,k+1)**pow,x=Math.cos(a)*r,z=Math.sin(a)*r;if(!free(x,z))continue;n++;out.push({kind,x,z,yaw:rnd(i,k+2)*TAU,scale:(r<dirt?.6:.8)+.5*rnd(i,k+3)})}};
 add('grass',Math.round(grass*amount),1,inner,outer,1.8);add('fern',Math.round(ferns*amount),5,dirt+.4,outer*.7,1.2);
 return out;
}
// One tuft or fern as plain triangles: position [x,y,z,...] in metres, bend [0..1 per vertex] (0 = the root, which the wind never moves).
export function coverShape(kind){
 const position=[],bend=[],tri=(...v)=>{for(const [x,y,z,b] of v){position.push(x,y,z);bend.push(b)}};
 for(let f=0;f<7;f++){
  if(kind==='fern'){const a=f*TAU/7+.3*Math.sin(f*2.4),c=Math.cos(a),s=Math.sin(a),len=.55*(.8+.2*Math.sin(f*1.7)),W=[.03,.16,.12,0],
    at=(k,side)=>{const u=k/3,d=len*u,half=W[k]/2*side;return [c*d-s*half,.4*(2.2*u-1.6*u*u),s*d+c*half,u]}; // a frond: out from the centre, up, and drooping at the tip
   for(let k=0;k<2;k++)tri(at(k,-1),at(k,1),at(k+1,1),at(k,-1),at(k+1,1),at(k+1,-1));tri(at(2,-1),at(2,1),at(3,1))}
  else{const a=f*TAU/7+.5*Math.sin(f*3.1),c=Math.cos(a),s=Math.sin(a),r=.03+.05*((f*3)%7)/7,h=.26+.14*((f*5)%7)/7,lean=.1+.08*((f*2)%7)/7,
    at=(u,side)=>{const d=r+lean*u*u,half=.0225*side*(1-.45*u);return [c*d-s*half,h*u,s*d+c*half,u]}; // a blade: leaning out, narrowing to a point
   tri(at(0,-1),at(0,1),at(.55,1),at(0,-1),at(.55,1),at(.55,-1),at(.55,-1),at(.55,1),at(1,0))}
 }
 return {position,bend};
}
// The wind on the cover: how far (metres, along COVER_WIND x/z) a vertex with `bend` at ground spot x,z is pushed at time t. Waves run downwind.
// menu-scene.js writes the same formula into the vertex shader from these numbers (uTime = t, uGust = gust(t)).
export const COVER_WIND={x:.97,z:.243,lean:.03,sway:.02,gust:.04,speed:1.7,kx:.45,kz:.3};
export const coverBend=(t,x,z,bend)=>{const W=COVER_WIND,g=gust(t);return bend*bend*(W.lean*g+(W.sway+W.gust*g)*Math.sin(t*W.speed-x*W.kx-z*W.kz))};

// After saving in the character creator: Edit character on the main menu goes back to the menu (the scene shows the new look); a first character starts the game.
export const creatorReturn=({active,fromMenu})=>!active&&fromMenu?'menu':'game';

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
// setStill(on) puts the old picture behind the menu: only when the scene cannot run (failed, reduced motion, or the assets still missing after STILL_AFTER_MS), never while loading.
export function createMenuLive({build,ready=()=>true,menuVisible=()=>true,pageHidden=()=>false,reducedMotion=()=>false,setLive=()=>{},setStill=()=>{},fps=()=>MENU_FPS}){
 let scene=null,failed=false,disposed=false,last=-Infinity,start=null,live=false,frames=0,still=false,first=null;
 const show=on=>{if(on!==live){live=on;try{setLive(on)}catch{}}if(on)showStill(false)};
 const showStill=on=>{if(on!==still){still=on;try{setStill(on)}catch{}}};
 function tick(now){
  if(disposed)return 'off';
  const mode=menuMode({menuVisible:menuVisible(),pageHidden:pageHidden(),reducedMotion:reducedMotion(),ready:ready(),failed});
  if(first===null)first=now;
  if(mode==='static'){show(false);showStill(failed||reducedMotion()||now-first>STILL_AFTER_MS);return mode}
  if(mode==='paused'||!frameDue(now,last,fps()))return mode==='paused'?mode:'wait';
  try{
   if(!scene){scene=build();start=now}
   const dt=Math.min(.1,Math.max(0,(now-last)/1000))||0;last=now;
   scene.update((now-start)/1000,dt);scene.render();frames++;show(true);
  }catch(e){failed=true;show(false);showStill(true);try{scene?.dispose()}catch{}scene=null;return 'static'}
  return 'live';
 }
 return {tick,
  setAppearance(a){try{scene?.setAppearance(a)}catch{}},
  // The game has started: free the scene, for good (going back to the menu reloads the page).
  dispose(){if(disposed)return;disposed=true;try{scene?.dispose()}catch{}scene=null;show(false)},
  get live(){return live},get frames(){return frames},get built(){return !!scene},get failed(){return failed},get disposed(){return disposed}};
}
