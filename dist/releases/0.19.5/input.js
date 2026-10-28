const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
export function createMovementInput(win,doc,enabled){
 const keyboard=new Set(),pointers=new Map();
 const input={has:code=>keyboard.has(code)||[...pointers.values()].includes(code),clear(){keyboard.clear();pointers.clear()},pressPointer(id,code){if(enabled())pointers.set(id,code)},releasePointer(id){pointers.delete(id)}};
 win.addEventListener('keydown',e=>{
  if(!movementCodes.has(e.code))return;
  if(!enabled()||e.target?.matches?.('input,textarea,select,[contenteditable=true]')){input.clear();return}
  e.preventDefault();
  // A repeat after focus changes must not resurrect a key whose release was missed.
  if(!e.repeat||keyboard.has(e.code))keyboard.add(e.code);
 },true);
 win.addEventListener('keyup',e=>keyboard.delete(e.code),true);
 for(const event of ['blur','pagehide'])win.addEventListener(event,()=>input.clear());
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)input.clear()});
 doc.addEventListener('focusin',()=>input.clear());
 win.addEventListener('pointerup',e=>input.releasePointer(e.pointerId),true);
 win.addEventListener('pointercancel',e=>input.releasePointer(e.pointerId),true);
 return input;
}
