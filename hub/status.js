// Mikkadr Hub P5, R7a: the status block the master chat gets with every message.

// It always knows where we are without re-reading files.
// buildStatus is pure (data in, text out); statusText reads the files and the controllers' views. No model call, no process.
// The block is capped (MAX_STATUS characters, about 1,200 tokens) because it is sent with every message and a resumed session keeps each copy.
import fs from 'node:fs';
import path from 'node:path';
import {listPlans} from './plans-store.mjs';
import {statusOf,latestRevision} from './plans.js';
import {loadReadings,evaluate} from './watcher.js';
import {actionsFor} from './web/run-actions.js';

export const MAX_STATUS=4500,MAX_STATE=1400;
const cut=(s,n)=>{s=String(s??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const hm=ms=>{const d=new Date(ms),p=x=>String(x).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}`};
const ago=(ms,now)=>{const m=Math.max(0,Math.round((now-ms)/60000));return m<1?'just now':m<60?m+' min ago':m<48*60?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'};

// The "State" section of PROJECT-BRIEF.md: what is deployed, what is committed, the queue in the user's order.
export function stateSection(briefText){
 const lines=String(briefText||'').replace(/\r\n/g,'\n').split('\n'),at=lines.findIndex(l=>/^##\s+State\s*$/.test(l));
 if(at<0)return '';
 const body=[];for(let i=at+1;i<lines.length&&!/^##\s/.test(lines[i]);i++)body.push(lines[i]);
 return cut(body.join(' '),MAX_STATE)}

// R7c: the clicks that are possible right now, as ready-made ACTION lines with their ids (the master can only propose what is listed here). At most MAX_ACTIONS.
export const MAX_ACTIONS=8;
export function possibleActions({plans=[],runs=[],ready=[]}={}){
 const out=[];
 for(const p of plans)if(statusOf(p).status==='waiting')out.push(`ACTION: approve ${p.id} ${latestRevision(p).n} (plan "${cut(p.title,50)}")`);
 for(const r of ready)if(r.canStart&&r.planId)out.push(`ACTION: start ${r.planId} ${r.revision} (run "${cut(r.title,50)}" on ${r.model})`);
 for(const r of runs){const ops=actionsFor(r).map(a=>a.op);
  if(ops.includes('resume'))out.push(`ACTION: resume ${r.id} ("${cut(r.planTitle,50)}", ${r.status})`);
  if(ops.includes('close'))out.push(`ACTION: close ${r.id} ("${cut(r.planTitle,50)}", ${r.status})`)}
 return out.slice(0,MAX_ACTIONS)}

// Hub v2 V2: the tool clicks that are possible right now (scripts from the hub's job table; no ids, no tokens). jobs: the job runner's list(), with `busy` already saying whether a run or a job works.
export function toolActions(jobs){
 if(!jobs||!jobs.enabled)return [];
 const dev=(jobs.jobs||[]).find(j=>j.key==='dev'),out=[];
 if(!jobs.busy)out.push('ACTION: test','ACTION: release','ACTION: check','ACTION: index');
 out.push(dev&&dev.running?'ACTION: dev-stop':'ACTION: dev-start');
 if(!jobs.busy)out.push('ACTION: restart');
 return out}
// The tools in two lines: the last test result with its time, and what is running.
export function toolLines(jobs,now=Date.now()){
 if(!jobs||!jobs.enabled)return [];
 const L=[],list=jobs.jobs||[],last=['test','check'].map(k=>list.find(j=>j.key===k)).map(j=>j&&j.last).filter(l=>l&&l.summary&&Number.isFinite(l.summary.total)).sort((a,b)=>b.endedAt-a.endedAt)[0];
 L.push(last?`Tests (last run from the hub, ${hm(last.endedAt)}, ${ago(last.endedAt,now)}): ${last.summary.text}${last.summary.failing&&last.summary.failing.length?'; failing: '+cut(last.summary.failing.join(', '),300):''}.`:'Tests: not run from the hub yet.');
 const up=list.filter(j=>j.kind==='service'&&j.running).map(j=>j.label+(j.url?` (${j.url})`:''));
 if(jobs.running)L.push(`A job is running now: ${cut(jobs.running.label,60)}.`);
 if(up.length)L.push('Running servers: '+up.join(', ')+'.');
 return L}

// Hub v2 V3: the work not yet committed, in two lines (counts and group names only, never file contents), and the two page-opening actions that fit. changes: commits.summary() or null.
export function changeLines(changes){
 if(!changes||!changes.enabled)return [];
 const g=Object.entries(changes.groups||{}).map(([k,n])=>`${k} ${n}`).join(', '),L=[];
 L.push(`Changes since the last commit: ${changes.files} file${changes.files===1?'':'s'}${g?' ('+g+')':''}; last commit ${changes.lastId||'none'}${changes.leftOut?`; ${changes.leftOut} private path${changes.leftOut===1?'':'s'} always left out`:''}. Commits on this PC not on GitHub yet: ${changes.unpushed||0}.`);
 const acts=[];if(changes.files>0)acts.push('ACTION: commit');if(changes.unpushed>0)acts.push('ACTION: push');
 if(acts.length)L.push('Commit actions (each only OPENS the Commit page; the owner writes or edits the message and presses the button there; propose by copying the line exactly): '+acts.join(' | '));
 return L}

// Hub v2 V4: the asset stages in a line or two (counts, ids and the names of new files only). brief: records.brief() or null. The row ids are what a RECORD: asset stage line may use.
export const MAX_ASSET_ROWS=20;
export function assetLines(brief){
 if(!brief)return [];
 const c=brief.counts||{},L=[];
 L.push(`Assets: wanted ${c.wanted||0}, received ${c.received||0}, staged ${c.staged||0}${brief.known?`, converted ${c.converted||0}, in game ${c['in-game']||0}, credited ${c.credited||0}`:' (the shipped counts are not read yet)'}, retired ${c.retired||0}. The owner moves wanted, received and staged by hand; the game's modules decide converted and in game.`);
 if(brief.newFiles>0)L.push(`New files in assets-src/ that no asset row accounts for: ${brief.newFiles}${brief.newNames&&brief.newNames.length?' ('+brief.newNames.map(n=>cut(n,80)).join(', ')+')':''}. Once the owner says which row a file belongs to: RECORD: asset file <id> "<path>".`);
 const rows=brief.rows||[];
 if(rows.length)L.push('Asset rows (id stage; copy an id exactly for RECORD: asset stage <id> <stage>): '+rows.slice(0,MAX_ASSET_ROWS).map(r=>`${cut(r.id,40)} ${r.stage}`).join(', ')+(rows.length>MAX_ASSET_ROWS?`, +${rows.length-MAX_ASSET_ROWS} more`:''));
 return L}

// plans: normalised plan objects; runs: the run views (hub/runs.js); ready: its ready() list; gauges: {weekly,fiveHour} pcts or null; chat: {model,tokens}; state: the brief's State text; jobs: the job list (or null).
export function buildStatus({plans=[],runs=[],ready=[],gauges=null,chat=null,state='',jobs=null,changes=null,assets=null,now=Date.now()}={}){
 const L=[`HUB STATUS at ${hm(now)} (ground truth: trust it over your memory; it is rebuilt for every message)`];
 if(state)L.push('Project state: '+state);
 if(gauges)L.push(`Tokens: weekly ${gauges.weekly==null?'?':Math.round(gauges.weekly)+'%'}, 5-hour ${gauges.fiveHour==null?'?':Math.round(gauges.fiveHour)+'%'}${chat?`; this chat on ${chat.model}, ${chat.tokens.toLocaleString('en-US')} tokens so far`:''}.`);
 const live=runs.find(r=>['running','waiting-answer','confirming'].includes(r.status));
 if(live)L.push(`ACTIVE RUN: ${cut(live.planTitle,70)} · ${live.status} · ${live.model} · ${live.tokens.toLocaleString('en-US')} of ${live.capTokens.toLocaleString('en-US')} tokens · ${live.files.length} file(s) touched${live.question?' · waiting for the user to answer: '+cut(live.question.text,200):''}.`);
 else L.push('No run is active.');
 const acts=possibleActions({plans,runs,ready});
 if(acts.length)L.push('Possible actions (you may propose one by copying its ACTION line exactly; the user clicks): '+acts.join(' | '));
 for(const l of toolLines(jobs,now))L.push(l);
 const tools=toolActions(jobs);
 if(tools.length)L.push('Tool actions (scripts on this PC, no tokens; propose one by copying its line exactly; the user clicks): '+tools.join(' | '));
 for(const l of changeLines(changes))L.push(l);
 for(const l of assetLines(assets))L.push(l);
 const recent=runs.filter(r=>r!==live).slice(0,4);
 if(recent.length)L.push('Recent runs: '+recent.map(r=>`${cut(r.planTitle,50)} [${r.status}${r.flagged.length?`, ${r.flagged.length} flagged file(s) to look at`:''}${r.status==='done'&&r.resultText?`, result: ${cut(r.resultText,160)}`:''}${r.reason&&r.status!=='done'?`, ${cut(r.reason,100)}`:''}] ${ago(r.updatedAt,now)}`).join(' | '));
 if(ready.length)L.push('Ready to run (approved, startable by the user pressing Start): '+ready.map(p=>`${cut(p.title,60)} (${p.model} ${p.size}${p.canStart?'':', blocked: '+cut(p.reasons.join(' '),80)})`).join('; '));
 const waiting=plans.filter(p=>statusOf(p).status==='waiting'),approved=plans.filter(p=>statusOf(p).status==='approved'),denied=plans.filter(p=>statusOf(p).status==='denied');
 if(waiting.length)L.push('Plans waiting for the user: '+waiting.slice(0,8).map(p=>`${cut(p.title,60)} (rev ${latestRevision(p).n}, from ${p.from})`).join('; '));
 if(approved.length)L.push('Plans approved: '+approved.slice(-6).map(p=>`${cut(p.title,60)} (rev ${latestRevision(p).n})`).join('; '));
 if(denied.length){const d=denied.slice(-3).map(p=>{const a=[...p.answers].reverse().find(x=>x.verdict==='denied');return `${cut(p.title,50)}${a&&a.note?` (note: ${cut(a.note,100)})`:''}`});L.push('Plans denied: '+d.join('; '))}
 let out=L.join('\n');
 if(out.length>MAX_STATUS)out=out.slice(0,MAX_STATUS-1)+'…';
 return out}

// The impure wrapper the hub uses: reads the brief and the plans, asks the controllers for their views.
export function statusText({root,runs=null,chat=null,jobs=null,commits=null,records=null,now=Date.now()}){
 let brief='';try{brief=fs.readFileSync(path.join(root,'PROJECT-BRIEF.md'),'utf8')}catch{}
 let plans=[];try{plans=listPlans(path.join(root,'plans'))}catch{}
 let g=null;try{const s=evaluate(loadReadings(path.join(root,'.hub','usage.jsonl')),{now});g={weekly:s.weekly.known?s.weekly.pct:null,fiveHour:s.fiveHour.known?s.fiveHour.pct:null}}catch{}
 const l=runs?runs.list():{runs:[],ready:[]},c=chat?chat.view():null;
 // the block is built while the master's own turn starts, so "busy" here means a run or a job, not the chat itself
 let j=null;try{if(jobs){const v=jobs.list();j={...v,busy:!!v.running||!!(runs&&runs.locked())}}}catch{}
 let ch=null;try{if(commits)ch=commits.summary()}catch{}
 let as=null;try{if(records)as=records.brief()}catch{}
 return buildStatus({plans,runs:l.runs,ready:l.ready,gauges:g,chat:c?{model:c.model,tokens:c.tokens}:null,state:stateSection(brief),jobs:j,changes:ch,assets:as,now})}

// What goes to the model: the status block, then the user's own words. The saved chat shows only the user's words.
export const withStatus=(status,text)=>status?`${status}\n\n---\nUSER MESSAGE:\n${text}`:text;
