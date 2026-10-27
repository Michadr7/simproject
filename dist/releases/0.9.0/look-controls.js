// Native capture is requested only on a direct canvas click. Free look is a
// complete fallback: hover rotates; edge turning continues beyond screen bounds.
export function createLookControls(canvas,doc,enabled,rotate,onUnlock,onMode){let touch=null,wasLocked=false,free=false,pending=false,blocked=false,last=null,edgeX=0,edgeY=0,intentional=false;
 const locked=()=>doc.pointerLockElement===canvas;
 function mode(reason=''){canvas.classList?.toggle('free-look',free&&!locked());onMode?.({mode:locked()?'captured':free?'free':'cursor',reason})}
 function fallback(reason){pending=false;blocked=true;if(enabled()){free=true;last=null;mode(reason)}}
 async function capture(native=false){if(!enabled()||locked())return;free=true;last=null;mode();if(!native||blocked||pending)return;if(!canvas.requestPointerLock){fallback('Pointer lock is not supported by this browser.');return}pending=true;try{await canvas.requestPointerLock();pending=false}catch(error){fallback((error?.name||'Capture denied')+': '+(error?.message||'Browser declined capture.'))}}
 function release(){free=false;last=null;edgeX=edgeY=0;touch=null;if(locked()){intentional=true;doc.exitPointerLock?.()}mode()}
 canvas.addEventListener('click',e=>{if(e.pointerType!=='touch')capture(true)});
 doc.addEventListener('mousemove',e=>{if(locked()&&enabled())rotate(e.movementX||0,e.movementY||0)});
 canvas.addEventListener('pointerdown',e=>{if(enabled()&&e.pointerType==='touch'){touch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}});
 canvas.addEventListener('pointermove',e=>{if(!enabled())return;if(touch&&touch.id===e.pointerId){rotate(e.clientX-touch.x,e.clientY-touch.y);touch={id:e.pointerId,x:e.clientX,y:e.clientY};return}if(!free||locked()||e.pointerType==='touch')return;if(last)rotate(e.clientX-last.x,e.clientY-last.y);last={x:e.clientX,y:e.clientY};const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;edgeX=x<.06?-(.06-x)/.06:x>.94?(x-.94)/.06:0;edgeY=y<.04?-(.04-y)/.04:y>.96?(y-.96)/.04:0;});
 canvas.addEventListener('pointerleave',()=>{last=null;edgeX=edgeY=0});for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,()=>touch=null);
 doc.addEventListener('pointerlockchange',()=>{const next=locked();pending=false;if(next&&!enabled()){release();return}if(wasLocked&&!next){free=false;last=null;if(!intentional)onUnlock();intentional=false}wasLocked=next;mode()});doc.addEventListener('pointerlockerror',()=>fallback('Browser blocked mouse capture. Free look is active.'));
 return {capture,release,locked,tick(dt){if(free&&!locked()&&enabled())rotate(edgeX*dt*650,edgeY*dt*350)},retry(){blocked=false;return capture(true)}};
}
