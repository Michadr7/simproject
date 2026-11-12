// Hub v2 V3: git, a fixed command list.

// The only file in the hub that starts git. It uses GitHub Desktop's git.exe (git is not on PATH), through execFile: no shell, the repo root as the folder.
// Only the command shapes in ALLOWED exist; anything else throws before a process starts, and every path is checked against the never-commit list on top of the proposal check in commit-ctl.mjs.
// Push is the one command that can wait on a network: it has a 60 s limit and GIT_TERMINAL_PROMPT=0, so it can never sit on a password prompt. Nothing here talks to a model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFile,execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {forbiddenReason,plainPath} from './commit.js';

export const PUSH_LIMIT_MS=60000,READ_LIMIT_MS=20000,MAX_OUT=8*1024*1024;
const BRANCH=/^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$/;
export const safeBranch=b=>typeof b==='string'&&BRANCH.test(b)&&!b.includes('..')&&!b.endsWith('/')&&!b.endsWith('.lock');
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const goodPaths=a=>a.length>0&&a.every(p=>plainPath(p)&&!forbiddenReason(p));

// The whole command list. READ shapes may also run synchronously (they are quick and only look).
const READ=[
 a=>same(a,['status','--porcelain=v1','-z','--untracked-files=all']),
 a=>same(a,['rev-parse','--short','HEAD']),
 a=>same(a,['log','-5','--format=%h%x09%ct%x09%s']),
 a=>same(a,['rev-parse','--abbrev-ref','HEAD']),
 a=>same(a,['branch','-r','--contains','HEAD']),
 a=>a.length===3&&a[0]==='log'&&a[2]==='--format=%h%x09%s'&&/^origin\/(.+)\.\.HEAD$/.test(a[1])&&safeBranch(/^origin\/(.+)\.\.HEAD$/.exec(a[1])[1])];
const WRITE=[
 a=>a[0]==='add'&&a[1]==='--'&&goodPaths(a.slice(2)),
 a=>a[0]==='commit'&&a[1]==='-F'&&typeof a[2]==='string'&&a[2].length>0&&a[3]==='--'&&goodPaths(a.slice(4)),
 a=>same(a,['reset','--soft','HEAD~1']),
 a=>a.length===3&&a[0]==='push'&&a[1]==='origin'&&safeBranch(a[2])];
export const isReadCommand=a=>Array.isArray(a)&&a.every(x=>typeof x==='string')&&READ.some(f=>f(a));
export const isAllowed=a=>isReadCommand(a)||(Array.isArray(a)&&a.every(x=>typeof x==='string')&&WRITE.some(f=>f(a)));

// GitHub Desktop's git: the newest app-* folder under %LOCALAPPDATA%\GitHubDesktop that has resources\app\git\cmd\git.exe. null when there is none.
export function findGit({localAppData=process.env.LOCALAPPDATA,fsApi=fs}={}){
 if(!localAppData)return null;
 const base=path.join(localAppData,'GitHubDesktop');let names=[];try{names=fsApi.readdirSync(base)}catch{return null}
 const ver=n=>(/^app-(\d+(?:\.\d+)*)/.exec(n)||[,''])[1].split('.').map(Number);
 const apps=names.filter(n=>/^app-\d/.test(n)).sort((a,b)=>{const x=ver(a),y=ver(b);for(let i=0;i<Math.max(x.length,y.length);i++){const d=(y[i]||0)-(x[i]||0);if(d)return d}return 0});
 for(const n of apps){const exe=path.join(base,n,'resources','app','git','cmd','git.exe');if(fsApi.existsSync(exe))return exe}
 return null}

const childEnv=(extra={})=>({...process.env,GIT_TERMINAL_PROMPT:'0',GIT_LITERAL_PATHSPECS:'1',GCM_INTERACTIVE:'never',GIT_OPTIONAL_LOCKS:'0',...extra});
const tail=(s,n=300)=>{const t=String(s||'').replace(/\r/g,'').trim().split('\n').filter(Boolean).slice(-4).join(' ').replace(/\s+/g,' ');return t.length>n?t.slice(0,n-1)+'…':t};

// What a failed push means in plain words. kind: 'behind' (GitHub has newer commits), 'auth' (sign-in), 'timeout', 'other'.
export function pushProblem({stderr='',timedOut=false}){
 const s=String(stderr);
 if(timedOut)return {kind:'timeout',text:'GitHub did not answer within 60 seconds, so the push was cancelled. Nothing was sent. Try again, or push from GitHub Desktop.'};
 if(/non-fast-forward|fetch first|\[rejected\]|updates were rejected|tip of your current branch is behind/i.test(s))return {kind:'behind',text:'GitHub has newer commits than this PC. The hub will not fetch, pull or merge. Open GitHub Desktop, bring the newer commits in there, then push.'};
 if(/authentication failed|could not read (username|password)|terminal prompts disabled|invalid credentials|403|permission denied|no credentials|logon failed|bad credentials/i.test(s))return {kind:'auth',text:'GitHub did not accept the sign-in from the hub. Push from GitHub Desktop instead, which is signed in.'};
 return {kind:'other',text:'The push did not work: '+(tail(s)||'git gave no reason')+'. You can push from GitHub Desktop instead.'}}

export function createGit({root,gitPath=findGit(),timeoutMs=READ_LIMIT_MS,pushMs=PUSH_LIMIT_MS,execFileFn=execFile,execSyncFn=execFileSync}){
 const have=!!gitPath;
 const guard=(args,read)=>{if(!have)throw new Error('git was not found');if(!(read?isReadCommand(args):isAllowed(args)))throw new Error('That git command is not one the hub may run')};
 // sync: only for the read shapes
 const readSync=args=>{guard(args,true);try{return {ok:true,stdout:String(execSyncFn(gitPath,args,{cwd:root,env:childEnv(),encoding:'utf8',timeout:timeoutMs,maxBuffer:MAX_OUT,windowsHide:true,stdio:['ignore','pipe','pipe']}))}}catch(e){return {ok:false,stdout:String(e.stdout||''),stderr:tail(e.stderr||e.message),code:e.status??-1}}};
 const run=(args,{limit=timeoutMs}={})=>{guard(args,false);return new Promise(ok=>{
  execFileFn(gitPath,args,{cwd:root,env:childEnv(),encoding:'utf8',timeout:limit,maxBuffer:MAX_OUT,windowsHide:true},(e,stdout,stderr)=>ok({ok:!e,stdout:String(stdout||''),stderr:String(stderr||''),code:e?(e.code??-1):0,timedOut:!!(e&&(e.killed||e.signal))}))})};
 const lines=t=>String(t||'').split('\n').map(l=>l.replace(/\r$/,'')).filter(Boolean);

 return {
  available:have,gitPath,
  status(){const r=readSync(['status','--porcelain=v1','-z','--untracked-files=all']);return r.ok?{stdout:r.stdout}:{error:'git could not read the status: '+r.stderr}},
  // {id, time (ms), subject} of HEAD, or null for a repository with no commit yet
  head(){const r=readSync(['log','-5','--format=%h%x09%ct%x09%s']);if(!r.ok)return null;const l=lines(r.stdout)[0];if(!l)return null;const [id,t,...s]=l.split('\t');return {id,time:Number(t)*1000,subject:s.join('\t')}},
  recent(){const r=readSync(['log','-5','--format=%h%x09%ct%x09%s']);return r.ok?lines(r.stdout).map(l=>{const [id,t,...s]=l.split('\t');return {id,time:Number(t)*1000,subject:s.join('\t')}}):[]},
  branch(){const r=readSync(['rev-parse','--abbrev-ref','HEAD']);return r.ok?lines(r.stdout)[0]||null:null},
  // true when some remote branch already holds HEAD (so an undo would rewrite shared history)
  onRemote(){const r=readSync(['branch','-r','--contains','HEAD']);return r.ok?lines(r.stdout).length>0:true},
  // the commits on this branch that origin/<branch> does not have: [{id, subject}], or {error} when the remote branch is not known here
  ahead(b){if(!safeBranch(b))return {error:'branch'};const r=readSync(['log',`origin/${b}..HEAD`,'--format=%h%x09%s']);return r.ok?{commits:lines(r.stdout).map(l=>{const [id,...s]=l.split('\t');return {id,subject:s.join('\t')}})}:{error:'no-remote'}},
  async add(paths){const r=await run(['add','--',...paths]);return r.ok?{ok:true}:{ok:false,text:tail(r.stderr)||'git could not stage the files'}},
  // The message goes through a temp file (never the command line), written without a BOM and removed afterwards.
  async commit(message,paths){
   const file=path.join(os.tmpdir(),`hub-commit-${randomBytes(6).toString('hex')}.txt`);
   try{fs.writeFileSync(file,String(message).replace(/\r\n/g,'\n').replace(/\s+$/,'')+'\n','utf8');
    const r=await run(['commit','-F',file,'--',...paths]);
    if(r.ok)return {ok:true};
    const e=tail(r.stderr+' '+r.stdout);
    return {ok:false,text:/please tell me who you are|unable to auto-detect email|empty ident/i.test(r.stderr)?'Git has no name or email set for this project. Commit once from GitHub Desktop, or set them, then try again.':e||'git did not make the commit'}
   }finally{try{fs.unlinkSync(file)}catch{}}},
  async undo(){const r=await run(['reset','--soft','HEAD~1']);return r.ok?{ok:true}:{ok:false,text:tail(r.stderr)||'git could not undo the commit'}},
  async push(b){const r=await run(['push','origin',b],{limit:pushMs});return r.ok?{ok:true}:{ok:false,...pushProblem(r)}}}}
