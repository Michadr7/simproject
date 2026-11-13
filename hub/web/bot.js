// Mikkadr Hub P5, R7b step 2: the corner bot. A small face at the foot of the rail on every page, with one speech line saying what the hub is doing, and a short live list when you click the line.
// It never covers the page: the line and the list sit in a strip the page makes room for (html[data-bot] sets --bot-h, and .main and .panel end above it). Click the face to fold it away to the face alone.
// It reads GET /api/activity (names and counts only; no model call): every 2 s while something works, every 10 s otherwise, never while the tab is hidden. It sends nothing and starts nothing.
// The top part is pure (no DOM) so tests can import it; mountBot builds the DOM with text only.
import {fmt} from './run-actions.js';
import {mountPanda} from './panda.js';

export const BOT_STATES=['mini','line','open']; // face only · face and speech line · face, line and the live list
export const MOOD_LABEL={idle:'Idle',working:'Working',question:'Needs you',stopped:'Stopped'};
export const moodOf=a=>a&&Object.hasOwn(MOOD_LABEL,a.mood)?a.mood:'idle';
// ?bot=mini|line|open wins (screenshots), then the remembered choice, then the open shelf (the panda).
export const botStateOf=(query,stored)=>BOT_STATES.includes(query)?query:BOT_STATES.includes(stored)?stored:'open';
// The face folds the bot away or brings the line back; the line opens or closes the list.
export const afterFace=state=>state==='mini'?'line':'mini';
export const afterLine=state=>state==='open'?'line':'open';
// Which panda pose shows the hub's mood (2.4.2). A chat turn is the master thinking; a run is working; a question or a stop is shown as such; the file named in the last live row (if any) goes on the panda's sign.
export const pandaOf=a=>{const m=moodOf(a);return m==='working'?(a&&a.source==='chat'?'think':'write'):m==='question'?'wait':m==='stopped'?'stopped':'idle'};
// 2.6: the pose and the numbers come from the activity answer's own scene and facts (hub/activity.js). Older answers without them fall back to the mood.
export const PANDA_SCENES=['idle','think','read','write','test','pass','fail','wait','stopped','done'];
export const sceneFor=a=>a&&PANDA_SCENES.includes(a.scene)?a.scene:pandaOf(a);
const num=v=>Number.isFinite(v)?v:null;
export const factsFor=a=>{const f=a&&a.facts?a.facts:{};return {used:num(f.used)||0,cap:num(f.cap)>0?f.cap:null,file:String(f.file||(a?fileOf(a):'')||''),cmd:String(f.cmd||''),asks:num(f.asks)||0,sign:f.sign?String(f.sign):null,cacheMin:num(f.cacheMin),cache:f.cache||null,gauge:num(f.gauge)}};
export const fileOf=a=>{const rows=a&&Array.isArray(a.items)?a.items:[];for(let i=rows.length-1;i>=0;i--){const m=/[A-Za-z0-9_./\\-]+\.(?:js|mjs|css|html|md|json)\b/.exec(String(rows[i]&&(rows[i].text||rows[i].k)||''));if(m)return m[0]}return ''};
export const pollMs=mood=>mood==='working'?2000:10000;
export const lineOf=a=>!a?'The hub is not answering.':a.enabled===false?'Runs and the chat are switched off.':String(a.line||'Nothing is running.');
export const countOf=a=>!a||!(a.tokens>0)?'':a.cap>0?`${fmt(a.tokens)} / ${fmt(a.cap)}`:fmt(a.tokens);
// Where "open it" leads: the run, the chat, or nowhere.
export const linkOf=a=>!a?null:a.source==='job'?{href:'#tools',label:'Open Tools'}:a.source==='run'&&/^run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$/.test(String(a.runId))?{href:'#runs/'+a.runId,label:'Open the run'}:a.source==='chat'?{href:'#chat',label:'Open the chat'}:null;
export const faceLabel=(a,state)=>`Hub assistant: ${MOOD_LABEL[moodOf(a)].toLowerCase()}. ${state==='mini'?'Show':'Hide'} what it is doing.`;

export function mountBot({doc=document,win=window,query=null,store=null,onActivity=null}={}){
 const h=(tag,props={},...kids)=>{const e=doc.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else e.setAttribute(k,v)}e.append(...kids);return e};
 const root=doc.documentElement;
 let state=botStateOf(query,store?store.get('hub.bot.v2'):null),last=null,timer=null,alive=true,sig='';
 const face=h('button',{class:'bot-face',type:'button'},h('span',{class:'eye'}),h('span',{class:'eye'}));
 const mood=h('span',{class:'bot-mood'}),text=h('span',{class:'bot-text'}),count=h('span',{class:'bot-n'}),chev=h('span',{class:'bot-chev','aria-hidden':'true'});
 const line=h('button',{class:'bot-line',type:'button','aria-controls':'bot-list'},mood,text,count,chev);
 const rows=h('div',{class:'bot-rows',role:'log','aria-label':'What the hub just did'}),foot=h('div',{class:'bot-foot'});
 const list=h('div',{class:'bot-list',id:'bot-list'},h('div',{class:'label'},'Live · names and counts only'),rows,foot);
 const stage=h('canvas',{class:'bot-stage',role:'img','aria-label':'The hub panda'});
 const bubble=h('div',{class:'bot-bubble'},stage,list,line);
 let panda=null;
 const box=h('section',{class:'bot',id:'bot','aria-label':'Hub assistant','data-mood':'idle'},face,bubble);

 function drawState(){
  root.dataset.bot=state;line.setAttribute('aria-expanded',String(state==='open'));list.hidden=state!=='open';bubble.hidden=state==='mini';
  face.setAttribute('aria-label',faceLabel(last,state));face.title=state==='mini'?lineOf(last):'Fold away';
  // the panda lives on the shelf (the open state) and rests, unseen and not drawn, in the other two
  if(state==='open'&&!panda&&typeof stage.getContext==='function'){try{panda=mountPanda(stage,{win});feedPanda(last)}catch{panda=null}}
  else if(state!=='open'&&panda){panda.stop();panda=null}}
 function feedPanda(a){if(panda)panda.want(sceneFor(a),factsFor(a))}
 function draw(a){
  last=a;const m=a?moodOf(a):'stopped';box.dataset.mood=m;
  root.dataset.mood=m;if(a&&(a.source==='chat'||a.source==='run'))root.dataset.doing=a.source;else delete root.dataset.doing; // the background follows what the hub is doing (hub.css, "the scene")
  mood.textContent=a?MOOD_LABEL[m]:'Offline';text.textContent=lineOf(a);count.textContent=countOf(a);
  const items=a&&Array.isArray(a.items)?a.items:[],s=JSON.stringify([items,linkOf(a)]);
  if(s!==sig){sig=s;rows.textContent='';
   if(!items.length)rows.append(h('div',{class:'bot-none'},'Nothing yet.'));
   for(const r of items)rows.append(h('div',{class:'br '+(r.cls==='q'||r.cls==='bad'?r.cls:'')},h('span',{class:'t'},String(r.t||'')),h('span',{class:'x'},String(r.text||r.k||'')),h('span',{class:'n'},String(r.n||''))));
   foot.textContent='';const l=linkOf(a);if(l)foot.append(h('a',{href:l.href},l.label))}
  drawState();feedPanda(a);if(onActivity&&a){try{onActivity(a)}catch{}}}
 async function tick(){
  if(!alive)return;
  if(!doc.hidden){try{const r=await win.fetch('/api/activity',{cache:'no-store'});draw(r.ok?await r.json():null)}catch{draw(null)}}
  if(alive)timer=win.setTimeout(tick,pollMs(last?moodOf(last):'idle'))}
 const set=s=>{state=s;if(store)store.set('hub.bot.v2',s);drawState()};
 face.addEventListener('click',()=>set(afterFace(state)));
 line.addEventListener('click',()=>set(afterLine(state)));
 const wake=()=>{if(!doc.hidden&&alive){win.clearTimeout(timer);tick()}};
 doc.addEventListener('visibilitychange',wake);
 doc.body.append(box);drawState();text.textContent='…';tick();
 return {refresh:wake,unmount(){alive=false;if(panda){panda.stop();panda=null};win.clearTimeout(timer);doc.removeEventListener('visibilitychange',wake);box.remove();delete root.dataset.bot}}}
