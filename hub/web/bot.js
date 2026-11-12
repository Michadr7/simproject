// Mikkadr Hub P5, R7b step 2: the corner bot. A small face at the foot of the rail on every page, with one speech line saying what the hub is doing, and a short live list when you click the line.
// It never covers the page: the line and the list sit in a strip the page makes room for (html[data-bot] sets --bot-h, and .main and .panel end above it). Click the face to fold it away to the face alone.
// It reads GET /api/activity (names and counts only; no model call): every 2 s while something works, every 10 s otherwise, never while the tab is hidden. It sends nothing and starts nothing.
// The top part is pure (no DOM) so tests can import it; mountBot builds the DOM with text only.
import {fmt} from './run-actions.js';

export const BOT_STATES=['mini','line','open']; // face only · face and speech line · face, line and the live list
export const MOOD_LABEL={idle:'Idle',working:'Working',question:'Needs you',stopped:'Stopped'};
export const moodOf=a=>a&&Object.hasOwn(MOOD_LABEL,a.mood)?a.mood:'idle';
// ?bot=mini|line|open wins (screenshots), then the remembered choice, then the line.
export const botStateOf=(query,stored)=>BOT_STATES.includes(query)?query:BOT_STATES.includes(stored)?stored:'line';
// The face folds the bot away or brings the line back; the line opens or closes the list.
export const afterFace=state=>state==='mini'?'line':'mini';
export const afterLine=state=>state==='open'?'line':'open';
export const pollMs=mood=>mood==='working'?2000:10000;
export const lineOf=a=>!a?'The hub is not answering.':a.enabled===false?'Runs and the chat are switched off.':String(a.line||'Nothing is running.');
export const countOf=a=>!a||!(a.tokens>0)?'':a.cap>0?`${fmt(a.tokens)} / ${fmt(a.cap)}`:fmt(a.tokens);
// Where "open it" leads: the run, the chat, or nowhere.
export const linkOf=a=>!a?null:a.source==='run'&&/^run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$/.test(String(a.runId))?{href:'#runs/'+a.runId,label:'Open the run'}:a.source==='chat'?{href:'#chat',label:'Open the chat'}:null;
export const faceLabel=(a,state)=>`Hub assistant: ${MOOD_LABEL[moodOf(a)].toLowerCase()}. ${state==='mini'?'Show':'Hide'} what it is doing.`;

export function mountBot({doc=document,win=window,query=null,store=null}={}){
 const h=(tag,props={},...kids)=>{const e=doc.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else e.setAttribute(k,v)}e.append(...kids);return e};
 const root=doc.documentElement;
 let state=botStateOf(query,store?store.get('hub.bot'):null),last=null,timer=null,alive=true,sig='';
 const face=h('button',{class:'bot-face',type:'button'},h('span',{class:'eye'}),h('span',{class:'eye'}));
 const mood=h('span',{class:'bot-mood'}),text=h('span',{class:'bot-text'}),count=h('span',{class:'bot-n'}),chev=h('span',{class:'bot-chev','aria-hidden':'true'});
 const line=h('button',{class:'bot-line',type:'button','aria-controls':'bot-list'},mood,text,count,chev);
 const rows=h('div',{class:'bot-rows',role:'log','aria-label':'What the hub just did'}),foot=h('div',{class:'bot-foot'});
 const list=h('div',{class:'bot-list',id:'bot-list'},h('div',{class:'label'},'Live · names and counts only'),rows,foot);
 const bubble=h('div',{class:'bot-bubble'},list,line);
 const box=h('section',{class:'bot',id:'bot','aria-label':'Hub assistant','data-mood':'idle'},face,bubble);

 function drawState(){
  root.dataset.bot=state;line.setAttribute('aria-expanded',String(state==='open'));list.hidden=state!=='open';bubble.hidden=state==='mini';
  face.setAttribute('aria-label',faceLabel(last,state));face.title=state==='mini'?lineOf(last):'Fold away'}
 function draw(a){
  last=a;const m=a?moodOf(a):'stopped';box.dataset.mood=m;
  root.dataset.mood=m;if(a&&(a.source==='chat'||a.source==='run'))root.dataset.doing=a.source;else delete root.dataset.doing; // the background follows what the hub is doing (hub.css, "the scene")
  mood.textContent=a?MOOD_LABEL[m]:'Offline';text.textContent=lineOf(a);count.textContent=countOf(a);
  const items=a&&Array.isArray(a.items)?a.items:[],s=JSON.stringify([items,linkOf(a)]);
  if(s!==sig){sig=s;rows.textContent='';
   if(!items.length)rows.append(h('div',{class:'bot-none'},'Nothing yet.'));
   for(const r of items)rows.append(h('div',{class:'br '+(r.cls==='q'||r.cls==='bad'?r.cls:'')},h('span',{class:'t'},String(r.t||'')),h('span',{class:'x'},String(r.text||r.k||'')),h('span',{class:'n'},String(r.n||''))));
   foot.textContent='';const l=linkOf(a);if(l)foot.append(h('a',{href:l.href},l.label))}
  drawState()}
 async function tick(){
  if(!alive)return;
  if(!doc.hidden){try{const r=await win.fetch('/api/activity',{cache:'no-store'});draw(r.ok?await r.json():null)}catch{draw(null)}}
  if(alive)timer=win.setTimeout(tick,pollMs(last?moodOf(last):'idle'))}
 const set=s=>{state=s;if(store)store.set('hub.bot',s);drawState()};
 face.addEventListener('click',()=>set(afterFace(state)));
 line.addEventListener('click',()=>set(afterLine(state)));
 const wake=()=>{if(!doc.hidden&&alive){win.clearTimeout(timer);tick()}};
 doc.addEventListener('visibilitychange',wake);
 doc.body.append(box);drawState();text.textContent='…';tick();
 return {refresh:wake,unmount(){alive=false;win.clearTimeout(timer);doc.removeEventListener('visibilitychange',wake);box.remove();delete root.dataset.bot}}}
