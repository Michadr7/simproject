// P3: the token watcher

// Mikkadr Hub, P3: the token watcher. Pure rules plus small file readers; it never calls a model and never starts a process.
// The real 5-hour and weekly percentages come from the rate_limit_event that every headless Claude Code run prints (P1): `parseRunOutput` reads them,
// `.hub/usage.jsonl` keeps them, `evaluate` turns the newest into zones and warnings, `canStart` and `shouldStop` are the hub's rules, and `scanLogs` counts
// the tokens this PC's Claude Code sessions have used (from ~/.claude/projects) so a reading can be projected forward until the next one.
// Rules from the user (2026-11-10): the weekly limit never reaches 100 (hard stop 99, warnings from 60); the 5-hour limit may reach 100 (the queue pauses).
import fs from 'node:fs';
import path from 'node:path';

export const LIMITS={
 weekly:{label:'Weekly',watch:60,high:75,critical:90,stop:99},
 fiveHour:{label:'5-hour',watch:50,high:75,critical:90,stop:100}};
// internalGuard: an extra stop below the user's hard limit, because readings are whole percents and can lag inside a run. The user said yes to 97 on 2026-11-10 (plan decision 9);
// the hard limit stays 99, and the guard never raises it. Pass internalGuard:null to see the plain 99 rule.
export const DEFAULTS={stop:LIMITS.weekly.stop,internalGuard:97,staleMinutes:15};
export const ZONES=['calm','watch','high','critical','stop'];
const round1=n=>Math.round(n*10)/10;
export const effectiveStop=(config=DEFAULTS)=>config.internalGuard!=null?Math.min(config.internalGuard,config.stop??LIMITS.weekly.stop):(config.stop??LIMITS.weekly.stop);

// ── Reading a run's output (stream-json). Utilization arrives as a fraction of the limit (0.42 is 42 percent).
function readingOf(info){
 const w=info.unifiedWindows||{};
 const pick=k=>{const v=w[k];return v&&Number.isFinite(v.utilization)?{pct:round1(v.utilization*100),resetsAt:v.resetsAt??null}:null};
 let weekly=pick('seven_day'),fiveHour=pick('five_hour');
 if(!weekly&&!fiveHour&&Number.isFinite(info.utilization)){const one={pct:round1(info.utilization*100),resetsAt:info.resetsAt??null};if(info.rateLimitType==='seven_day')weekly=one;else if(info.rateLimitType==='five_hour')fiveHour=one}
 return weekly||fiveHour?{weekly,fiveHour}:null}
export function parseRunOutput(text){
 const readings=[];let result=null;
 for(const line of String(text).replace(/^﻿/,'').split(/\r?\n/)){if(!line.trim())continue;let e;try{e=JSON.parse(line)}catch{continue}
  if(e.type==='rate_limit_event'&&e.rate_limit_info){const r=readingOf(e.rate_limit_info);if(r)readings.push(r)}
  if(e.type==='result')result={isError:!!e.is_error,costUsd:e.total_cost_usd??null,turns:e.num_turns??null,usage:e.usage||{},models:Object.keys(e.modelUsage||{}),text:e.is_error?String(e.result||'').slice(0,200):''}}
 return {readings,result}}

// ── The store: one JSON line per reading. {at (ms), source, weekly:{pct,resetsAt}|null, fiveHour:{...}|null, tokensTotal?}
export const loadReadings=file=>{if(!fs.existsSync(file))return [];const out=[];for(const l of fs.readFileSync(file,'utf8').replace(/^﻿/,'').split(/\r?\n/)){if(!l.trim())continue;try{const r=JSON.parse(l);if(Number.isFinite(r.at)&&(r.weekly||r.fiveHour))out.push(r)}catch{}}return out.sort((a,b)=>a.at-b.at)};
export function appendReading(file,reading){fs.mkdirSync(path.dirname(file),{recursive:true});fs.appendFileSync(file,JSON.stringify(reading)+'\n')}

// ── Zones and the state of both gauges
export function zoneOf(limit,pct,stopAt=LIMITS[limit].stop){const L=LIMITS[limit];if(pct==null)return 'unknown';if(pct>=stopAt)return 'stop';if(pct>=L.critical)return 'critical';if(pct>=L.high)return 'high';if(pct>=L.watch)return 'watch';return 'calm'}
function windowState(key,reading,now,config=DEFAULTS){
 const w=reading?.[key];if(!w)return {key,known:false,pct:null,zone:'unknown',resetsAt:null,resetIn:null,resetSinceReading:false};
 const resetMs=w.resetsAt?w.resetsAt*1000:null,reset=resetMs!=null&&now>=resetMs; // the window rolled over after the reading: the number is old
 return {key,known:!reset,pct:reset?null:w.pct,zone:reset?'unknown':zoneOf(key,w.pct,key==='weekly'?effectiveStop(config):undefined),resetsAt:resetMs,resetIn:resetMs?Math.max(0,resetMs-now):null,resetSinceReading:reset,lastPct:w.pct}}
export function evaluate(readings,{now=Date.now(),config=DEFAULTS}={}){
 const newest=key=>[...readings].reverse().find(r=>r[key]);
 const weeklyR=newest('weekly'),fiveR=newest('fiveHour');
 const weekly=windowState('weekly',weeklyR,now,config),fiveHour=windowState('fiveHour',fiveR,now,config);
 const at=Math.max(weeklyR?.at??0,fiveR?.at??0)||null,ageMin=at?Math.round((now-at)/60000):null,stale=at==null||ageMin>(config.staleMinutes??15);
 weekly.readingAt=weeklyR?.at??null;fiveHour.readingAt=fiveR?.at??null;
 const state={now,at,ageMin,stale,weekly,fiveHour,config,warnings:[]};state.warnings=warningsOf(state);return state}
const clock=ms=>new Date(ms).toLocaleString('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'});
function warningsOf(s){
 const out=[],stopAt=effectiveStop(s.config),w=s.weekly,f=s.fiveHour;
 if(s.at==null)out.push({level:'info',text:'No usage reading yet. Run npm run watcher -- --probe (one small Haiku call) to get the first one.'});
 else if(s.stale)out.push({level:'info',text:`The newest reading is ${s.ageMin>=120?Math.round(s.ageMin/60)+' hours':s.ageMin+' minutes'} old. Real use may be higher.`});
 if(w.resetSinceReading)out.push({level:'info',text:`The weekly window reset after the last reading (it was ${w.lastPct}%). Take a new reading.`});
 if(f.resetSinceReading)out.push({level:'info',text:`The 5-hour window reset after the last reading (it was ${f.lastPct}%). Take a new reading.`});
 if(w.known){const L=LIMITS.weekly;
  if(w.pct>=stopAt)out.push({level:'stop',text:`Weekly use is ${w.pct}%. Agents are stopped and nothing new starts until the reset (${clock(w.resetsAt)}).`});
  else if(w.pct>=L.critical)out.push({level:'critical',text:`Weekly use is ${w.pct}%. A run starts only if its estimate keeps use under ${stopAt}%.`});
  else if(w.pct>=L.high)out.push({level:'high',text:`Weekly use is ${w.pct}%. Only Haiku, Sonnet and scripts should start.`});
  else if(w.pct>=L.watch)out.push({level:'watch',text:`Weekly use is ${w.pct}%. Opus runs need a second yes.`})}
 if(f.known){const L=LIMITS.fiveHour;
  if(f.pct>=L.stop)out.push({level:'stop',text:`5-hour use is ${f.pct}%. The queue is paused until ${clock(f.resetsAt)}.`});
  else if(f.pct>=L.critical)out.push({level:'critical',text:`5-hour use is ${f.pct}%. Wait for the reset (${clock(f.resetsAt)}) before a large run.`});
  else if(f.pct>=L.high)out.push({level:'high',text:`5-hour use is ${f.pct}%. Consider waiting for the reset (${clock(f.resetsAt)}).`});
  else if(f.pct>=L.watch)out.push({level:'watch',text:`5-hour use is ${f.pct}%. It resets ${clock(f.resetsAt)}.`})}
 return out}

// ── The hub's rules
// canStart: may a run begin? estimatePct is the run's expected share of the weekly limit, or null when unknown.
export function canStart(state,{estimatePct=null,model='sonnet'}={}){
 const reasons=[],stopAt=effectiveStop(state.config),w=state.weekly,f=state.fiveHour;let ok=true,secondYes=false;
 if(w.known){
  if(w.pct>=stopAt){ok=false;reasons.push(`weekly use is ${w.pct}%, at or over the stop (${stopAt}%)`)}
  else if(estimatePct!=null&&w.pct+estimatePct>=stopAt){ok=false;reasons.push(`the estimate (${estimatePct}%) would take weekly use from ${w.pct}% to ${round1(w.pct+estimatePct)}%, past the stop at ${stopAt}%`)}
  else if(estimatePct==null&&w.pct>=LIMITS.weekly.critical){ok=false;reasons.push(`weekly use is ${w.pct}% and this run has no estimate`)}
  if(ok&&/opus|fable/i.test(model)&&w.pct>=LIMITS.weekly.watch)secondYes=true}
 else if(w.resetSinceReading)reasons.push('the weekly reading is from before a reset');
 if(f.known&&f.pct>=LIMITS.fiveHour.stop){ok=false;reasons.push(`5-hour use is ${f.pct}%: paused until the reset`)}
 return {ok,secondYes,needsProbe:state.stale,reasons}}
// shouldStop: stop a running agent now? tokensSince is what this PC's sessions used since the reading, rate is percent of weekly per million tokens (learnRate), or null.
export function shouldStop(state,{tokensSince=0,rate=null}={}){
 const stopAt=effectiveStop(state.config),w=state.weekly,f=state.fiveHour;
 if(w.known){const projected=w.pct+(rate?tokensSince/1e6*rate:0);if(projected>=stopAt)return {stop:true,kind:'weekly',reason:`weekly use is about ${round1(projected)}%, at the stop (${stopAt}%)`,projected}}
 if(f.known&&f.pct>=LIMITS.fiveHour.stop)return {stop:true,kind:'pause',reason:'the 5-hour limit is reached: pause until it resets',projected:f.pct};
 return {stop:false,kind:null,reason:'',projected:w.known?w.pct:null}}

// ── Learning how many percent a million tokens costs, from readings that carry a token total. Rough: tokens are counted raw (input, output, cache writes).
export function learnRate(readings,key='weekly'){
 const obs=readings.filter(r=>r[key]&&Number.isFinite(r.tokensTotal)).sort((a,b)=>a.at-b.at),ratios=[];
 for(let i=1;i<obs.length;i++){const a=obs[i-1],b=obs[i],dPct=b[key].pct-a[key].pct,dTok=b.tokensTotal-a.tokensTotal;if(dPct>=2&&dTok>0&&(a[key].resetsAt===b[key].resetsAt))ratios.push(dPct/(dTok/1e6))}
 if(!ratios.length)return null;ratios.sort((x,y)=>x-y);return {rate:round1(ratios[Math.floor(ratios.length/2)]),n:ratios.length}}

// ── Counting tokens in this PC's Claude Code session logs (account-wide use from other devices is not here)
function walk(dir,out=[]){if(!fs.existsSync(dir))return out;for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())walk(p,out);else if(d.name.endsWith('.jsonl'))out.push(p)}return out}
const localDay=ms=>{const d=new Date(ms);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const blank=()=>({messages:0,input:0,output:0,cacheCreate:0,cacheRead:0,billable:0});
const add=(t,u)=>{t.messages++;t.input+=u.input_tokens||0;t.output+=u.output_tokens||0;t.cacheCreate+=u.cache_creation_input_tokens||0;t.cacheRead+=u.cache_read_input_tokens||0;t.billable=t.input+t.output+t.cacheCreate};
export function scanLogs(dir,{since=0,until=Infinity}={}){
 const seen=new Map(); // one API message can be written to the log several times; keep the last (largest) copy of each
 for(const file of walk(dir)){let text;try{text=fs.readFileSync(file,'utf8')}catch{continue}
  for(const line of text.split('\n')){if(!line.includes('"usage"'))continue;let e;try{e=JSON.parse(line)}catch{continue}
   const m=e.message,u=m?.usage;if(e.type!=='assistant'||!u||!m.model||m.model==='<synthetic>')continue;
   const at=Date.parse(e.timestamp);if(!(at>=since&&at<until))continue;
   const id=m.id||e.uuid||`${file}:${at}`,old=seen.get(id);if(!old||(u.output_tokens||0)>=(old.u.output_tokens||0))seen.set(id,{at,model:m.model,u})}}
 const byModel={},byDay={},total=blank();
 for(const {at,model,u} of seen.values()){add(byModel[model]??=blank(),u);add((byDay[localDay(at)]??={}).total??=blank(),u);add(((byDay[localDay(at)].models??={})[model]??=blank()),u);add(total,u)}
 return {total,byModel,byDay,messages:seen.size}}
