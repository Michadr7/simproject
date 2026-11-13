// Mikkadr Hub 2.7: the Deploy page (foot row "Deploy"): bringing the game online. Step 1 is the check: one press reads what is live, the version, the tests, the git status, Dev Mode and the Cloudflare login,
// and shows each in plain words (ok, warning, or blocking). It publishes nothing. The judging is in hub/deploy.js; the work is done by scripts/deploy-check.mjs, started as a job (a script, no model, no tokens).
// Text only (textContent). Polls GET /api/jobs every 2 s while the check runs and every 8 s otherwise.
import {runCall,errorText} from './runs-api.js';
import {canPublish,confirmText} from './deploy-rules.js';

export const STATE_GLYPH={ok:'✓',warn:'!',fail:'✕',unknown:'?'};
export const STATE_WORD={ok:'OK',warn:'Warning',fail:'Blocks',unknown:'Unknown'};
const hm=ms=>{const d=new Date(ms),p=x=>String(x).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}`};
const agoText=(ms,now)=>{const m=Math.max(0,Math.round((now-ms)/60000));return m<1?'just now':m<60?m+' min ago':m<48*60?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'};
// The sentence at the top of the page.
export function nextLine(d,job,now=Date.now(),pub=null){
 if(!d||!d.enabled)return 'Tools are switched off. Stop the hub and start it again with: npm run hub -- --runs';
 if(pub&&pub.running)return 'Publishing now. Keep this hub open until it finishes. It then reads the live site to see the new version arrive.';
 if(job&&job.running)return 'Checking now. This reads the live site and Cloudflare and takes a few seconds. Nothing is published.';
 if(d.busy&&!(job&&job.running))return 'A run, the master or a job is working. Wait for it, then press Check.';
 const l=job&&job.last;
 if(!l||!l.summary||!Array.isArray(l.summary.checks))return 'Press Check before going online. It reads the live site, the version, the tests, the git status and the Cloudflare login, and publishes nothing.';
 const age=l.endedAt?` The check ran ${agoText(l.endedAt,now)}.`:'';
 return l.summary.ok?`Everything needed is in place for ${l.summary.version||'this version'}.${age} Warnings are yours to judge. Press Publish when you are ready.`:`Something blocks going online (marked below).${age} Fix it, then press Check again.`}

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}

export function mountDeploy(view,{onChange}={}){
 let alive=true,timer=null,sig=null,busy=false;
 const stop=()=>{alive=false;clearTimeout(timer)};
 const top=h('p',{class:'next'}),note=h('p',{class:'msg err',role:'alert',hidden:true}),body=h('div',{});
 view.append(top,note,body);
 const say=t=>{note.textContent=t;note.hidden=!t};
 async function publish(sum){
  if(busy||!confirm(confirmText(sum)))return;busy=true;say('');
  const res=await runCall('job-start',{job:'deploy',confirm:sum.version});busy=false;if(!alive)return;
  if(!res.ok)say(errorText(res));
  await load(true);if(onChange)onChange()}
 async function check(){
  if(busy)return;busy=true;say('');
  const res=await runCall('job-start',{job:'deploy-check'});busy=false;if(!alive)return;
  if(!res.ok)say(errorText(res));
  await load(true);if(onChange)onChange()}
 function draw(d,force){
  const job=d&&d.jobs?d.jobs.find(j=>j.key==='deploy-check'):null,pub=d&&d.jobs?d.jobs.find(j=>j.key==='deploy'):null,s=JSON.stringify([d&&d.enabled,d&&d.busy,job,pub]);if(!force&&s===sig)return;sig=s;
  top.textContent='';top.append(h('b',{},'NEXT STEP'),nextLine(d,job,Date.now(),pub));body.textContent='';
  if(!d){body.append(h('p',{class:'soon'},'Could not read the tools. Is the hub still running?'));return}
  if(!d.enabled){body.append(h('div',{class:'box'},h('div',{class:'label'},'Going online needs runs on'),h('p',{},'Start the hub again with:'),h('code',{class:'cmd'},'npm run hub -- --runs')));return}
  const l=job&&job.last,sum=l&&l.summary,running=!!(job&&job.running);
  body.append(h('div',{class:'box tool'},h('div',{class:'tool-head'},
   h('span',{class:'plan-main'},h('span',{class:'plan-title'},'Check before going online'),h('span',{class:'plan-meta tool-res '+(running?'run':sum&&sum.ok?'ok':sum?'bad':'')},running?'Checking…':sum?sum.text:'Not run yet'),h('span',{class:'plan-meta'},'Sends and publishes nothing. It reads what is live and checks the Cloudflare login.')),
   h('span',{class:'acts'},h('button',{class:'btn pri',type:'button',disabled:running||d.busy,onclick:check},'Check')))));
  if(sum&&Array.isArray(sum.checks)){
   body.append(h('h2',{class:'sect'},'Results'),h('div',{class:'box'},h('ul',{class:'dchecks'},sum.checks.map(c=>h('li',{class:'dc dc-'+c.state},
    h('span',{class:'dg','aria-hidden':'true'},STATE_GLYPH[c.state]||'?'),h('span',{},h('b',{},c.label),h('span',{class:'dw'},' · '+(STATE_WORD[c.state]||c.state)),h('br'),h('span',{class:'small dim'},c.text)))))))}
  // Publish: only after a passing check from the last 10 minutes; the browser asks once more, naming both versions. The hub and the script check it all again.
  const can=canPublish(job&&job.last,Date.now()),pl=pub&&pub.last,pr=!!(pub&&pub.running);
  body.append(h('h2',{class:'sect'},'Go online'),h('div',{class:'box tool'+(pr?' on':'')},h('div',{class:'tool-head'},
   h('span',{class:'plan-main'},h('span',{class:'plan-title'},'Publish the game'),
    h('span',{class:'plan-meta tool-res '+(pr?'run':pl&&pl.summary?(pl.summary.ok?'ok':'bad'):'')},pr?'Publishing…':pl&&pl.summary?pl.summary.text+(pl.endedAt?' · '+hm(pl.endedAt)+' ('+agoText(pl.endedAt,Date.now())+')':''):'Not published from the hub yet'),
    h('span',{class:'plan-meta'},can.ok?'Runs wrangler deploy for '+job.last.summary.version+'. One press, one deploy. It is never forced.':can.why)),
   h('span',{class:'acts'},h('button',{class:'btn pri danger',type:'button',disabled:!can.ok||pr||d.busy,onclick:()=>publish(job.last.summary)},'Publish')))),
   !pr&&pl&&pl.tail&&pl.tail.length?h('details',{class:'fold tool-fold'},h('summary',{},`Last output (${pl.tail.length} line${pl.tail.length===1?'':'s'})`),h('pre',{class:'tool-out'},pl.tail.join('\n'))):null)}
 async function load(force){
  clearTimeout(timer);
  const d=await getJson('/api/jobs');if(!alive)return;
  draw(d,force);
  timer=setTimeout(()=>{if(document.hidden)timer=setTimeout(load,4000);else load()},d&&(d.running||d.busy)?2000:8000)}
 load();
 return stop}