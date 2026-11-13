// Mikkadr Hub 2.8: Add from link. The pure rules for a link, a folder and a file name; the refusals of the script (every one happens before any network call or any file is written); the route of the hub; and the proof that a download stays inside assets-src.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkFetchUrl,cleanFolder,safeFileName,nameFrom,isPrivateAddress,sizeText,ALLOWED_EXT,MAX_BYTES,DEFAULT_FOLDER} from '../hub/web/fetch-rules.js';
import {createHubServer} from '../hub/server.js';
import {summarise,JOBS,tableProblems} from '../hub/jobs.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// links
assert.deepEqual(checkFetchUrl('https://grab3d.example/models/man.glb#top'),{ok:true,url:'https://grab3d.example/models/man.glb',host:'grab3d.example'},'a good link, without the part after #');
for(const bad of ['','   ','nonsense','http://x.example/a.glb','ftp://x.example/a.glb','https://localhost/a.glb','https://127.0.0.1/a.glb','https://192.168.1.2/a.glb','https://[::1]/a.glb','https://2130706433/a.glb','https://nas.local/a.glb','https://box.internal/a.glb','https://u:p@x.example/a.glb','https://x.example:8080/a.glb','https://x.example/a b.glb','https://nodots/a.glb','https://x.example/'+'a'.repeat(700)])assert.ok(checkFetchUrl(bad).error,'refused: '+bad.slice(0,50));
assert.ok(checkFetchUrl('https://x.example:443/a.glb').ok,'the normal port is fine');
// addresses
for(const ip of ['10.1.2.3','127.0.0.1','192.168.0.9','172.16.0.1','172.31.255.255','169.254.1.1','100.64.0.1','0.0.0.0','224.0.0.1','::1','::','fe80::1','fd12::1','::ffff:10.0.0.1','nonsense'])assert.equal(isPrivateAddress(ip),true,ip);
for(const ip of ['93.184.216.34','8.8.8.8','172.32.0.1','2606:4700:4700::1111'])assert.equal(isPrivateAddress(ip),false,ip);
// folders and names
assert.equal(cleanFolder(''),DEFAULT_FOLDER);assert.equal(cleanFolder('Characters/grab3d man'),'Characters/grab3d_man');assert.equal(cleanFolder('a\\b'),'a/b');assert.equal(cleanFolder('../x'),null);assert.equal(cleanFolder('a/b/c/d'),null,'at most 3 levels');assert.equal(cleanFolder('C:\\x'),null);assert.equal(cleanFolder('x'.repeat(50)),null);
assert.equal(safeFileName('man v2.glb'),'man v2.glb');assert.equal(safeFileName('../../evil.glb'),'evil.glb','never a path');assert.equal(safeFileName('run.exe'),null);assert.equal(safeFileName('noext'),null);assert.equal(safeFileName('.glb'),null);assert.equal(safeFileName('a.GLB'),'a.GLB');assert.equal(safeFileName('x.zip'),'x.zip');
assert.equal(nameFrom('attachment; filename="woman.glb"','/dl/1234'),'woman.glb','the name the site gives wins');assert.equal(nameFrom('','/models/man.fbx'),'man.fbx');assert.equal(nameFrom('attachment; filename="x.exe"','/a/b.glb'),'b.glb','a bad given name falls back to the address');assert.equal(nameFrom('','/'),null);
assert.ok(ALLOWED_EXT.includes('glb')&&!ALLOWED_EXT.includes('exe')&&!ALLOWED_EXT.includes('js')&&!ALLOWED_EXT.includes('html')&&!ALLOWED_EXT.includes('bat'),'no program and no page can be saved');assert.equal(MAX_BYTES,300*1024*1024);assert.equal(sizeText(1536*1024),'1.5 MB');

// the job and its summary
assert.deepEqual(tableProblems(JOBS),[]);assert.ok(JOBS['fetch-asset']&&JOBS['fetch-asset'].script==='scripts/fetch-asset.mjs'&&JOBS['fetch-asset'].args.length===0);
let s=summarise('fetch-asset','FETCHED '+JSON.stringify({path:'Characters/man.glb',bytes:1572864,host:'grab3d.example'}),0);assert.equal(s.ok,true);assert.equal(s.path,'Characters/man.glb');assert.match(s.text,/^Saved Characters\/man\.glb \(1\.5 MB\) from grab3d\.example\. It now appears under New files\.$/);
s=summarise('fetch-asset','REFUSED That link is a web page, not a file.',2);assert.equal(s.ok,false);assert.equal(s.refused,true);assert.match(s.text,/^Nothing was saved: That link is a web page/);assert.equal(summarise('fetch-asset','',1).ok,false);assert.equal(summarise('fetch-asset','FETCHED {"path":"a.glb"}',1).ok,false,'a non-zero exit never counts as saved');

// the script: each refusal comes before the network and before any file is written
{const reqFile=path.join(root,'.hub','fetch-request.json'),had=fs.existsSync(reqFile)?fs.readFileSync(reqFile,'utf8'):null,src=path.join(root,'assets-src'),before=fs.existsSync(src)?fs.readdirSync(src).sort().join('|'):null;fs.mkdirSync(path.join(root,'.hub'),{recursive:true});
 const run=()=>{const r=spawnSync(process.execPath,[path.join(root,'scripts','fetch-asset.mjs')],{cwd:root,encoding:'utf8',timeout:60000,windowsHide:true});return {code:r.status,out:String(r.stdout||'')}},put=o=>fs.writeFileSync(reqFile,JSON.stringify(o));
 try{try{fs.unlinkSync(reqFile)}catch{}
  let r=run();assert.equal(r.code,2);assert.match(r.out,/did not ask for a download/);
  put({url:'https://x.example/a.glb',at:Date.now()-6*60000});r=run();assert.match(r.out,/more than 5 minutes old/);assert.ok(!fs.existsSync(reqFile),'used up even when refused');
  put({url:'http://x.example/a.glb',at:Date.now()});r=run();assert.match(r.out,/Only https links/);
  put({url:'https://localhost/a.glb',at:Date.now()});r=run();assert.match(r.out,/Use the name of the site|own network/);
  put({url:'https://x.example/a.glb',folder:'../outside',at:Date.now()});r=run();assert.match(r.out,/folder name is not allowed/);
  assert.ok(r.out.startsWith('REFUSED'));assert.equal(fs.existsSync(src)?fs.readdirSync(src).sort().join('|'):null,before,'nothing was created in assets-src')
 }finally{if(had!==null)fs.writeFileSync(reqFile,had);else try{fs.unlinkSync(reqFile)}catch{}}
 const code=fs.readFileSync(path.join(root,'scripts','fetch-asset.mjs'),'utf8').replace(/\/\/.*$/gm,'');
 assert.ok(code.includes("redirect:'manual'")&&code.includes('MAX_REDIRECTS'),'redirects are followed by hand, each one checked');assert.ok(code.includes('isPrivateAddress')&&code.includes('dns.lookup'),'every address is resolved and must be public');assert.ok(!/credentials|cookie|Authorization/i.test(code),'no cookies and no login are sent');
 assert.ok(code.includes('existsSync(path.join(dir,final))'),'an existing file is never overwritten');assert.ok(code.includes('MAX_BYTES')&&code.includes('tooBig'),'the size limit is counted while it streams, not only from the header');assert.ok(code.indexOf("refuse('The hub did not ask")<code.indexOf('await fetch')&&code.indexOf('await vet(req.url)')<code.indexOf('fs.mkdirSync(dir'),'the checks come before the network and the folder');
 assert.ok(!/child_process|\bspawn|execFile|execSync/.test(code),'the download starts no process')}

// the hub's route
{const root2=fs.mkdtempSync(path.join(os.tmpdir(),'hub-fetch-'));fs.mkdirSync(path.join(root2,'.hub'));
 let started=0;const jobsStub={has:k=>k==='fetch-asset',last:()=>null,start:()=>{started++;return {job:{id:'job-20260101-000000-abcd'}}},list:()=>({running:null,jobs:[]}),active:()=>false},runsStub={checkToken:t=>t==='tk',locked:()=>false};
 const s2=createHubServer({root:root2,runs:runsStub,jobs:jobsStub}),p2=await s2.listen();
 const post=(body,h={'X-Hub-Token':'tk'})=>new Promise((res,rej)=>{const q=http.request({host:'127.0.0.1',port:p2,method:'POST',path:'/api/jobs/start',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:'+p2,...h}},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,body:JSON.parse(b||'{}')}))});q.on('error',rej);q.end(JSON.stringify(body))});
 try{
  assert.equal((await post({job:'fetch-asset',url:'http://x.example/a.glb'})).status,400);assert.equal((await post({job:'fetch-asset'})).status,400);assert.equal((await post({job:'fetch-asset',url:'https://localhost/a.glb'})).status,400);assert.equal((await post({job:'fetch-asset',url:'https://x.example/a.glb',folder:'../x'})).status,400);assert.equal(started,0);
  assert.equal((await post({job:'fetch-asset',url:'https://x.example/a.glb'},{})).status,403,'no token');assert.equal(started,0);
  assert.ok(!fs.existsSync(path.join(root2,'.hub','fetch-request.json')),'a refused request leaves no file');
  const r=await post({job:'fetch-asset',url:'https://grab3d.example/models/man.glb#x',folder:'Characters/grab3d man'});assert.equal(r.status,200);assert.equal(started,1);
  const rq=JSON.parse(fs.readFileSync(path.join(root2,'.hub','fetch-request.json'),'utf8'));assert.deepEqual([rq.url,rq.folder],['https://grab3d.example/models/man.glb','Characters/grab3d_man'],'the cleaned link and folder are what the script reads');assert.ok(Date.now()-rq.at<5000)
 }finally{await s2.close()}
 fs.rmSync(root2,{recursive:true,force:true})}
// the page
{const a=fs.readFileSync(path.join(root,'hub','web','assets-area.js'),'utf8');assert.ok(a.includes('Add from link')&&a.includes("job:'fetch-asset'")&&a.includes('checkFetchUrl'),'the Assets page has the box');assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(a))}
console.log('hub-fetch: the link, address, folder and file-name rules, the summary, every refusal of the script before any network or file, the route of the hub, and the page passed.');