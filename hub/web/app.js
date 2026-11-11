// Mikkadr Hub P4, S3: the shell. Draws the rail, the Menu panel and the gauges, follows the hash route, and sets the accent from the weekly gauge.
// Waiting for you (home.js) and Plans (plans.js) draw inside the shell; Assets and Tokens open the pages that already exist. Polls GET /api/gauges and /api/waiting every 20 s and when the tab comes back; the writes live in plans.js and home.js.
import {ROWS,routeOf,planIdOf,accentOf,barOf,titleOf,pageOf} from './shell.js';
import {mountPlans} from './plans.js';
import {mountHome} from './home.js';

const $=id=>document.getElementById(id);
const root=document.documentElement;
const counts={waiting:0,plans:0,assets:0,tokens:0};
let route=routeOf(location.hash),menuOpen,unmount=null,home=null,lastWaiting=null;

const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const q=new URLSearchParams(location.search).get('menu'); // ?menu=open|closed overrides the remembered choice (used for screenshots)
menuOpen=q==='open'?true:q==='closed'?false:store.get('hub.menu')!=='closed';

function drawNav(){
 const ul=$('nav');ul.textContent='';
 for(const r of ROWS){
  const li=document.createElement('li');
  const a=document.createElement(r.off?'span':'a');
  if(!r.off){a.href='#'+r.key;if(r.key===route)a.setAttribute('aria-current','page')}else a.setAttribute('aria-disabled','true');
  const num=document.createElement('b');num.textContent=r.num;a.append(num,r.label);
  if(r.off){const n=document.createElement('small');n.textContent='· '+r.off;a.append(n)}
  else if(counts[r.key]>0){const n=document.createElement('span');n.className='count';n.textContent=counts[r.key];a.append(n)}
  li.append(a);ul.append(li)}
}
function drawRoute(){
 route=routeOf(location.hash);
 const row=ROWS.find(r=>r.key===route),page=pageOf(route),view=$('view'),frame=$('frame');
 $('title').textContent=row.label;
 view.hidden=!!page;frame.hidden=!page;
 if(unmount){unmount();unmount=null}
 if(page){if(frame.getAttribute('src')!==page)frame.setAttribute('src',page)}
 else if(route==='plans'){view.textContent='';unmount=mountPlans(view,{id:planIdOf(location.hash),onChange:refresh})}
 else{view.textContent='';home=mountHome(view,{onChange:refresh});unmount=()=>{home=null};if(lastWaiting)home.update(lastWaiting);else{const p=document.createElement('p');p.className='soon';p.textContent='Loading…';view.append(p)}}
 drawNav();document.title=titleOf(route,counts.waiting);
 if(innerWidth<700)setMenu(false);
}
function setMenu(open,remember){
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
addEventListener('keydown',e=>{if(e.key==='Escape'&&menuOpen&&innerWidth<700)setMenu(false)});
addEventListener('hashchange',drawRoute);
addEventListener('focus',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setMenu(menuOpen);drawRoute();refresh();setInterval(()=>{if(!document.hidden)refresh()},20000);
