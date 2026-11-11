// Token watcher (Mikkadr Hub P3, hub/): reading a run's rate limit event, zones and warnings at every threshold, the start and stop rules (weekly never reaches 100: stop at 99),
// learning percent per million tokens, counting tokens in session logs, the usage probe refusing without approval, and the static page.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EventEmitter} from 'node:events';
import {LIMITS,DEFAULTS,parseRunOutput,loadReadings,appendReading,zoneOf,evaluate,canStart,shouldStop,effectiveStop,learnRate,scanLogs} from '../hub/watcher.js';
import {findClaude,cleanEnv,probeArgs,runProbe,PROBE_MODEL} from '../hub/probe.js';
import {renderPage,duration} from '../hub/page.js';

const NOGUARD={...DEFAULTS,internalGuard:null}; // the user's plain 99 rule; the default config also has the 97 guard on
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'watcher-test-'));
// the event a real headless run printed on 2026-11-10 (P1): 5-hour 41 percent, weekly 5 percent
const EVENT='{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1794369600,"rateLimitType":"five_hour","unifiedWindows":{"five_hour":{"utilization":0.41,"resetsAt":1794369600,"status":"allowed"},"seven_day":{"utilization":0.05,"resetsAt":1794924000,"status":"allowed"}}}}';
const RESULT='{"type":"result","subtype":"success","is_error":false,"total_cost_usd":0.00087256,"num_turns":1,"usage":{"input_tokens":2,"output_tokens":4},"modelUsage":{"claude-haiku-5-5":{"inputTokens":2}},"result":"ok"}';
const RUN=['\uFEFF{"type":"system","subtype":"init"}','{"type":"assistant"}',EVENT,'not json at all',RESULT].join('\n');
const MIN=60000,R5=1794369600*1000,R7=1794924000*1000;
try{
 // ── parseRunOutput: BOM, junk lines, fractions become percents, the result's cost
 {const {readings,result}=parseRunOutput(RUN);assert.equal(readings.length,1);
  assert.deepEqual(readings[0],{weekly:{pct:5,resetsAt:1794924000},fiveHour:{pct:41,resetsAt:1794369600}});
  assert.equal(result.costUsd,0.00087256);assert.equal(result.isError,false);assert.deepEqual(result.models,['claude-haiku-5-5'])}
 assert.deepEqual(parseRunOutput('').readings,[]);
 assert.deepEqual(parseRunOutput('{"type":"rate_limit_event","rate_limit_info":{"rateLimitType":"seven_day","utilization":0.333,"resetsAt":5}}').readings,[{weekly:{pct:33.3,resetsAt:5},fiveHour:null}],'a single-window event');
 assert.equal(parseRunOutput('{"type":"result","is_error":true,"result":"Not logged in"}').result.text,'Not logged in');

 // ── zones sit exactly on the user's thresholds: weekly 60 / 75 / 90 / stop 99, 5-hour 50 / 75 / 90 / pause 100
 for(const [pct,zone] of [[0,'calm'],[59.9,'calm'],[60,'watch'],[74.9,'watch'],[75,'high'],[89.9,'high'],[90,'critical'],[98.9,'critical'],[99,'stop'],[100,'stop']])assert.equal(zoneOf('weekly',pct),zone,`weekly ${pct}`);
 for(const [pct,zone] of [[0,'calm'],[49.9,'calm'],[50,'watch'],[75,'high'],[90,'critical'],[99.9,'critical'],[100,'stop']])assert.equal(zoneOf('fiveHour',pct),zone,`5-hour ${pct}`);
 assert.equal(zoneOf('weekly',null),'unknown');assert.equal(LIMITS.weekly.stop,99,'the weekly stop is 99, as the user set it');assert.equal(DEFAULTS.internalGuard,97,'the 97 guard is on: the user said yes on 2026-11-10');assert.equal(DEFAULTS.stop,99,'the hard limit stays 99');

 // ── evaluate: the newest reading per window, age, staleness, resets
 const at=R5-210*MIN,reading=(w,f,t=at)=>({at:t,source:'probe',weekly:w==null?null:{pct:w,resetsAt:1794924000},fiveHour:f==null?null:{pct:f,resetsAt:1794369600}});
 {const s=evaluate([reading(5,41)],{now:at+12*MIN});assert.equal(s.weekly.pct,5);assert.equal(s.fiveHour.pct,41);assert.equal(s.ageMin,12);assert.equal(s.stale,false);assert.equal(s.weekly.resetIn,R7-(at+12*MIN));assert.deepEqual(s.warnings,[])}
 {const s=evaluate([reading(5,41),reading(6,42,at+30*MIN)],{now:at+31*MIN});assert.equal(s.weekly.pct,6,'the newest reading wins')}
 {const s=evaluate([reading(5,41),{at:at+MIN,source:'run',weekly:null,fiveHour:{pct:44,resetsAt:1794369600}}],{now:at+2*MIN});assert.equal(s.weekly.pct,5,'a window missing from the newest reading keeps its own latest');assert.equal(s.fiveHour.pct,44)}
 {const s=evaluate([reading(5,41)],{now:at+16*MIN});assert.equal(s.stale,true);assert.match(s.warnings[0].text,/16 minutes old/)}
 {const s=evaluate([reading(5,41)],{now:at+5*60*MIN});assert.match(s.warnings[0].text,/5 hours old/)}
 {const s=evaluate([],{now:1});assert.equal(s.at,null);assert.equal(s.stale,true);assert.match(s.warnings[0].text,/No usage reading yet/);assert.equal(s.weekly.zone,'unknown')}
 {const s=evaluate([reading(5,95)],{now:R5+MIN});assert.equal(s.fiveHour.known,false,'the 5-hour window reset after the reading');assert.equal(s.fiveHour.resetSinceReading,true);assert.equal(s.weekly.known,true);assert.ok(s.warnings.some(w=>/5-hour window reset/.test(w.text)))}

 // ── warnings fire at every threshold, with the right level and words
 const levelFor=(w,f)=>evaluate([reading(w,f)],{now:at+MIN,config:NOGUARD}).warnings.filter(x=>x.level!=='info');
 assert.deepEqual(levelFor(59,49),[]);
 assert.deepEqual(levelFor(60,10).map(x=>x.level),['watch']);assert.match(levelFor(60,10)[0].text,/Opus runs need a second yes/);
 assert.deepEqual(levelFor(75,10).map(x=>x.level),['high']);assert.match(levelFor(75,10)[0].text,/Only Haiku, Sonnet and scripts/);
 assert.deepEqual(levelFor(90,10).map(x=>x.level),['critical']);assert.match(levelFor(90,10)[0].text,/under 99%/);
 assert.deepEqual(levelFor(99,10).map(x=>x.level),['stop']);assert.match(levelFor(99,10)[0].text,/Agents are stopped/);
 assert.deepEqual(levelFor(10,50).map(x=>x.level),['watch']);assert.deepEqual(levelFor(10,75).map(x=>x.level),['high']);assert.deepEqual(levelFor(10,90).map(x=>x.level),['critical']);
 assert.deepEqual(levelFor(10,100).map(x=>x.level),['stop']);assert.match(levelFor(10,100)[0].text,/queue is paused/);
 assert.deepEqual(levelFor(61,76).map(x=>x.level),['watch','high'],'both gauges can warn at once');

 // ── canStart: the rules
 const st=(w,f,config=NOGUARD)=>evaluate([reading(w,f)],{now:at+MIN,config}),stDefault=(w,f)=>evaluate([reading(w,f)],{now:at+MIN}); // st: the plain 99 rule; stDefault: the real default, guard on
 assert.deepEqual(canStart(st(6,42),{estimatePct:2,model:'sonnet'}),{ok:true,secondYes:false,needsProbe:false,reasons:[]});
 assert.equal(canStart(st(60,10),{estimatePct:1,model:'opus'}).secondYes,true);assert.equal(canStart(st(60,10),{estimatePct:1,model:'sonnet'}).secondYes,false);assert.equal(canStart(st(59,10),{estimatePct:1,model:'opus'}).secondYes,false);
 assert.equal(canStart(st(91,10),{estimatePct:null}).ok,false,'from 90 a run needs an estimate');assert.match(canStart(st(91,10),{estimatePct:null}).reasons[0],/no estimate/);
 assert.equal(canStart(st(91,10),{estimatePct:7}).ok,true,'91 + 7 stays under 99');assert.equal(canStart(st(91,10),{estimatePct:8}).ok,false,'91 + 8 reaches 99');assert.match(canStart(st(91,10),{estimatePct:8}).reasons[0],/past the stop at 99%/);
 assert.equal(canStart(st(98.9,10),{estimatePct:0.1}).ok,false);assert.equal(canStart(st(99,10),{estimatePct:0}).ok,false,'at 99 nothing starts');assert.equal(canStart(st(100,10),{estimatePct:0}).ok,false);
 assert.equal(canStart(st(10,100),{estimatePct:1}).ok,false,'the 5-hour limit pauses the queue');assert.match(canStart(st(10,100),{estimatePct:1}).reasons[0],/paused/);assert.equal(canStart(st(10,99),{estimatePct:1}).ok,true,'the 5-hour limit may be used up to 100');
 assert.equal(canStart(evaluate([reading(5,41)],{now:at+60*MIN}),{estimatePct:1}).needsProbe,true,'an old reading asks for a new one');
 {const guard={...DEFAULTS,internalGuard:97};assert.equal(effectiveStop(guard),97);assert.equal(effectiveStop(DEFAULTS),97,'the default has the guard on');assert.equal(effectiveStop(NOGUARD),99);assert.equal(effectiveStop({...DEFAULTS,internalGuard:99.5}),99,'a guard never raises the stop');
  assert.equal(canStart(st(96,10,guard),{estimatePct:2}).ok,false);assert.equal(canStart(st(96,10),{estimatePct:2}).ok,true);assert.equal(canStart(st(97,10,guard),{estimatePct:0}).ok,false);
  // the default config: 96 + 2 is refused, 96 + 0.5 is not, and from 97 up the banner and zone say stop although the hard limit is 99
  assert.equal(canStart(stDefault(96,10),{estimatePct:2}).ok,false);assert.equal(canStart(stDefault(96,10),{estimatePct:0.5}).ok,true);assert.match(canStart(stDefault(96,10),{estimatePct:2}).reasons[0],/past the stop at 97%/);
  assert.equal(stDefault(97,10).weekly.zone,'stop');assert.equal(stDefault(96.9,10).weekly.zone,'critical');assert.equal(st(97,10).weekly.zone,'critical','with the guard off, 97 is still only critical');assert.match(stDefault(97.5,10).warnings.at(-1).text,/Agents are stopped/);
  assert.equal(shouldStop(stDefault(95,10),{tokensSince:5e5,rate:5}).stop,true,'95 + 2.5 reaches 97')}

 // ── shouldStop: projects the reading forward with the learned rate; stops at 99; pauses at the 5-hour limit
 assert.equal(shouldStop(st(50,10),{tokensSince:1e6,rate:5}).stop,false);
 assert.deepEqual([shouldStop(st(97,10),{tokensSince:5e5,rate:5}).stop,shouldStop(st(97,10),{tokensSince:5e5,rate:5}).projected],[true,99.5]);
 assert.equal(shouldStop(st(98,10),{tokensSince:1e6,rate:null}).stop,false,'without a rate there is no projection');assert.equal(shouldStop(st(99,10)).stop,true);
 assert.deepEqual(shouldStop(st(10,100)),{stop:true,kind:'pause',reason:'the 5-hour limit is reached: pause until it resets',projected:100});
 assert.equal(shouldStop(st(96,10,{...DEFAULTS,internalGuard:97}),{tokensSince:3e5,rate:5}).stop,true,'96 + 1.5 passes the 97 guard');
 assert.equal(shouldStop(evaluate([],{now:1})).stop,false,'with no reading there is nothing to stop on');

 // ── learnRate: median of percent per million tokens between readings at least 2 points apart, same window only
 const withTokens=(w,t,total,res=1794924000)=>({at:t,source:'probe',weekly:{pct:w,resetsAt:res},fiveHour:null,tokensTotal:total});
 assert.deepEqual(learnRate([withTokens(5,1,0),withTokens(9,2,2e6)]),{rate:2,n:1});
 assert.deepEqual(learnRate([withTokens(5,1,0),withTokens(9,2,2e6),withTokens(15,3,3e6),withTokens(17,4,5e6)]),{rate:2,n:3},'median of 2, 6 and 1');
 assert.equal(learnRate([withTokens(5,1,0),withTokens(6,2,5e6)]),null,'a 1 point step is too coarse');assert.equal(learnRate([withTokens(5,1,0),withTokens(9,2,2e6,99)]),null,'readings from different windows are not compared');
 assert.equal(learnRate([withTokens(5,1,0)]),null);assert.equal(learnRate([]),null);

 // ── the store: bad lines are skipped, order is by time, a missing file is empty
 {const f=path.join(tmp,'.hub','usage.jsonl');assert.deepEqual(loadReadings(f),[]);appendReading(f,reading(5,41,300));appendReading(f,reading(4,40,100));fs.appendFileSync(f,'garbage\n{"at":"x"}\n\n');
  assert.deepEqual(loadReadings(f).map(r=>r.at),[100,300])}

 // ── scanLogs: counts assistant usage once per API message, skips synthetic and other lines, groups by local day, respects the time window, reads subfolders
 {const dir=path.join(tmp,'projects');fs.mkdirSync(path.join(dir,'p1','sub'),{recursive:true});
  const day=(h)=>new Date(2026,10,10,h,0,0).toISOString(),other=new Date(2026,10,8,12,0,0).toISOString();
  const line=(id,model,usage,ts,type='assistant')=>JSON.stringify({type,uuid:'u'+id+ts,timestamp:ts,message:{id,model,usage}});
  const u=(i,o,cc,cr)=>({input_tokens:i,output_tokens:o,cache_creation_input_tokens:cc,cache_read_input_tokens:cr});
  fs.writeFileSync(path.join(dir,'p1','a.jsonl'),[line('m1','claude-opus-5-5',u(10,5,100,1000),day(9)),line('m1','claude-opus-5-5',u(10,50,100,1000),day(9)),line('m2','claude-haiku-5-5',u(2,3,0,500),day(10)),line('m3','<synthetic>',u(1,1,1,1),day(10)),line('m4','claude-opus-5-5',u(1,1,1,1),day(10),'user'),'{"type":"assistant","message":{"usage":'+'broken',line('m5','claude-opus-5-5',u(7,7,7,7),other)].join('\n'));
  fs.writeFileSync(path.join(dir,'p1','sub','b.jsonl'),line('m6','claude-sonnet-5-5',u(4,6,20,200),day(11)));
  const all=scanLogs(dir),first=new Date(2026,10,9).getTime();
  assert.equal(all.messages,4,'m1 (once), m2, m5 and m6');
  assert.deepEqual(all.byModel['claude-opus-5-5'],{messages:2,input:17,output:57,cacheCreate:107,cacheRead:1007,billable:181},'the larger copy of m1 is kept, cache reads are separate');
  assert.equal(all.byModel['<synthetic>'],undefined);assert.equal(all.total.billable,181+5+0+30);
  const recent=scanLogs(dir,{since:first});assert.equal(recent.messages,3);assert.equal(recent.byModel['claude-opus-5-5'].billable,10+50+100);
  assert.deepEqual(Object.keys(recent.byDay),['2026-11-10']);assert.equal(recent.byDay['2026-11-10'].total.messages,3);assert.equal(recent.byDay['2026-11-10'].models['claude-haiku-5-5'].output,3);
  assert.equal(scanLogs(dir,{until:first}).messages,1);assert.equal(scanLogs(path.join(tmp,'nope')).messages,0)}

 // ── the probe: a model call, so it refuses without approval and never spawns anything
 {let spawned=0;await assert.rejects(runProbe({claudePath:'x',spawnFn:()=>{spawned++}}),/go-ahead/);await assert.rejects(runProbe({approved:'yes',claudePath:'x',spawnFn:()=>{spawned++}}),/go-ahead/,'only true counts');assert.equal(spawned,0);
  await assert.rejects(runProbe({approved:true,claudePath:null}),/claude\.exe was not found/)}
 {const home='C:\\Users\\T',ext=path.join(home,'.vscode','extensions'),dirs=['anthropic.claude-code-2.1.99-win32-x64','anthropic.claude-code-2.1.322-win32-x64','anthropic.claude-code-2.1.322-linux-x64','other.thing-1'];
  const found=findClaude({env:{USERPROFILE:home},list:()=>dirs,exists:()=>true});assert.equal(found,path.join(ext,'anthropic.claude-code-2.1.322-win32-x64','resources','native-binary','claude.exe'),'newest version, numerically');
  assert.equal(findClaude({env:{USERPROFILE:home},list:()=>dirs,exists:()=>false}),null);assert.equal(findClaude({env:{USERPROFILE:home},list:()=>{throw new Error('no folder')}}),null)}
 assert.deepEqual(cleanEnv({PATH:'p',CLAUDECODE:'1',CLAUDE_CODE_SESSION_ID:'x',claude_pid:'1',ELECTRON_RUN_AS_NODE:'1',HOME:'h'}),{PATH:'p',HOME:'h'});
 {const a=probeArgs();assert.ok(a.includes('--tools=')&&a.includes('--no-session-persistence')&&a.includes('--max-budget-usd')&&a[a.indexOf('--model')+1]===PROBE_MODEL&&PROBE_MODEL==='claude-haiku-5-5')}
 const fakeSpawn=(stdout,code=0,seen={})=>(exe,args,opts)=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kill=()=>{seen.killed=true};seen.exe=exe;seen.args=args;seen.opts=opts;seen.cwdExisted=fs.existsSync(opts.cwd);setImmediate(()=>{c.stdout.emit('data',stdout);c.emit('close',code)});return c};
 {const seen={},r=await runProbe({approved:true,claudePath:'C:\\fake\\claude.exe',spawnFn:fakeSpawn(RUN,0,seen),now:()=>777});
  assert.deepEqual(r,{at:777,source:'probe',weekly:{pct:5,resetsAt:1794924000},fiveHour:{pct:41,resetsAt:1794369600},costUsd:0.00087256});
  assert.equal(seen.exe,'C:\\fake\\claude.exe');assert.equal(seen.cwdExisted,true);assert.ok(!fs.existsSync(seen.opts.cwd),'the empty working folder is removed');assert.equal(seen.opts.env.CLAUDECODE,undefined);assert.equal(seen.opts.windowsHide,true)}
 await assert.rejects(runProbe({approved:true,claudePath:'x',spawnFn:fakeSpawn('{"type":"result","is_error":true,"result":"Not logged in"}',1)}),/no reading \(exit 1: Not logged in\)/);
 await assert.rejects(runProbe({approved:true,claudePath:'x',spawnFn:fakeSpawn('{"type":"result"}',0)}),/no reading/);
 {const seen={};await assert.rejects(runProbe({approved:true,claudePath:'x',timeoutMs:20,spawnFn:(e,a,o)=>{const c=new EventEmitter();c.stdout=new EventEmitter();c.stderr=new EventEmitter();c.kill=()=>{seen.killed=true};seen.cwd=o.cwd;return c}}),/did not finish/);assert.equal(seen.killed,true);assert.ok(!fs.existsSync(seen.cwd))}

 // ── the page: gauges with their numbers and words, banners, the decisions table, no scripts and no network
 const page=(readings,now,extra={})=>renderPage({state:evaluate(readings,{now,config:NOGUARD,...extra}),today:{'claude-opus-5-5':{messages:3,billable:12345,output:99,cacheRead:5e6}},week:{},readings,rate:null,generatedAt:now});
 {const html=page([reading(63,52)],at+2*MIN);assert.match(html,/<!doctype html>/);assert.match(html,/Token watcher/);assert.match(html,/class="card gauge z-watch"[\s\S]*63<small>%/);assert.match(html,/52<small>%/);
  assert.match(html,/WATCH<\/b> Weekly use is 63%/);assert.match(html,/--acc:232,150,40/,'the accent follows the weekly zone');
  assert.match(html,/Would a run start now\?/);assert.match(html,/needs a second yes/);assert.match(html,/12,345/);assert.match(html,/99 stop/);assert.match(html,/100 pause/);
  assert.ok(!/<script/i.test(html),'no scripts');assert.ok(!/https?:\/\//i.test(html),'no network addresses');assert.match(html,/npm run watcher -- --probe/)}
 {const html=page([reading(5,41)],at+90*MIN);assert.match(html,/new reading first/,'a stale reading does not read as a plain "allowed"');assert.ok(!html.includes('>allowed<'))}
 {const html=page([reading(5,41)],at+MIN);assert.match(html,/>allowed</);assert.ok(!html.includes('new reading first'))}
 {const html=page([reading(99.4,100)],at+MIN);assert.match(html,/z-stop/);assert.match(html,/STOP<\/b> Weekly use is 99.4%/);assert.match(html,/refused/);assert.match(html,/--acc:220,52,62/)}
 {const html=page([reading(50,10)],at+MIN,{config:DEFAULTS});assert.match(html,/97 stop/);assert.match(html,/internal guard on; your hard limit is 99%/);assert.ok(!html.includes('99 stop'))}
 {const html=page([reading(50,10)],at+MIN);assert.match(html,/Weekly stop at 99%/);assert.ok(!html.includes('internal guard'))}
 {const html=page([],1);assert.match(html,/no reading/);assert.match(html,/No usage reading yet/);assert.match(html,/--acc:120,128,140/);assert.match(html,/No readings yet/)}
 {const html=renderPage({state:evaluate([reading(5,41)],{now:at+MIN}),today:{'<b>x</b>':{messages:1,billable:1,output:1,cacheRead:0}},week:{},readings:[],generatedAt:at});assert.ok(!html.includes('<b>x</b>')&&html.includes('&lt;b&gt;x&lt;/b&gt;'),'model names are escaped')}
 assert.deepEqual([duration(null),duration(5*MIN),duration(95*MIN),duration(30*3600e3)],['','5 min','1 h 35 min','30 h 0 min']);assert.equal(duration(3*86400e3),'3 d 0 h');

 // ── wiring: the page and data folder are not committed, the npm script exists
 assert.match(fs.readFileSync(path.join(ROOT,'.gitignore'),'utf8'),/^\.hub\/\s*$/m);assert.equal(JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).scripts.watcher,'node hub/watcher-cli.mjs');
 console.log('watcher tests passed: zones and warnings at every threshold, start and stop at 99, the probe refuses without approval, logs counted once per message, a static page with no scripts');
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
