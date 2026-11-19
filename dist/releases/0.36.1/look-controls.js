// A fresh center-to-edge motion is required after every interaction before
// free-look edge turning can resume. Async capture attempts cannot outlive menus.
// Free look (cursor visible, pointer lock unavailable): the camera also turns while the cursor rests in the outer EDGE_ZONE of the left or right side.
// The turn eases in (the square of how far into the zone the cursor is) up to EDGE_MAX_SPEED mouse-pixels a second, so grazing the edge is a slow drift
// and slamming into it is not a spin. Tune the three numbers here.
export const EDGE_ZONE=.06,EDGE_MAX_SPEED=420,RELOCK_DELAY_MS=1300;
// setTimer is replaceable for tests. After the player leaves pointer lock with Esc, browsers refuse a new request for about a second
// (a SecurityError); one automatic retry after RELOCK_DELAY_MS gets the player back to mouse capture instead of stranding them in free look.
export function createLookControls(canvas,doc,enabled,rotate,onUnlock,onMode,{setTimer=setTimeout,clearTimer=clearTimeout}={}){let touch=null,wasLocked=false,free=false,pending=false,blocked=false,last=null,edgeX=0,edgeY=0,intentional=false,armed=false,skipLockedMove=true,epoch=0,relockTimer=null,retried=false;
 const locked=()=>doc.pointerLockElement===canvas;
 function resetMotion(){last=null;edgeX=edgeY=0;armed=false;skipLockedMove=true;touch=null}
 function mode(reason=''){canvas.classList?.toggle('free-look',free&&!locked());onMode?.({mode:locked()?'captured':free?'free':'cursor',reason})}
 function fallback(reason){pending=false;blocked=true;resetMotion();if(enabled()){free=true;mode(reason)}}
 async function capture(native=false){if(!enabled())return;resetMotion();if(locked())return;free=true;mode();if(!native||blocked||pending)return;const request=++epoch;if(!canvas.requestPointerLock){fallback('Pointer lock is not supported by this browser.');return}pending=true;try{await canvas.requestPointerLock();if(request===epoch)pending=false}catch(error){if(request!==epoch)return;
   if(error?.name==='SecurityError'&&!retried){retried=true;pending=false;relockTimer=setTimer(()=>{relockTimer=null;if(request===epoch&&enabled()&&!locked())capture(true)},RELOCK_DELAY_MS);return}
   fallback((error?.name||'Capture denied')+': '+(error?.message||'Browser declined capture.'))}}
 function release(){++epoch;pending=false;free=false;if(relockTimer){clearTimer(relockTimer);relockTimer=null}resetMotion();if(locked()){intentional=true;doc.exitPointerLock?.()}mode()}
 canvas.addEventListener('click',e=>{if(e.pointerType!=='touch')capture(true)});
 doc.addEventListener('mousemove',e=>{if(!enabled()){resetMotion();return}if(locked()){if(skipLockedMove){skipLockedMove=false;return}rotate(Math.max(-160,Math.min(160,e.movementX||0)),Math.max(-120,Math.min(120,e.movementY||0)))}});
 canvas.addEventListener('pointerdown',e=>{if(enabled()&&e.pointerType==='touch'){touch={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)}});
 canvas.addEventListener('pointermove',e=>{if(!enabled()){resetMotion();return}if(touch&&touch.id===e.pointerId){rotate(e.clientX-touch.x,e.clientY-touch.y);touch={id:e.pointerId,x:e.clientX,y:e.clientY};return}if(!free||locked()||e.pointerType==='touch')return;const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;if(!last){last={x:e.clientX,y:e.clientY};return}const dx=e.clientX-last.x,dy=e.clientY-last.y;last={x:e.clientX,y:e.clientY};if(!dx&&!dy)return;rotate(Math.max(-160,Math.min(160,dx)),Math.max(-120,Math.min(120,dy)));if(x>.12&&x<.88&&y>.1&&y<.9)armed=true;edgeX=armed?(x<EDGE_ZONE?-(EDGE_ZONE-x)/EDGE_ZONE:x>1-EDGE_ZONE?(x-(1-EDGE_ZONE))/EDGE_ZONE:0):0;edgeY=0;});
 canvas.addEventListener('pointerleave',resetMotion);for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,()=>touch=null);
 // The window losing focus (Alt+Tab, a notification) or the tab hiding must stop any edge turn: the cursor may still rest over the canvas, so no pointerleave comes.
 doc.defaultView?.addEventListener?.('blur',resetMotion);doc.addEventListener('visibilitychange',resetMotion);
 doc.addEventListener('pointerlockchange',()=>{const next=locked();pending=false;if(next)retried=false;resetMotion();if(next&&(!enabled()||!free)){wasLocked=true;release();return}if(wasLocked&&!next){free=false;if(!intentional)onUnlock();intentional=false}wasLocked=next;mode()});doc.addEventListener('pointerlockerror',()=>{if(pending)fallback('Browser blocked mouse capture. Free look is active.')});
 return {capture,release,locked,resetMotion,tick(dt){if(!enabled()){resetMotion();return}if(free&&!locked()&&armed&&edgeX){const e=Math.max(-1,Math.min(1,edgeX));rotate(Math.sign(e)*e*e*Math.min(dt,.05)*EDGE_MAX_SPEED,0)}},retry(){blocked=false;retried=false;return capture(true)}};
}
