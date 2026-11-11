// Mikkadr Hub, P3c: a small orbit control for the 3D viewer (the repo vendors no OrbitControls). Drag to turn, wheel to zoom, double-click to reset, right-drag or shift-drag to move
// the view sideways, two fingers to pinch. The maths is pure and exported (`orbitPosition`, `applyDrag`, `applyZoom`, `applyPan`) so tests can pin it; the class only wires events.
// State: {target:{x,y,z}, yaw, pitch, distance}. yaw 0 looks from +z toward the target, pitch is up from the horizon, +y is up, 1 unit = 1 m.
export const PITCH_LIMIT=Math.PI/2-.05;
export const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

export function orbitPosition(s){
 const c=Math.cos(s.pitch);
 return {x:s.target.x+s.distance*c*Math.sin(s.yaw),y:s.target.y+s.distance*Math.sin(s.pitch),z:s.target.z+s.distance*c*Math.cos(s.yaw)};
}
export const applyDrag=(s,dx,dy,speed=.0065)=>({...s,yaw:s.yaw-dx*speed,pitch:clamp(s.pitch+dy*speed,-PITCH_LIMIT,PITCH_LIMIT)});
// Each wheel notch (about 100 units) changes the distance by about 12 percent, always staying between min and max.
export const applyZoom=(s,deltaY,min,max)=>({...s,distance:clamp(s.distance*Math.exp(deltaY*.0012),min,max)});
// A pan moves the target along the camera's right and up vectors by `perPixel` metres per pixel (the viewer passes distance times a constant).
export function applyPan(s,dx,dy,perPixel){
 const right={x:Math.cos(s.yaw),y:0,z:-Math.sin(s.yaw)},up={x:-Math.sin(s.pitch)*Math.sin(s.yaw),y:Math.cos(s.pitch),z:-Math.sin(s.pitch)*Math.cos(s.yaw)};
 return {...s,target:{x:s.target.x-right.x*dx*perPixel+up.x*dy*perPixel,y:s.target.y-right.y*dx*perPixel+up.y*dy*perPixel,z:s.target.z-right.z*dx*perPixel+up.z*dy*perPixel}};
}

export class OrbitControl{
 constructor(camera,element,{onChange=()=>{}}={}){
  this.camera=camera;this.element=element;this.onChange=onChange;this.min=.05;this.max=500;
  this.home={target:{x:0,y:0,z:0},yaw:.67,pitch:.33,distance:5};this.state={...this.home};
  const pointers=new Map();let pinch=0;
  element.style.touchAction='none';
  element.addEventListener('contextmenu',e=>e.preventDefault());
  element.addEventListener('pointerdown',e=>{element.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y)}});
  const end=e=>{pointers.delete(e.pointerId);pinch=0};
  element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);
  element.addEventListener('pointermove',e=>{
   const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
   if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch)this.state=applyZoom(this.state,(pinch-d)*2.2,this.min,this.max);pinch=d}
   else if(pointers.size===1&&(e.buttons&2||e.shiftKey))this.state=applyPan(this.state,dx,dy,this.state.distance*.0016);
   else if(pointers.size===1)this.state=applyDrag(this.state,dx,dy);
   this.update();
  });
  element.addEventListener('wheel',e=>{e.preventDefault();this.state=applyZoom(this.state,e.deltaMode===1?e.deltaY*33:e.deltaY,this.min,this.max);this.update()},{passive:false});
  element.addEventListener('dblclick',()=>this.reset());
 }
 // Frames a new model: `home` replaces the reset view.
 setHome(home,{min,max}={}){this.home={...home,target:{...home.target}};if(min)this.min=min;if(max)this.max=max;this.reset()}
 reset(){this.state={...this.home,target:{...this.home.target}};this.update()}
 update(){const p=orbitPosition(this.state);this.camera.position.set(p.x,p.y,p.z);this.camera.lookAt(this.state.target.x,this.state.target.y,this.state.target.z);this.onChange()}
}
