// Mikkadr Hub v2, V3: the Commit page (foot row "Commit"). The files changed since the last commit, grouped and ticked, a message box, the test result with a Run tests button, and below it a separate card for Push.
// Commit and Push are two buttons and two presses: nothing here runs by itself, and committing never pushes. A press sends only the ticked paths, the message and the proposal's hash (runCall, with the hub token);
// the hub checks every path against its own list. Text only (textContent): file names and messages are never read as markup. Polls every 8 s (every 2 s while a job works).
import {runCall,errorText} from './runs-api.js';
import {draftStore} from './run-actions.js';

export const MESSAGE_KEY='hub.commit.message',SUGGESTED_KEY='hub.commit.suggested',MAX_MESSAGE=2000;
export const PUSH_NOTE='This sends your commits to GitHub. Nothing in this project deploys by itself on a push; deploying stays a separate step.';
const hm=ms=>{const d=new Date(ms),p=x=>String(x).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}`};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;

// The sentence at the top of the page.
export function nextLine(p,push){
 if(!p||!p.enabled)return 'Commit is switched off. Stop the hub and start it again with: npm run hub -- --runs';
 if(p.error)return p.error;
 if(p.busy)return 'A run, the master or a job is working, so nothing can be committed or pushed. Wait for it, or stop it.';
 const files=p.counts?p.counts.files:0,ahead=push&&push.count||0;
 if(!files)return ahead?`Nothing new to commit. ${plural(ahead,'commit')} ${ahead===1?'is':'are'} waiting to be pushed: see the card below.`:'Nothing has changed since the last commit.';
 if((p.warnings||[]).some(w=>w.kind==='tests'))return 'Run the tests first (button below), then commit. Committing is still possible if you choose to.';
 return `Read the list, edit the message, then press Commit. ${ahead?`${plural(ahead,'earlier commit')} ${ahead===1?'is':'are'} also not on GitHub yet. `:''}Pushing is a separate button further down.`}
// The test result as a pill: {text, cls} with cls '', 'ok', 'bad', 'run' or 'warn'.
export function testPill(p,jobs,now=Date.now()){
 const run=jobs&&jobs.running&&(jobs.running.key==='test'||jobs.running.key==='check');
 if(run)return {text:`${jobs.running.label} is running…`,cls:'run'};
 const t=p&&p.lastTest;
 if(!t)return {text:'Tests: not run from the hub yet',cls:''};
 const stale=(p.warnings||[]).some(w=>w.kind==='tests');
 if(!t.ok)return {text:`Tests failed (${t.text}) · ${hm(t.endedAt)}`,cls:'bad'};
 return stale?{text:`Tests passed (${t.text}) · ${hm(t.endedAt)}, but files changed after that`,cls:'warn'}:{text:`Tests passed (${t.text}) · ${hm(t.endedAt)}`,cls:'ok'}}
// The paths currently ticked, in list order.
export const pickedPaths=(p,unticked)=>(p&&p.files||[]).flatMap(g=>g.items.map(i=>i.path)).filter(x=>!unticked.has(x));
export const commitButtonText=n=>`Commit ${plural(n,'file')}`;
export const pushButtonText=n=>`Push ${plural(n,'commit')} to GitHub`;
// Why the Commit button is off right now, or '' when it can be pressed.
export function commitBlock(p,picked,message,working){
 if(!p||!p.enabled||p.error)return 'Commit is not available.';
 if(working)return 'Working…';
 if(p.busy)return 'Something is working.';
 if(!picked)return 'Tick at least one file.';
 if(!String(message).trim())return 'Write a message first.';
 if(String(message).length>MAX_MESSAGE)return 'The message is too long.';
 return ''}
// New proposal in, ticks kept: files you unticked stay unticked, new files follow the proposal (a file from an unfinished run starts unticked), files that left the list are forgotten.
export function mergeTicks(p,unticked,known){
 const now=new Set();
 for(const g of (p&&p.files)||[])for(const i of g.items){now.add(i.path);if(!known.has(i.path)){known.add(i.path);if(!i.ticked)unticked.add(i.path)}}
 for(const x of [...known])if(!now.has(x)){known.delete(x);unticked.delete(x)}}

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}
const KIND={added:'new',changed:'changed',deleted:'deleted',renamed:'renamed',untracked:'new'};

export function mountCommit(view,{onChange}={}){
 let alive=true,timer=null,sig=null,p=null,push=null,jobs=null,working=false,pushing=false,dirty=false,pushedNote='';
 const unticked=new Set(),known=new Set(),draft=draftStore(MESSAGE_KEY),suggested=draftStore(SUGGESTED_KEY);
 let message='';
 const fromMaster=suggested.get();if(fromMaster){message=fromMaster.slice(0,MAX_MESSAGE);dirty=true;draft.set(message);suggested.set('')} // the master's suggestion waits in the box; you edit it
 else{const kept=draft.get();if(kept){message=kept;dirty=true}}
 const stop=()=>{alive=false;clearTimeout(timer)};

 const top=h('p',{class:'next'}),note=h('p',{class:'msg err',role:'alert',hidden:true}),ok=h('p',{class:'msg approved',role:'status',hidden:true});
 const say=t=>{note.textContent=t;note.hidden=!t;if(t)ok.hidden=true},good=t=>{ok.textContent=t;ok.hidden=!t;if(t)note.hidden=true};
 const testBox=h('div',{class:'box'}),banner=h('div',{}),listBox=h('div',{}),actions=h('div',{class:'cm-actions'}),pushBox=h('div',{class:'box'});
 // the message box is built once and never rebuilt, so typing is never interrupted by a redraw
 const ta=h('textarea',{rows:'6',maxlength:String(MAX_MESSAGE),'aria-label':'Commit message',placeholder:'One short line, then (optional) detail.'}),count=h('span',{class:'small dim'});
 ta.value=message;
 ta.addEventListener('input',()=>{message=ta.value;dirty=true;draft.set(message);updateActions()});
 const msgBox=h('div',{class:'box'},h('div',{class:'label'},'Commit message'),ta,count);
 view.append(top,note,ok,testBox,banner,msgBox,listBox,actions,h('h2',{class:'sect'},'Push to GitHub'),pushBox);

 const commitBtn=h('button',{class:'btn pri',type:'button',onclick:()=>doCommit()},'Commit'),cancelBtn=h('button',{class:'btn',type:'button',onclick:()=>{draft.set('');location.hash='#work'}},'Cancel'),why=h('span',{class:'small dim'});
 actions.append(commitBtn,cancelBtn,why);

 function updateActions(){
  const picked=pickedPaths(p,unticked),block=commitBlock(p,picked.length,message,working);
  commitBtn.textContent=commitButtonText(picked.length);commitBtn.disabled=!!block;why.textContent=block&&!working?block:'';
  count.textContent=`${message.length.toLocaleString('en-US')} of ${MAX_MESSAGE.toLocaleString('en-US')} characters`;
  actions.hidden=!(p&&p.enabled&&!p.error&&p.counts&&p.counts.files>0)}

 async function doCommit(){
  const picked=pickedPaths(p,unticked);if(commitBlock(p,picked.length,message,working))return;
  working=true;say('');good('');updateActions();
  const res=await runCall('commit-do',{files:picked,message,hash:p.hash});working=false;if(!alive)return;
  if(res.ok){draft.set('');dirty=false;message='';ta.value='';good(`Committed as ${res.data.commit.id} (${plural(res.data.commit.files,'file')}). It is not on GitHub yet: Push is a separate button below.`)}
  else{say(errorText(res));if(res.data&&res.data.proposal){applyProposal(res.data.proposal)}} // a changed tree comes back as the fresh list; nothing was committed
  await load(true);if(onChange)onChange()}
 async function doUndo(){
  if(working)return;working=true;say('');good('');
  const res=await runCall('commit-undo',{});working=false;if(!alive)return;
  if(res.ok)good('Undone. Every file is exactly as it was; the files are ready to commit again.');else say(errorText(res));
  await load(true);if(onChange)onChange()}
 async function doPush(){
  if(pushing||!push||!push.canPush)return;
  pushing=true;pushedNote='';say('');good('');drawPush();
  const res=await runCall('push-do',{head:push.head});pushing=false;if(!alive)return;
  if(res.ok)pushedNote=`Sent ${plural(res.data.pushed.count,'commit')} to GitHub (${res.data.pushed.branch}).`;else say(errorText(res));
  await load(true);if(onChange)onChange()}
 async function runTests(){
  say('');const res=await runCall('job-start',{job:'test'});if(!res.ok)say(errorText(res));
  await load(true)}

 function applyProposal(next){p=next;mergeTicks(p,unticked,known);if(!dirty)message=p.suggestedMessage||'';if(document.activeElement!==ta)ta.value=message}

 function drawTests(){
  testBox.textContent='';
  if(!p||!p.enabled||p.error)return;
  const t=testPill(p,jobs),running=jobs&&jobs.running,blocked=!!(jobs&&jobs.busy)||!!running||p.busy;
  testBox.append(h('div',{class:'tool-head'},h('span',{class:'plan-main'},h('span',{class:'plan-title'},'Tests'),h('span',{class:'plan-meta tool-res '+t.cls},t.text)),
   h('span',{class:'acts'},h('button',{class:'btn',type:'button',disabled:blocked,onclick:runTests},'Run tests'))));
  const ws=(p.warnings||[]).filter(w=>w.kind!=='tests');
  for(const w of (p.warnings||[]).filter(w=>w.kind==='tests'))testBox.append(h('p',{class:'small warn'},w.text));
  for(const w of ws)testBox.append(h('p',{class:'small warn'},w.text))}

 function drawBanner(){
  banner.textContent='';
  if(!p||!p.last)return;
  const l=p.last;
  banner.append(h('div',{class:'box'},h('div',{class:'tool-head'},h('span',{class:'plan-main'},h('span',{class:'plan-title'},`Committed as ${l.id}`),h('span',{class:'plan-meta'},l.canUndo?'The hub made this commit and it is not on GitHub. You can take it back; every file stays as it is.':l.why)),
   l.canUndo?h('span',{class:'acts'},h('button',{class:'btn',type:'button',disabled:working||p.busy,onclick:doUndo},'Undo this commit, keep the files')):null)))}

 function drawList(){
  listBox.textContent='';
  if(!p||!p.enabled){listBox.append(h('div',{class:'box'},h('div',{class:'label'},'Commit is off'),h('p',{},'Commit is switched on together with runs when the hub starts. Stop the hub and start it again with:'),h('code',{class:'cmd'},'npm run hub -- --runs')));return}
  if(p.error){listBox.append(h('p',{class:'soon'},p.error));return}
  const box=h('div',{class:'box'},h('div',{class:'label'},`Files changed since the last commit${p.head?` (${p.head.id})`:''}`));
  if(!p.files.length)box.append(h('p',{class:'small dim'},'Nothing has changed.'));
  for(const g of p.files){
   box.append(h('h3',{class:'cm-group'},`${g.group} · ${g.items.length}`));
   const ul=h('ul',{class:'cm-files'});
   for(const i of g.items){
    const cb=h('input',{type:'checkbox',checked:!unticked.has(i.path),id:'cm-'+i.path});
    cb.addEventListener('change',()=>{if(cb.checked)unticked.delete(i.path);else unticked.add(i.path);updateActions()});
    ul.append(h('li',{},h('label',{},cb,h('span',{class:'cm-kind k-'+i.kind},KIND[i.kind]||i.kind),h('code',{class:'cm-path'},i.path),i.from?h('span',{class:'small dim'},` (was ${i.from})`):null),...i.warn.map(w=>h('span',{class:'small warn cm-warn'},w))))}
   box.append(ul)}
  listBox.append(box);
  if(p.leftOut.length){
   listBox.append(h('div',{class:'box'},h('div',{class:'label'},`Left out, never committed (${p.leftOut.length})`),
    h('ul',{class:'cm-files cm-out'},p.leftOut.slice(0,100).map(o=>h('li',{title:o.reason},h('s',{class:'cm-path'},o.path),h('span',{class:'small dim'},' · '+o.reason)))),
    p.leftOut.length>100?h('p',{class:'small dim'},`and ${p.leftOut.length-100} more`):null))}}

 function drawPush(){
  pushBox.textContent='';
  if(!push||!push.enabled){pushBox.append(h('p',{class:'small dim'},'Push is off. Start the hub with: npm run hub -- --runs'));return}
  const n=push.count||0;
  pushBox.append(h('div',{class:'label'},n?`${plural(n,'commit')} ${n===1?'is':'are'} not on GitHub yet`:'Nothing waiting to be pushed'));
  if(push.branch)pushBox.append(h('p',{class:'small dim'},`Branch: ${push.branch}. This is what this PC knows; the hub never fetches, so GitHub may hold newer commits.`));
  if(n)pushBox.append(h('ul',{class:'cm-files'},push.commits.map(c=>h('li',{},h('code',{class:'cm-path'},c.id),' ',c.subject)),push.more?h('li',{class:'small dim'},`and ${push.more} more`):null));
  else if(push.why)pushBox.append(h('p',{class:'small dim'},push.why));
  if(pushedNote)pushBox.append(h('p',{class:'msg approved'},pushedNote));
  pushBox.append(h('p',{class:'small'},PUSH_NOTE),
   h('div',{class:'cm-actions'},h('button',{class:'btn pri',type:'button',disabled:!push.canPush||pushing||working,onclick:doPush},pushing?'Pushing…':pushButtonText(n)),
    pushing?h('span',{class:'small dim'},'Waiting for GitHub (up to 60 seconds)…'):(!push.canPush&&n&&push.why?h('span',{class:'small dim'},push.why):null)))}

 function draw(){
  top.textContent='';top.append(h('b',{},'NEXT STEP'),nextLine(p,push));
  drawTests();drawBanner();drawList();drawPush();updateActions()}

 async function load(force){
  clearTimeout(timer);
  const [next,ps,j]=await Promise.all([getJson('/api/commit/proposal'),getJson('/api/push/status'),getJson('/api/jobs')]);if(!alive)return;
  if(next&&!working){
   // the proposal is part of the signature (its hash covers the files and the head); the ticks and the message live outside it
   const s=JSON.stringify([next,ps,j&&[j.busy,j.running&&j.running.id,(j.jobs||[]).filter(x=>x.key==='test'||x.key==='check').map(x=>x.last&&x.last.endedAt)]]);
   if(force||s!==sig){sig=s;push=ps;jobs=j;applyProposal(next);draw()}}
  else if(!next){top.textContent='';top.append(h('b',{},'NEXT STEP'),'Could not read the changes. Is the hub still running?')}
  const fast=(j&&(j.running||j.busy))||pushing;
  timer=setTimeout(()=>{if(document.hidden)timer=setTimeout(load,4000);else load()},fast?2000:8000)}
 load(true);
 return stop}
