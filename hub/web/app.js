// Mikkadr Hub v2, V1: the shell. Draws the rail, the tree (Chat, Work with its projects and steps, Assets; Commit, Tools and Tokens at the foot) and the gauges, follows the hash route, and sets the accent from the weekly gauge.
// Work (work.js), Chat (chat.js) and Tools (tools.js, V2) draw inside the shell; Assets and Tokens open the pages that already exist; Commit is a placeholder until V3.
// Polls GET /api/gauges and /api/work every 20 s and when the tab comes back; this file sends no writes (they live in the pages).
import {TREE,WIDE,rowOf as treeRow,routeOf,planIdOf,runIdOf,accentOf,barOf,titleOf,pageOf,sceneOf,needsText,ageText,commitLabel} from './shell.js';
import {mountCommit} from './commit.js';
import {mountWork,GLYPH,stepHref,stepName} from './work.js';
import {mountChat} from './chat.js';
import {mountTools} from './tools.js';
import {mountAssets} from './assets-area.js';
import {mountBot} from './bot.js';

const $=id=>document.getElementById(id);
const root=document.documentElement;
let route=routeOf(location.hash),menuOpen,unmount=null,work=null,tree,commitInfo=null;
const openProjects=new Map(); // a project you opened or closed by hand stays that way until the page is reloaded
let showDone=false;

const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const q=new URLSearchParams(location.search).get('menu'); // ?menu=open|closed overrides the remembered choice (used for screenshots)
menuOpen=q==='open'?true:q==='closed'?false:store.get('hub.menu')!=='closed';
const wide=()=>innerWidth>=WIDE; // the tree is always visible on a wide window

// The sliding highlight (one pill that glides to the row under the pointer, or rests on the current page) and the scene (the background's hue follows the page, and previews the row you hover).
const pill=document.createElement('i');pill.className='nav-pill';pill.setAttribute('aria-hidden','true');
const scene=document.createElement('div');scene.className='scene';scene.setAttribute('aria-hidden','true');scene.append(document.createElement('i'),document.createElement('i'));document.body.prepend(scene);
let hoverKey=null;
function placePill(){
 const key=sceneOf(route,hoverKey),ul=$('nav');root.dataset.scene=key;if(hoverKey)root.dataset.hover='';else delete root.dataset.hover;
 let hit=null;for(const li of ul.querySelectorAll('li[data-key]')){const on=li.dataset.key===key;li.classList.toggle('hot',on);if(on)hit=li}
 const a=hit&&hit.firstElementChild;
 if(!a){pill.style.opacity='0';return}
 pill.style.opacity='1';pill.style.height=a.offsetHeight+'px';pill.style.transform=`translateY(${hit.offsetTop+a.offsetTop}px)`}
const setHover=k=>{if(k===hoverKey)return;hoverKey=k;placePill()};
const navWatch=typeof ResizeObserver==='function'?new ResizeObserver(()=>placePill()):null;
// Picking a row sends a wave of that page's colour across the screen, starting at the row.
const wave=document.createElement('div');wave.className='wave';wave.setAttribute('aria-hidden','true');scene.after(wave);
function sendWave(li,key){
 const r=li.firstElementChild.getBoundingClientRect();wave.style.setProperty('--wx',Math.round(r.left+r.width/2)+'px');wave.style.setProperty('--wy',Math.round(r.top+r.height/2)+'px');
 wave.dataset.scene=key;wave.classList.remove('go');void wave.offsetWidth;wave.classList.add('go')}
const rowOf=e=>{const li=e.target instanceof Element?e.target.closest('li[data-key]'):null;return li?li.dataset.key:null};

const el=(tag,cls,...kids)=>{const e=document.createElement(tag);if(cls)e.className=cls;e.append(...kids.filter(k=>k!=null));return e};
const glyph=g=>{const s=el('span','s '+g,GLYPH[g]||GLYPH.todo);s.setAttribute('aria-hidden','true');return s};
// The projects and steps under Work. A project is open when it holds the step you are reading, when something in it needs you or is working, or when you opened it.
function workTree(){
 const plan=planIdOf(location.hash),run=runIdOf(location.hash),ul=el('ul','sub');
 const projectLi=p=>{
  const here=p.steps.some(s=>(run&&s.runId===run)||(!run&&plan&&s.planId===plan)),open=openProjects.has(p.name)?openProjects.get(p.name):here||p.needsYou>0||p.glyph==='run';
  const b=el('button',p.needsYou?'you-row':'',glyph(p.glyph),el('span','tx',`${p.name} · ${p.summary}`));b.type='button';b.setAttribute('aria-expanded',String(open));
  b.addEventListener('click',()=>{openProjects.set(p.name,!open);drawNav()});
  const li=el('li','',b);
  if(open){const sub=el('ul','sub');
   for(const s of p.steps){const a=el('a',s.needsYou?'you-row':'',glyph(s.glyph),el('span','tx',stepName(s)));a.href=stepHref(s);a.title=s.label;if((run&&s.runId===run)||(!run&&plan&&s.planId===plan))a.setAttribute('aria-current','true');sub.append(el('li','',a))}
   for(const i of p.items){const a=el('a','you-row',glyph('you'),el('span','tx',i.title));a.href='#work';sub.append(el('li','',a))}
   li.append(sub)}
  return li};
 const live=tree.projects.filter(p=>!p.allDone),done=tree.projects.filter(p=>p.allDone);
 for(const p of live)ul.append(projectLi(p));
 if(done.length){const b=el('button','',glyph('ok'),el('span','tx',`Finished (${done.length})`));b.type='button';b.setAttribute('aria-expanded',String(showDone));b.addEventListener('click',()=>{showDone=!showDone;drawNav()});
  const li=el('li','',b);if(showDone){const sub=el('ul','sub');for(const p of done)sub.append(projectLi(p));li.append(sub)}ul.append(li)}
 return ul.childElementCount?ul:null}
function drawNav(){
 const ul=$('nav'),old=ul.querySelector('.sub'),scroll=old?old.scrollTop:0;ul.textContent='';ul.append(pill);
 const row=(r,foot,first)=>{
  const li=document.createElement('li');li.dataset.key=r.key;if(foot)li.className='foot'+(first?' foot-first':'');
  const a=document.createElement('a');a.href='#'+r.key;if(r.key===route)a.setAttribute('aria-current','page');
  const g=document.createElement('b');g.textContent=r.glyph;g.setAttribute('aria-hidden','true');a.append(g,r.key==='commit'?commitLabel(commitInfo):r.label);
  if(r.key==='work'&&tree&&tree.needsYou>0){const n=document.createElement('span');n.className='count';n.textContent=tree.needsYou;n.title=needsText(tree.needsYou);a.append(n)}
  li.append(a);if(r.key==='work'&&tree){const sub=workTree();if(sub)li.append(sub)}
  ul.append(li)};
 TREE.areas.forEach(r=>row(r,false,false));TREE.foot.forEach((r,i)=>row(r,true,i===0));
 const now=ul.querySelector('.sub');if(now)now.scrollTop=scroll;
 placePill();
 // the rows below Work move when its list changes height after this draw (the bot bar arriving, the window resizing): keep the pill on its row
 if(navWatch){navWatch.disconnect();navWatch.observe(ul);if(now)navWatch.observe(now)}
}
function drawNeeds(){
 const n=tree?tree.needsYou:0,a=$('needs');a.hidden=!(n>0);a.textContent=needsText(n);
 document.title=titleOf(route,n)}
function drawRoute(){
 route=routeOf(location.hash);
 const row=treeRow(route),page=pageOf(route),view=$('view'),frame=$('frame');
 $('title').textContent=row.label;
 view.hidden=!!page;frame.hidden=!page;
 if(unmount){unmount();unmount=null}
 work=null;view.textContent='';
 if(page){if(frame.getAttribute('src')!==page)frame.setAttribute('src',page)}
 else if(route==='chat')unmount=mountChat(view,{onChange:refresh});
 else if(route==='tools')unmount=mountTools(view,{onChange:refresh});
 else if(route==='commit')unmount=mountCommit(view,{onChange:refresh});
 else if(route==='assets')unmount=mountAssets(view,{onChange:refresh});
 else if(route==='work'){work=mountWork(view,{plan:planIdOf(location.hash),run:runIdOf(location.hash),onChange:refresh});unmount=work.stop;if(tree!==undefined)work.update(tree)}
 else{const p=document.createElement('p');p.className='soon';p.textContent=row.soon||'';view.append(p)}
 drawNav();drawNeeds();
 if(!wide()&&innerWidth<700)setMenu(false);
}
function setMenu(open,remember){
 const shown=open||wide();
 if(shown&&root.dataset.menu==='closed'){root.classList.add('opening');setTimeout(()=>root.classList.remove('opening'),800)} // the rows rise in once, when the menu opens (not on every redraw)
 menuOpen=open;root.dataset.menu=shown?'open':'closed';$('menutab').setAttribute('aria-expanded',String(shown));
 if(remember)store.set('hub.menu',open?'open':'closed')}

function gauge(id,w,orangeAt,redAt){
 const g=$(id),pct=w&&w.known?w.pct:null,fill=g.querySelector('i'),val=g.querySelector('.val');
 val.textContent=pct==null?'no reading':Math.round(pct)+'%';
 fill.style.width=pct==null?'0':Math.min(100,pct)+'%';g.dataset.bar=barOf(pct,orangeAt,redAt);
 g.setAttribute('aria-label',`${g.dataset.name}: ${pct==null?'no reading':val.textContent+' used'}`)}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url+' '+r.status);return r.json()}
async function refresh(){
 try{const g=await getJson('/api/gauges');
  gauge('g-weekly',g.weekly,60,90);gauge('g-five',g.fiveHour,50,90);
  root.dataset.accent=accentOf(g.weekly.known?g.weekly.pct:null);
  $('g-age').textContent=ageText(g.ageMin,g.stale)}
 catch{$('g-age').textContent='The usage reading is unavailable'}
 try{commitInfo=await getJson('/api/commit/summary')}catch{commitInfo=null}
 try{tree=await getJson('/api/work')}catch{tree=null}
 drawNav();drawNeeds();if(work)work.update(tree)}

$('menutab').addEventListener('click',()=>setMenu(!menuOpen,true));
$('nav').addEventListener('mouseover',e=>{const k=rowOf(e);if(k)setHover(k)});$('nav').addEventListener('mouseleave',()=>setHover(null));
$('nav').addEventListener('focusin',e=>{const k=rowOf(e);if(k)setHover(k)});$('nav').addEventListener('focusout',()=>setHover(null));
$('nav').addEventListener('click',e=>{const a=e.target instanceof Element?e.target.closest('a'):null,li=a&&a.parentElement;if(li&&li.dataset.key&&li.dataset.key!==route)sendWave(li,li.dataset.key)});
addEventListener('resize',()=>{setMenu(menuOpen);placePill()});
{const hq=new URLSearchParams(location.search).get('hover');if(hq)setTimeout(()=>setHover(sceneOf(null,hq)===hq?hq:null),0)} // ?hover=<row> holds a row hovered (screenshots)
addEventListener('keydown',e=>{if(e.key==='Escape'&&menuOpen&&innerWidth<700)setMenu(false)});
addEventListener('hashchange',drawRoute);
addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
const bot=mountBot({query:new URLSearchParams(location.search).get('bot'),store}); // R7b: the corner bot, on every page
addEventListener('hashchange',()=>bot.refresh());
setMenu(menuOpen);drawRoute();refresh();setInterval(()=>{if(!document.hidden)refresh()},20000);
