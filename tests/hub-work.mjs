// Mikkadr Hub v2 V1: the Work tree (hub/work.js) and the tree shell (hub/web/shell.js).
// What it pins: plans are grouped into projects by "Project CODE: title" (a "Project:" line wins, the rest is "Other"); every step has one of the eight statuses with a meaning;
// the "Next step" sentence says what to press and what it costs; the needs-you count; the other waiting items and found plan files appear as items; old hashes open Work; the route /api/work answers;
// the layout rule (560 px content and an always visible tree from 1100 px) is in the style sheet; the Work page sets text only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {buildWork,nextStep,needsYou,splitTitle,projectLine,allowanceOf,findStep,STATUS,OTHER} from '../hub/work.js';
import {CAPS} from '../hub/runplan.js';
import {TREE,ROUTES,HOME,WIDE,routeOf,planIdOf,runIdOf,titleOf,needsText,ageText,sceneOf,SCENES} from '../hub/web/shell.js';
import {feedRow,STATUS_LABEL} from '../hub/web/run-actions.js';
import {createHubServer,resolveRoute,workOf} from '../hub/server.js';
import {sendPlan,savePlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';

const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// ── titles and the project line
assert.deepEqual(splitTitle('Scene editor E4: Library, inspector, look'),{project:'Scene editor',code:'E4',name:'Library, inspector, look'});
assert.deepEqual(splitTitle('Hub v2 V1: the tree, the Work area'),{project:'Hub v2',code:'V1',name:'the tree, the Work area'},'"v2" is part of the project name, V1 is the step');
assert.deepEqual(splitTitle('Mikkadr Hub R7b: corner bot'),{project:'Mikkadr Hub',code:'R7b',name:'corner bot'});
assert.deepEqual(splitTitle('Minimap in the corner'),{project:null,code:'',name:'Minimap in the corner'});assert.equal(splitTitle('Note: read this').project,null,'a word before the colon is not a step code');
assert.equal(projectLine('# X\n\nProject: People\n\ntext'),'People');assert.equal(projectLine('# X\nThe Project: none here'),null,'only a line of its own counts');assert.equal(projectLine(''),null);
assert.equal(allowanceOf('sonnet','M'),CAPS.sonnet.M);assert.equal(allowanceOf('fable','S'),CAPS.opus.S,'Fable borrows the Opus allowance');assert.equal(allowanceOf('haiku','L'),null);

// ── the eight statuses, each with a meaning
assert.deepEqual(Object.keys(STATUS),['waiting','approved','working','question','finished','done','stopped','blocked']);
assert.deepEqual(Object.values(STATUS).map(s=>s.label),['Waiting for your approval','Approved (press Start)','Working','Has a question for you','Finished (read the result)','Done','Stopped','Cannot start yet']);
for(const s of Object.values(STATUS))assert.ok(s.meaning.length>10&&/\.$/.test(s.meaning),'a one-line meaning');

// ── grouping and statuses
const RUN={model:'sonnet',size:'M'};
const plan=(id,title,status,over)=>({id,title,status,revision:1,sentAt:1000,run:RUN,runProblem:null,note:'',...over});
const run=(planId,status,over)=>({id:'run-20261111-140211-'+planId.slice(0,4).padEnd(4,'0'),planId,planTitle:planId,revision:1,model:'sonnet',size:'M',capTokens:1500000,tokens:41200,status,reason:'',turn:1,files:[],flagged:[],question:null,resultText:'',pending:null,createdAt:2000,updatedAt:3000,...over});
const plans=[plan('e1','Scene editor E1: Rules','approved'),plan('e2','Scene editor E2: Game draws the overlay','approved'),plan('e10','Scene editor E10: Late step','approved',{run:null,runProblem:'The plan has no "## Run" section.'}),
 plan('e4','Scene editor E4: Library','waiting'),plan('e3','Scene editor E3: Editor core','approved'),plan('a2','Walking and NPC cars','approved',{project:'People'}),plan('mm','Minimap in the corner','denied',{note:'not now'}),plan('v1','Hub v2 V1: the tree','approved')];
const runs=[run('e1','closed'),run('e2','done',{flagged:['package.json']}),run('e3','running'),run('a2','waiting-answer',{question:{id:1,text:'SECRET-MODEL-WORDS'}})];
const ready=[{planId:'v1',title:'Hub v2 V1: the tree',revision:1,model:'sonnet',size:'M',capTokens:1500000,needs:[],why:'',secondYes:false,canStart:true,reasons:[],at:1}];
const waiting=[{id:'plan:e4',group:'plan',title:'Plan: x',detail:'',at:1,actions:[]},{id:'run:x',group:'run',title:'Run',detail:'',at:1,actions:[]},{id:'found',group:'note',title:'1 plan file found',detail:'',at:1,actions:[]},
 {id:'asset:abc',group:'asset',severity:'att',title:'crate is not used anywhere in the game',detail:'Assets · x',at:5,actions:[{type:'hide',label:'Hide until it changes',hash:'abc'}]},{id:'tokens:stale',group:'note',severity:'info',title:'The token reading is 3 h old',detail:'Tokens',at:6,actions:[]}];
const found=[{hash:'0123456789abcdef',path:'docs/scene-plan.md',title:'Scene editor E7: Polish',bytes:10,modifiedAt:7},{hash:'fedcba9876543210',path:'x-plan.md',title:'Loose idea',bytes:10,modifiedAt:8}];
const tree=buildWork({plans,runs,ready,waiting,found,enabled:true});
const P=name=>tree.projects.find(p=>p.name===name),S=id=>findStep(tree,{plan:id}).step;
assert.deepEqual(tree.projects.map(p=>p.name).sort(),['Hub v2',OTHER,'People','Scene editor'].sort());
assert.deepEqual(P('Scene editor').steps.map(s=>s.code),['E1','E2','E3','E4','E10'],'steps are in the order of their codes (E10 after E4)');
assert.equal(S('a2').status,'question');assert.equal(P('People').steps.length,1,'the "Project:" line wins over the title');
assert.equal(S('e1').status,'done');assert.equal(S('e2').status,'finished');assert.equal(S('e3').status,'working');assert.equal(S('e4').status,'waiting');assert.equal(S('e10').status,'blocked');assert.equal(S('v1').status,'approved');assert.equal(S('mm').status,'stopped');
assert.equal(S('mm').label,'Closed by you: not now');assert.equal(S('mm').glyph,'ok');assert.match(S('mm').meaning,/You closed this plan/);assert.equal(S('mm').needsYou,false,'a plan you denied does not wait for you');
for(const s of tree.projects.flatMap(p=>p.steps)){assert.ok(Object.hasOwn(STATUS,s.status));assert.equal(s.meaning,s.denied?'You closed this plan. A new revision of it would put it back on your list.':STATUS[s.status].meaning);assert.ok(s.next.length>10)}
for(const [st,label] of [['capped','Stopped: it used its whole allowance'],['paused','Stopped: the 5-hour limit was reached'],['interrupted','Stopped: the hub closed'],['guard-stopped','Stopped: to protect your weekly limit'],['failed','Stopped: it ended without a result'],['stopped','Stopped: you stopped it']]){
 const s=buildWork({plans:[plan('p','X','approved')],runs:[run('p',st)]}).projects[0].steps[0];assert.equal(s.status,'stopped',st);assert.equal(s.label,label);assert.equal(s.needsYou,true)}
// a run cancelled before it began does not count; a waiting newer revision wins over an old run; runs off; a run without its plan keeps its buttons
assert.equal(buildWork({plans:[plan('p','X','approved')],runs:[run('p','closed',{turn:0})],ready:[{...ready[0],planId:'p'}]}).projects[0].steps[0].status,'approved');
assert.equal(buildWork({plans:[plan('p','X','waiting',{revision:2})],runs:[run('p','done')]}).projects[0].steps[0].status,'waiting');
const off=buildWork({plans:[plan('p','X','approved')],enabled:false}).projects[0].steps[0];assert.equal(off.status,'approved');assert.match(off.next,/npm run hub -- --runs/);
const orphan=buildWork({runs:[run('gone','capped')]});assert.equal(orphan.projects[0].steps[0].status,'stopped');assert.equal(orphan.projects[0].steps[0].runId,run('gone','x').id);
assert.equal(buildWork({plans:[plan('p','X','approved')],runs:[run('p','confirming',{model:'opus',pending:{kind:'start'}})]}).projects[0].steps[0].status,'question');

// ── items: the other things that wait for you
assert.deepEqual(P('Scene editor').items.map(i=>i.id),['found:0123456789abcdef'],'a found plan file lands in the project its title names');
assert.deepEqual(P(OTHER).items.map(i=>i.id),['asset:abc','tokens:stale','found:fedcba9876543210'],'asset attention, token notes and other found files go under Other; plan and run items are steps already');
assert.equal(P(OTHER).items[0].kind,'asset');assert.equal(P(OTHER).items[1].kind,'tokens');assert.deepEqual(P(OTHER).items[0].actions[0],{type:'hide',label:'Hide until it changes',hash:'abc'});
assert.ok(!JSON.stringify(tree).includes('SECRET'),'names and counts only: a question stays on the step page');

// ── the count
assert.equal(needsYou(P('Scene editor')),3,'E2 finished, E4 waiting, one found file');assert.equal(P('Scene editor').needsYou,3);
assert.equal(tree.needsYou,3+1+1+3);assert.equal(needsYou(tree),tree.needsYou);assert.equal(needsYou(null),0);assert.equal(needsYou(buildWork()),0);
assert.equal(P('Scene editor').summary,'3 need you');assert.equal(P('Hub v2').summary,'1 needs you');
const allDone=buildWork({plans:[plan('p','Old P1: done thing','approved')],runs:[run('p','closed')]}).projects[0];assert.equal(allDone.allDone,true);assert.equal(allDone.glyph,'ok');assert.equal(allDone.summary,'done');
assert.equal(tree.projects.at(-1).needsYou>0||tree.projects.at(-1).name===OTHER,true);assert.ok(tree.projects[0].needsYou>0,'what needs you comes first');

// ── next-step sentences: what to press and what it costs
assert.equal(S('e4').next,'Read the plan and press Approve. After that, Start runs it on Sonnet 5.5 (allowed up to 1,500,000 tokens).');
assert.equal(S('v1').next,'Press Start to run it on Sonnet 5.5. It may use up to 1,500,000 tokens.');
assert.equal(S('e3').next,'Nothing to press. It is working on Sonnet 5.5: 41,200 of 1,500,000 tokens used so far. Stop ends it early.');
assert.equal(S('a2').next,'Read the question and send your answer. Waiting costs nothing; the run then carries on with the 1,458,800 tokens it has left.');
assert.equal(S('e2').next,'Read the result, look at the 1 flagged file first, then press Close. It used 41,200 tokens; closing costs nothing.');
assert.equal(S('e1').next,'Nothing to do. This step is done.');assert.match(S('e10').next,/Run block/);assert.match(S('mm').next,/new revision/);
assert.equal(nextStep({status:'stopped',runStatus:'capped',model:'sonnet',capTokens:600000,tokens:610000}),'Press Continue with more to give it extra tokens (it used 610,000 of 600,000), or Close to end it.');
assert.equal(nextStep({status:'stopped',runStatus:'paused',model:'sonnet',capTokens:600000,tokens:100000}),'Press Resume to carry on in the same session (500,000 tokens of its allowance are left), or Close to end it.');
assert.match(nextStep({status:'approved',model:'opus',capTokens:400000,canStart:true,secondYes:true}),/Opus 5\.5\. It may use up to 400,000 tokens\. The hub asks for a second press/);
assert.match(nextStep({status:'approved',model:'sonnet',capTokens:1,canStart:false,reasons:['A run or a chat turn is already active.']}),/^Cannot start right now\. A run or a chat turn is already active\.$/);
assert.match(nextStep({status:'question',runStatus:'confirming',model:'opus',capTokens:400000}),/within 2 minutes to run on Opus 5\.5 \(allowed up to 400,000 tokens\)/);
assert.match(nextStep({status:'waiting',model:null,capTokens:null}),/no Run block/);
assert.equal(P('Scene editor').next,'E2: '+S('e2').next,'a project names its first step that needs you');assert.ok(tree.next.startsWith(tree.projects[0].name+': '));
assert.equal(buildWork().next,'Nothing needs you.');assert.equal(nextStep(null),'Nothing needs you.');
assert.match(nextStep({kind:'found'}),/Press Add/);assert.match(nextStep({kind:'asset'}),/3D/);assert.match(nextStep({kind:'tokens'}),/Haiku/);

// ── the tree shell: areas, foot rows, no numbers, old hashes
assert.deepEqual(TREE.areas.map(r=>r.label),['Chat','Work','Assets']);assert.deepEqual(TREE.foot.map(r=>r.label),['Commit','Deploy','Tools','Tokens']);
assert.ok([...TREE.areas,...TREE.foot].every(r=>!('num' in r)),'no numbers');assert.ok(!('soon' in TREE.foot[0])&&!('soon' in TREE.foot[2]),'Commit (V3) and Tools (V2) are built pages now');
assert.deepEqual(ROUTES,['chat','work','assets','commit','deploy','tools','tokens']);assert.equal(HOME,'work');assert.equal(WIDE,1100);
for(const [hash,r] of [['#waiting','work'],['#plans','work'],['#runs','work'],['#plans/2026-11-10-x','work'],['#runs/run-20261111-140211-ab12','work'],['#work','work'],['#work/abc','work'],['#chat','chat'],['#assets','assets'],['#tokens','tokens'],['#commit','commit'],['#tools','tools'],['','work'],['#nope','work'],['#__proto__','work'],['#constructor','work']])assert.equal(routeOf(hash),r,'route of '+hash);
assert.equal(planIdOf('#plans/2026-11-10-hub-p4'),'2026-11-10-hub-p4','the old plan hash opens that step');assert.equal(planIdOf('#work/2026-11-10-hub-p4'),'2026-11-10-hub-p4');assert.equal(planIdOf('#work'),null);assert.equal(planIdOf('#chat/abc'),null);
assert.equal(runIdOf('#runs/run-20261111-140211-ab12'),'run-20261111-140211-ab12','the old run hash opens that step');
assert.equal(titleOf('work',3),'(3) Work · Mikkadr Hub');assert.equal(titleOf('chat',0),'Chat · Mikkadr Hub');assert.equal(titleOf('zzz',0),'Work · Mikkadr Hub');
assert.equal(needsText(0),'');assert.equal(needsText(1),'1 thing needs you');assert.equal(needsText(3),'3 things need you');
assert.equal(ageText(null),'');assert.equal(ageText(12,false),'Usage checked 12 min ago');assert.equal(ageText(180,true),'Usage last checked 3 h ago');
assert.equal(sceneOf('work',null),'work');assert.equal(sceneOf('zzz',null),'work');assert.deepEqual(Object.keys(SCENES).sort(),[...ROUTES].sort());

// ── plain words in the feed and the status names
const at=new Date(2026,10,11,17,41,2).getTime(),row=(e,c)=>feedRow({at,...e},c).text;
assert.equal(row({kind:'started',model:'claude-sonnet-5-5',tools:6}),'Started on Sonnet with 6 tools');assert.equal(row({kind:'turn',n:1,resumed:false}),'Began working');assert.equal(row({kind:'turn',n:2,resumed:true}),'Carried on after your answer');
assert.equal(row({kind:'tool',tool:'Read',target:'dist/world.js'}),'Reading dist/world.js');assert.equal(row({kind:'tool',tool:'Edit',target:'dist/scene-editor.js'}),'Editing dist/scene-editor.js');assert.equal(row({kind:'tool',tool:'Shell',target:'npm test'}),'Running npm test');
assert.equal(row({kind:'tool',tool:'Shell',target:'command'}),'Running a command');assert.equal(row({kind:'tool',tool:'Grep',target:'1 pattern'}),'Searching the files');
assert.equal(row({kind:'tokens',total:41200},{cap:1500000}),'Tokens used so far: 41,200 of 1,500,000');assert.equal(row({kind:'tokens',total:41200}),'Tokens used so far: 41,200');
assert.equal(row({kind:'gauges',weekly:36,fiveHour:51}),'Usage check: 36% of this week, 51% of these 5 hours');
assert.equal(row({kind:'cap-warning',capPct:80}),"Used 80% of this run's token allowance");assert.equal(row({kind:'cap-stop',capPct:101}),'Stopped: it used its whole allowance');assert.equal(row({kind:'gauge-stop'}),'Stopped to protect your weekly limit');
assert.equal(row({kind:'result',turns:14}),'Finished after 14 turns');
assert.equal(STATUS_LABEL.confirming,'Press again to confirm (expensive model)');assert.equal(STATUS_LABEL.running,'Working');
const feedWords=JSON.stringify(['started','turn','tool','tokens','gauges','question','result','cap-warning','cap-stop','gauge-stop','end'].map(kind=>feedRow({at,kind,total:1,weekly:1,fiveHour:1,end:'capped'})));
assert.ok(!/turn total|fresh reading|gauges|the cap\b|weekly guard/i.test(feedWords),'no jargon in a feed line: '+feedWords);

// ── the layout rule and the page files
const css=fs.readFileSync(path.join(REPO,'hub','web','hub.css'),'utf8');
assert.match(css,/\.wrap\{max-width:1280px/,'content is centred, at most 1280 px wide');assert.match(css,/@container page \(min-width:900px\)/,'two panes from 900 px of page width');assert.match(css,/@media\(min-width:1100px\)\{\.menutab\{visibility:hidden\}\}/,'the menu does not fold on a wide window');assert.ok(!/\.view\{max-width:560px\}/.test(css),'the old narrow column is gone');
assert.match(css,/--panelw:236px/);
for(const f of ['work.js','app.js']){const code=fs.readFileSync(path.join(REPO,'hub','web',f),'utf8');assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(code),f+' sets text only');assert.ok(!/https?:\/\//.test(code),f+' loads nothing from outside')}
{const {statusLine,groupOf}=await import('../hub/web/work.js');assert.equal(groupOf({denied:true,needsYou:false,status:'stopped'}),'done','a plan you closed is done');assert.equal(statusLine({projects:[{items:[{}],steps:[{needsYou:true,status:'waiting'},{status:'working'},{status:'blocked'},{status:'done'},{status:'done'}]}]}),'2 need you · 1 working · 1 waiting · 2 done','the status line counts every group');assert.equal(groupOf({status:'blocked'}),'wait');assert.equal(groupOf({needsYou:true,status:'approved'}),'you')}
{const dep=fs.readFileSync(path.join(REPO,'hub','web','deploy.js'),'utf8'),as=fs.readFileSync(path.join(REPO,'hub','web','assets-area.js'),'utf8');assert.ok(!/:null\)/.test(dep),'deploy.js: node.append(null) would print the word null on the page');assert.ok(!/links\.append\([^\n]*:null\)/.test(as),'assets-area.js: the links line must not append null (it printed the word null)')}
const workJs=fs.readFileSync(path.join(REPO,'hub','web','work.js'),'utf8');
assert.equal((workJs.match(/method:'POST'/g)||[]).length,1,'the Work page has one write of its own (Add or Hide a found plan file); every run and plan button goes through runs.js and plans.js');
assert.ok(workJs.includes("mountRuns(")&&workJs.includes("mountPlans(")&&workJs.includes("mountHome("),'the old buttons are reused, not rebuilt');
assert.ok(!/method\s*:\s*'POST'/.test(fs.readFileSync(path.join(REPO,'hub','web','app.js'),'utf8')),'the shell sends no writes');
const html=fs.readFileSync(path.join(REPO,'hub','web','index.html'),'utf8');assert.ok(html.includes('This week')&&html.includes('These 5 hours')&&!/WEEKLY|5-HOUR/.test(html),'the gauges are named in plain words');
assert.ok(fs.existsSync(resolveRoute(REPO,'/web/work.js','127.0.0.1:1',1).file));

// ── live: GET /api/work from real plan files (runs switched off)
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-work-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
const dir=path.join(root,'plans'),send=(title,text)=>sendPlan(dir,{source:title.toLowerCase().replace(/\W+/g,'-')+'.md',title,from:'master',text,now:Date.now()}).plan;
send('Scene editor E4: Library','# Scene editor E4: Library\n\nText.\n\n## Run\nmodel: sonnet\nwhy: builds\nsize: M\nneeds: npm test\n');
send('Walking and cars','# Walking and cars\n\nProject: People\n\nNo run block.\n');
let p3=send('Hub v2 V9: thing','# Hub v2 V9: thing\n\n## Run\nmodel: haiku\nwhy: tiny\nsize: S\n');p3=answerPlan(p3,{verdict:'approved',note:'go',revision:1,now:Date.now()}).plan;savePlan(dir,p3);
const w=workOf(root);
assert.deepEqual(w.projects.map(p=>p.name).sort(),['Hub v2','Other','People','Scene editor'],'Other holds the note that there is no token reading yet');assert.equal(w.enabled,false);assert.equal(w.locked,false);
const live=id=>findStep(w,{plan:w.projects.flatMap(p=>p.steps).find(s=>s.title.startsWith(id)).planId}).step;
assert.equal(live('Scene editor').status,'waiting');assert.match(live('Scene editor').next,/Sonnet 5\.5 \(allowed up to 1,500,000 tokens\)/);
assert.equal(live('Walking').status,'waiting');assert.match(live('Walking').next,/no Run block/);
assert.equal(live('Hub v2').status,'approved');assert.match(live('Hub v2').next,/Runs are switched off/);
assert.ok(!JSON.stringify(w).includes('No run block.'),'the plan text never leaves in the tree');
assert.deepEqual(resolveRoute(root,'/api/work','127.0.0.1:1',1),{api:'work'});
const srv=createHubServer({root}),port=await srv.listen();
const got=await new Promise((ok,fail)=>http.get(`http://127.0.0.1:${port}/api/work`,res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,body:JSON.parse(t)}))}).on('error',fail));
assert.equal(got.status,200);assert.equal(got.body.needsYou,4,'three steps and the token note');assert.equal(got.body.projects.length,4);
await srv.close();fs.rmSync(root,{recursive:true,force:true});
console.log('hub-work: grouping, the eight statuses, next-step sentences, the count, items, old hashes, plain feed words, the layout rule and GET /api/work passed.');
