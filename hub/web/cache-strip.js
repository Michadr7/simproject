// Mikkadr Hub v2.5b: the cache strip, drawn under the chat header and on the run card. Text only (textContent). Numbers come from the usage each reply carries (hub/cache-store.mjs keeps them).
//   source: {cache:{at,model,input,output,cacheRead,cacheWrite,window}|null, life:{...}|null}  (the chat view and the run view both have these two fields)
// It never shows a countdown the data does not support (see stateOf in cache.js), and it shows nothing at all before the first reply.
import {contextOf,splitOf,stateOf,stripText} from './cache.js';
import {fmt} from './run-actions.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
export function mountCacheStrip(box){
 box.classList.add('cstrip');
 const size=h('div',{class:'small'}),sizeBar=h('div',{class:'capbar'},h('i')),state=h('div',{class:'small'}),parts=h('div',{class:'cparts','aria-hidden':'true'},h('i',{class:'c-re'}),h('i',{class:'c-wr'})),legend=h('div',{class:'small dim'});
 box.append(h('div',{class:'label'},'Conversation and cache'),size,sizeBar,state,parts,legend);
 return function paint(source,now=Date.now()){
  const c=source&&source.cache;box.hidden=false;
  if(!c){size.textContent='Conversation size and cache: measured after the next reply.';sizeBar.hidden=true;state.textContent='';parts.hidden=true;legend.textContent='';return}
  const ctx=contextOf(c),win=Number.isFinite(c.window)&&c.window>0?c.window:null,sp=splitOf(c);
  size.textContent=`Conversation size: ${fmt(ctx)}${win?` of ${fmt(win)}`:''} tokens`;
  sizeBar.hidden=!win;if(win){sizeBar.firstChild.style.width=Math.min(100,ctx/win*100)+'%';sizeBar.dataset.state=ctx/win>=0.9?'full':ctx/win>=0.6?'warn':''}
  state.textContent=stripText(stateOf({lastReplyAt:c.at,now,lifetime:source.life}));
  const all=sp.reused+sp.written;parts.hidden=!all;if(all){parts.children[0].style.width=(sp.reused/all*100)+'%';parts.children[1].style.width=(sp.written/all*100)+'%'}
  legend.textContent=all?`Last message: ${fmt(sp.reused)} re-used from cache (cheap) · ${fmt(sp.written)} written new`:''}}