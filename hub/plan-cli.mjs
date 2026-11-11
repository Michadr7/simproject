// Mikkadr Hub P4, S1: the plan command. No model call, no network; it only reads and writes files in plans/.
//   npm run plan -- <file.md> [--title "..."] [--from name]   send a plan (the same file from the same sender = the next revision)
//   npm run plan -- --status <id or file.md>                   print verdict, note and revision
//   npm run plan -- --list                                     one line per plan
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sendPlan,listPlans,findPlan} from './plans-store.mjs';
import {statusOf,latestRevision} from './plans.js';
import {describeRun} from './runplan.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),DIR=path.join(ROOT,'plans');
const args=process.argv.slice(2),flag=n=>args.includes(n),value=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null};
const sourceKey=f=>path.relative(ROOT,path.resolve(f)).split(path.sep).join('/');
const fail=m=>{console.error(m);process.exit(2)};

if(flag('--list')){
 const plans=listPlans(DIR);
 if(!plans.length)console.log('No plans yet.');
 for(const p of plans)console.log(`${p.id}  ${p.status}  revision ${latestRevision(p).n}  ${p.title}`);
}else if(flag('--status')){
 const key=value('--status');if(!key)fail('--status needs a plan id or the file it was sent from.');
 const p=findPlan(DIR,key)||findPlan(DIR,sourceKey(key));
 if(!p)fail(`No plan found for ${key}.`);
 const s=statusOf(p);
 console.log(`${s.id}: ${s.status}, revision ${s.revision}${s.verdict?`, answered ${s.verdict}`:', not answered yet'}${s.note?`, note: ${s.note}`:''}`);
 console.log(s.buildable?'Build allowed: this revision is approved.':'Do not build from this yet.');
 console.log(describeRun(latestRevision(p).text));
 if(!s.buildable)process.exitCode=1;
}else{
 const file=args.find(a=>!a.startsWith('--')&&a!==value('--title')&&a!==value('--from'));
 if(!file)fail('Usage: npm run plan -- <file.md> [--title "..."] [--from name] | --status <id or file> | --list');
 if(!fs.existsSync(file))fail(`File not found: ${file}`);
 const r=sendPlan(DIR,{source:sourceKey(file),title:value('--title'),from:value('--from'),text:fs.readFileSync(file,'utf8').replace(/^﻿/,'')});
 if(r.error)fail(r.error);
 const n=latestRevision(r.plan).n;
 console.log(r.action==='created'?`Sent plan ${r.plan.id} (revision 1), waiting for you.`:r.action==='revision'?`Sent revision ${n} of ${r.plan.id}, waiting for you again.`:`No change: ${r.plan.id} revision ${n} is already waiting.`);
}
