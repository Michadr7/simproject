// P3: the usage probe

// Mikkadr Hub, P3: the usage probe. One tiny headless Claude Code call on Haiku (about 7,600 tokens, under a cent) whose only purpose is the rate_limit_event it prints.
// It is a model call, so it refuses to run unless the caller passes approved:true, which only an explicit user action may do (typing `npm run watcher -- --probe`,
// or a yes in the chat). Nothing else in the hub may call it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseRunOutput} from './watcher.js';

export const PROBE_MODEL='claude-haiku-5-5';
// claude.exe is not on PATH; the VS Code extension carries it. The folder name holds the version and changes when the extension updates, so look for the newest.
export function findClaude({env=process.env,exists=fs.existsSync,list=dir=>fs.readdirSync(dir)}={}){
 const home=env.USERPROFILE||os.homedir(),ext=path.join(home,'.vscode','extensions');
 try{const dirs=list(ext).filter(n=>/^anthropic\.claude-code-[\d.]+-win32-x64$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).reverse();
  for(const d of dirs){const exe=path.join(ext,d,'resources','native-binary','claude.exe');if(exists(exe))return exe}}catch{}
 return null}
// The environment a child run needs: this session's own CLAUDE* variables and ELECTRON_RUN_AS_NODE would make it behave as a child of this session.
export function cleanEnv(env=process.env){const out={};for(const [k,v] of Object.entries(env)){if(/^CLAUDE/i.test(k)||k==='ELECTRON_RUN_AS_NODE')continue;out[k]=v}return out}
export const probeArgs=()=>['-p','Reply with the single word: ok','--model',PROBE_MODEL,'--output-format','stream-json','--verbose','--max-budget-usd','0.05','--no-session-persistence','--tools='];

export function runProbe({approved=false,claudePath=findClaude(),spawnFn=spawn,timeoutMs=60000,now=Date.now}={}){
 if(approved!==true)return Promise.reject(new Error('The usage probe is a model call and needs the user\'s go-ahead (approved: true).'));
 if(!claudePath)return Promise.reject(new Error('claude.exe was not found. Is the Claude Code extension installed in VS Code?'));
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'mikkadr-probe-')); // an empty folder, so no project files are loaded into the run
 return new Promise((resolve,reject)=>{
  const child=spawnFn(claudePath,probeArgs(),{cwd,env:cleanEnv(),stdio:['ignore','pipe','pipe'],windowsHide:true});
  let out='',err='',done=false;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);try{fs.rmSync(cwd,{recursive:true,force:true})}catch{}fn(v)};
  const timer=setTimeout(()=>{try{child.kill()}catch{}finish(reject,new Error('The probe did not finish in time.'))},timeoutMs);
  child.stdout.on('data',d=>{out+=d});child.stderr.on('data',d=>{err+=d});
  child.on('error',e=>finish(reject,e));
  child.on('close',code=>{const {readings,result}=parseRunOutput(out);
   if(code!==0||!readings.length)return finish(reject,new Error(`The probe gave no reading (exit ${code}${result?.isError?': '+result.text:''}${err?': '+err.slice(0,160):''}).`));
   finish(resolve,{at:now(),source:'probe',...readings[readings.length-1],costUsd:result?.costUsd??null})})})}
