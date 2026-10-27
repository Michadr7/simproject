// Pointer lock gives continuous desktop look; touch retains drag controls.
export function createLookControls(canvas,doc,enabled,rotate,onUnlock,onError){let touch=null,wasLocked=false;
 const locked=()=>doc.pointerLockElement===canvas;
 async function capture(){if(!enabled()||locked())return;try{if(!canvas.requestPointerLock){onError();return}await canvas.requestPointerLock()}catch{onError()}}
 const release=()=>{touch=null;if(locked())doc.exitPointerLock?.()};
 canvas.addEventListener('pointerdown',e=>{if(!enabled())return;if(e.pointerType==='touch'){touch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}else capture()});
 doc.addEventListener('mousemove',e=>{if(locked()&&enabled())rotate(e.movementX||0,e.movementY||0)});
 canvas.addEventListener('pointermove',e=>{if(!touch||!enabled()||touch.id!==e.pointerId)return;rotate(e.clientX-touch.x,e.clientY-touch.y);touch={id:e.pointerId,x:e.clientX,y:e.clientY}});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>touch=null);
 doc.addEventListener('pointerlockchange',()=>{const next=locked();if(wasLocked&&!next)onUnlock();wasLocked=next});doc.addEventListener('pointerlockerror',onError);
 return {capture,release,locked};
}
