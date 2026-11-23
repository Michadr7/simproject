// Diner Station View: pure food-making session, DOM tray, and pooled 3D part stacker (notes/diner-design.md, D-C).
import {recipeById,scoreOrder} from './diner-recipes.js';

export const STATION_CAM=Object.freeze({
 espresso:{pos:{x:-6.25,y:1.7,z:-7.9},look:{x:-6.25,y:.92,z:-9.18}},
 grill:{pos:{x:-2.35,y:1.8,z:-7.9},look:{x:-2.35,y:1.02,z:-9.18}},
 prep:{pos:{x:-4.05,y:1.8,z:-7.9},look:{x:-4.05,y:.88,z:-9.15}},
 oven:{pos:{x:-.8,y:1.8,z:-7.9},look:{x:-.8,y:.98,z:-9.18}}
});

export function createStationSession(ticket,recipe){
 const r=typeof recipe==='string'?recipeById(recipe):recipe;
 if(!ticket||!r)return null;
 return {
  ticketId:ticket.id,recipeId:r.id,recipeName:r.name,station:r.station,
  steps:r.parts,placed:[],cookSecs:0,heating:false,burnt:false,remakes:0,
  cookSec:r.cookSec||0,burnSec:r.burnSec||0,waitMin:ticket.waitMin||0
 };
}

export function addStationPart(s,partId){
 if(!s||s.burnt||typeof partId!=='string')return s;
 if(!s.steps.some(p=>p.id===partId))return s;
 return {...s,placed:[...s.placed,partId]};
}

export function toggleStationHeat(s){
 if(!s||s.burnt)return s;
 return {...s,heating:!s.heating};
}

export function tickStation(s,dt){
 if(!s||!s.heating||s.burnt||!Number.isFinite(dt)||dt<=0)return s;
 const cookSecs=s.cookSecs+Math.min(dt,0.25);
 const burnt=s.burnSec>0&&cookSecs>=s.burnSec;
 return {...s,cookSecs,burnt,heating:burnt?false:s.heating};
}

export function remakeStation(s){
 if(!s)return null;
 return {...s,placed:[],cookSecs:0,heating:false,burnt:false,remakes:s.remakes+1};
}

export function finishStation(s,waitGameMin=s?.waitMin||0){
 if(!s)return {ok:false,quality:0,missing:[],burnt:false,tipCents:0};
 return scoreOrder(s.recipeId,s.placed,s.cookSecs,waitGameMin);
}

export function createDinerStationUI({document:doc,onPart,onHeat,onFinish,onRemake,onClose}){
 const root=doc.createElement('div');
 root.id='dinerStationTray';
 root.className='hud-card';
 root.hidden=true;
 root.style.cssText='position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:40;min-width:420px;max-width:92vw;padding:12px 14px;background:rgba(16,22,26,0.9);color:#f2eee2;border:1px solid rgba(255,255,255,0.14);border-radius:10px;font-family:inherit;pointer-events:auto';
 const head=doc.createElement('div');
 head.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px';
 const title=doc.createElement('strong');
 const timer=doc.createElement('span');
 timer.style.cssText='font-size:12px;opacity:0.9';
 head.append(title,timer);
 const row=doc.createElement('div');
 row.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px';
 const foot=doc.createElement('div');
 foot.style.cssText='display:flex;gap:8px;align-items:center;font-size:12px;opacity:0.85';
 const heatBtn=doc.createElement('button');heatBtn.textContent='Space · Cook';heatBtn.onclick=()=>onHeat?.();
 const doneBtn=doc.createElement('button');doneBtn.textContent='Enter · Serve';doneBtn.onclick=()=>onFinish?.();
 const remakeBtn=doc.createElement('button');remakeBtn.textContent='R · Remake';remakeBtn.onclick=()=>onRemake?.();
 const escBtn=doc.createElement('button');escBtn.textContent='Esc · Leave';escBtn.onclick=()=>onClose?.();
 foot.append(heatBtn,doneBtn,remakeBtn,escBtn);
 root.append(head,row,foot);
 doc.body?.append?.(root);

 function render(s){
  if(!s){root.hidden=true;return}
  root.hidden=false;
  title.textContent=`${s.recipeName} (${s.station})`;
  const warn=s.burnt?'BURNT':s.cookSec>0?`${s.cookSecs.toFixed(1)}s / ${s.cookSec}s (burn ${s.burnSec}s)`:'No heat needed';
  timer.textContent=`${s.heating?'🔥 ':''}${warn} · Parts ${s.placed.length}/${s.steps.length}`;
  heatBtn.textContent=s.heating?'Space · Stop heat':'Space · Cook';
  row.replaceChildren();
  s.steps.slice(0,9).forEach((step,i)=>{
   const b=doc.createElement('button');
   const count=s.placed.filter(id=>id===step.id).length;
   b.textContent=`${i+1} ${step.id.replace(/_/g,' ')}${count?' ✓':''}`;
   b.disabled=s.burnt;
   b.onclick=()=>onPart?.(step.id);
   row.append(b);
  });
 }
 function onKey(code,s){
  if(!s||root.hidden)return false;
  if(code==='Escape'){onClose?.();return true}
  if(code==='Space'){onHeat?.();return true}
  if(code==='Enter'||code==='NumpadEnter'){onFinish?.();return true}
  if(code==='KeyR'){onRemake?.();return true}
  const n=/^Digit([1-9])$/.exec(code)?.[1];
  if(n){const step=s.steps[Number(n)-1];if(step)onPart?.(step.id);return true}
  return false;
 }
 return {root,render,onKey,hide:()=>{root.hidden=true}};
}

export function createDinerStationView({THREE,GLTFLoader,parent}){
 const group=new THREE.Group();group.name='diner-station-view';group.visible=false;parent.add(group);
 const parts=new Map(),pool=[],tmp=new THREE.Vector3();
 let loading=null,loaded=false;
 function ensureLoaded(){
  if(loaded)return Promise.resolve();
  if(loading)return loading;
  if(!globalThis.document?.baseURI)return Promise.resolve();
  const loader=new GLTFLoader();
  loading=Promise.all([
   loader.loadAsync(new URL('./assets/diner/food_parts.glb',document.baseURI).href),
   loader.loadAsync(new URL('./assets/diner/tableware.glb',document.baseURI).href)
  ]).then(([food,ware])=>{
   for(const g of [food.scene,ware.scene])g.traverse(o=>{
    if(o.isMesh)parts.set(o.name,{geometry:o.geometry,material:o.material,top:o.children?.find(c=>c.name==='anchor_top_'+o.name)?.position?.y||0.04});
   });
   loaded=true;
  }).catch(()=>{});
  return loading;
 }
 function sync(s,at={x:-4.05,y:.88,z:-9.15}){
  if(!s){group.visible=false;return}
  ensureLoaded();
  group.visible=true;group.position.set(at.x,at.y,at.z);
  let y=0;
  s.placed.forEach((id,i)=>{
   const p=parts.get(id);if(!p)return;
   let m=pool[i];
   if(!m){m=new THREE.Mesh(p.geometry,p.material);pool.push(m);group.add(m)}
   else if(m.geometry!==p.geometry){m.geometry=p.geometry;m.material=p.material}
   m.visible=true;tmp.set(0,y,0);m.position.copy(tmp);y+=p.top;
  });
  for(let i=s.placed.length;i<pool.length;i++)pool[i].visible=false;
 }
 return {group,sync,ensureLoaded};
}
