// Mikkadr Hub 2.7.4: the hub starts. Boots a copy of the hub folder in a temporary project (so the real .hub data is never touched), with runs switched on, asks it who it is, and stops it.
// This is the test that would have caught a reference to a variable that only exists inside the --runs block (the hub died at start with "claude is not defined"). No model call is made.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {killTree} from '../hub/runner.js';
const real=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-boot-'));
fs.cpSync(path.join(real,'hub'),path.join(tmp,'hub'),{recursive:true,filter:s=>!/[\\/]hub[\\/]design(?:[\\/]|$)/.test(s)});
fs.writeFileSync(path.join(tmp,'package.json'),JSON.stringify({name:'boot-test',version:'0.0.1'}));
const free=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p))})});
const get=p=>new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:free,path:p,timeout:3000},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,body:b}))}).on('error',rej)});
const child=spawn(process.execPath,[path.join(tmp,'hub','hub-cli.mjs'),'--child','--runs','--port='+free],{cwd:tmp,stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,HUB_SUPERVISED:''}});
let out='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);
let exited=null;child.on('close',c=>{exited=c});
try{
 let id=null;for(let i=0;i<60&&exited===null&&!id;i++){await new Promise(r=>setTimeout(r,250));try{const r=await get('/api/hub-id');if(r.status===200)id=JSON.parse(r.body)}catch{}}
 assert.ok(id,'the hub answered within 15 seconds. Its output: '+out.slice(0,600));assert.equal(exited,null,'and is still running');
 const {HUB_VERSION}=await import('../hub/web/shell.js');assert.equal(id.version,HUB_VERSION);
 const tok=JSON.parse((await get('/api/hub-token')).body);assert.equal(tok.runs,true,'runs are on');assert.equal(tok.chat,true);
 assert.equal((await get('/api/jobs')).status,200);assert.equal((await get('/api/activity')).status,200);assert.equal((await get('/tokens')).status,200);assert.match((await get('/')).body,/Mikkadr Hub/);
 assert.ok(!/ReferenceError|is not defined|Could not start/.test(out),'no start-up error: '+out.slice(0,400));
}finally{try{await killTree(child.pid)}catch{}fs.rmSync(tmp,{recursive:true,force:true})}
console.log('hub-boot: the hub folder starts with runs on, answers who it is, hands out its token, serves the jobs, activity, tokens and home pages, and prints no start-up error passed.');