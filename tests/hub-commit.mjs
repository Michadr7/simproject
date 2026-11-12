// Hub v2 V3: Commit and Push buttons.

// The pure rules always run; the git part runs only when GitHub Desktop's git is found, and ONLY in temporary folders
// (a local bare repository stands in for GitHub). Nothing here commits, pushes or even reads the real repository's git.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FORBIDDEN,parseStatus,forbiddenReason,plainPath,groupOf,buildProposal,suggestMessage,messageProblem,checkSelection,proposalPaths,MAX_MESSAGE,MAX_FILE_BYTES} from '../hub/commit.js';
import {findGit,createGit,isAllowed,isReadCommand,pushProblem,safeBranch} from '../hub/git.mjs';
import {createCommits} from '../hub/commit-ctl.mjs';
import {createHubServer,resolveRoute} from '../hub/server.js';
import {buildStatus,changeLines} from '../hub/status.js';
import {MASTER_RULES,extractCommit,createChat} from '../hub/chat.js';
import {parseActionLine,withoutActions,chatActionState,chatActionCall,callFor,CHAT_OPS,NAV_OPS} from '../hub/web/run-actions.js';
import {commitLabel,TREE} from '../hub/web/shell.js';
import {nextLine,testPill,pickedPaths,commitBlock,mergeTicks,commitButtonText,pushButtonText,PUSH_NOTE} from '../hub/web/commit.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),REPO=path.resolve(HERE,'..'),HUB=path.join(REPO,'hub');
const skipped=[];

// ── parseStatus: renames, spaces, deletes, untracked, conflicts (with -z there is no quoting)
{
 const z=['M  hub/a.js','?? dir/with space.txt','R  new name.txt','old name.txt',' D gone.txt','A  added.txt',' M dist/game.js','UU clash.txt','DD both.txt','?? ünï.txt',''].join('\0');
 const s=parseStatus(z),by=Object.fromEntries(s.map(e=>[e.path,e]));
 assert.equal(s.length,9);
 assert.equal(by['hub/a.js'].kind,'changed');assert.equal(by['hub/a.js'].staged,true);
 assert.equal(by['dir/with space.txt'].kind,'untracked');assert.equal(by['dir/with space.txt'].staged,false);
 assert.deepEqual([by['new name.txt'].kind,by['new name.txt'].from],['renamed','old name.txt']);
 assert.equal(by['gone.txt'].kind,'deleted');assert.equal(by['added.txt'].kind,'added');assert.equal(by['dist/game.js'].staged,false);
 assert.equal(by['clash.txt'].kind,'conflict');assert.equal(by['both.txt'].kind,'conflict');assert.equal(by['ünï.txt'].kind,'untracked');
 assert.deepEqual(parseStatus(''),[]);assert.deepEqual(parseStatus('\0\0'),[]);assert.deepEqual(parseStatus(null),[]);
}

// ── the never-commit list: nothing on it can be chosen
assert.deepEqual(FORBIDDEN,['assets-src/','.claude/','.hub/','.dev.vars','simproject.code-workspace']);
for(const bad of ['assets-src/man.glb','assets-src/a/b/c.png','.claude/settings.json','.claude/agents/advisor.md','.hub/usage.jsonl','.dev.vars','simproject.code-workspace','sub/.dev.vars','ASSETS-SRC/x.glb','.Claude/x','Simproject.Code-Workspace','pkg/.claude/x.md','sub/assets-src/y.png','.env','.env.local','.ENV','deep/dir/.env.production','secrets/server.pem','a/b/key.KEY','id.key','.git/config','x/.git/hooks/pre-push'])
 assert.ok(forbiddenReason(bad),bad+' is forbidden');
for(const good of ['dist/game.js','hub/commit.js','assets-src-notes.md','my.claude.md','environment.md','tests/hub-commit.mjs','plans/p.json','keyboard.js','monkey.js','dist/vendor/three.module.js'])assert.equal(forbiddenReason(good),null,good+' is allowed');
for(const odd of ['','/etc/passwd','C:/x.txt','c:\\x','..','../x','a/../b','a//b','./a','-rf','--version','a\\b','a\0b',undefined,null,7,'x'.repeat(401)])assert.ok(forbiddenReason(odd),'odd path refused: '+JSON.stringify(odd));
assert.ok(plainPath('a b/c d.txt')&&!plainPath('../a'));

// ── groups
for(const [p,g] of [['dist/game.js','Game'],['server.js','Game'],['worker/x.js','Game'],['tests/a.mjs','Tests'],['hub/a.js','Hub'],['scripts/hub-shots.mjs','Hub'],['scripts/build.mjs','Other'],['plans/a.json','Plans'],['README.md','Notes'],['context.md','Notes'],['package.json','Other'],['docs/a.txt','Notes']])assert.equal(groupOf(p),g,p);

// ── buildProposal
const E=(path,o={})=>({path,x:' ',y:'M',kind:'changed',staged:false,size:10,mtime:1000,...o});
const HEAD={id:'abc1234',time:5000,subject:'before'};
const run=(o={})=>({id:'run-20261111-140211-ab12',planTitle:'Hub v2 V2: Tools',status:'done',updatedAt:6000,flagged:[],files:[],...o});
{
 const status=[E('hub/a.js'),E('dist/game.js'),E('tests/t.mjs'),E('plans/p.json'),E('NOTES.md'),E('package.json'),E('assets-src/m.glb',{y:'?',kind:'untracked'}),E('.claude/s.json'),E('.dev.vars'),E('keys/a.pem'),E('clash.txt',{kind:'conflict',x:'U',y:'U'}),E('moved.txt',{kind:'renamed',from:'.hub/old.txt',x:'R'})];
 const p=buildProposal({status,runs:[run()],lastTest:{ok:true,endedAt:2000,text:'150 of 150 passed'},head:HEAD});
 assert.deepEqual(p.files.map(g=>g.group),['Game','Tests','Hub','Plans','Notes','Other'],'groups in the plan\'s order');
 assert.deepEqual(proposalPaths(p).sort(),['NOTES.md','dist/game.js','hub/a.js','package.json','plans/p.json','tests/t.mjs']);
 assert.deepEqual(p.leftOut.map(o=>o.path).sort(),['.claude/s.json','.dev.vars','assets-src/m.glb','clash.txt','keys/a.pem','moved.txt']);
 assert.ok(p.leftOut.every(o=>o.reason),'each left-out path says why');
 assert.deepEqual(p.counts,{files:6,leftOut:6,groups:{Game:1,Tests:1,Hub:1,Plans:1,Notes:1,Other:1}});
 assert.equal(p.warnings.length,0,'tests passed after the newest change, no big files, no open runs');
 assert.ok(/^[0-9a-f]{24}$/.test(p.hash));assert.deepEqual(p.head,HEAD);
 assert.equal(p.suggestedMessage,'Hub v2 V2: Tools','one finished step since the last commit');
 // warnings: they warn, they do not block
 const w=(o)=>buildProposal({status:o.status||[E('hub/a.js')],runs:o.runs||[],lastTest:o.t===undefined?{ok:true,endedAt:2000}:o.t,head:HEAD}).warnings;
 assert.match(w({t:null})[0].text,/not been run/);assert.match(w({t:{ok:false,endedAt:2000,text:'x'}})[0].text,/failed/);assert.match(w({t:{ok:true,endedAt:500}})[0].text,/changed after the last passing/);
 assert.equal(w({status:[]}).length,0,'nothing to commit, nothing to warn about');
 const big=buildProposal({status:[E('dist/big.bin',{size:MAX_FILE_BYTES+1})],lastTest:{ok:true,endedAt:2000},head:HEAD});
 assert.equal(big.warnings[0].kind,'big');assert.match(big.warnings[0].text,/dist\/big\.bin: Large file: 5\.0 MB/);assert.equal(big.files[0].items[0].ticked,true,'a big file warns but stays ticked');
 assert.equal(buildProposal({status:[E('dist/big.bin',{size:MAX_FILE_BYTES})],lastTest:{ok:true,endedAt:2000},head:HEAD}).warnings.length,0,'exactly 5 MB is fine');
 const open=buildProposal({status:[E('hub/a.js'),E('hub/b.js')],runs:[run({status:'stopped',planTitle:'Half done',flagged:['hub/a.js']})],lastTest:{ok:true,endedAt:2000},head:HEAD});
 const items=Object.fromEntries(open.files[0].items.map(i=>[i.path,i]));
 assert.equal(items['hub/a.js'].ticked,false,'a file flagged by a run that is not Finished starts unticked');assert.equal(items['hub/b.js'].ticked,true);assert.match(items['hub/a.js'].warn[0],/Half done/);assert.ok(open.warnings.some(x=>x.kind==='run'));
 for(const st of ['done','closed'])assert.equal(buildProposal({status:[E('hub/a.js')],runs:[run({status:st,flagged:['hub/a.js']})],lastTest:{ok:true,endedAt:2000},head:HEAD}).files[0].items[0].ticked,true,st+' is finished');
 // the hash covers the status and the head, and ignores left-out paths
 const base=buildProposal({status:[E('hub/a.js')],head:HEAD}).hash;
 assert.equal(buildProposal({status:[E('hub/a.js'),E('.hub/x.json')],head:HEAD}).hash,base,'left-out paths do not change the hash');
 assert.equal(buildProposal({status:[E('hub/a.js')],head:HEAD,runs:[run()],lastTest:{ok:true,endedAt:1}}).hash,base,'runs and tests do not change it');
 for(const [name,o] of [['another file',{status:[E('hub/a.js'),E('hub/b.js')],head:HEAD}],['status letters',{status:[E('hub/a.js',{y:'D',kind:'deleted'})],head:HEAD}],['size',{status:[E('hub/a.js',{size:11})],head:HEAD}],['time',{status:[E('hub/a.js',{mtime:2000})],head:HEAD}],['head',{status:[E('hub/a.js')],head:{...HEAD,id:'def5678'}}],['no head',{status:[E('hub/a.js')],head:null}]])assert.notEqual(buildProposal(o).hash,base,name+' changes the hash');
}
// the message is made by script from step titles
assert.equal(suggestMessage({runs:[],files:1,groups:{Hub:1}}),'Update 1 file (hub)');assert.equal(suggestMessage({runs:[],files:3,groups:{Game:2,Tests:1}}),'Update 3 files (game, tests)');
assert.equal(suggestMessage({runs:[run({updatedAt:100})],head:HEAD,files:2,groups:{}}),'Update 2 files','a step finished before the last commit is not mentioned');
assert.equal(suggestMessage({runs:[run({status:'running'}),run({status:'failed'})],head:HEAD,files:2,groups:{}}),'Update 2 files','only Finished steps count');
{const m=suggestMessage({runs:[run({planTitle:'One'}),run({planTitle:'Two',updatedAt:7000}),run({planTitle:'One'}),run({planTitle:'Three',status:'closed',updatedAt:8000})],head:HEAD,files:5,groups:{}});assert.equal(m,'One and 2 more steps\n\n- One\n- Two\n- Three')}
assert.ok(suggestMessage({runs:Array.from({length:400},(_,i)=>run({planTitle:'T'+i+'x'.repeat(90)})),head:HEAD}).length<=MAX_MESSAGE);
assert.equal(messageProblem('ok'),null);for(const bad of ['','   ',undefined,null,5,'x'.repeat(MAX_MESSAGE+1),'a\0b'])assert.ok(messageProblem(bad),JSON.stringify(bad));assert.equal(messageProblem('x'.repeat(MAX_MESSAGE)),null);
// checkSelection: only the proposal's own paths, never a forbidden one
{
 const p=buildProposal({status:[E('hub/a.js',{y:' ',x:'M',staged:true}),E('hub/b c.js',{y:'?',x:'?',kind:'untracked'}),E('new.txt',{kind:'renamed',from:'old.txt',x:'R',y:' '}),E('.claude/x.json')],head:HEAD});
 const ok=checkSelection(p,['hub/a.js','hub/b c.js','new.txt','hub/a.js']);
 assert.deepEqual(ok.paths,['hub/a.js','hub/b c.js','new.txt'],'duplicates dropped');assert.deepEqual(ok.gitPaths.sort(),['hub/a.js','hub/b c.js','new.txt','old.txt']);assert.deepEqual(ok.toAdd,['hub/b c.js'],'only what is not fully staged needs add');
 for(const bad of [['.claude/x.json'],['hub/other.js'],['hub/a.js','../etc/passwd'],[],'hub/a.js',null,[7],['hub/a.js',null],['old.txt'],['HUB/A.JS']])assert.ok(checkSelection(p,bad).error,'refused: '+JSON.stringify(bad));
 assert.ok(checkSelection(p,Array.from({length:5001},(_,i)=>'f'+i)).error);
 // even if a forbidden path were somehow in the proposal, checkSelection still refuses it
 const evil={files:[{group:'Other',items:[{path:'.env',x:' ',y:'M'}]}]};assert.ok(checkSelection(evil,['.env']).error);
}

// ── the git file: only the allowed command shapes exist
const r=(...a)=>a;
for(const good of [r('status','--porcelain=v1','-z','--untracked-files=all'),r('rev-parse','--short','HEAD'),r('log','-5','--format=%h%x09%ct%x09%s'),r('rev-parse','--abbrev-ref','HEAD'),r('branch','-r','--contains','HEAD'),r('log','origin/main..HEAD','--format=%h%x09%s'),r('add','--','a.txt','b c.txt'),r('commit','-F','C:\\t\\m.txt','--','a.txt'),r('reset','--soft','HEAD~1'),r('push','origin','main'),r('push','origin','feature/x-1.2')])assert.ok(isAllowed(good),'allowed: '+good.join(' '));
for(const bad of [r('add','-A'),r('add','.'),r('add','--','.claude/x'),r('add','--','../x'),r('add','--'),r('add','-A','--','a'),r('commit','-m','x'),r('commit','--amend','-F','m','--','a'),r('commit','-F','m'),r('commit','-F','m','--'),r('commit','-F','m','--','.env'),r('commit','-a','-F','m','--','a'),r('commit','--no-verify','-F','m','--','a'),r('push'),r('push','origin'),r('push','--force','origin','main'),r('push','origin','main','--force'),r('push','-f','origin','main'),r('push','origin','+main'),r('push','origin','main:other'),r('push','origin','--delete','main'),r('push','origin','main','extra'),r('push','upstream','main'),r('push','origin','-u'),r('push','--force-with-lease','origin','main'),r('push','origin','a..b'),r('push','origin','x.lock'),r('fetch'),r('fetch','origin'),r('pull'),r('merge','main'),r('rebase','main'),r('reset','--hard'),r('reset','--hard','HEAD~1'),r('reset','--soft','HEAD~2'),r('reset','HEAD~1'),r('clean','-fd'),r('checkout','main'),r('checkout','--','a'),r('restore','a'),r('stash'),r('config','user.name','x'),r('remote','add','x','y'),r('log','origin/main..HEAD'),r('log','-p'),r('status'),r('log','origin/-x..HEAD','--format=%h%x09%s'),r(),r(7)]
 )assert.ok(!isAllowed(bad),'refused: '+JSON.stringify(bad));
assert.ok(!isAllowed('push origin main')&&!isAllowed(null)&&!isAllowed(undefined)&&!isAllowed({}));
assert.ok(isReadCommand(['status','--porcelain=v1','-z','--untracked-files=all'])&&!isReadCommand(['add','--','a']),'only looking commands may run synchronously');
assert.ok(safeBranch('main')&&safeBranch('feature/a-b_c.1')&&!safeBranch('-x')&&!safeBranch('a b')&&!safeBranch('a..b')&&!safeBranch('+main')&&!safeBranch('')&&!safeBranch('HEAD:x')&&!safeBranch(null));
{ // the file itself holds no other command, in code (comments and the plain-words messages are not code)
 const src=fs.readFileSync(path.join(HUB,'git.mjs'),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
 for(const word of ["'fetch'","'pull'","'merge'","'rebase'","'clean'","'checkout'","'restore'","'stash'","'remote'","'config'","'-A'","'--amend'","'--no-verify'","'--hard'","'-f'","'-u'","'--delete'","'--mirror'","'--tags'"])assert.ok(!src.includes(word),'git.mjs has no '+word);
 assert.ok(!/(?<![.\w])(spawn|exec)\(/.test(src)&&!/shell\s*:\s*true/.test(src),'no shell, no exec string');
 assert.ok(src.includes('GIT_TERMINAL_PROMPT')&&src.includes('PUSH_LIMIT_MS=60000'),'a push can never wait on a password prompt or for longer than 60 s');
 for(const f of fs.readdirSync(HUB).filter(n=>/\.(js|mjs)$/.test(n)&&n!=='git.mjs')){
  const code=fs.readFileSync(path.join(HUB,f),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');
  assert.ok(!/execFile\([^)]*git|['"]git(\.exe)?['"]|findGit\(/.test(code)||['commit-ctl.mjs','hub-cli.mjs'].includes(f),f+' does not start git')}
 const server=fs.readFileSync(path.join(HUB,'server.js'),'utf8').replace(/\/\/.*$/gm,'');assert.ok(!/child_process/.test(server),'server.js has no process code');
}
// plain words for what GitHub says
assert.equal(pushProblem({stderr:' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs'}).kind,'behind');
assert.equal(pushProblem({stderr:'! [rejected] main -> main (non-fast-forward)'}).kind,'behind');
assert.match(pushProblem({stderr:'hint: Updates were rejected because the remote contains work'}).text,/GitHub Desktop/);
for(const s of ['fatal: Authentication failed for https://github.com/x/y.git','fatal: could not read Username for \'https://github.com\': terminal prompts disabled','remote: Permission denied','fatal: unable to access: The requested URL returned error: 403'])assert.equal(pushProblem({stderr:s}).kind,'auth',s);
assert.match(pushProblem({timedOut:true,stderr:''}).text,/60 seconds/);assert.equal(pushProblem({stderr:'fatal: something odd'}).kind,'other');assert.match(pushProblem({stderr:'fatal: something odd'}).text,/something odd/);
for(const k of ['behind','auth','timeout','other'])assert.ok(!/pull|fetch/.test(pushProblem(k==='timeout'?{timedOut:true}:{stderr:k==='behind'?'[rejected]':k==='auth'?'Authentication failed':'x'}).text.replace(/will not fetch, pull or merge/,'')),'the hub never tells you it will fetch or pull');
// finding GitHub Desktop's git: the newest app-* folder
{
 const files=new Set(),dirs=['app-3.4.20','app-3.5.2','app-3.6.10','app-3.10.1','bin','packages','app-x'];
 const exe=n=>path.join('L','GitHubDesktop',n,'resources','app','git','cmd','git.exe');
 const fsApi={readdirSync:()=>dirs,existsSync:p=>files.has(p)};
 assert.equal(findGit({localAppData:'L',fsApi}),null,'none has a git.exe');
 files.add(exe('app-3.5.2'));files.add(exe('app-3.6.10'));assert.equal(findGit({localAppData:'L',fsApi}),exe('app-3.6.10'));
 files.add(exe('app-3.10.1'));assert.equal(findGit({localAppData:'L',fsApi}),exe('app-3.10.1'),'3.10 is newer than 3.6');
 assert.equal(findGit({localAppData:'L',fsApi:{readdirSync(){throw new Error('x')},existsSync:()=>false}}),null);assert.equal(findGit({localAppData:'',fsApi}),null);
}

// ── the master and the pages: both buttons only OPEN the page
assert.deepEqual(NAV_OPS,['commit','push']);assert.ok(CHAT_OPS.includes('commit')&&CHAT_OPS.includes('push'));
for(const op of NAV_OPS){assert.deepEqual(parseActionLine('ACTION: '+op),{op});assert.deepEqual(parseActionLine(`  **ACTION:** \`${op}\`  `),{op});assert.ok(MASTER_RULES.includes('ACTION: '+op),'the master is told about '+op);assert.deepEqual(chatActionCall({op}),{nav:'#commit'},op+' opens the page and sends nothing')}
for(const bad of ['ACTION: commit everything','ACTION: push origin main','ACTION: push --force','ACTION: commit -m x','ACTION: commit all'])assert.equal(parseActionLine(bad),null,bad);
assert.equal(withoutActions('Ready.\nACTION: commit\nThen push.\nACTION: push'),'Ready.\nThen push.');
assert.ok(MASTER_RULES.includes('COMMIT:')&&MASTER_RULES.includes('only on the owner\'s press')&&!/the hub never commits/i.test(MASTER_RULES));
assert.equal(extractCommit('Done.\nCOMMIT:\nAdd the Commit page\n\nGrouped list, undo and push.'),'Add the Commit page\n\nGrouped list, undo and push.');
assert.equal(extractCommit('x\n**COMMIT:**\nSubject\nPLAN:\n# P'),'Subject','the message stops at a PLAN: line');assert.equal(extractCommit('no message here'),null);assert.equal(extractCommit('COMMIT:\n   \n'),null);
assert.equal(extractCommit('COMMIT:\n'+'y'.repeat(5000)).length,2000);assert.equal(extractCommit('COMMIT:\nA\0B'),'AB');assert.equal(extractCommit('I will COMMIT: later'),null);
{
 const git={enabled:true,files:3,unpushed:2};
 assert.deepEqual(chatActionState({op:'commit'},{git}),{label:'Review commit (3 files)',enabled:true,why:'Opens the Commit page. Nothing is committed until you press Commit there.',primary:false});
 assert.equal(chatActionState({op:'push'},{git}).label,'Review push (2 commits)');assert.match(chatActionState({op:'push'},{git}).why,/Nothing is sent to GitHub until you press Push there/);
 assert.equal(chatActionState({op:'commit'},{git:{enabled:true,files:1,unpushed:0}}).label,'Review commit (1 file)');
 assert.equal(chatActionState({op:'commit'},{git:{enabled:true,files:0,unpushed:1}}).enabled,false);assert.equal(chatActionState({op:'push'},{git:{enabled:true,files:1,unpushed:0}}).enabled,false);
 assert.equal(chatActionState({op:'commit'},{}).enabled,false);assert.match(chatActionState({op:'commit'},{git:{enabled:false}}).why,/Commit is off/);
 const cc=callFor('commit-do',{files:['a'],message:'m',hash:'h'});assert.deepEqual(cc,{url:'/api/commit',body:{files:['a'],message:'m',hash:'h'}});assert.equal(callFor('commit-do',{files:'a',message:'m',hash:'h'}),null);assert.equal(callFor('commit-do',{files:['a'],message:'m'}),null);
 assert.deepEqual(callFor('commit-undo'),{url:'/api/commit/undo',body:{}});assert.deepEqual(callFor('push-do',{head:'abc1234'}),{url:'/api/push',body:{head:'abc1234'}});assert.equal(callFor('push-do',{}),null);
}
{
 const text=buildStatus({changes:{enabled:true,files:7,groups:{Game:2,Hub:5},lastId:'abc1234',leftOut:2,unpushed:1},now:Date.now()});
 assert.match(text,/Changes since the last commit: 7 files \(Game 2, Hub 5\); last commit abc1234; 2 private paths always left out\. Commits on this PC not on GitHub yet: 1\./);
 assert.match(text,/ACTION: commit \| ACTION: push/);assert.match(text,/only OPENS the Commit page/);
 assert.ok(!/hub\/|dist\//.test(changeLines({enabled:true,files:7,groups:{Game:2},lastId:'a',unpushed:0}).join('')),'counts only, never file names');
 assert.ok(!buildStatus({changes:{enabled:true,files:0,groups:{},lastId:'a',unpushed:0},now:1}).includes('ACTION: commit'),'nothing changed, nothing to propose');
 assert.ok(!buildStatus({now:1}).includes('Changes since'),'off when the controller is off');assert.deepEqual(changeLines({enabled:false}),[]);
}
{
 // the master's COMMIT: line becomes a message on the chat entry plus an Open button, never a commit
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-commit-chat-'));fs.mkdirSync(path.join(dir,'.hub'));fs.writeFileSync(path.join(dir,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct:5,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:5,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
 const FAKE=path.join(HERE,'fixtures','fake-claude.mjs');
 const chat=createChat({root:dir,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:{HUB_FAKE_SCENARIO:'master',HUB_FAKE_REPLY:'Ready to commit.\nCOMMIT:\nAdd the Commit page\n\nGrouped list and undo.'}});
 const sent=chat.send({text:'commit please',busy:false});assert.ok(!sent.error,JSON.stringify(sent));
 for(let i=0;i<200&&chat.working();i++)await new Promise(ok=>setTimeout(ok,50));
 const msg=chat.view().messages.filter(m=>m.role==='master').at(-1);
 assert.ok(msg,'the master answered');assert.equal(msg.commitMessage,'Add the Commit page\n\nGrouped list and undo.');assert.deepEqual(msg.actions,[{op:'commit'}]);
 await chat.shutdown();fs.rmSync(dir,{recursive:true,force:true});
}
assert.equal(commitLabel(null),'Commit');assert.equal(commitLabel({enabled:false,files:4}),'Commit');assert.equal(commitLabel({enabled:true,files:0}),'Commit');assert.equal(commitLabel({enabled:true,files:1}),'Commit · 1 file changed');assert.equal(commitLabel({enabled:true,files:12}),'Commit · 12 files changed');
assert.ok(!('soon' in TREE.foot.find(x=>x.key==='commit')),'Commit is a real page now');
// the page's pure rules
{
 const P=(o={})=>({enabled:true,counts:{files:3,leftOut:0,groups:{}},warnings:[],busy:false,files:[{group:'Hub',items:[{path:'hub/a.js',ticked:true,warn:[]},{path:'hub/b.js',ticked:false,warn:['x']}]}],...o});
 assert.match(nextLine(null,null),/switched off/);assert.match(nextLine({enabled:false},null),/npm run hub -- --runs/);assert.equal(nextLine({enabled:true,error:'git is missing'},null),'git is missing');
 assert.match(nextLine(P({busy:true}),null),/nothing can be committed or pushed/);assert.match(nextLine(P({counts:{files:0}}),null),/Nothing has changed/);assert.match(nextLine(P({counts:{files:0}}),{count:2}),/2 commits are waiting to be pushed/);
 assert.match(nextLine(P({warnings:[{kind:'tests',text:'t'}]}),null),/Run the tests first/);assert.match(nextLine(P(),{count:1}),/1 earlier commit is also not on GitHub yet/);assert.match(nextLine(P(),null),/Pushing is a separate button/);
 assert.deepEqual(testPill(P({lastTest:null}),null),{text:'Tests: not run from the hub yet',cls:''});
 assert.equal(testPill(P({lastTest:{ok:true,endedAt:1,text:'150 of 150 passed'}}),null).cls,'ok');assert.equal(testPill(P({lastTest:{ok:true,endedAt:1,text:'150 of 150 passed'},warnings:[{kind:'tests'}]}),null).cls,'warn');
 assert.equal(testPill(P({lastTest:{ok:false,endedAt:1,text:'2 of 150 passed, 148 failed'}}),null).cls,'bad');assert.equal(testPill(P(),{running:{key:'test',label:'Run the tests'}}).cls,'run');assert.equal(testPill(P(),{running:{key:'dev',label:'x'}}).cls,'');
 const unticked=new Set(),known=new Set();mergeTicks(P(),unticked,known);assert.deepEqual([...unticked],['hub/b.js'],'a file from an unfinished run starts unticked');
 unticked.add('hub/a.js');mergeTicks(P(),unticked,known);assert.ok(unticked.has('hub/a.js'),'your unticks stay across refreshes');
 unticked.delete('hub/b.js');mergeTicks(P(),unticked,known);assert.ok(!unticked.has('hub/b.js'),'a file you ticked stays ticked');
 mergeTicks(P({files:[]}),unticked,known);assert.equal(unticked.size,0);assert.equal(known.size,0,'files that left the list are forgotten');
 assert.deepEqual(pickedPaths(P(),new Set(['hub/b.js'])),['hub/a.js']);
 assert.equal(commitBlock(P(),1,'msg',false),'');assert.match(commitBlock(P(),0,'msg',false),/Tick at least one/);assert.match(commitBlock(P(),1,'  ',false),/Write a message/);assert.match(commitBlock(P(),1,'x'.repeat(2001),false),/too long/);assert.ok(commitBlock(P({busy:true}),1,'m',false));assert.ok(commitBlock(P(),1,'m',true));assert.ok(commitBlock(P({error:'x'}),1,'m',false));assert.ok(commitBlock(null,1,'m',false));
 assert.equal(commitButtonText(1),'Commit 1 file');assert.equal(commitButtonText(12),'Commit 12 files');assert.equal(pushButtonText(1),'Push 1 commit to GitHub');assert.equal(pushButtonText(3),'Push 3 commits to GitHub');
 assert.equal(PUSH_NOTE,'This sends your commits to GitHub. Nothing in this project deploys by itself on a push; deploying stays a separate step.');
}
// the routes
{
 const R=(p,host='127.0.0.1:8765')=>resolveRoute(REPO,p,host,8765);
 assert.deepEqual(R('/api/commit/proposal'),{api:'commit-proposal',write:false});assert.deepEqual(R('/api/commit/summary'),{api:'commit-summary',write:false});assert.deepEqual(R('/api/push/status'),{api:'push-status',write:false});
 assert.deepEqual(R('/api/commit'),{api:'commit-do',write:true});assert.deepEqual(R('/api/commit/undo'),{api:'commit-undo',write:true});assert.deepEqual(R('/api/push'),{api:'push-do',write:true});
 for(const bad of ['/api/commit/proposal/x','/api/commit/amend','/api/push/force','/api/push/status/x','/api/commits','/api/Commit','/api/commit/','/api/pull','/api/fetch','/api/constructor','/api/__proto__'])assert.ok(R(bad).status,bad+' is refused');
 assert.equal(R('/api/commit/proposal','evil.example').status,403);
}

// ── git, in temporary folders only
const gitPath=findGit();
if(!gitPath){skipped.push('skipped: git not found (GitHub Desktop\'s git.exe), so the temporary-repository tests did not run')}
else{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-commit-'));
 assert.ok(path.resolve(tmp).startsWith(path.resolve(os.tmpdir())),'temporary folder');
 const G=(cwd,...a)=>execFileSync(gitPath,a,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
 const bare=path.join(tmp,'github.git'),work=path.join(tmp,'work'),other=path.join(tmp,'other');
 fs.mkdirSync(bare);G(bare,'init','--bare','-b','main');fs.mkdirSync(work);G(work,'init','-b','main');
 for(const [k,v] of [['user.name','Test User'],['user.email','test@example.invalid'],['commit.gpgsign','false'],['core.autocrlf','false'],['core.hooksPath',path.join(tmp,'no-hooks')]])G(work,'config',k,v);
 G(work,'remote','add','origin',bare);
 const W=(f,t)=>{const p=path.join(work,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,t)};
 for(const [f,t] of [['a.txt','a\n'],['d.txt','d\n'],['r.txt','rename me\n'.repeat(5)],['hub/keep.js','k\n'],['s.txt','s\n']])W(f,t);
 G(work,'add','--','a.txt','d.txt','r.txt','hub/keep.js','s.txt');G(work,'commit','-m','first');G(work,'push','-u','origin','main');
 const count=(cwd=work)=>Number(G(cwd,'rev-list','--count','HEAD').trim());
 const bareCount=()=>Number(execFileSync(gitPath,['--git-dir',bare,'rev-list','--count','main'],{encoding:'utf8'}).trim());
 assert.equal(count(),1);assert.equal(bareCount(),1);
 // the work: a change, a new file with a space in its name, a delete, a staged rename, a staged file that must NOT go in, and four files that may never go in
 W('a.txt','a changed\n');W('dir/b c.txt','new\n');fs.unlinkSync(path.join(work,'d.txt'));G(work,'mv','r.txt','r2.txt');W('s.txt','s changed\n');G(work,'add','--','s.txt');
 W('.env','SECRET=1\n');W('.claude/settings.json','{}\n');W('assets-src/m.glb','glb\n');W('keys/server.pem','pem\n');W('.hub/usage.jsonl','{}\n');
 const git=createGit({root:work,gitPath});assert.ok(git.available);
 let busy=false;const commits=createCommits({root:work,git,busy:()=>busy,now:Date.now});
 const P0=commits.proposal();
 assert.ok(!P0.error,JSON.stringify(P0));assert.deepEqual(proposalPaths(P0).sort(),['a.txt','d.txt','dir/b c.txt','r2.txt','s.txt']);
 assert.deepEqual(P0.leftOut.map(o=>o.path).sort(),['.claude/settings.json','.env','.hub/usage.jsonl','assets-src/m.glb','keys/server.pem']);
 assert.equal(P0.head.subject,'first');assert.equal(P0.last,null);const ren=P0.files.flatMap(g=>g.items).find(i=>i.path==='r2.txt');assert.deepEqual([ren.kind,ren.from],['renamed','r.txt']);
 assert.deepEqual(commits.summary().groups,P0.counts.groups);assert.equal(commits.summary().files,5);
 // refusals, each one leaves the repository exactly as it was
 const same=()=>{assert.equal(count(),1);assert.equal(bareCount(),1)};
 let o=await commits.commit({files:['a.txt'],message:'x',hash:'0'.repeat(24)});assert.equal(o.code,409);assert.match(o.error,/changed since you opened/);assert.equal(o.proposal.hash,P0.hash,'the fresh list comes back');same();
 busy=true;o=await commits.commit({files:['a.txt'],message:'x',hash:P0.hash});assert.equal(o.code,423);o=await commits.undo();assert.equal(o.code,423);o=await commits.push({head:'abc1234'});assert.equal(o.code,423);assert.equal(commits.pushStatus().canPush,false);busy=false;same();
 for(const [files,why] of [[['.env'],'a forbidden file'],[['.claude/settings.json'],'a forbidden file'],[['assets-src/m.glb'],'a forbidden file'],[['nope.txt'],'a file that is not in the proposal'],[['a.txt','../outside.txt'],'a path that climbs out'],[[],'nothing ticked'],['a.txt','not a list']]){
  o=await commits.commit({files,message:'x',hash:P0.hash});assert.ok(o.error&&[400,409].includes(o.code),why+': '+JSON.stringify(o));same()}
 for(const m of ['','   ','x'.repeat(2001),undefined]){o=await commits.commit({files:['a.txt'],message:m,hash:P0.hash});assert.equal(o.code,400,JSON.stringify(m));same()}
 assert.equal(G(work,'diff','--cached','--name-only').trim().split('\n').sort().join(','),'r2.txt,s.txt','refused commits staged nothing new (only the setup\'s own rename and s.txt are staged)');
 // the press: exactly the ticked files in exactly one commit; the staged s.txt, the new-but-unticked files and the four private files stay out
 o=await commits.commit({files:['a.txt','dir/b c.txt','d.txt','r2.txt'],message:'Add things\n\nWith detail.',hash:P0.hash});
 assert.ok(!o.error,JSON.stringify(o));assert.equal(o.commit.files,4);assert.match(o.commit.id,/^[0-9a-f]{7,}$/);assert.equal(count(),2);assert.equal(bareCount(),1,'committing never pushes');
 const shown=G(work,'show','--name-status','--format=%B','-M','HEAD').split('\n').filter(Boolean);
 assert.deepEqual(shown.filter(l=>/^[A-Z]\d*\t/.test(l)).map(l=>l.split('\t').slice(1).join('>')).sort(),['a.txt','d.txt','dir/b c.txt','r.txt>r2.txt'],JSON.stringify(shown));
 assert.ok(shown.includes('Add things')&&shown.includes('With detail.'));
 const st=G(work,'status','--porcelain=v1','-z','--untracked-files=all').split('\0');
 assert.ok(st.includes('M  s.txt'),'the file someone else staged is still staged, not committed');
 for(const f of ['.env','.claude/settings.json','assets-src/m.glb','keys/server.pem'])assert.ok(fs.existsSync(path.join(work,f)),f+' is untouched on disk');
 assert.ok(!G(work,'ls-files').includes('.env')&&!G(work,'ls-files').includes('assets-src'));
 assert.ok(!fs.readdirSync(os.tmpdir()).some(n=>/^hub-commit-[0-9a-f]{12}\.txt$/.test(n)),'the message file is removed');
 assert.equal(G(work,'log','-1','--format=%an <%ae>').trim(),'Test User <test@example.invalid>');
 const P1=commits.proposal();assert.deepEqual(proposalPaths(P1),['s.txt']);assert.deepEqual(P1.last,{id:o.commit.id,canUndo:true,why:''});assert.notEqual(P1.hash,P0.hash);
 o=await commits.commit({files:['s.txt'],message:'x',hash:P0.hash});assert.equal(o.code,409,'a proposal from before the commit is stale');
 // undo: the soft reset keeps every file as it is
 const before={a:fs.readFileSync(path.join(work,'a.txt'),'utf8'),b:fs.readFileSync(path.join(work,'dir/b c.txt'),'utf8'),r2:fs.existsSync(path.join(work,'r2.txt')),d:fs.existsSync(path.join(work,'d.txt'))};
 let u=await commits.undo();assert.ok(!u.error,JSON.stringify(u));assert.equal(count(),1);assert.deepEqual({a:fs.readFileSync(path.join(work,'a.txt'),'utf8'),b:fs.readFileSync(path.join(work,'dir/b c.txt'),'utf8'),r2:fs.existsSync(path.join(work,'r2.txt')),d:fs.existsSync(path.join(work,'d.txt'))},before,'every file is as it was');
 assert.equal(commits.proposal().last,null);u=await commits.undo();assert.equal(u.code,409);assert.match(u.error,/Nothing to undo/);
 const P2=commits.proposal();assert.deepEqual(proposalPaths(P2).sort(),['a.txt','d.txt','dir/b c.txt','r2.txt','s.txt'],'the files are ready to commit again');
 // an undo is refused once HEAD is not the commit the hub made (someone committed after it)
 o=await commits.commit({files:['a.txt'],message:'one',hash:P2.hash});assert.ok(!o.error,JSON.stringify(o));
 W('later.txt','l\n');G(work,'add','--','later.txt');G(work,'commit','-m','made by hand','--','later.txt');
 assert.equal(commits.proposal().last.canUndo,false);u=await commits.undo();assert.equal(u.code,409);assert.match(u.error,/no longer the newest/);assert.equal(count(),3);
 // push, as its own press
 let ps=commits.pushStatus();assert.equal(ps.branch,'main');assert.equal(ps.count,2);assert.deepEqual(ps.commits.map(c=>c.subject),['made by hand','one']);assert.ok(ps.canPush);assert.equal(ps.head,git.head().id);assert.equal(commits.summary().unpushed,2);
 o=await commits.push({head:'1234567'});assert.equal(o.code,409);assert.match(o.error,/newest commit changed/);assert.ok(o.push);assert.equal(bareCount(),1);
 o=await commits.push({head:'zz'});assert.equal(o.code,400);o=await commits.push({});assert.equal(o.code,400);o=await commits.push({head:null});assert.equal(o.code,400);assert.equal(bareCount(),1,'nothing was sent');
 // ...GitHub (the stand-in) is ahead: refused in plain words, nothing fetched, pulled or merged
 G(tmp,'clone',bare,other);for(const [k,v] of [['user.name','Other'],['user.email','o@example.invalid'],['commit.gpgsign','false'],['core.hooksPath',path.join(tmp,'no-hooks')]])G(other,'config',k,v);
 fs.writeFileSync(path.join(other,'remote.txt'),'r\n');G(other,'add','--','remote.txt');G(other,'commit','-m','from elsewhere');G(other,'push','origin','main');assert.equal(bareCount(),2);
 const headBefore=git.head().id;o=await commits.push({head:headBefore});
 assert.equal(o.code,409);assert.equal(o.kind,'behind');assert.match(o.error,/GitHub has newer commits/);assert.match(o.error,/GitHub Desktop/);assert.equal(bareCount(),2,'nothing was sent');assert.equal(git.head().id,headBefore,'nothing was rewritten here');
 assert.equal(count(),3,'no merge commit appeared');assert.ok(!fs.existsSync(path.join(work,'remote.txt')),'nothing was pulled');
 // bring the stand-in back level the way the owner would (in the other folder: GitHub Desktop's job), then push works
 G(work,'update-ref','refs/remotes/origin/main','HEAD~2');G(bare,'update-ref','refs/heads/main',G(work,'rev-parse','HEAD~2').trim()); // test-only: put the stand-in where this PC thinks it is
 ps=commits.pushStatus();assert.equal(ps.count,2);
 o=await commits.push({head:ps.head});assert.ok(!o.error,JSON.stringify(o));assert.deepEqual(o.pushed,{count:2,branch:'main'});assert.equal(bareCount(),3);assert.equal(execFileSync(gitPath,['--git-dir',bare,'rev-parse','--short','main'],{encoding:'utf8'}).trim(),git.head().id);
 ps=commits.pushStatus();assert.equal(ps.count,0);assert.equal(ps.canPush,false);o=await commits.push({head:ps.head});assert.equal(o.code,409);assert.match(o.error,/already on GitHub|nothing to push/i);
 // undo is gone after a push, even if the hub's record is put back by hand
 assert.equal(commits.proposal().last,null);
 fs.mkdirSync(path.join(work,'.hub'),{recursive:true});fs.writeFileSync(path.join(work,'.hub','last-commit.json'),JSON.stringify({id:git.head().id,branch:'main',at:1}));
 assert.equal(commits.proposal().last.canUndo,false);assert.match(commits.proposal().last.why,/already on GitHub/);u=await commits.undo();assert.equal(u.code,409);assert.match(u.error,/already on GitHub/);assert.equal(count(),3);

 // ── the hub's own server in front of it: token, origin, busy, foreign path, stale hash
 let isBusy=false,hubBusy=()=>isBusy;
 const runsStub={token:'t'.repeat(48),checkToken:t=>t===runsStub.token,locked:()=>false,list:()=>({runs:[],ready:[],enabled:true,locked:false,holding:null}),enabled:()=>true};
 const commits2=createCommits({root:work,git,busy:hubBusy});
 const srv=createHubServer({root:work,runs:runsStub,commits:commits2}),port=await srv.listen(),ORIGIN=`http://127.0.0.1:${port}`;
 const call=(method,url,{body,json=true,origin=ORIGIN,token=runsStub.token,ct='application/json'}={})=>new Promise((res,rej)=>{
  const h={...(origin?{Origin:origin}:{}),...(token?{'X-Hub-Token':token}:{}),...(ct&&method==='POST'?{'Content-Type':ct}:{})};
  const q=http.request({host:'127.0.0.1',port,method,path:url,headers:h},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>{let b=s;try{b=JSON.parse(s)}catch{}res({status:x.statusCode,body:b})})});q.on('error',rej);q.end(body===undefined?undefined:(json?JSON.stringify(body):body))});
 W('srv.txt','s\n');W('keep out.txt','k\n');
 let t=await call('GET','/api/commit/proposal');assert.equal(t.status,200);assert.ok(proposalPaths(t.body).includes('srv.txt'));const hash=t.body.hash;
 assert.equal((await call('GET','/api/commit/summary')).body.files>=2,true);assert.equal((await call('GET','/api/push/status')).body.branch,'main');
 for(const [url,body] of [['/api/commit',{files:['srv.txt'],message:'x',hash}],['/api/commit/undo',{}],['/api/push',{head:git.head().id}]]){
  assert.equal((await call('GET',url)).status,405,url+' is not a GET');
  assert.equal((await call('POST',url,{origin:null,body})).status,403,url+': no Origin');
  assert.equal((await call('POST',url,{origin:'http://evil.example',body})).status,403,url+': another site, even with the token');
  assert.equal((await call('POST',url,{ct:'text/plain',body})).status,415,url+': not JSON');
  assert.equal((await call('POST',url,{body:'x'.repeat(70000),json:false})).status,413,url+': too large');
  assert.equal((await call('POST',url,{body:'{no',json:false})).status,400,url+': broken JSON');
  assert.equal((await call('POST',url,{token:null,body})).status,403,url+': no token');
  assert.equal((await call('POST',url,{token:'0'.repeat(48),body})).status,403,url+': wrong token')}
 t=await call('POST','/api/commit',{body:{files:['srv.txt'],message:'x',hash:'nothex'}});assert.equal(t.status,400);
 t=await call('POST','/api/commit',{body:{files:'srv.txt',message:'x',hash}});assert.equal(t.status,400);t=await call('POST','/api/commit',{body:{files:['srv.txt'],message:5,hash}});assert.equal(t.status,400);
 t=await call('POST','/api/commit',{body:{files:['x'.repeat(401)],message:'x',hash}});assert.equal(t.status,400);t=await call('POST','/api/push',{body:{head:'; rm -rf'}});assert.equal(t.status,400);
 const n3=count();
 isBusy=true;t=await call('POST','/api/commit',{body:{files:['srv.txt'],message:'x',hash}});assert.equal(t.status,423,'refused while something works');isBusy=false;
 t=await call('POST','/api/commit',{body:{files:['.env'],message:'x',hash}});assert.equal(t.status,400,'a forbidden path is refused');
 t=await call('POST','/api/commit',{body:{files:['not-there.txt'],message:'x',hash}});assert.equal(t.status,400,'a foreign path is refused');
 t=await call('POST','/api/commit',{body:{files:['srv.txt'],message:'x',hash:'f'.repeat(24)}});assert.equal(t.status,409);assert.ok(t.body.proposal&&t.body.proposal.hash===hash,'a stale hash gets the fresh proposal');
 assert.equal(count(),n3,'no commit was made by any refusal');
 t=await call('POST','/api/commit',{body:{files:['srv.txt'],message:'Add srv',hash}});assert.equal(t.status,200,JSON.stringify(t.body));assert.equal(count(),n3+1);assert.equal(bareCount(),3,'no push');
 assert.ok(fs.existsSync(path.join(work,'keep out.txt')));
 t=await call('POST','/api/commit/undo',{body:{}});assert.equal(t.status,200);assert.equal(count(),n3);
 t=await call('POST','/api/push',{body:{head:git.head().id}});assert.equal(t.status,409,'nothing to push');
 await srv.close();
 // the other side of the switch: no controller, no commit
 const off=createHubServer({root:work,runs:runsStub}),op=await off.listen();
 const callOff=(method,url,body)=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port:op,method,path:url,headers:{Origin:`http://127.0.0.1:${op}`,'X-Hub-Token':runsStub.token,'Content-Type':'application/json'}},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>res({status:x.statusCode,body:JSON.parse(s)}))});q.on('error',rej);q.end(body===undefined?undefined:JSON.stringify(body))});
 assert.equal((await callOff('GET','/api/commit/proposal')).body.enabled,false);assert.equal((await callOff('POST','/api/commit',{files:['a'],message:'x',hash:'a'.repeat(24)})).status,503);assert.equal((await callOff('POST','/api/push',{head:'abcd'})).status,503);
 await off.close();
 // a git that is not there
 const none=createCommits({root:work,git:createGit({root:work,gitPath:null})});assert.match(none.proposal().error,/not found/);assert.equal(none.summary().enabled,false);assert.equal((await none.commit({files:['a'],message:'m',hash:'a'.repeat(24)})).code,409);
 assert.throws(()=>createGit({root:work,gitPath:null}).status(),/not found/);
 // the real repository was never touched: this test's git calls all had a temporary folder as their cwd
 assert.ok(![work,bare,other].some(d=>path.resolve(d).startsWith(REPO)));
 fs.rmSync(tmp,{recursive:true,force:true});
}
console.log('hub-commit: ok'+(skipped.length?' ('+skipped.join('; ')+')':''));
