// Hub v2 V3: commit proposal (pure).

// Pure rules + package.json version read once at load (hub/git.mjs runs git, hub/commit-ctl.mjs joins the two).
// The hub proposes ONE batch commit: every file changed since the last commit, minus the forbidden paths, with a message made by script. Nothing here commits;
// the owner's press does, every time. Warnings never block: they show on the page and some files (unfinished runs, old dist/releases/* folders) start unticked.
import {createHash} from 'node:crypto';
import fs from 'node:fs';

const readPackageVersion=()=>{try{const j=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));return typeof j?.version==='string'&&j.version?j.version:null}catch{return null}};
export const PACKAGE_VERSION=readPackageVersion();

export const FORBIDDEN=['assets-src/','.claude/','.hub/','.dev.vars','simproject.code-workspace'];
export const MAX_MESSAGE=2000,MAX_FILE_BYTES=5*1024*1024,MAX_FILES=5000;
export const GROUPS=['Game','Releases','Tests','Hub','Plans','Notes','Assets','Other'];
export const HASH=/^[0-9a-f]{24}$/;
export const RELEASE_PATH=/^dist\/releases\/([^/]+)\//;
export const releaseVersionOf=p=>{const m=RELEASE_PATH.exec(String(p||''));return m?m[1]:null};
export function cmpSemver(a,b){const x=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(a||'')),y=/^(\d+)\.(\d+)\.(\d+)$/.exec(String(b||''));if(!x||!y)return String(a||'').localeCompare(String(b||''));for(let i=1;i<=3;i++){const d=Number(x[i])-Number(y[i]);if(d)return d<0?-1:1}return 0}
export function activeReleaseVersion(versions=[],currentVersion=PACKAGE_VERSION){if(typeof currentVersion==='string'&&currentVersion)return currentVersion;const list=[...new Set(versions.filter(Boolean))].sort(cmpSemver);return list.at(-1)||null}
const FORBIDDEN_DIRS=FORBIDDEN.filter(f=>f.endsWith('/')).map(f=>f.slice(0,-1).toLowerCase()).concat(['.git']);
const FORBIDDEN_FILES=FORBIDDEN.filter(f=>!f.endsWith('/')).map(f=>f.toLowerCase());

// A path git printed, as it is used here: forward slashes, relative, nothing that climbs out of the folder.
export const plainPath=p=>typeof p==='string'&&p.length>0&&p.length<=400&&!p.includes('\0')&&!p.includes('\\')&&!p.startsWith('/')&&!p.startsWith('-')&&!/^[A-Za-z]:/.test(p)&&!p.split('/').some(s=>s===''||s==='.'||s==='..');
// Why a path may never be committed from the hub, or null. Case-insensitive (Windows), and matched on every folder of the path, not only the first.
export function forbiddenReason(p){
 if(!plainPath(p))return 'not a plain path inside the project';
 const segs=p.toLowerCase().split('/'),base=segs[segs.length-1];
 if(segs.slice(0,-1).some(s=>FORBIDDEN_DIRS.includes(s))||FORBIDDEN_DIRS.includes(base))return 'private or local-only folder';
 if(FORBIDDEN_FILES.includes(base))return 'private or local-only file';
 if(base.startsWith('.env')||/\.(pem|key)$/.test(base))return 'looks like a secret (.env, .pem, .key)';
 return null}

// parseStatus: the output of `git status --porcelain=v1 -z --untracked-files=all`. One entry per path:
// {path, from?, x, y, kind: added|changed|deleted|renamed|untracked|conflict, staged}. -z means paths with spaces or odd letters come through unquoted; a rename carries its old path in the next field.
export function parseStatus(text){
 const parts=String(text||'').split('\0'),out=[];
 for(let i=0;i<parts.length;i++){
  const s=parts[i];if(s.length<4||s[2]!==' ')continue;
  const x=s[0],y=s[1],p=s.slice(3),e={path:p,x,y,kind:'changed',staged:x!==' '&&x!=='?'};
  if(x==='R'||x==='C'||y==='R'||y==='C'){e.from=parts[++i]||'';e.kind='renamed'}
  else if(x==='?'&&y==='?')e.kind='untracked';
  else if(x==='U'||y==='U'||(x==='A'&&y==='A')||(x==='D'&&y==='D'))e.kind='conflict';
  else if(x==='D'||y==='D')e.kind='deleted';
  else if(x==='A')e.kind='added';
  out.push(e)}
 return out}

export const groupOf=p=>/^dist\/releases\//.test(p)?'Releases':/^dist\/assets\//.test(p)||p==='assets-register.json'||p==='ASSETS.md'?'Assets':/^(dist|worker|launcher)\//.test(p)||p==='server.js'?'Game':/^tests\//.test(p)?'Tests':/^hub\//.test(p)||/^scripts\/hub-/.test(p)?'Hub':/^plans\//.test(p)?'Plans':/^[^/]+\.md$/i.test(p)||/^(docs|notes)\//.test(p)?'Notes':'Other';

const cut=(s,n)=>{s=String(s??'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n-1)+'…':s};
const mb=n=>(n/1048576).toFixed(1)+' MB';
const FINISHED=['done','closed'];

// The message, made by script from the titles of the steps finished since the last commit (runs that ended 'done' or 'closed' after it). No model.
export function suggestMessage({runs=[],head=null,files=0,groups={}}={}){
 const since=head&&Number.isFinite(head.time)?head.time:0,seen=new Set(),titles=[];
 for(const r of runs){if(!FINISHED.includes(r.status)||!(r.updatedAt>since))continue;const t=cut(r.planTitle,100);if(t&&!seen.has(t)){seen.add(t);titles.push(t)}}
 let m;
 if(titles.length===1)m=titles[0];
 else if(titles.length>1)m=`${cut(titles[0],70)} and ${titles.length-1} more step${titles.length===2?'':'s'}\n\n${titles.map(t=>'- '+t).join('\n')}`;
 else{const g=Object.entries(groups).filter(([,n])=>n>0).map(([k])=>k.toLowerCase()).join(', ');m=`Update ${files} file${files===1?'':'s'}${g?' ('+g+')':''}`}
 return m.slice(0,MAX_MESSAGE)}

// buildProposal: status entries (each may carry size and mtime from the caller), the run views, the last test result {ok, endedAt, text} or null, the head commit {id, time (ms), subject} or null.
// Returns {files:[{group, items}], leftOut, warnings, suggestedMessage, hash, counts, head}. `hash` covers the head commit and the status and size/time of every proposed file (never the left-out ones),
// so any change to the tree or the head makes an older proposal stale.
export function buildProposal({status=[],runs=[],lastTest=null,head=null,currentVersion=PACKAGE_VERSION}={}){
 const items=[],leftOut=[];
 const curVer=activeReleaseVersion(status.map(e=>releaseVersionOf(e.path)).filter(Boolean),currentVersion);
 for(const e of status){
  const why=e.kind==='conflict'?'unresolved merge conflict: finish it in GitHub Desktop':forbiddenReason(e.path)||(e.from&&forbiddenReason(e.from)?'renamed from a private path':null);
  if(why)leftOut.push({path:e.path,reason:why});
  else{const rel=releaseVersionOf(e.path),oldRelease=!!(rel&&curVer&&rel!==curVer);items.push({...e,group:groupOf(e.path),...(rel?{release:rel,oldRelease}:{}),warn:[],ticked:!oldRelease})}}
 // files a run that is not Finished has touched start unticked
 const open=runs.filter(r=>!FINISHED.includes(r.status));
 for(const it of items){const r=open.find(x=>(x.flagged||[]).includes(it.path));if(r){it.ticked=false;it.warn.push(`A run is not finished: ${cut(r.planTitle,60)}`)}}
 for(const it of items)if(Number.isFinite(it.size)&&it.size>MAX_FILE_BYTES)it.warn.push(`Large file: ${mb(it.size)}`);
 const activeItems=items.some(i=>!i.oldRelease)?items.filter(i=>!i.oldRelease):items;
 const warnings=[];
 if(items.length){
  const newest=activeItems.reduce((m,i)=>Number.isFinite(i.mtime)&&i.mtime>m?i.mtime:m,0);
  if(!lastTest)warnings.push({kind:'tests',text:'The tests have not been run from the hub yet.'});
  else if(!lastTest.ok)warnings.push({kind:'tests',text:'The last test run failed. Fix it, or commit knowing it fails.'});
  else if(lastTest.endedAt<newest)warnings.push({kind:'tests',text:'A file changed after the last passing test run. Run the tests again first.'});
  for(const it of items)if(it.warn.some(w=>w.startsWith('Large')))warnings.push({kind:'big',text:`${it.path}: ${it.warn.find(w=>w.startsWith('Large'))}`,path:it.path});
  const openFiles=items.filter(i=>i.warn.some(w=>w.startsWith('A run')));
  if(openFiles.length)warnings.push({kind:'run',text:`${openFiles.length} file${openFiles.length===1?'':'s'} touched by a run that is not finished ${openFiles.length===1?'is':'are'} unticked.`,paths:openFiles.map(i=>i.path)})}
 const files=GROUPS.map(g=>({group:g,items:items.filter(i=>i.group===g).sort((a,b)=>a.path.localeCompare(b.path))})).filter(g=>g.items.length);
 const groups=Object.fromEntries(files.map(g=>[g.group,g.items.length]));
 const msgGroups=Object.fromEntries(GROUPS.map(g=>[g,activeItems.filter(i=>i.group===g).length]).filter(([,n])=>n>0));
 const relMap=new Map();for(const it of items)if(it.release)relMap.set(it.release,(relMap.get(it.release)||0)+1);
 const releases=[...relMap.entries()].map(([version,n])=>({version,current:!!(curVer&&version===curVer),files:n})).sort((a,b)=>(b.current-a.current)||cmpSemver(b.version,a.version));
 const hash=createHash('sha256').update(JSON.stringify([head?head.id:null,items.map(i=>[i.x,i.y,i.path,i.from||null,i.size??null,Number.isFinite(i.mtime)?Math.round(i.mtime):null]).sort((a,b)=>a[2]<b[2]?-1:a[2]>b[2]?1:0)])).digest('hex').slice(0,24);
 return {files,leftOut,warnings,suggestedMessage:suggestMessage({runs,head,files:activeItems.length,groups:msgGroups}),hash,counts:{files:items.length,leftOut:leftOut.length,groups},currentVersion:curVer,releases,head}}

export const proposalPaths=p=>(p.files||[]).flatMap(g=>g.items.map(i=>i.path));

// The message the owner typed: 1 to 2,000 characters, no NUL. Returns an error sentence or null.
export const messageProblem=m=>typeof m!=='string'||!m.trim()?'Write a commit message first.':m.length>MAX_MESSAGE?`The message is too long (at most ${MAX_MESSAGE.toLocaleString('en-US')} characters).`:m.includes('\0')?'The message holds a character that is not allowed.':null;

// checkSelection: the paths the owner ticked against the proposal's own list. Every path must be in the proposal and not forbidden; nothing else ever reaches git.
// Returns {error} or {paths (as ticked), gitPaths (a rename also names its old path), toAdd (paths that still need `add`: not already staged in full)}.
export function checkSelection(proposal,wanted){
 if(!Array.isArray(wanted)||!wanted.length)return {error:'Tick at least one file.'};
 if(wanted.length>MAX_FILES)return {error:'Too many files in one commit.'};
 const byPath=new Map((proposal.files||[]).flatMap(g=>g.items).map(i=>[i.path,i])),paths=[],seen=new Set();
 for(const w of wanted){
  if(typeof w!=='string')return {error:'A file name is not text.'};
  const it=byPath.get(w);
  if(!it||forbiddenReason(w))return {error:`${typeof w==='string'?w.slice(0,120):'That file'} is not one of the files the hub proposed.`};
  if(seen.has(w))continue;seen.add(w);paths.push(w)}
 const sel=paths.map(p=>byPath.get(p)),gitPaths=[...new Set(sel.flatMap(i=>i.from?[i.path,i.from]:[i.path]))];
 if(gitPaths.some(p=>forbiddenReason(p)))return {error:'A file is on the never-commit list.'};
 return {paths,gitPaths,toAdd:sel.filter(i=>i.y!==' ').map(i=>i.path)}}
