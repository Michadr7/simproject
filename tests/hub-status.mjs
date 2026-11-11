// Mikkadr Hub P5 R7a: the status block the master chat gets with every message. Pure builder, the brief's State section, the cap, and the chat sending it (but saving only the user's own words).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildStatus,stateSection,statusText,withStatus,MAX_STATUS,MAX_STATE} from '../hub/status.js';
import {createChat,MASTER_RULES} from '../hub/chat.js';
import {sendPlan,savePlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';

const NOW=new Date(2026,10,11,15,30).getTime();
// ── the brief's State section
const brief='# Brief\n\n## What it is\nA game.\n\n## State\nDeployed 0.35.2. Queue: hub P6; A2.\nSecond line.\n\n## Standing rules\n- x\n';
assert.equal(stateSection(brief),'Deployed 0.35.2. Queue: hub P6; A2. Second line.');assert.equal(stateSection('no state here'),'');assert.ok(stateSection('## State\n'+'x'.repeat(5000)).length<=MAX_STATE);

// ── the block
const plan=(id,title,verdict)=>{let {plan:p}=sendPlan(path.join(root,'plans'),{source:id+'.md',title,from:'master',text:'# '+title+'\n',now:NOW});if(verdict)p=answerPlan(p,{verdict,note:verdict==='denied'?'too big':'ok',revision:1,now:NOW}).plan;return p};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-status-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
const plans=[plan('a','A2 design'),plan('b','Minimap','approved'),plan('c','Big idea','denied')];
const run=(over)=>({id:'run-1',planTitle:'Minimap',model:'sonnet',tokens:412300,capTokens:1500000,files:['a.js','b.css'],flagged:[],question:null,resultText:'',reason:'',status:'running',updatedAt:NOW-60000,...over});
let s=buildStatus({plans,runs:[run()],ready:[{title:'Minimap',model:'sonnet',size:'M',canStart:false,reasons:['A run is already active.']}],gauges:{weekly:19.4,fiveHour:13},chat:{model:'sonnet',tokens:6187},state:'Deployed 0.35.2.',now:NOW});
assert.match(s,/^HUB STATUS at 15:30/);assert.match(s,/Project state: Deployed 0\.35\.2\./);assert.match(s,/weekly 19%, 5-hour 13%; this chat on sonnet, 6,187 tokens/);
assert.match(s,/ACTIVE RUN: Minimap · running · sonnet · 412,300 of 1,500,000 tokens · 2 file\(s\) touched/);
assert.match(s,/Ready to run .*Minimap \(sonnet M, blocked: A run is already active\.\)/);assert.match(s,/Plans waiting for the user: A2 design \(rev 1, from master\)/);assert.match(s,/Plans approved: Minimap \(rev 1\)/);assert.match(s,/Plans denied: Big idea \(note: too big\)/);
s=buildStatus({plans:[],runs:[run({status:'waiting-answer',question:{id:2,text:'QUESTION: round or square?'}})],now:NOW});assert.match(s,/waiting for the user to answer: QUESTION: round or square\?/);
s=buildStatus({plans:[],runs:[run({status:'done',resultText:'Added it.',flagged:['hub/x.js'],updatedAt:NOW-7200000})],now:NOW});assert.match(s,/No run is active\./);assert.match(s,/Minimap \[done, 1 flagged file\(s\) to look at, result: Added it\.\] 2 h ago/);
s=buildStatus({plans:[],runs:[run({status:'capped',reason:'The run reached its cap (600,000 tokens).'})],now:NOW});assert.match(s,/\[capped, The run reached its cap/);
assert.match(buildStatus({now:NOW}),/No run is active\./,'an empty hub still gives a block');
// the cap: a lot of data never makes it huge
const many=Array.from({length:60},(_,i)=>run({id:'run-'+i,planTitle:'P'+i+'x'.repeat(200),status:'done',resultText:'r'.repeat(500)}));
assert.ok(buildStatus({plans,runs:many,ready:many.map(r=>({title:r.planTitle,model:'sonnet',size:'S',canStart:true,reasons:[]})),now:NOW}).length<=MAX_STATUS);
assert.equal(withStatus('','hi'),'hi');assert.equal(withStatus('S','hi'),'S\n\n---\nUSER MESSAGE:\nhi');
assert.ok(MASTER_RULES.includes('HUB STATUS')&&MASTER_RULES.includes('ground truth'));

// ── the impure wrapper reads the brief and the plan files
fs.writeFileSync(path.join(root,'PROJECT-BRIEF.md'),brief);
fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:30,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
const t=statusText({root,runs:null,chat:null,now:Date.now()});assert.match(t,/Deployed 0\.35\.2/);assert.match(t,/weekly 12%/);assert.match(t,/A2 design/);

// ── the chat sends the block with the message, but saves only the user's words, and survives a failing status
const FAKE=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures','fake-claude.mjs');
const env={HUB_FAKE_SCENARIO:'master',HUB_FAKE_OUT:path.join(root,'fake-out.json'),HUB_FAKE_REPLY:'ok'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const idle=async c=>{for(let i=0;i<200&&c.working();i++)await sleep(40)};
const chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,contextFn:()=>'HUB STATUS at 15:30\nNo run is active.'});
assert.ok(chat.send({text:'Where are we?'}).chat);await idle(chat);
const rec=JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8'));assert.equal(rec.stdin,'HUB STATUS at 15:30\nNo run is active.\n\n---\nUSER MESSAGE:\nWhere are we?');
assert.equal(chat.view().messages[0].text,'Where are we?','the chat shows only what you wrote');
const root2=fs.mkdtempSync(path.join(os.tmpdir(),'hub-status2-'));fs.mkdirSync(path.join(root2,'.hub'));fs.copyFileSync(path.join(root,'.hub','usage.jsonl'),path.join(root2,'.hub','usage.jsonl'));
const broken=createChat({root:root2,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,contextFn:()=>{throw new Error('boom')}});
assert.ok(broken.send({text:'still works'}).chat);await idle(broken);assert.equal(JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8')).stdin,'still works','a failing status never blocks a message');
console.log('hub-status: ok');