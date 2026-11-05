// Free-look edge behaviour (dist/look-controls.js): the turn eases in and is capped, focus loss stops it, and a refused re-lock after Esc is retried once.
import assert from 'node:assert/strict';
import {createLookControls,EDGE_MAX_SPEED,EDGE_ZONE,RELOCK_DELAY_MS} from '../dist/look-controls.js';

function rig({lockError=null}={}){
 const canvas=new EventTarget(),doc=new EventTarget(),win=new EventTarget();doc.defaultView=win;
 canvas.classList={toggle(){}};canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:800});canvas.setPointerCapture=()=>{};
 const state={turns:[],unlocks:0,requests:0,modes:[],enabled:true,error:lockError};
 canvas.requestPointerLock=async()=>{state.requests++;if(state.error)throw state.error;doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'))};
 doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'))};
 const timers=[];const setTimer=(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length-1},clearTimer=i=>{if(timers[i])timers[i].live=false};
 const look=createLookControls(canvas,doc,()=>state.enabled,(x,y)=>state.turns.push([x,y]),()=>state.unlocks++,m=>state.modes.push(m),{setTimer,clearTimer});
 const fire=(target,type,data)=>{const e=new Event(type);Object.assign(e,data);target.dispatchEvent(e)};
 const move=(x)=>fire(canvas,'pointermove',{pointerType:'mouse',clientX:x,clientY:400});
 const runTimers=()=>{for(const t of [...timers])if(t.live){t.live=false;t.fn()}};
 return {canvas,doc,win,state,look,fire,move,timers,runTimers};
}
const FREE=async r=>{r.state.error=new Error('Browser policy denied capture');await r.look.capture(true);r.state.error=null}; // blocked -> free look
const intoEdge=(r,x)=>{r.move(500);r.move(520);r.move(x)}; // a deliberate centre-to-edge movement arms the turn

// The turn eases in: just inside the zone it is a drift, at the very edge it is the cap, never above it, and it is symmetric
{const r=rig();await FREE(r);
 const speedAt=(x,dt=.05)=>{r.look.resetMotion();intoEdge(r,x);const n=r.state.turns.length;r.look.tick(dt);return r.state.turns.length>n?r.state.turns.at(-1)[0]/dt:0};
 const inside=speedAt(1000*(1-EDGE_ZONE)+3),half=speedAt(1000*(1-EDGE_ZONE/2)),edge=speedAt(999);
 assert(inside>0&&inside<EDGE_MAX_SPEED*.03,'barely inside the zone is a slow drift: '+inside);
 assert(half>EDGE_MAX_SPEED*.2&&half<EDGE_MAX_SPEED*.3,'half way is a quarter of the cap (eased): '+half);
 assert(edge>EDGE_MAX_SPEED*.9&&edge<=EDGE_MAX_SPEED+1e-6,'at the edge it is the cap: '+edge);
 assert(Math.abs(speedAt(1)+edge)<EDGE_MAX_SPEED*.05,'the left edge turns the same speed the other way');
 assert.equal(speedAt(500),0,'the middle of the screen does not turn');
 // a long frame cannot make a jump: dt is capped
 r.look.resetMotion();intoEdge(r,999);const n=r.state.turns.length;r.look.tick(5);assert(Math.abs(r.state.turns.at(-1)[0])<=.05*EDGE_MAX_SPEED+1e-6,'one slow frame turns no more than 50 ms worth');assert.equal(r.state.turns.length,n+1);}

// Losing focus stops an edge turn even though the cursor is still over the canvas
{const r=rig();await FREE(r);intoEdge(r,999);let n=r.state.turns.length;r.look.tick(.016);assert.equal(r.state.turns.length,n+1,'turning at the edge');
 r.win.dispatchEvent(new Event('blur'));n=r.state.turns.length;for(let i=0;i<50;i++)r.look.tick(.016);assert.equal(r.state.turns.length,n,'Alt+Tab with the cursor at the edge: no more turning');
 intoEdge(r,999);n=r.state.turns.length;r.look.tick(.016);assert.equal(r.state.turns.length,n+1,'coming back, a deliberate move to the edge turns again');
 r.doc.dispatchEvent(new Event('visibilitychange'));n=r.state.turns.length;for(let i=0;i<50;i++)r.look.tick(.016);assert.equal(r.state.turns.length,n,'a hidden tab stops it too');}
// A document without a window (some test setups) is fine
{const doc=new EventTarget(),canvas=new EventTarget();canvas.classList={toggle(){}};canvas.getBoundingClientRect=()=>({left:0,top:0,width:10,height:10});createLookControls(canvas,doc,()=>true,()=>{},()=>{});}

// Esc then a quick click: the browser refuses with a SecurityError; one retry after the cool-down brings capture back
{const r=rig({lockError:Object.assign(new Error('The user has exited the lock before this request was completed.'),{name:'SecurityError'})});
 await r.look.capture(true);assert.equal(r.state.requests,1);assert.equal(r.timers.length,1,'a retry is scheduled');assert.equal(r.timers[0].ms,RELOCK_DELAY_MS);
 assert(!r.state.modes.some(m=>/SecurityError/.test(m.reason||'')),'not reported as a failure yet');
 r.state.error=null;r.runTimers();await Promise.resolve();await Promise.resolve();
 assert.equal(r.state.requests,2,'retried once');assert.equal(r.look.locked(),true,'and captured the mouse');}
// A second refusal gives up quietly into free look (and a manual retry gets a fresh try)
{const err=Object.assign(new Error('again'),{name:'SecurityError'});const r=rig({lockError:err});
 await r.look.capture(true);r.runTimers();await Promise.resolve();await Promise.resolve();
 assert.equal(r.state.requests,2);assert(/SecurityError/.test(r.state.modes.at(-1).reason),'second refusal: free look with the reason');
 await r.look.capture(true);assert.equal(r.state.requests,2,'automatic resume does not hammer a blocked browser');
 r.state.error=null;await r.look.retry();assert.equal(r.look.locked(),true,'Try mouse capture again still works');}
// Leaving (a menu opens) cancels a pending retry; other errors are not retried
{const r=rig({lockError:Object.assign(new Error('x'),{name:'SecurityError'})});await r.look.capture(true);r.look.release();r.state.error=null;r.runTimers();await Promise.resolve();assert.equal(r.state.requests,1,'no capture after the menu closed it');assert.equal(r.look.locked(),false);
 const o=rig({lockError:Object.assign(new Error('nope'),{name:'NotAllowedError'})});await o.look.capture(true);assert.equal(o.timers.length,0,'only the Esc cool-down refusal is retried');}
// A successful lock re-arms the single retry for the next Esc
{const r=rig();await r.look.capture(true);assert(r.look.locked());r.look.release();r.state.error=Object.assign(new Error('s'),{name:'SecurityError'});await r.look.capture(true);assert.equal(r.timers.filter(t=>t.live).length,1,'the next refusal is retried again');}
console.log('Look edge: eased turn (drift at the zone edge, the cap at the screen edge, symmetric, capped per frame), focus loss and hidden tab stop it, one retry after the Esc cool-down, a second refusal falls back, a menu cancels the retry.');
