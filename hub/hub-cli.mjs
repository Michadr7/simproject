// Mikkadr Hub P4, S2: `npm run hub` starts the local hub on 127.0.0.1:8765 (or --port=<n>) and keeps it running. No model call.
//   npm run hub                 serve the hub
//   npm run hub -- --open       also open it in the default browser
//   npm run hub -- --runs       also switch on agent runs and the master chat (P5): each is a model call and starts only by your click
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {createHubServer} from './server.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),want=args.find(a=>a.startsWith('--port='));
let runs=null,chat=null;
if(args.includes('--runs')){
 const {findClaude}=await import('./probe.js'),{createRuns}=await import('./runs.js'),{createChat}=await import('./chat.js');
 const claudePath=findClaude();
 const claude=claudePath?{path:claudePath}:null;
 const {statusText}=await import('./status.js');
 chat=createChat({root:ROOT,claude,contextFn:()=>statusText({root:ROOT,runs,chat})});
 runs=createRuns({root:ROOT,claude,busy:()=>chat.working()});
 await chat.reapOrphan();
 const n=await runs.reapOrphans();
 console.log(claudePath?'Runs: on. Claude Code found.':'Runs: on, but claude.exe was not found, so no run can start.');
 if(n)console.log(`  ${n} run${n>1?'s were':' was'} still marked running when the hub last stopped; marked interrupted.`);
}
const srv=createHubServer({root:ROOT,port:want?+want.split('=')[1]:8765,runs,chat});
let port;try{port=await srv.listen()}catch(e){console.error(e.code==='EADDRINUSE'?'That port is already in use: is the hub already running? Try --port=<n>.':'Could not start: '+e.message);process.exit(1)}
const url=`http://127.0.0.1:${port}/`;
console.log(`Mikkadr Hub: ${url}  (Ctrl+C to stop)`);
console.log(`  Assets ${url}assets · 3D viewer ${url}viewer.html · Tokens ${url}tokens`);
console.log('  The asset and token pages are built by npm run assets and npm run watcher.');
if(runs){const bye=async()=>{await chat.shutdown();await runs.shutdown();process.exit(0)};process.on('SIGINT',bye);process.on('SIGTERM',bye)}
if(args.includes('--open'))execFile('cmd',['/c','start','',url]);
