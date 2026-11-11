// Mikkadr Hub P4, S5: the Waiting for you list. The shell fetches /api/waiting (every 20 s and when the tab comes back) and hands the answer to update(); this draws it.
// Text only (textContent). The one write is "Hide until it changes" (POST /api/waiting/hide with the item's content hash); the Copy command button copies text and sends nothing.
import {agoText} from './plans.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
export const signature=data=>JSON.stringify(data&&data.items?data.items.map(i=>[i.id,i.title,i.detail]):null); // redraw only when the list really changed, so a "Copied" note is not wiped by a poll

export function mountHome(view,{onChange}={}){
 let last=null;
 async function hide(hash,button){
  button.disabled=true;
  try{const r=await fetch('/api/waiting/hide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash}),cache:'no-store'});if(r.ok||r.status===404){if(onChange)onChange();return}}catch{}
  button.disabled=false}
 async function copy(text,button){
  let ok=false;try{await navigator.clipboard.writeText(text);ok=true}catch{}
  const old=button.textContent;button.textContent=ok?'Copied':'Select and copy it from the line above';setTimeout(()=>{button.textContent=old},2200)}
 const action=a=>{
  if(a.type==='link')return h('a',{class:'btn'+(a.primary?' pri':''),href:a.href,target:a.external?'_blank':null,rel:a.external?'noopener':null},a.label);
  if(a.type==='copy')return h('button',{class:'btn'+(a.primary?' pri':''),type:'button',onclick:e=>copy(a.text,e.currentTarget)},a.label);
  return h('button',{class:'btn',type:'button',onclick:e=>hide(a.hash,e.currentTarget)},a.label)};
 const item=i=>h('div',{class:'it'},h('i',{class:'sev s-'+i.severity,'aria-hidden':'true'}),
  h('div',{class:'it-main'},h('div',{class:'t'},i.title),h('div',{class:'d'},i.detail,i.at?` · ${agoText(i.at)}`:''),i.actions.some(a=>a.type==='copy')?h('code',{class:'cmd'},i.actions.find(a=>a.type==='copy').text):null),
  h('div',{class:'acts'},i.actions.map(action)));
 return {
  update(data){
   if(!data){if(last===null){view.textContent='';view.append(h('p',{class:'soon'},'Could not read the list. Is the hub still running?'))}return}
   const sig=signature(data);if(sig===last)return;last=sig;
   view.textContent='';
   view.append(data.items.length?h('div',{class:'items'},data.items.map(item)):h('p',{class:'soon'},'Nothing is waiting for you.'))},
  stop(){}}}
