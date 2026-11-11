// Mikkadr Hub P4, S3: the shell. Draws the rail, the Menu panel and the gauges, follows the hash route, and sets the accent from the weekly gauge.
// Waiting for you (home.js) and Plans (plans.js) draw inside the shell; Assets and Tokens open the pages that already exist. Polls GET /api/gauges and /api/waiting every 20 s and when the tab comes back; the writes live in plans.js and home.js.
import {ROWS,routeOf,planIdOf,runIdOf,accentOf,barOf,titleOf,pageOf,sceneOf} from './shell.js';
import {mountPlans} from './plans.js';
import {mountRuns} from './runs.js';
import {mountChat} from './chat.js';
import {mountHome} from './home.js';
import {mountBot} from './bot.js';

const $=id=>document.getElementById(id);
const root=document.documentElement;
const counts={waiting:0,plans:0,runs:0,assets:0,tokens:0};
let route=routeOf(location.hash),menuOpen,unmount=null,home=null,lastWaiting=null;

const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const q=new URLSearchParams(location.search).get('menu'); // ?menu=open|closed overrides the remembered choice (used for screenshots)
menuOpen=q==='open'?true:q==='closed'?false:store.get('hub.menu')!=='closed';

// The sliding highlight (one pill that glides to the row under the pointer, or rests on the current page) and the scene (the background's hue follows the page, and previews the row you hover).
const pill=document.createElement('i');pill.className='nav-pill';pill.setAttribute('aria-hidden','true');
const scene=document.createElement('div');scene.className='scene';scene.setAttribute('aria-hidden','true');scene.append(document.createElement('i'),document.createElement('i'));document.body.prepend(scene);
let hoverKey=null;
function placePill(){
 const key=sceneOf(route,hoverKey),ul=$('nav');root.dataset.scene=key;if(hoverKey)root.dataset.hover='';else delete root.dataset.hover;
 let hit=null;for(const li of ul.querySelectorAll('li[data-key]')){const on=li.dataset.key===key;li.classList.toggle('hot',on);if(on)hit=li}
 if(!hit){pill.style.opacity='0';return}
 pill.style.opacity='1';pill.style.height=hit.offsetHeight+'px';pill.style.transform=`translateY(${hit.offsetTop}px)`}
const setHover=k=>{if(k===hoverKey)return;hoverKey=k;placePill()};
// Picking a row sends a wave of that page's colour across the screen, starting at the row.
const wave=document.createElement('div');wave.className='wave';wave.setAttribute('aria-hidden','true');scene.after(wave);
function sendWave(li,key){
 const r=li.getBoundingClientRect();wave.style.setProperty('--wx',Math.round(r.left+r.width/2)+'px');wave.style.setProperty('--wy',Math.round(r.top+r.height/2)+'px');
 wave.dataset.scene=key;wave.classList.remove('go');void wave.offsetWidth;wave.classList.add('go')}
const rowOf=e=>{const li=e.target instanceof Element?e.target.closest('li[data-key]'):null;return li?li.dataset.key:null};

function drawNav(){
 const ul=$('nav');ul.textContent='';ul.append(pill);
 for(const r of ROWS){
  const li=document.createElement('li');if(!r.off)li.dataset.key=r.key;
  const a=document.createElement(r.off?'span':'a');
  if(!r.off){a.href='#'+r.key;if(r.key===route)a.setAttribute('aria-current','page')}else a.setAttribute('aria-disabled','true');
  const num=document.createElement('b');num.textContent=r.num;a.append(num,r.label);
  if(r.off){const n=document.createElement('small');n.textContent='· '+r.off;a.append(n)}
  else if(counts[r.key]>0){const n=document.createElement('span');n.className='count';n.textContent=counts[r.key];a.append(n)}
  li.append(a);ul.append(li)}
 placePill();
}
function drawRoute(){
 route=routeOf(location.hash);
 const row=ROWS.find(r=>r.key===route),page=pageOf(route),view=$('view'),frame=$('frame');
 $('title').textContent=row.label;
 view.hidden=!!page;frame.hidden=!page;
 if(unmount){unmount();unmount=null}
 if(page){if(frame.getAttribute('src')!==page)frame.setAttribute('src',page)}
 else if(route==='plans'){view.textContent='';unmount=mountPlans(view,{id:planIdOf(location.hash),onChange:refresh})}
 else if(route==='chat'){view.textContent='';unmount=mountChat(view,{onChange:refresh})}
 else if(route==='runs'){view.textContent='';unmount=mountRuns(view,{id:runIdOf(location.hash),onChange:refresh})}
 else{view.textContent='';home=mountHome(view,{onChange:refresh});unmount=()=>{home=null};if(lastWaiting)home.update(lastWaiting);else{const p=document.createElement('p');p.className='soon';p.textContent='Loading…';view.append(p)}}
 drawNav();document.title=titleOf(route,counts.waiting);
 if(innerWidth<700)setMenu(false);
}
function setMenu(open,remember){
 if(open&&root.dataset.menu==='closed'){root.classList.add('opening');setTimeout(()=>root.classList.remove('opening'),800)} // the rows rise in once, when the menu opens (not on every redraw)
 menuOpen=open;root.dataset.menu=open?'open':'closed';$('menutab').setAttribute('aria-expanded',String(open));
 if(remember)store.set('hub.menu',open?'open':'closed')}

function gauge(id,w,orangeAt,redAt){
 const el=$(id),pct=w&&w.known?w.pct:null,fill=el.querySelector('i'),val=el.querySelector('.val');
 val.textContent=pct==null?'no reading':Math.round(pct)+'%';
 fill.style.width=pct==null?'0':Math.min(100,pct)+'%';el.dataset.bar=barOf(pct,orangeAt,redAt);
 el.setAttribute('aria-label',`${el.dataset.name} use ${val.textContent}`)}
async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(url+' '+r.status);return r.json()}
async function refresh(){
 try{const g=await getJson('/api/gauges');
  gauge('g-weekly',g.weekly,60,90);gauge('g-five',g.fiveHour,50,90);
  root.dataset.accent=accentOf(g.weekly.known?g.weekly.pct:null);
  $('g-age').textContent=g.ageMin==null?'':(g.stale?'reading ':'')+(g.ageMin>=120?Math.round(g.ageMin/60)+' h old':g.ageMin+' min old')}
 catch{$('g-age').textContent='gauges unavailable'}
 try{const w=await getJson('/api/waiting');lastWaiting=w;Object.assign(counts,w.counts);drawNav();if(home)home.update(w)}catch{if(home)home.update(null)} // the Plans page keeps its own state: a refresh never redraws it

 document.title=titleOf(route,counts.waiting)}

$('menutab').addEventListener('click',()=>setMenu(!menuOpen,true));
$('nav').addEventListener('mouseover',e=>{const k=rowOf(e);if(k)setHover(k)});$('nav').addEventListener('mouseleave',()=>setHover(null));
$('nav').addEventListener('focusin',e=>{const k=rowOf(e);if(k)setHover(k)});$('nav').addEventListener('focusout',()=>setHover(null));
$('nav').addEventListener('click',e=>{const li=e.target instanceof Element?e.target.closest('li[data-key]'):null;if(li&&li.dataset.key!==route)sendWave(li,li.dataset.key)});
addEventListener('resize',placePill);
{const hq=new URLSearchParams(location.search).get('hover');if(hq)setTimeout(()=>setHover(sceneOf(null,hq)===hq?hq:null),0)} // ?hover=<row> holds a row hovered (screenshots)
addEventListener('keydown',e=>{if(e.key==='Escape'&&menuOpen&&innerWidth<700)setMenu(false)});
addEventListener('hashchange',drawRoute);
addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
const bot=mountBot({query:new URLSearchParams(location.search).get('bot'),store}); // R7b: the corner bot, on every page
addEventListener('hashchange',()=>bot.refresh());
setMenu(menuOpen);drawRoute();refresh();setInterval(()=>{if(!document.hidden)refresh()},20000);
