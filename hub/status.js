// Mikkadr Hub P5, R7a: the status block the master chat gets with every message, so it always knows where we are without re-reading files.
// buildStatus is pure (data in, text out); statusText reads the files and the controllers' views. No model call, no process.
// The block is capped (MAX_STATUS characters, about 1,200 tokens) because it is sent with every message and a resumed session keeps each copy.
import fs from 'node:fs';
import path from 'node:path';
import {listPlans} from './plans-store.mjs';
import {statusOf,latestRevision} from './plans.js';
import {loadReadings,evaluate} from './watcher.js';

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

// plans: normalised plan objects; runs: the run views (hub/runs.js); ready: its ready() list; gauges: {weekly,fiveHour} pcts or null; chat: {model,tokens}; state: the brief's State text.
export function buildStatus({plans=[],runs=[],ready=[],gauges=null,chat=null,state='',now=Date.now()}={}){
 const L=[`HUB STATUS at ${hm(now)} (ground truth: trust it over your memory; it is rebuilt for every message)`];
 if(state)L.push('Project state: '+state);
 if(gauges)L.push(`Tokens: weekly ${gauges.weekly==null?'?':Math.round(gauges.weekly)+'%'}, 5-hour ${gauges.fiveHour==null?'?':Math.round(gauges.fiveHour)+'%'}${chat?`; this chat on ${chat.model}, ${chat.tokens.toLocaleString('en-US')} tokens so far`:''}.`);
 const live=runs.find(r=>['running','waiting-answer','confirming'].includes(r.status));
 if(live)L.push(`ACTIVE RUN: ${cut(live.planTitle,70)} · ${live.status} · ${live.model} · ${live.tokens.toLocaleString('en-US')} of ${live.capTokens.toLocaleString('en-US')} tokens · ${live.files.length} file(s) touched${live.question?' · waiting for the user to answer: '+cut(live.question.text,200):''}.`);
 else L.push('No run is active.');
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
export function statusText({root,runs=null,chat=null,now=Date.now()}){
 let brief='';try{brief=fs.readFileSync(path.join(root,'PROJECT-BRIEF.md'),'utf8')}catch{}
 let plans=[];try{plans=listPlans(path.join(root,'plans'))}catch{}
 let g=null;try{const s=evaluate(loadReadings(path.join(root,'.hub','usage.jsonl')),{now});g={weekly:s.weekly.known?s.weekly.pct:null,fiveHour:s.fiveHour.known?s.fiveHour.pct:null}}catch{}
 const l=runs?runs.list():{runs:[],ready:[]},c=chat?chat.view():null;
 return buildStatus({plans,runs:l.runs,ready:l.ready,gauges:g,chat:c?{model:c.model,tokens:c.tokens}:null,state:stateSection(brief),now})}

// What goes to the model: the status block, then the user's own words. The saved chat shows only the user's words.
export const withStatus=(status,text)=>status?`${status}\n\n---\nUSER MESSAGE:\n${text}`:text;
