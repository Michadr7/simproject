// Mikkadr Hub v2.5b: the cache strip, drawn under the chat header and on the run card. Text only (textContent). Numbers come from the usage each reply carries (hub/cache-store.mjs keeps them).
//   source: {cache:{at,model,input,output,cacheRead,cacheWrite,window}|null, life:{...}|null}  (the chat view and the run view both have these two fields)
// It never shows a countdown the data does not support (see stateOf in cache.js), and it shows nothing at all before the first reply.
import {contextOf,splitOf,stateOf,stripText} from './cache.js';
import {fmt} from './run-actions.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
export function mountCacheStrip(box,{placeholder=true}={}){
 box.classList.add('cstrip');
 const size=h('div',{class:'small'}),sizeBar=h('div',{class:'capbar'},h('i')),state=h('div',{class:'small'}),parts=h('div',{class:'cparts','aria-hidden':'true'},h('i',{class:'c-re'}),h('i',{class:'c-wr'})),legend=h('div',{class:'small dim'});
 box.append(h('div',{class:'label'},'Conversation and cache'),size,sizeBar,state,parts,legend);
 return function paint(source,now=Date.now()){
  const c=source&&source.cache;box.hidden=!c&&!placeholder; // the chat shows words until its first measured reply; a run's card shows nothing it has not measured
  if(!c){size.textContent='Conversation size and cache: measured after the next reply.';sizeBar.hidden=true;state.textContent='';parts.hidden=true;legend.textContent='';return}
  const ctx=contextOf(c),win=Number.isFinite(c.window)&&c.window>0?c.window:null,sp=splitOf(c);
  size.textContent=`Conversation size: ${fmt(ctx)}${win?` of ${fmt(win)}`:''} tokens`;
  sizeBar.hidden=!win;if(win){sizeBar.firstChild.style.width=Math.min(100,ctx/win*100)+'%';sizeBar.dataset.state=ctx/win>=0.9?'full':ctx/win>=0.6?'warn':''}
  state.textContent=stripText(stateOf({lastReplyAt:c.at,now,lifetime:source.life,ttlMs:c.ttlMs}));
  const all=sp.reused+sp.written;parts.hidden=!all;if(all){parts.children[0].style.width=(sp.reused/all*100)+'%';parts.children[1].style.width=(sp.written/all*100)+'%'}
  legend.textContent=all?`Last message: ${fmt(sp.reused)} re-used from cache (cheap) · ${fmt(sp.written)} written new`:''}}

// The compact meter beside the Send button, like the one in the VS Code chat: a ring for how full the conversation is, a clock for how long the cache has left. Hover (or focus) for the sentence.
// The ring needs the context window and the clock needs the cache lifetime: until the hub knows them, each says so in the sentence and shows a dash. Nothing is guessed.
export function chipOf(source,now=Date.now()){
 const c=source&&source.cache;
 if(!c)return {ring:null,clock:'–',tip:'Conversation size and cache: measured after the next reply.',state:'none'};
 const ctx=contextOf(c),win=Number.isFinite(c.window)&&c.window>0?c.window:null,st=stateOf({lastReplyAt:c.at,now,lifetime:source.life,ttlMs:c.ttlMs});
 const left=st.state==='warm'&&Number.isFinite(st.countdownMs)?Math.max(0,Math.ceil(st.countdownMs/60000)):null;
 const clock=left!=null?(left>=60?'1h':left+'m'):st.state==='cold'?'cold':st.ageMs==null?'–':(st.ageMs<60000?'now':Math.round(st.ageMs/60000)+'m ago');
 const tip=`${win?`Conversation: ${fmt(ctx)} of ${fmt(win)} tokens (${Math.round(ctx/win*100)}%). `:`Conversation: ${fmt(ctx)} tokens (the window size is not known yet). `}${stripText(st)}.`;
 return {ring:win?Math.min(1,ctx/win):null,clock,tip,state:st.state,over:win?ctx/win>=0.6:false}}
export function mountCacheChip(box){
 const ring=h('span',{class:'cring','aria-hidden':'true'}),clock=h('span',{class:'cclock'}),root=h('span',{class:'cchip',tabindex:'0',role:'img'},ring,clock);
 box.append(root);
 return function paint(source,now=Date.now()){
  const c=chipOf(source,now);
  ring.style.setProperty('--p',c.ring==null?'0':String(Math.round(c.ring*100)));ring.dataset.known=c.ring==null?'no':'yes';ring.dataset.high=c.over?'yes':'no';
  clock.textContent=c.clock;root.title=c.tip;root.setAttribute('aria-label',c.tip);root.dataset.state=c.state}}