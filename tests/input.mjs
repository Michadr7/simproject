import assert from 'node:assert/strict';
import {createMovementInput} from '../dist/input.js';
const win=new EventTarget(),doc=new EventTarget();let enabled=true;
const input=createMovementInput(win,doc,()=>enabled);
function send(target,type,values={}){const event=new Event(type,{cancelable:true});Object.assign(event,values);target.dispatchEvent(event)}
send(win,'keydown',{code:'KeyW',repeat:false});assert(input.has('KeyW'));
send(win,'keyup',{code:'KeyW'});assert(!input.has('KeyW'),'release stops movement');
send(win,'keydown',{code:'KeyW',repeat:false});send(win,'blur');assert(!input.has('KeyW'));
send(win,'keydown',{code:'KeyW',repeat:true});assert(!input.has('KeyW'),'stale repeat after blur cannot restart movement');
send(win,'keydown',{code:'KeyW',repeat:false});doc.hidden=true;send(doc,'visibilitychange');assert(!input.has('KeyW'));
doc.hidden=false;send(win,'keydown',{code:'KeyW',repeat:false});send(doc,'focusin');assert(!input.has('KeyW'));
input.pressPointer(1,'KeyW');input.pressPointer(2,'KeyD');send(win,'pointerup',{pointerId:1});assert(!input.has('KeyW'));assert(input.has('KeyD'));
send(win,'pointercancel',{pointerId:2});assert(!input.has('KeyD'));
enabled=false;send(win,'keydown',{code:'KeyW',repeat:false});input.pressPointer(1,'KeyW');assert(!input.has('KeyW'),'menus do not record movement');
console.log('Movement release, focus loss, visibility, stale repeats, pointer cancellation and menu checks passed.');
