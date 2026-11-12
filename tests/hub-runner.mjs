// Mikkadr Hub P5 R2: the run engine against a fake Claude CLI. No model call, no network; the real claude.exe is never looked up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {relPath,buildArgs,createReducer,createCapTracker,runTurn,killTree,isAlive,toolsOf,firstPrompt,budgetUsd,HOUSE_RULES,MODEL_IDS} from '../hub/runner.js';
import {evaluate} from '../hub/watcher.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),FAKE=path.join(HERE,'fixtures','fake-claude.mjs');
const SID='11111111-1111-4111-8111-111111111111';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-runner-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ── guard: nothing here may find the real claude.exe
for(const f of [fileURLToPath(import.meta.url),path.join(HERE,'..','hub','runner.js')]){const src=fs.readFileSync(f,'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');assert.ok(!/findClaude\s*\(/.test(src.replace(/findClaude\s*\(\s*\)\s*\)/g,'')),`${path.basename(f)} does not call findClaude`)}
assert.throws(()=>runTurn({claude:null,args:[],cap:1}),/claude path/);

// ── buildArgs: every flag pinned
const a=buildArgs({model:'sonnet',sessionId:SID,capTokens:1500000,needs:['test','release','check']});
assert.deepEqual(a,['-p','--output-format','stream-json','--verbose','--model','claude-sonnet-5-5','--session-id',SID,
 '--tools=Read,Grep,Glob,Edit,Write,Bash,PowerShell',
 '--allowedTools=Read,Grep,Glob,Edit,Write,Bash(npm test),PowerShell(npm test),Bash(npm run release -- --force),PowerShell(npm run release -- --force),Bash(node --check:*),PowerShell(node --check:*)',
 '--disallowedTools=WebFetch,WebSearch,Task,Agent,Skill,AskUserQuestion,NotebookEdit,Edit(.hub/**),Write(.hub/**),Edit(plans/**),Write(plans/**)',
 '--permission-mode','dontAsk','--strict-mcp-config','--setting-sources','project',
 '--max-budget-usd','21.6','--append-system-prompt',a[a.length-1]]);
assert.ok(a[a.length-1].startsWith(HOUSE_RULES)&&/ONLY these exact commands: npm test \| npm run release -- --force \| node --check <file>/.test(a[a.length-1])&&/npm run plan/.test(a[a.length-1]),'the shell rule names the allowed commands');
assert.equal(buildArgs({model:'haiku',sessionId:SID,capTokens:150000}).at(-1),HOUSE_RULES,'no needs: no shell rule');
assert.ok(!a.includes('--no-session-persistence')&&!a.some(x=>x.startsWith('--max-turns'))&&!a.includes('--dangerously-skip-permissions')&&!a.includes('--add-dir')&&!a.includes('--mcp-config'),'forbidden or missing flags');
const r=buildArgs({model:'haiku',sessionId:SID,resume:true,capTokens:150000,needs:[]});
assert.ok(r.join(' ').includes(`--resume ${SID}`)&&!r.includes('--session-id'),'a later turn resumes');
assert.ok(r.includes('--tools=Read,Grep,Glob,Edit,Write')&&!r.some(x=>x.includes('Bash')&&!x.startsWith('--disallowed')),'no needs, no shell');
assert.equal(buildArgs({model:'opus',sessionId:SID,capTokens:1,readOnly:true,needs:['test']}).find(x=>x.startsWith('--tools=')),'--tools=Read,Grep,Glob','the master chat is read-only, whatever needs say');
assert.deepEqual(toolsOf(a),['Read','Grep','Glob','Edit','Write','Bash','PowerShell']);
assert.ok(buildArgs({model:'sonnet',sessionId:SID,capTokens:1,needs:['index']}).some(x=>x.startsWith('--allowedTools=')&&x.includes('PowerShell(npm run index)')),'index is an allowed need');
assert.throws(()=>buildArgs({model:'gpt',sessionId:SID,capTokens:1}),/unknown model/);
assert.throws(()=>buildArgs({model:'sonnet',sessionId:'../x',capTokens:1}),/UUID/);
assert.throws(()=>buildArgs({model:'sonnet',sessionId:SID,capTokens:1,needs:['git']}),/unknown need/);
assert.throws(()=>buildArgs({model:'sonnet',sessionId:SID,capTokens:0}),/cap/);
assert.equal(MODEL_IDS.fable,'claude-fable-5-2');assert.equal(budgetUsd('haiku',150000),0.54);
assert.match(firstPrompt({id:'p',title:'T',revision:2,text:'a\r\nb'}),/revision 2\. The plan follows\.\n\na\nb$/);

// ── cap tracker: cache reads are free, a split message counts once, 80% warns once, 100% caps
const t=createCapTracker({cap:1000});
assert.deepEqual(t.add('m1',{input_tokens:100,output_tokens:100,cache_creation_input_tokens:100,cache_read_input_tokens:999999}),{counted:true,total:300,capped:false,warn:false});
assert.equal(t.add('m1',{input_tokens:100}).counted,false);assert.equal(t.total,300);
let x=t.add('m2',{input_tokens:500});assert.equal(x.warn,true);assert.equal(x.capped,false);assert.equal(t.pct,80);
assert.equal(t.add('m3',{input_tokens:1}).warn,false,'warns once');
x=t.add('m4',{input_tokens:200});assert.equal(x.capped,true);

// ── reducer: names and counts only
const red=createReducer({tools:['Read','Edit']});
const L=o=>JSON.stringify(o);
let ev=red.take(L({type:'assistant',message:{id:'a',content:[{type:'tool_use',name:'Read',input:{file_path:'C:\\secret dir\\evil"<b>.js'}},{type:'tool_use',name:'Bash',input:{command:'curl http://x/SECRET'}},{type:'tool_use',name:'Bash',input:{command:'npm test -- foo'}},{type:'tool_use',name:'Grep',input:{pattern:'SECRET'}}],usage:{input_tokens:5}}}));
assert.deepEqual(ev.events.map(e=>[e.kind,e.tool,e.target]),[['tool','Read','evil_b.js'.replace('_','')],['tool','Shell','command'],['tool','Shell','npm test'],['tool','Grep','1 pattern']]);
assert.ok(!JSON.stringify(ev.events).includes('SECRET'),'no raw model fields in the feed');
assert.deepEqual(ev.usage,{id:'a',usage:{input_tokens:5}});
ev=red.take(L({type:'assistant',message:{id:'b',content:[{type:'text',text:'thinking SECRET\nQUESTION: round or square?\nmore'}]}}));
assert.deepEqual(ev.events,[{kind:'question'}]);assert.equal(red.question,'QUESTION: round or square?\nmore');
assert.ok(!JSON.stringify(ev.events).includes('round'),'the question text is held for Waiting, not put in the feed');
ev=red.take(L({type:'system',subtype:'init',session_id:SID,model:'claude-x',tools:['Read','Edit','WebFetch','Bash']}));
assert.equal(red.violation,'the run offers 2 tools outside the list');assert.equal(red.session,SID);
assert.equal(red.take('not json').events.length,0);assert.equal(createReducer({tools:[]}).take(L({type:'system',subtype:'init',tools:['Bash']})).events.some(e=>e.kind==='violation'),false,'no list given, no check');
assert.deepEqual(red.files,[]);createReducer().take('');

assert.equal(relPath('C:\\proj\\hub\\runs.js','C:\\proj'),'hub/runs.js');assert.equal(relPath('hub/../x"y.js',null),'hub/xy.js','.. segments and odd characters are dropped');
// ── real processes against the fake
const fakeClaude={path:process.execPath,prefix:[FAKE]};
const state=(w=12,f=58)=>evaluate([{at:Date.now(),weekly:{pct:w,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:f,resetsAt:Math.floor(Date.now()/1000)+3600}}],{now:Date.now()});
const play=(scenario,{cap=1500000,needs=['test'],st=state(),rate=null,extra={},prompt='PLAN TEXT'}={})=>{
 const out=path.join(tmp,scenario+'-'+Math.random().toString(36).slice(2)+'.json'),events=[];
 const args=buildArgs({model:'sonnet',sessionId:SID,capTokens:cap,needs});
 const run=runTurn({claude:fakeClaude,args,prompt,cwd:tmp,cap,state:st,rate,extraEnv:{HUB_FAKE_SCENARIO:scenario,HUB_FAKE_OUT:out,...extra},onEvent:e=>events.push(e),closeGraceMs:1500});
 return {run,events,out,args,read:()=>JSON.parse(fs.readFileSync(out,'utf8'))}};

// normal
process.env.CLAUDE_CODE_TEST_MARK='1';process.env.ELECTRON_RUN_AS_NODE='1';
let p=play('normal');let o=await p.run.done;
assert.equal(o.end,'result');assert.equal(o.exitCode,0);
assert.equal(o.tokens,5*150+(50+25+1000),'5 messages of 150 plus the last 1,075; the repeated message id counts once and cache reads not at all');
const rec=p.read();
assert.deepEqual(rec.argv,p.args,'the fake received exactly the arguments buildArgs made');
assert.equal(rec.stdin,'PLAN TEXT','the prompt arrives on stdin');
assert.deepEqual(rec.claudeEnv,[],'no CLAUDE* variable reaches the run');assert.equal(rec.electron,false);
if(process.platform==='win32')assert.ok(rec.priority>0,'below-normal priority, got '+rec.priority);
assert.equal(rec.cwd.toLowerCase(),fs.realpathSync(tmp).toLowerCase());
const kinds=p.events.map(e=>e.kind);
assert.ok(kinds[0]==='started'&&kinds.includes('gauges')&&kinds.at(-1)==='result');
assert.deepEqual(p.events.filter(e=>e.kind==='tool').map(e=>e.tool+':'+e.target),['Grep:1 pattern','Read:minimap.js','Edit:minimap.js','Write:style.css','Shell:npm test','Shell:command']);
assert.ok(!JSON.stringify(p.events).includes('SECRET'),'no model words and no URL in the feed');
assert.deepEqual(o.files,['minimap.js','style.css']);assert.deepEqual(o.paths,['C/Users/X/Documents/simproject/dist/minimap.js','dist/style.css'],'paths are cleaned and kept for the flags');assert.equal(o.session,SID);assert.equal(o.readings.length,1);assert.equal(o.result.text,'Done. SECRET-MODEL-WORDS');
delete process.env.CLAUDE_CODE_TEST_MARK;delete process.env.ELECTRON_RUN_AS_NODE;

// question ends the turn with the question held
o=await play('question').run.done;assert.equal(o.end,'question');assert.match(o.question,/^QUESTION: Should the minimap be round or square\?/);

// a line split across two writes is read whole
p=play('split');o=await p.run.done;assert.equal(o.end,'result');assert.equal(p.events.find(e=>e.kind==='tool').target,'split.js');assert.equal(o.tokens,10);

// crash and silence
o=await play('crash').run.done;assert.equal(o.end,'crashed');assert.equal(o.exitCode,3);assert.equal(o.stderr,'boom');
o=await play('silent').run.done;assert.equal(o.end,'crashed','exit 0 with no result is not a result');

// Stop kills a hanging process
p=play('hang');await sleep(600);const pid=p.run.pid;assert.ok(isAlive(pid));
await p.run.stop('stopped');o=await p.run.done;assert.equal(o.end,'stopped');assert.equal(isAlive(pid),false,'the process is gone');

// Stop kills the grandchild too
const pidFile=path.join(tmp,'grandchild.pid');
p=play('grandchild',{extra:{HUB_FAKE_PIDFILE:pidFile}});
for(let i=0;i<60&&!fs.existsSync(pidFile);i++)await sleep(100);
const gc=Number(fs.readFileSync(pidFile,'utf8'));assert.ok(gc>0&&isAlive(gc),'the grandchild runs');
await p.run.stop();o=await p.run.done;assert.equal(o.end,'stopped');
for(let i=0;i<30&&isAlive(gc);i++)await sleep(100);
assert.equal(isAlive(gc),false,'the whole tree is killed, not only the first process');

// the cap stops the run (200k per message, cap 1M: the 5th message reaches it)
p=play('overcap',{cap:1000000});o=await p.run.done;
assert.equal(o.end,'capped');assert.ok(o.tokens>=1000000&&o.tokens<=1400000,'a few messages of overshoot at most: '+o.tokens);
assert.ok(p.events.some(e=>e.kind==='cap-warning')&&p.events.some(e=>e.kind==='cap-stop'));
assert.equal(p.events.filter(e=>e.kind==='cap-warning').length,1);

// the weekly guard stops the run: reading 96, rate 3 %/M, 100k tokens per message: 97 is reached at about 0.33M tokens
p=play('gauge',{cap:3000000});o=await p.run.done;
assert.equal(o.end,'gauge-stop');assert.ok(o.tokens>=300000&&o.tokens<=700000,'stopped near the 97 line: '+o.tokens);
assert.ok(p.events.some(e=>e.kind==='gauge-stop'&&e.stopKind==='weekly'));

// the 5-hour limit at 100: the run pauses (allowed, not an error)
o=await play('pause').run.done;assert.equal(o.end,'pause');

// a run that offers a tool outside the list is killed at once
o=await play('violation').run.done;assert.equal(o.end,'violation');assert.match(o.violation,/outside the list/);

// killTree reports gone for a pid that does not exist
assert.deepEqual(await killTree(2147483000),{gone:true});

fs.rmSync(tmp,{recursive:true,force:true});
console.log('hub-runner: ok');
