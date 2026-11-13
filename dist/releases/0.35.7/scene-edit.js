// Scene edit rules: pure data and transactions, no THREE, no DOM (importable from Node tests and the hub).
// Edits = {version:1, added:[{id,prop,x,z,yaw}], moved:{<key>:{x,z,yaw}}, removed:[<key>]}. A transaction is (edits, action) -> {ok:true, edits} | {ok:false, error}.
import {MAP} from './map-definition.js';
export const HISTORY_CAP=100;
export const emptyEdits=()=>({version:1,added:[],moved:{},removed:[]});
const r2=v=>Math.round(v*100)/100+0,r4=v=>Math.round(v*1e4)/1e4+0,num=v=>typeof v==='number'?v:NaN,isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const cmp=(a,b)=>a<b?-1:a>b?1:0,fin=(...v)=>v.every(Number.isFinite);
const pose=o=>({x:r2(num(o.x)),z:r2(num(o.z)),yaw:r4(num(o.yaw))});
// Drops unknown fields, rounds x and z to 0.01 m and yaw to 0.0001, and sorts, so the same edits always give the same output.
export function normaliseEdits(raw){
 const out=emptyEdits();if(!isObj(raw))return out;
 if(Array.isArray(raw.added))out.added=raw.added.filter(isObj).map(a=>({id:String(a.id),prop:String(a.prop),...pose(a)})).sort((a,b)=>cmp(a.id,b.id));
 if(isObj(raw.moved))for(const k of Object.keys(raw.moved).sort())if(isObj(raw.moved[k]))out.moved[k]=pose(raw.moved[k]);
 if(Array.isArray(raw.removed))out.removed=[...new Set(raw.removed.filter(k=>typeof k==='string'))].sort();
 return out;
}
export const snap=(value,step=.5)=>Math.round(value/step)*step+0;
export const snapYaw=(yaw,stepDeg=15)=>{const s=stepDeg*Math.PI/180;return Math.round(yaw/s)*s+0};
export function nextId(edits){let m=0;for(const a of edits.added){const n=/^e-(\d+)$/.exec(a.id);if(n)m=Math.max(m,+n[1])}return 'e-'+String(m+1).padStart(4,'0')}
const fail=error=>({ok:false,error}),done=e=>({ok:true,edits:normaliseEdits(e)}),clone=e=>normaliseEdits(e);
const target=(e,a)=>{ // which thing an action points at: an editor-placed prop (id) or a named map prop (key)
 if(a&&typeof a.id==='string'){const i=e.added.findIndex(p=>p.id===a.id);return i<0?{error:'There is no placed prop '+a.id+'.'}:{kind:'added',index:i,at:e.added[i]}}
 if(a&&typeof a.key==='string'){if(e.removed.includes(a.key))return {error:a.key+' has been removed.'};return {kind:'map',key:a.key,at:e.moved[a.key]||null}}
 return {error:'Say which prop: an id or a key.'};
};
export function place(edits,a){
 if(!a||typeof a.prop!=='string'||!a.prop)return fail('Place needs a prop.');
 if(!fin(a.x,a.z,a.yaw??0))return fail('Place needs a finite position and turn.');
 const e=clone(edits),id=nextId(e);e.added.push({id,prop:a.prop,x:a.x,z:a.z,yaw:a.yaw??0});
 return {...done(e),id};
}
export function move(edits,a){
 const t=target(edits,a);if(t.error)return fail(t.error);
 if(!fin(a.x,a.z))return fail('Move needs a finite position.');
 const e=clone(edits),yaw=a.yaw??t.at?.yaw??0;if(!fin(yaw))return fail('The turn must be a finite number.');
 if(t.kind==='added')e.added[t.index]={...e.added[t.index],x:a.x,z:a.z,yaw};else e.moved[t.key]={x:a.x,z:a.z,yaw};
 return done(e);
}
export function turn(edits,a){
 const t=target(edits,a);if(t.error)return fail(t.error);
 if(!fin(a.yaw))return fail('Turn needs a finite angle.');
 const e=clone(edits);
 if(t.kind==='added')e.added[t.index]={...e.added[t.index],yaw:a.yaw};
 else{const x=t.at?.x??a.x,z=t.at?.z??a.z;if(!fin(x,z))return fail('Turning a map prop needs its position.');e.moved[t.key]={x,z,yaw:a.yaw}}
 return done(e);
}
export function remove(edits,a){
 const t=target(edits,a);if(t.error)return fail(t.error);
 const e=clone(edits);
 if(t.kind==='added')e.added.splice(t.index,1);else{delete e.moved[t.key];e.removed.push(t.key)}
 return done(e);
}
// Copy: a new editor-placed prop of the same model as the source, at (x,z) and the source's turn unless yaw is given. A named map prop needs `prop` (its model).
export function copy(edits,a){
 const t=target(edits,a);if(t.error)return fail(t.error);
 const prop=t.kind==='added'?t.at.prop:a.prop;if(typeof prop!=='string'||!prop)return fail('Copying a map prop needs its model.');
 return place(edits,{prop,x:a.x,z:a.z,yaw:a.yaw??t.at?.yaw??0});
}
const has=(list,v)=>typeof list==='function'?!!list(v):list instanceof Set?list.has(v):Array.isArray(list)?list.includes(v):false;
// Plain-language problems with an edit set; an empty list means it is fine. caps is {perModel,total}, bounds is {x0,x1,z0,z1}.
export function validateEdits(edits,{knownProps,knownKeys,bounds,caps}={}){
 const errs=[],inside=p=>!bounds||(p.x>=bounds.x0&&p.x<=bounds.x1&&p.z>=bounds.z0&&p.z<=bounds.z1),ids=new Set(),count={};
 for(const a of edits.added||[]){
  if(ids.has(a.id))errs.push('The id '+a.id+' is used more than once.');ids.add(a.id);
  if(knownProps&&!has(knownProps,a.prop))errs.push(a.id+' uses an unknown prop: '+a.prop+'.');
  if(!fin(a.x,a.z,a.yaw))errs.push(a.id+' has a number that is not finite.');else if(!inside(a))errs.push(a.id+' is outside the playable area.');
  count[a.prop]=(count[a.prop]||0)+1;
 }
 for(const [k,p] of Object.entries(edits.moved||{})){
  if(knownKeys&&!has(knownKeys,k))errs.push('Moved prop '+k+' is not a known map prop.');
  if(!fin(p.x,p.z,p.yaw))errs.push('Moved prop '+k+' has a number that is not finite.');else if(!inside(p))errs.push('Moved prop '+k+' is outside the playable area.');
 }
 for(const k of edits.removed||[])if(knownKeys&&!has(knownKeys,k))errs.push('Removed prop '+k+' is not a known map prop.');
 if(caps){
  for(const [m,n] of Object.entries(count))if(n>caps.perModel)errs.push('Too many of one model: '+n+' of '+m+' (at most '+caps.perModel+').');
  if((edits.added||[]).length>caps.total)errs.push('Too many props in all: '+edits.added.length+' (at most '+caps.total+').');
 }
 return errs;
}
// Extra draw calls: one for each distinct added model that is not already on screen.
export function drawCallCost(edits,modelsAlreadyOnScreen=[]){
 const on=modelsAlreadyOnScreen instanceof Set?modelsAlreadyOnScreen:new Set(modelsAlreadyOnScreen);
 return new Set(edits.added.map(a=>a.prop).filter(p=>!on.has(p))).size;
}
// What `edits` has beyond `base`: props added, named props moved (new or changed), named props removed.
export function summary(edits,base=emptyEdits()){
 const had=new Set(base.added.map(a=>a.id)),same=(a,b)=>a&&b&&a.x===b.x&&a.z===b.z&&a.yaw===b.yaw;
 return {added:edits.added.filter(a=>!had.has(a.id)).length,moved:Object.keys(edits.moved).filter(k=>!same(edits.moved[k],base.moved[k])).length,removed:edits.removed.filter(k=>!base.removed.includes(k)).length};
}
// ── Named map props (E2) ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// The yard props (map-definition.js `yards`, drawn by eastbank.js) answer to a stable key: <yard id>.<prop id without its "prop." prefix>-<n>, n counting that model in the yard's list from 1
// (for example gas-station.pump-island-1, freight-yard.container-a-3). Reordering a yard's list renumbers its keys. Landmarks, trees, lamps and the town's street furniture are not named yet.
export const yardKey=(yardId,prop,n)=>yardId+'.'+String(prop).replace(/^prop\./,'')+'-'+n;
// [{key, prop, x, z, yaw, y, yard}] for every named prop, with its original spot.
export function sceneKeys(map=MAP){
 const out=[];for(const yard of map.yards||[]){const seen={};for(const it of yard.items){seen[it.prop]=(seen[it.prop]||0)+1;out.push({key:yardKey(yard.id,it.prop,seen[it.prop]),prop:it.prop,x:it.x,z:it.z,yaw:it.yaw||0,y:it.y||0,yard:yard.id})}}
 return out;
}
// The spot a named prop has under the edits: the moved spot, null when removed, or the original spot itself (same object) when untouched.
export function applyToNamed(key,spot,edits){
 if(!edits)return spot;
 if(edits.removed?.includes(key))return null;
 const m=edits.moved?.[key];return m?{...spot,x:m.x,z:m.z,yaw:m.yaw}:spot;
}
// A yard's items under the edits (removed ones dropped, moved ones moved); the original array when nothing in it is touched.
export function editedYardItems(yard,edits){
 const seen={},out=[];let touched=false;
 for(const it of yard.items){seen[it.prop]=(seen[it.prop]||0)+1;const s=applyToNamed(yardKey(yard.id,it.prop,seen[it.prop]),it,edits);if(s!==it)touched=true;if(s)out.push(s)}
 return touched?out:yard.items;
}
// Undo and redo over whole edit sets (they are small). push(edits) records a new state and drops any redo; undo() and redo() return the state to show, or null.
export function createHistory(initial=emptyEdits(),cap=HISTORY_CAP){
 let states=[initial],at=0;
 return {
  push(edits){states=states.slice(0,at+1);states.push(edits);if(states.length>cap)states.shift();at=states.length-1;return edits},
  undo(){if(at<=0)return null;at--;return states[at]},
  redo(){if(at>=states.length-1)return null;at++;return states[at]},
  canUndo:()=>at>0,canRedo:()=>at<states.length-1,current:()=>states[at],size:()=>states.length,
 };
}
