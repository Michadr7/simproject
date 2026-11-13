// P4 S2: npm run hub

// Mikkadr Hub P4, S2: `npm run hub` starts the local hub on 127.0.0.1:8765 (or --port=<n>) and keeps it running. No model call.
//   npm run hub                 serve the hub
//   npm run hub -- --open       also open it in the default browser
//   npm run hub -- --runs       also switch on agent runs, the master chat (P5) and the tools (Hub v2 V2): a run or a chat message is a model call and starts only by your click
//                               (Hub v2 V3: also Commit and Push, each its own button and its own press; GitHub Desktop's git does the work. Nothing commits or pushes by itself.)
//   npm run hub -- --replace   when an older hub of this folder holds the port: stop it and take over (a program that does not answer as this hub is never stopped)
// Hub v2 V2: this file is two things. Without --child it is a small supervisor that starts the real hub (itself with --child) and starts it again when that exits with code 75,
// which is what the Restart button on the Tools page asks for. With --child it is the hub.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile,spawn} from 'node:child_process';
import {createHubServer} from './server.js';
import {supervise,RESTART_CODE,writeHubFile,findOldHub} from './supervisor.mjs';
import {killTree} from './runner.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),want=args.find(a=>a.startsWith('--port='));

if(!args.includes('--child')){
 // The supervisor. Ctrl+C reaches the hub too (same console); the hub cleans up and exits, and this process follows it.
 process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});
 const once=['--open','--replace']; // only for the first start: a restart must not open another tab
 const code=await supervise({log:m=>console.log(m),startChild:n=>spawn(process.execPath,[fileURLToPath(import.meta.url),'--child',...args.filter(a=>n===0||!once.includes(a))],{stdio:'inherit',env:{...process.env,HUB_SUPERVISED:'1'}})});
 process.exit(code)}

const startedAt=Date.now(),wantPort=want?+want.split('=')[1]:8765;
let runs=null,chat=null,jobs=null,commits=null,restart=null,claudePath=null,probeFn=null;
// Hub v2 V4: asset records (the Assets page and the master's RECORD: lines). No model call; works with or without --runs.
const {createRecords}=await import('./records-store.mjs'),records=createRecords({root:ROOT});
if(args.includes('--runs')){
 const {findClaude,runProbe}=await import('./probe.js'),{createRuns,processName}=await import('./runs.js'),{createChat}=await import('./chat.js'),{createJobs}=await import('./job-runner.mjs'),{logTotal}=await import('./tokens-page.mjs');
 const {createGit}=await import('./git.mjs'),{createCommits}=await import('./commit-ctl.mjs');
 claudePath=findClaude();
 const claude=claudePath?{path:claudePath}:null;
 probeFn=claude?(o=>runProbe({...o,claudePath:claude.path})):null; // Publish and Refresh need these; the server file itself starts no process
 const {statusText}=await import('./status.js');
 jobs=createJobs({root:ROOT,busy:()=>runs.locked()||chat.working(),nameOf:processName});
 chat=createChat({root:ROOT,claude,records,logTotal:()=>logTotal(),contextFn:()=>statusText({root:ROOT,runs,chat,jobs,commits,records})});
 // after a run finishes, the hub rebuilds the brief and the index by itself (a script, no tokens)
 runs=createRuns({root:ROOT,claude,logTotal:()=>logTotal(),busy:()=>chat.working()||jobs.active(),onEnd:r=>{if(r.status==='done')jobs.start('index',{auto:true})}});
 // Hub v2 V3: commit and push, each only on the owner's press (hub/commit-ctl.mjs); GitHub Desktop's git is the only git used
 commits=createCommits({root:ROOT,git:createGit({root:ROOT}),busy:()=>runs.locked()||chat.working()||jobs.active(),runs,jobs});
 // Restart: refused while anything works; otherwise stop what the hub started and exit with the code the supervisor restarts on. Only offered when a supervisor is there to start it again.
 if(process.env.HUB_SUPERVISED==='1')restart=()=>{
  if(runs.locked())return {error:'A run is working. Stop it or wait for it, then restart.'};
  if(chat.working())return {error:'The master is working. Wait for its answer, then restart.'};
  if(jobs.active())return {error:'A job is running. Wait for it, or stop it, then restart.'};
  return {go:async()=>{try{await jobs.shutdown();await chat.shutdown();await runs.shutdown()}catch{}process.exit(RESTART_CODE)}}};
}
const make=()=>createHubServer({root:ROOT,port:wantPort,runs,chat,jobs,commits,records,restart,startedAt,probeFn});
let srv=make(),port;
try{port=await srv.listen()}catch(e){
 if(e.code!=='EADDRINUSE'){console.error('Could not start: '+e.message);process.exit(1)}
 const old=await findOldHub({root:ROOT,port:wantPort});
 if(!old.hub){console.error('That port is already in use, and what holds it did not answer as this hub. Try --port=<n>.');process.exit(1)}
 console.log(`An older hub is running (pid ${old.pid}).`);
 if(!args.includes('--replace')){console.error('Start with --replace to stop it and take over:  npm run hub -- --runs --replace');process.exit(1)}
 await killTree(old.pid);
 for(let i=0;i<25&&port===undefined;i++){srv=make();try{port=await srv.listen()}catch{await new Promise(r=>setTimeout(r,200))}}
 if(port===undefined){console.error('The older hub was stopped, but the port did not come free.');process.exit(1)}
 console.log('The older hub was stopped. This one took over.')}
writeHubFile(ROOT,{pid:process.pid,port,startedAt});
if(runs){
 // the clean-up after a hub that died comes only now, when this hub owns the port: an older hub that is still alive keeps its run
 await chat.reapOrphan();
 const n=await runs.reapOrphans(),j=await jobs.reapOrphans();
 console.log(claudePath?'Runs: on. Claude Code found.':'Runs: on, but claude.exe was not found, so no run can start.');
 if(n)console.log(`  ${n} run${n>1?'s were':' was'} still marked running when the hub last stopped; marked interrupted.`);
 if(j)console.log(`  ${j} job${j>1?'s were':' was'} still marked running when the hub last stopped; marked interrupted.`);
}
const url=`http://127.0.0.1:${port}/`;
const {HUB_VERSION}=await import('./web/shell.js');
console.log(`Mikkadr Hub ${HUB_VERSION}: ${url}  (Ctrl+C to stop)`);
console.log(`  Assets ${url}assets · 3D viewer ${url}viewer.html · Tokens ${url}tokens`);
console.log('  The asset and token pages are built by npm run assets and npm run watcher.');
if(runs){const bye=async()=>{try{await jobs.shutdown();await chat.shutdown();await runs.shutdown()}catch{}process.exit(0)};process.on('SIGINT',bye);process.on('SIGTERM',bye)}
if(args.includes('--open'))execFile('cmd',['/c','start','',url]);
