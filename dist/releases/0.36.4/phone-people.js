// The phone's People app (stage W-D3 + Relationships): named contacts you have met, visual friendship/romance meters, and tips on getting closer.
import {peopleRows} from './npc-dialogue.js';
import {relationshipOf,relationshipMeterSpec,GEMMA_ID,GEMMA_PROFILE} from './relationships.js';

export function createPhonePeople({document:doc,getState,getBody}){
 const $=id=>doc.getElementById(id);let open=null;
 const el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const dayNow=()=>Math.max(0,(getState().progress.housing?.day||1)-1);
 const bodyNow=()=>(typeof getBody==='function'?getBody():null)||'male';
 function line(label,value){const p=el('p','phone-home-status');p.textContent=label+': '+value;return p}
 function meterNode(meter){
  const box=el('div','phone-rel');
  const addBar=(cls,label,pct)=>{
   const row=el('div','phone-rel-row'+(cls?' '+cls:''));
   const cap=el('div','phone-rel-cap');cap.append(el('span','',label));
   const bar=el('div','phone-rel-track');const fill=el('div','phone-rel-fill');fill.style.width=Math.max(0,Math.min(100,Math.round(pct||0)))+'%';bar.append(fill);
   row.append(cap,bar);box.append(row);
  };
  addBar(meter.friendTone==='high'?'high':meter.friendTone==='mid'?'mid':'',meter.friendText,meter.friendPct);
  if(meter.romanceUnlocked)addBar('romance',meter.romanceText,meter.romancePct);
  return box;
 }
 function allRows(progress){
  const body=bodyNow(),day=dayNow();
  const base=peopleRows(progress,{day}).map(r=>{
   const rel=relationshipOf(progress,r.id,body,progress.housing?.day||1);
   return {...r,rel,meter:relationshipMeterSpec(rel)};
  });
  const gemmaRel=relationshipOf(progress,GEMMA_ID,body,progress.housing?.day||1);
  if(gemmaRel.met){
   base.push({
    id:GEMMA_ID,
    name:GEMMA_PROFILE.name,
    role:GEMMA_PROFILE.role,
    home:'Ironwood',
    work:GEMMA_PROFILE.work,
    tier:gemmaRel.tier,
    tierWord:gemmaRel.tierLabel,
    mood:'good',
    sick:false,
    lastTalked:gemmaRel.talkedToday?'Today':'Recently',
    points:gemmaRel.points,
    hint:gemmaRel.nextMilestone+' Loves: bouquets, hot coffee, baking flour, eggs & apples.',
    rel:gemmaRel,
    meter:relationshipMeterSpec(gemmaRel)
   });
  }
  return base;
 }
 function render(){
  const box=$('phonePeople');if(!box)return;
  const rows=allRows(getState().progress),out=[];
  if(open&&!rows.some(r=>r.id===open))open=null;
  if(!rows.length){out.push(el('p','phone-empty','You have not met anyone yet. Talk to the people you see around town, or knock on a door at the Oak Street Apartments.'))}
  else if(open){
   const r=rows.find(x=>x.id===open);
   out.push(el('h3','',r.name),el('p','phone-subtitle',r.role),meterNode(r.meter),line('Friendship',r.tierWord+' ('+r.points+' / 100)'),...(r.rel.romanceUnlocked?[line('Romance',r.rel.statusLabel+' ('+r.rel.romance+' / 100)')]:[]),line('Mood',r.mood+(r.sick?' (unwell)':'')),line('Lives',r.home),line('Works',r.work),line('Last talked',r.lastTalked),el('h4','phone-heading','How to get closer'),el('p','phone-home-status',r.hint));
   const back=el('button','phone-accept','All people');back.id='phonePeopleBack';back.onclick=()=>{open=null;render()};out.push(back);
  }else for(const r of rows){
   const row=el('button','phone-message');row.dataset.person=r.id;row.dataset.unread='false';
   const head=el('small'),n=el('b','',r.name),t=el('span','',r.rel.romanceUnlocked?`${r.tierWord} · ♥ ${r.rel.statusLabel}`:r.tierWord);head.append(n,t);
   row.append(head,el('span','',r.role+' · mood '+r.mood+(r.sick?' · unwell':'')+' · talked '+r.lastTalked.toLowerCase()),meterNode(r.meter));
   row.onclick=()=>{open=r.id;render()};out.push(row);
  }
  box.replaceChildren(...out);
 }
 // Back inside the app: from a person's details to the list (true = handled).
 const back=()=>{if(!open)return false;open=null;render();return true};
 const reset=()=>{open=null};
 return {render,back,reset,get open(){return open}};
}
