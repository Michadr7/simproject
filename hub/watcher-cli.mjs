// P3: the watcher command

// Mikkadr Hub, P3: the watcher command. `npm run watcher` rebuilds .hub/watcher.html from the stored readings and this PC's session logs, prints the gauges, and makes no model call.
//   npm run watcher                       rebuild the page and print the state
//   npm run watcher -- --record <file>    add the reading from a saved headless run (stream-json output); the file's modified time is the reading time
//   npm run watcher -- --probe            take a fresh reading with one small Haiku call. Typing this is the user's go-ahead for that call.
//   npm run watcher -- --open             also open the page in the default browser
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {parseRunOutput,loadReadings,appendReading,evaluate,learnRate,scanLogs,canStart} from './watcher.js';
import {runProbe} from './probe.js';
import {renderPage} from './page.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),DATA=path.join(ROOT,'.hub'),STORE=path.join(DATA,'usage.jsonl'),PAGE=path.join(DATA,'watcher.html');
const LOGS=path.join(process.env.USERPROFILE||os.homedir(),'.claude','projects');
const args=process.argv.slice(2),flag=n=>args.includes(n),value=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null};

const startOfDay=(d=new Date())=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
async function main(){
 const logTotal=()=>scanLogs(LOGS).total.billable;
 if(flag('--record')){const file=value('--record');if(!file||!fs.existsSync(file)){console.error('--record needs the path of a saved run output.');process.exit(2)}
  const {readings}=parseRunOutput(fs.readFileSync(file,'utf8'));if(!readings.length){console.error('No rate limit reading in that file.');process.exit(2)}
  const r={at:Math.round(fs.statSync(file).mtimeMs),source:'run',...readings[readings.length-1]};if(Date.now()-r.at<120000)r.tokensTotal=logTotal(); // a run that just finished: the log total belongs with this reading
  appendReading(STORE,r);console.log(`Recorded: weekly ${r.weekly?.pct??'-'}%, 5-hour ${r.fiveHour?.pct??'-'}%.`)}
 if(flag('--probe')){console.log('Taking one reading with a small Haiku call (about 7,600 tokens)...');
  try{const r=await runProbe({approved:true});r.tokensTotal=logTotal();appendReading(STORE,r);console.log(`Reading: weekly ${r.weekly?.pct??'-'}%, 5-hour ${r.fiveHour?.pct??'-'}%${r.costUsd!=null?` (cost $${r.costUsd.toFixed(4)})`:''}.`)}
  catch(e){console.error('Probe failed: '+e.message);process.exitCode=1}}
 const readings=loadReadings(STORE),now=Date.now(),state=evaluate(readings,{now}),rate=learnRate(readings);
 const today=scanLogs(LOGS,{since:startOfDay()}).byModel,week=scanLogs(LOGS,{since:startOfDay()-6*86400000}).byModel;
 fs.mkdirSync(DATA,{recursive:true});fs.writeFileSync(PAGE,renderPage({state,today,week,readings,rate,generatedAt:now}));
 const fmt=w=>w.known?`${w.pct}% (${w.zone})`:'no current reading';
 console.log(`Weekly ${fmt(state.weekly)} · 5-hour ${fmt(state.fiveHour)} · newest reading ${state.ageMin==null?'none':state.ageMin+' min old'}${state.stale?' (stale)':''}`);
 for(const w of state.warnings)console.log(`  [${w.level}] ${w.text}`);
 const d=canStart(state,{estimatePct:null,model:'sonnet'});console.log(`A run with no estimate would be ${d.ok?'allowed':'refused: '+d.reasons.join('; ')}${d.needsProbe?' (take a new reading first)':''}.`);
 console.log('Page: '+PAGE);
 if(flag('--open'))execFile('cmd',['/c','start','',PAGE],()=>{});
}
main();
