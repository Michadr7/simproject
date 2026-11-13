// Mikkadr Hub v2, V2: the job table.

// Pure: no file, no process, no model call.
// A job is one of the project's own scripts, started by the hub as `node <script inside the repo> <fixed args>`: never through a shell, never through npm, and never from words a page or a model sent.
// A request names a job only by its key; everything else (the script, its arguments) comes from this table. hub/job-runner.mjs does the processes.
//   kind 'job'      runs once and ends (one at a time, under the shared .hub/run.lock)
//   kind 'service'  keeps running until you stop it or the hub exits (the game dev server, the relay)
//   steps           a job made of other jobs, run in order, stopping at the first failure (check = release, then test)
//   ownLock         the script takes .hub/run.lock itself (npm run assets does), so the runner must not hold it
import {deployChecks,verdictText} from './web/deploy-rules.js';
export const JOB_ID=/^job-[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$/;
export const JOBS={
 test:{key:'test',label:'Run the tests',kind:'job',script:'scripts/run-tests.mjs',args:[],about:'Every test file, each in its own process. This takes a few minutes.'},
 release:{key:'release',label:'Make a release',kind:'job',script:'scripts/package-release.mjs',args:['--force'],about:'Packs dist/ into the release folder the game loads. Needed after a change in dist/, before the tests.'},
 check:{key:'check',label:'Check (release, then tests)',kind:'job',steps:['release','test'],about:'Makes the release, then runs the tests. Stops at the first failure.'},
 index:{key:'index',label:'Rebuild the index',kind:'job',script:'scripts/build-index.mjs',args:[],about:'Rewrites PROJECT-BRIEF.md and PROJECT-INDEX.md. The hub also does this by itself after a run finishes.'},
 'deploy-check':{key:'deploy-check',label:'Check before going online',kind:'job',script:'scripts/deploy-check.mjs',args:[],about:'Reads what is live, the version, the tests, the git status and the Cloudflare login. Sends and publishes nothing.'},
 deploy:{key:'deploy',label:'Publish the game',kind:'job',script:'scripts/deploy.mjs',args:[],about:'Runs wrangler deploy after the same checks pass again. Started only from the Deploy page, with the version you confirmed.'},
 assets:{key:'assets',label:'Draw the asset pictures',kind:'job',script:'hub/assets-cli.mjs',args:[],ownLock:true,about:'Draws missing or changed asset pictures and rebuilds the Assets page.'},
 dev:{key:'dev',label:'Game dev server',kind:'service',script:'scripts/dev-server.mjs',args:[],url:'http://localhost:8000',about:'Serves the game on this PC so you can play it in the browser.'},
 relay:{key:'relay',label:'Multiplayer relay',kind:'service',script:'server.js',args:[],about:'The local multiplayer relay (port 8080).'}};

const SCRIPT=/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.m?js$/,ARG=/^--[a-z][a-z-]*$/;
// What is wrong with a table (an empty list means it is safe to run): every script is a plain path inside the repo, every argument a plain flag, nothing a shell would read.
export function tableProblems(table){
 const out=[];
 for(const [k,j] of Object.entries(table)){
  if(!/^[a-z][a-z-]{0,19}$/.test(k)||j.key!==k)out.push(`${k}: the key is not a plain word`);
  if(j.kind!=='job'&&j.kind!=='service')out.push(`${k}: unknown kind`);
  if(typeof j.label!=='string'||!j.label)out.push(`${k}: no label`);
  if(j.steps){if(j.kind!=='job'||!Array.isArray(j.steps)||!j.steps.length||j.steps.some(s=>!Object.hasOwn(table,s)||table[s].steps||table[s].kind!=='job'))out.push(`${k}: steps must name plain one-shot jobs`);continue}
  if(typeof j.script!=='string'||!SCRIPT.test(j.script))out.push(`${k}: the script is not a plain path inside the repo`);
  if(!Array.isArray(j.args)||j.args.some(a=>typeof a!=='string'||!ARG.test(a)))out.push(`${k}: an argument is not a plain flag`);
  if(j.url!==undefined&&!/^http:\/\/localhost:\d{2,5}$/.test(j.url))out.push(`${k}: the link is not a localhost address`)}
 return out}
// The processes one job starts, in order: [{key, script, args}].
export const stepsOf=(table,key)=>{const j=table[key];if(!j)return [];return j.steps?j.steps.map(s=>({key:s,script:table[s].script,args:[...table[s].args]})):[{key,script:j.script,args:[...j.args]}]};

// summarise: what a finished job says, from its output and exit code. {ok, text, passed?, total?, failing?}. For the tests it reads the last line of scripts/run-tests.mjs and the FAIL lines.
// step: the key of the step that ended the job (for check: 'release' when the release failed and the tests never ran). stopped: you pressed Stop.
export function summarise(key,output,exitCode,{step=key,stopped=false}={}){
 const text=String(output||'').replace(/\r\n/g,'\n'),ok=exitCode===0&&!stopped;
 if(stopped)return {ok:false,text:'Stopped by you'};
 if(key==='test'||(key==='check'&&step==='test')){
  const all=/^All (\d+) test files passed\.$/m.exec(text),some=/^(\d+) of (\d+) test files failed\.$/m.exec(text);
  const failing=[...text.matchAll(/^FAIL (\S+)$/gm)].map(m=>m[1].slice(0,80)).slice(0,40);
  if(some){const failed=Number(some[1]),total=Number(some[2]);return {ok:false,passed:total-failed,total,failing,text:`${total-failed} of ${total} passed, ${failed} failed`}}
  if(all&&ok){const n=Number(all[1]);return {ok:true,passed:n,total:n,failing:[],text:`${n} of ${n} passed`}}
  return {ok:false,failing,text:'The tests ended without a count'}}
 if(key==='deploy-check'){const m=/^FACTS (\{.*\})\s*$/m.exec(text);let f=null;try{f=m&&JSON.parse(m[1])}catch{}
  if(!f||typeof f!=='object')return {ok:false,text:'The check did not finish'};const r=deployChecks(f);return {ok:r.ready,text:verdictText(r,f.version),checks:r.checks,version:String(f.version||'').slice(0,20),live:f.live&&f.live.version?String(f.live.version).slice(0,20):null}}
 if(key==='deploy'){const ref=/^REFUSED (.+)$/m.exec(text),done=/^DEPLOYED (\{.*\})\s*$/m.exec(text);let d=null;try{d=done&&JSON.parse(done[1])}catch{}
  if(ref)return {ok:false,refused:true,text:'Nothing was published: '+ref[1].slice(0,200)};
  if(d&&typeof d==='object')return {ok:!!d.ok&&ok,deployed:!!d.ok,version:String(d.version||'').slice(0,20),live:d.live?String(d.live).slice(0,20):null,text:d.ok&&ok?`Published ${String(d.version).slice(0,20)}. The live site now says ${String(d.live).slice(0,20)}.`:String(d.note||'The deploy did not finish.').slice(0,200)};
  return {ok:false,text:stopped?'Stopped by you':'The deploy ended without a result. Press Check to see what is live.'}}
 if(key==='check')return {ok:false,text:'The release failed, so the tests did not run'};
 return {ok,text:ok?'Done':`Failed (exit code ${exitCode})`}}
