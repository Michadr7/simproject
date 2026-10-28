// A fresh center-to-edge motion is required after every interaction before
// free-look edge turning can resume. Async capture attempts cannot outlive menus.
export function createLookControls(canvas,doc,enabled,rotate,onUnlock,onMode){let touch=null,wasLocked=false,free=false,pending=false,blocked=false,last=null,edgeX=0,edgeY=0,intentional=false,armed=false,skipLockedMove=true,epoch=0;
 const locked=()=>doc.pointerLockElement===canvas;
 function resetMotion(){last=null;edgeX=edgeY=0;armed=false;skipLockedMove=true;touch=null}
 function mode(reason=''){canvas.classList?.toggle('free-look',free&&!locked());onMode?.({mode:locked()?'captured':free?'free':'cursor',reason})}
 function fallback(reason){pending=false;blocked=true;resetMotion();if(enabled()){free=true;mode(reason)}}
 async function capture(native=false){if(!enabled())return;resetMotion();if(locked())return;free=true;mode();if(!native||blocked||pending)return;const request=++epoch;if(!canvas.requestPointerLock){fallback('Pointer lock is not supported by this browser.');return}pending=true;try{await canvas.requestPointerLock();if(request===epoch)pending=false}catch(error){if(request===epoch)fallback((error?.name||'Capture denied')+': '+(error?.message||'Browser declined capture.'))}}
 function release(){++epoch;pending=false;free=false;resetMotion();if(locked()){intentional=true;doc.exitPointerLock?.()}mode()}
 canvas.addEventListener('click',e=>{if(e.pointerType!=='touch')capture(true)});
 doc.addEventListener('mousemove',e=>{if(!enabled()){resetMotion();return}if(locked()){if(skipLockedMove){skipLockedMove=false;return}rotate(Math.max(-160,Math.min(160,e.movementX||0)),Math.max(-120,Math.min(120,e.movementY||0)))}});
 canvas.addEventListener('pointerdown',e=>{if(enabled()&&e.pointerType==='touch'){touch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}});
 canvas.addEventListener('pointermove',e=>{if(!enabled()){resetMotion();return}if(touch&&touch.id===e.pointerId){rotate(e.clientX-touch.x,e.clientY-touch.y);touch={id:e.pointerId,x:e.clientX,y:e.clientY};return}if(!free||locked()||e.pointerType==='touch')return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;if(!last){last={x:e.clientX,y:e.clientY};return}const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};if(!dx&&!dy)return;rotate(Math.max(-160,Math.min(160,dx)),Math.max(-120,Math.min(120,dy)));if(x>.12&&x<.88&&y>.1&&y<.9)armed=true;edgeX=armed?(x<.06?-(.06-x)/.06:x>.94?(x-.94)/.06:0):0;edgeY=0;});
 canvas.addEventListener('pointerleave',resetMotion);for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,()=>touch=null);
 doc.addEventListener('pointerlockchange',()=>{const next=locked();pending=false;resetMotion();if(next&&(!enabled()||!free)){wasLocked=true;release();return}if(wasLocked&&!next){free=false;if(!intentional)onUnlock();intentional=false}wasLocked=next;mode()});doc.addEventListener('pointerlockerror',()=>{if(pending)fallback('Browser blocked mouse capture. Free look is active.')});
 return {capture,release,locked,resetMotion,tick(dt){if(!enabled()){resetMotion();return}if(free&&!locked()&&armed&&edgeX)rotate(Math.max(-1,Math.min(1,edgeX))*Math.min(dt,.05)*650,0)},retry(){blocked=false;return capture(true)}};
}
