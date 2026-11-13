// Mikkadr Hub 2.7: going online, step 1 (the check). Pure rules for each result, the job summary, and the proof that the check publishes nothing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cmpVersion,deployChecks,verdictText,LIVE_URL,canPublish,confirmText,CHECK_FRESH_MS} from '../hub/web/deploy-rules.js';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import http from 'node:http';
import {createHubServer} from '../hub/server.js';
import {summarise,JOBS,tableProblems} from '../hub/jobs.js';
import {nextLine} from '../hub/web/deploy.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

assert.equal(cmpVersion('0.35.4','0.35.3'),1);assert.equal(cmpVersion('0.35.4','0.35.4'),0);assert.equal(cmpVersion('0.9.0','0.10.0'),-1,'numbers, not text');assert.equal(cmpVersion('1.0.0','0.99.99'),1);assert.equal(cmpVersion('x','0.1.0'),null);
const good={version:'0.36.0',releaseFolder:true,indexPointsHere:true,live:{version:'0.35.3'},liveError:false,tests:{ok:true,at:1},changed:0,devMode:false,wrangler:'in'};
const by=(f,k)=>deployChecks(f).checks.find(c=>c.key===k);
let r=deployChecks(good);assert.equal(r.ready,true);assert.equal(r.warnings,0);assert.deepEqual(r.checks.map(c=>c.key),['version','live','tests','changed','dev','wrangler']);assert.ok(r.checks.every(c=>c.state==='ok'));
// what blocks
assert.equal(by({...good,version:'nope'},'version').state,'fail');assert.equal(by({...good,releaseFolder:false},'version').state,'fail');assert.equal(by({...good,indexPointsHere:false},'version').state,'fail');
assert.equal(by({...good,live:{version:'0.36.0'}},'live').state,'fail','a deployed version is never reused');assert.match(by({...good,live:{version:'0.36.0'}},'live').text,/never be reused/);assert.equal(by({...good,live:{version:'0.40.0'}},'live').state,'fail','never publish something older');
assert.equal(by({...good,tests:{ok:false,at:1}},'tests').state,'fail');assert.equal(by({...good,wrangler:'out'},'wrangler').state,'fail');assert.match(by({...good,wrangler:'out'},'wrangler').text,/npx wrangler login/);
for(const f of [{...good,releaseFolder:false},{...good,live:{version:'0.36.0'}},{...good,tests:{ok:false}},{...good,wrangler:'out'}])assert.equal(deployChecks(f).ready,false);
// what only warns (you may go on): Dev Mode on, uncommitted files, no test run recorded, the live version unreadable, wrangler unclear
assert.equal(by({...good,devMode:true},'dev').state,'warn');assert.equal(deployChecks({...good,devMode:true}).ready,true,'Dev Mode on is a warning you can accept');
assert.equal(by({...good,changed:3},'changed').state,'warn');assert.match(by({...good,changed:1},'changed').text,/1 file changed/);assert.equal(by({...good,tests:null},'tests').state,'warn');
assert.equal(by({...good,live:null,liveError:true},'live').state,'warn');assert.equal(deployChecks({...good,live:null,liveError:true}).ready,true);assert.equal(by({...good,wrangler:'unknown'},'wrangler').state,'warn');
assert.equal(by({...good,changed:null},'changed').state,'unknown');assert.equal(by({...good,devMode:null},'dev').state,'unknown');
assert.equal(deployChecks({...good,devMode:true,changed:5}).warnings,2);assert.equal(deployChecks({}).ready,false,'no facts, no go');
assert.equal(verdictText(deployChecks(good),'0.36.0'),'Ready to go online (0.36.0)');assert.match(verdictText(deployChecks({...good,devMode:true}),'0.36.0'),/1 warning$/);assert.match(verdictText(deployChecks({...good,wrangler:'out'}),'0.36.0'),/^Not ready: cloudflare login$/);

// the job: in the table, safe, summarised from the script's one line
assert.deepEqual(tableProblems(JOBS),[]);assert.ok(JOBS['deploy-check']&&JOBS['deploy-check'].script==='scripts/deploy-check.mjs'&&JOBS['deploy-check'].args.length===0);
const s=summarise('deploy-check','noise\nFACTS '+JSON.stringify(good)+'\n',0);assert.equal(s.ok,true);assert.equal(s.version,'0.36.0');assert.equal(s.live,'0.35.3');assert.equal(s.checks.length,6);
assert.equal(summarise('deploy-check','FACTS '+JSON.stringify({...good,wrangler:'out'}),1).ok,false);assert.equal(summarise('deploy-check','crashed',1).text,'The check did not finish');assert.equal(summarise('deploy-check','FACTS {bad',0).ok,false);
// the page's sentence
const job=(sum,run)=>({running:run?{}:null,last:sum?{summary:sum,endedAt:1e6}:null});
assert.match(nextLine({enabled:true},job(null)),/Press Check/);assert.match(nextLine({enabled:true},job(null,true)),/Checking now/);assert.match(nextLine({enabled:true},job({ok:true,version:'0.36.0',checks:[]}),1e6+60000),/0\.36\.0/);assert.match(nextLine({enabled:true},job({ok:false,checks:[]}),1e6),/blocks/i);assert.match(nextLine({enabled:false},null),/switched off/);

// it publishes nothing: the script asks wrangler only who is logged in, reads one public file, and the hub's server and page start no deploy
const script=fs.readFileSync(path.join(root,'scripts','deploy-check.mjs'),'utf8'),page=fs.readFileSync(path.join(root,'hub','web','deploy.js'),'utf8');
assert.deepEqual(fs.readFileSync(path.join(root,'hub','deploy-facts.mjs'),'utf8').match(/\[w,'[a-z]+'\]/g),["[w,'whoami']"],'wrangler is only asked whoami');assert.ok(!/'deploy'|wrangler deploy.*spawn|--force/.test(script.replace(/\/\/.*$/gm,'')),'the check never deploys');
{const facts=fs.readFileSync(path.join(root,'hub','deploy-facts.mjs'),'utf8');assert.equal((facts.match(/fetchFn\(/g)||[]).length,1,'one read of the live site');assert.ok(facts.includes('LIVE_URL')&&LIVE_URL.startsWith('https://')&&LIVE_URL.endsWith('/version.json'))}
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|https?:\/\//.test(page),'the page sets text only and loads nothing');
// ── Step 2: Publish
const okCheck={summary:{ok:true,version:'0.36.0',live:'0.35.3',checks:deployChecks(good).checks},endedAt:1e6};
assert.equal(canPublish(okCheck,1e6+60000).ok,true);assert.equal(canPublish(null).ok,false);assert.equal(canPublish({summary:{ok:false,checks:[]},endedAt:1e6},1e6).ok,false,'a blocked check cannot publish');assert.match(canPublish({summary:{ok:true,checks:[]},endedAt:1e6},1e6).why,/did not name a version/);
assert.equal(canPublish(okCheck,1e6+CHECK_FRESH_MS+1).ok,false,'a check older than 10 minutes is not enough');assert.match(canPublish(okCheck,1e6+CHECK_FRESH_MS+1).why,/10 minutes/);
assert.match(confirmText(okCheck.summary),/^Publish 0\.36\.0\?/);assert.match(confirmText(okCheck.summary),/0\.35\.3 is live now/);assert.ok(!/Dev Mode/.test(confirmText(okCheck.summary)));
assert.match(confirmText({version:'0.36.0',live:null,checks:deployChecks({...good,devMode:true}).checks}),/Dev Mode is on/);
assert.ok(JOBS.deploy&&JOBS.deploy.script==='scripts/deploy.mjs'&&JOBS.deploy.args.length===0&&tableProblems(JOBS).length===0);
let d=summarise('deploy','DEPLOYING 0.36.0\nlots of wrangler words\nDEPLOYED '+JSON.stringify({version:'0.36.0',live:'0.36.0',ok:true}),0);assert.equal(d.ok,true);assert.match(d.text,/^Published 0\.36\.0\. The live site now says 0\.36\.0\.$/);
d=summarise('deploy','DEPLOYED '+JSON.stringify({version:'0.36.0',live:'0.35.3',ok:false,note:'still old'}),1);assert.equal(d.ok,false);assert.equal(d.text,'still old');
d=summarise('deploy','REFUSED The checks no longer pass.',2);assert.equal(d.ok,false);assert.equal(d.refused,true);assert.match(d.text,/^Nothing was published: The checks/);
assert.equal(summarise('deploy','',1).ok,false);assert.equal(summarise('deploy','DEPLOYED '+JSON.stringify({version:'1.0.0',live:'1.0.0',ok:true}),1).ok,false,'a non-zero exit never counts as published');
assert.equal(nextLine({enabled:true},null,1,{running:{}}).startsWith('Publishing now'),true);

// the script: it can never deploy without the hub's confirmation. Each case below is refused before wrangler is touched.
const confirmFile=path.join(root,'.hub','deploy-confirm.json'),had=fs.existsSync(confirmFile)?fs.readFileSync(confirmFile,'utf8'):null;fs.mkdirSync(path.join(root,'.hub'),{recursive:true});
const runScript=()=>{const r=spawnSync(process.execPath,[path.join(root,'scripts','deploy.mjs')],{cwd:root,encoding:'utf8',timeout:90000,windowsHide:true});return {code:r.status,out:String(r.stdout||'')}};
try{
 try{fs.unlinkSync(confirmFile)}catch{}
 let r=runScript();assert.equal(r.code,2);assert.match(r.out,/^REFUSED The hub did not confirm/m);assert.ok(!r.out.includes('DEPLOYING'));
 fs.writeFileSync(confirmFile,JSON.stringify({version:'0.0.1',at:Date.now()-6*60000}));r=runScript();assert.equal(r.code,2);assert.match(r.out,/more than 5 minutes old/);assert.ok(!fs.existsSync(confirmFile),'the confirmation is used up even when refused');
 fs.writeFileSync(confirmFile,JSON.stringify({version:'0.0.1',at:Date.now()}));r=runScript();assert.equal(r.code,2);assert.match(r.out,/You confirmed 0\.0\.1, but package\.json now says/);assert.ok(!r.out.includes('DEPLOYING'))
}finally{if(had!==null)fs.writeFileSync(confirmFile,had);else try{fs.unlinkSync(confirmFile)}catch{}}
const dep=fs.readFileSync(path.join(root,'scripts','deploy.mjs'),'utf8').replace(/\/\/.*$/gm,'');
assert.deepEqual(dep.match(/\[wrangler,'[a-z-]+'\]/g),["[wrangler,'deploy']"],'only wrangler deploy, nothing else');assert.ok(!/--force|--branch|delete|rollback/.test(dep),'never forced, never deleted');
assert.ok(dep.indexOf("refuse('The hub did not confirm")<dep.indexOf("'deploy']"),'the refusals come before the deploy');

// the hub's route: Publish needs a passing check from the last 10 minutes and the version it named, typed back
{const root2=fs.mkdtempSync(path.join(os.tmpdir(),'hub-dep-'));fs.mkdirSync(path.join(root2,'.hub'));
 let started=0,chk=null;const jobsStub={has:k=>k==='deploy'||k==='deploy-check',last:k=>k==='deploy-check'?chk:null,start:k=>{started++;return {job:{id:'job-20260101-000000-abcd'}}},list:()=>({running:null,jobs:[]}),active:()=>false},runsStub={checkToken:t=>t==='tk',locked:()=>false};
 const s2=createHubServer({root:root2,runs:runsStub,jobs:jobsStub}),p2=await s2.listen();
 const post=(body,h={'X-Hub-Token':'tk'})=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port:p2,method:'POST',path:'/api/jobs/start',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:'+p2,...h}},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,body:JSON.parse(b||'{}')}))});q.on('error',rej);q.end(JSON.stringify(body))});
 try{
  let r=await post({job:'deploy',confirm:'0.36.0'});assert.equal(r.status,409,'no check yet');assert.match(r.body.error,/Press Check first/);assert.equal(started,0);
  chk={summary:{...okCheck.summary,ok:false},endedAt:Date.now()};r=await post({job:'deploy',confirm:'0.36.0'});assert.equal(r.status,409,'a blocked check');assert.equal(started,0);
  chk={summary:okCheck.summary,endedAt:Date.now()-CHECK_FRESH_MS-5000};r=await post({job:'deploy',confirm:'0.36.0'});assert.equal(r.status,409,'an old check');assert.equal(started,0);
  chk={summary:okCheck.summary,endedAt:Date.now()};r=await post({job:'deploy',confirm:'0.99.0'});assert.equal(r.status,409,'the wrong version typed back');assert.match(r.body.error,/Press Check again/);assert.equal(started,0);r=await post({job:'deploy'});assert.equal(r.status,409,'no version at all');
  r=await post({job:'deploy',confirm:'0.36.0'},{});assert.equal(r.status,403,'no token');assert.equal(started,0);
  r=await post({job:'deploy',confirm:'0.36.0'});assert.equal(r.status,200);assert.equal(started,1);const cf=JSON.parse(fs.readFileSync(path.join(root2,'.hub','deploy-confirm.json'),'utf8'));assert.equal(cf.version,'0.36.0');assert.ok(Date.now()-cf.at<5000,'the confirmation names the version and the time');
 }finally{await s2.close()}
 fs.rmSync(root2,{recursive:true,force:true})}
console.log('hub-deploy: the version rules, every blocking and warning result, the job summary, the page sentence, and the proof that the check publishes nothing, the Publish rules, the refusals of the script, and the route of the hub passed.');