// The phone's People app (stage W-D3, notes/world-system-design.md NEW NPCS): the named people you have met, one row each (name, standing tier, role, mood); tap a row for the details and how to get closer. Unmet people never show. The rows come from npc-dialogue.js peopleRows (pure, tested); this file only draws them. UI only: no state of its own except which row is open.
import {peopleRows} from './npc-dialogue.js';

export function createPhonePeople({document:doc,getState}){
 const $=id=>doc.getElementById(id);let open=null;
 const el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
 const dayNow=()=>Math.max(0,(getState().progress.housing?.day||1)-1);
 function line(label,value){const p=el('p','phone-home-status');p.textContent=label+': '+value;return p}
 function render(){
  const box=$('phonePeople');if(!box)return;
  const rows=peopleRows(getState().progress,{day:dayNow()}),out=[];
  if(open&&!rows.some(r=>r.id===open))open=null;
  if(!rows.length){out.push(el('p','phone-empty','You have not met anyone yet. Talk to the people you see around town, or knock on a door at the Oak Street Apartments.'))}
  else if(open){
   const r=rows.find(x=>x.id===open);
   out.push(el('h3','',r.name),el('p','phone-subtitle',r.role),line('Standing',r.tierWord+' ('+r.points+' points)'),line('Mood',r.mood+(r.sick?' (unwell)':'')),line('Lives',r.home),line('Works',r.work),line('Last talked',r.lastTalked),el('h4','phone-heading','How to get closer'),el('p','phone-home-status',r.hint));
   const back=el('button','phone-accept','All people');back.id='phonePeopleBack';back.onclick=()=>{open=null;render()};out.push(back);
  }else for(const r of rows){
   const row=el('button','phone-message');row.dataset.person=r.id;row.dataset.unread='false';
   const head=el('small'),n=el('b','',r.name),t=el('span','',r.tierWord);head.append(n,t);
   row.append(head,el('span','',r.role+' · mood '+r.mood+(r.sick?' · unwell':'')+' · talked '+r.lastTalked.toLowerCase()));
   row.onclick=()=>{open=r.id;render()};out.push(row);
  }
  box.replaceChildren(...out);
 }
 // Back inside the app: from a person's details to the list (true = handled).
 const back=()=>{if(!open)return false;open=null;render();return true};
 const reset=()=>{open=null};
 return {render,back,reset,get open(){return open}};
}
