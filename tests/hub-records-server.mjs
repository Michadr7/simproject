// Hub v2 V4: asset record routes and the master

// The four routes (token, origin, content type, size, unknown fields, refusals, 409 on undo), run WITHOUT --runs, and a master turn on the fake CLI whose reply carries RECORD: lines:
// applied at once by 'master', the cap of 6, lines below PLAN: ignored, refusals shown, Undo through the route. Temporary folders only; the real assets-register.json is read, never written.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRecords} from '../hub/records-store.mjs';
import {createChat} from '../hub/chat.js';
import {createHubServer,resolveRoute,MAX_BODY} from '../hub/server.js';
import {statusText} from '../hub/status.js';
import {formatRegister} from '../hub/records.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),REPO=path.resolve(HERE,'..'),FAKE=path.join(HERE,'fixtures','fake-claude.mjs');
const realText=fs.readFileSync(path.join(REPO,'assets-register.json'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};

// ── resolveRoute
for(const [p,api,write] of [['/api/assets/file','assets-file',true],['/api/assets/summary','assets-summary',false],['/api/assets/add','assets-add',true],['/api/assets/stage','assets-stage',true],['/api/records/undo','records-undo',true]]){const r=resolveRoute('/r',p,'127.0.0.1:1',1);assert.equal(r.api,api);assert.equal(!!r.write,write)}
assert.equal(resolveRoute('/r','/api/assets/other','127.0.0.1:1',1).status,404);assert.equal(resolveRoute('/r','/api/assets/add/','127.0.0.1:1',1).status,404);assert.equal(resolveRoute('/r','/api/records','127.0.0.1:1',1).status,404);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-records-srv-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
fs.writeFileSync(path.join(root,'assets-register.json'),realText);
const regFile=path.join(root,'assets-register.json'),regText=()=>fs.readFileSync(regFile,'utf8'),regJson=()=>JSON.parse(regText());
const records=createRecords({root,load:async()=>({assets:[{origin:'module',id:'prop:a',name:'A',stage:'in-game',hasCredit:true,licence:'CC0'}]}),originals:async()=>['Incoming/oak_tree.glb']});
const srv=createHubServer({root,records}),port=await srv.listen(); // no runs, no chat: the record routes still work
const raw=(method,url,body,headers={},opts={})=>new Promise((ok,fail)=>{const data=body===undefined?null:Buffer.from(body);const h={Host:`127.0.0.1:${port}`,...(data&&opts.origin!==false?{Origin:`http://127.0.0.1:${port}`}:{}),...(data?{'Content-Length':data.length}:{}),...headers};const req=http.request({host:'127.0.0.1',port,method,path:url,headers:h},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(t)}catch{}ok({status:res.statusCode,json:j,text:t})})});req.on('error',fail);if(data)req.write(data);req.end()});
const T=()=>({'X-Hub-Token':records.token,'Content-Type':'application/json'});
const post=(u,b)=>raw('POST',u,JSON.stringify(b),T());

try{
 // the token comes without --runs
 let r=await raw('GET','/api/hub-token');assert.equal(r.json.records,true);assert.equal(r.json.recordsToken,records.token);assert.equal(r.json.token,null,'no run token');assert.equal(r.json.runs,false);
 // the guard: token, origin, content type, size, JSON
 const body=JSON.stringify({name:'Oak tree',kind:'model'});
 assert.equal((await raw('POST','/api/assets/add',body,{'Content-Type':'application/json'})).status,403,'no token');
 assert.equal((await raw('POST','/api/assets/add',body,{'Content-Type':'application/json','X-Hub-Token':'wrong'})).status,403,'wrong token');
 assert.equal((await raw('POST','/api/assets/add',body,{'Content-Type':'application/json','X-Hub-Token':records.token.slice(0,-1)})).status,403,'short token');
 assert.equal((await raw('POST','/api/assets/add',body,T(),{origin:false})).status,403,'no Origin');
 assert.equal((await raw('POST','/api/assets/add',body,{...T(),Origin:'http://evil.example'})).status,403,'foreign Origin');
 assert.equal((await raw('POST','/api/assets/add',body,{...T(),'Content-Type':'text/plain'})).status,415);
 assert.equal((await raw('POST','/api/assets/add','{ not json',T())).status,400);assert.equal((await raw('POST','/api/assets/add','[1]',T())).status,400);
 assert.equal((await raw('POST','/api/assets/add',JSON.stringify({name:'Oak tree',kind:'model',note:'x'.repeat(MAX_BODY)}),T())).status,413,'over 64 KB');
 assert.equal((await raw('GET','/api/assets/add')).status,405,'POST only');assert.equal((await raw('POST','/api/assets/summary','{}',T())).status,405,'summary is GET only');
 assert.equal(regText(),realText,'nothing above wrote anything');
 // add
 r=await post('/api/assets/add',{name:'Oak tree',kind:'model',stage:'received',source:'https://example.com/oak',licence:'CC0',note:'n'});assert.equal(r.status,200,r.text);
 assert.equal(r.json.row.id,'oak-tree');assert.equal(r.json.change.by,'you');assert.equal(r.json.change.label,'Added Oak tree (received)');const addId=r.json.change.id;
 assert.equal(regJson().assets.at(-1).id,'oak-tree');assert.equal(regText(),formatRegister(regJson()));
 // refusals, each leaves the file as it is
 const keep=regText();
 const bad=[['/api/assets/add',{name:'Oak tree',kind:'model'},409],['/api/assets/add',{name:'../../etc/passwd',kind:'model'},400],['/api/assets/add',{name:'C:\\x.glb',kind:'model'},400],['/api/assets/add',{name:'x'.repeat(81),kind:'model'},400],
  ['/api/assets/add',{name:'Q',kind:'weapon'},400],['/api/assets/add',{name:'Q',kind:'model',stage:'in-game'},400],['/api/assets/add',{name:'Q',kind:'model',stage:'converted'},400],['/api/assets/add',{name:'Q',kind:'model',source:'file:///C:/x'},400],['/api/assets/add',{name:'Q',kind:'model',source:'javascript:alert(1)'},400],
  ['/api/assets/add',{name:'Q\u0000',kind:'model'},400],['/api/assets/add',{name:'Q',kind:'model',licence:'y'.repeat(81)},400],['/api/assets/add',{name:'Q',kind:'model',note:'y'.repeat(301)},400],['/api/assets/add',{name:5,kind:'model'},400],['/api/assets/add',{name:'Q',kind:['model']},400],['/api/assets/add',{},400],
  ['/api/assets/stage',{id:'ghost',stage:'staged'},404],['/api/assets/stage',{id:'constructor',stage:'staged'},404],['/api/assets/stage',{id:'__proto__',stage:'staged'},400],['/api/assets/stage',{id:'oak-tree',stage:'converted'},400],['/api/assets/stage',{id:'oak-tree',stage:'in-game'},400],['/api/assets/stage',{id:'oak-tree',stage:'credited'},400],
  ['/api/assets/stage',{id:'oak-tree',stage:'received'},409],['/api/assets/stage',{id:5,stage:'staged'},400],['/api/assets/stage',{id:'../x',stage:'staged'},400],['/api/assets/stage',{stage:'staged'},400],['/api/assets/stage',{id:'oak-tree',stage:'staged',extra:1},400],
  ['/api/records/undo',{id:'../x'},400],['/api/records/undo',{id:5},400],['/api/records/undo',{},400],['/api/records/undo',{id:addId,extra:1},400],['/api/records/undo',{id:'rec-zzzzzz-0000'},404]];
 for(const [u,b,code] of bad){const x=await post(u,b);assert.equal(x.status,code,`${u} ${JSON.stringify(b).slice(0,80)}: ${x.text}`);assert.ok(x.json&&x.json.error)}
 for(const [u,text] of [['/api/assets/add','{"name":"Q","kind":"model","__proto__":{"polluted":1}}'],['/api/assets/add','{"name":"Q","kind":"model","constructor":{"prototype":{"polluted":1}}}'],['/api/assets/stage','{"id":"oak-tree","stage":"staged","__proto__":1}'],['/api/records/undo','{"__proto__":{"id":"x"}}']]){
  const x=await raw('POST',u,text,T());assert.equal(x.status,400,u+' '+text);assert.match(x.json.error,/Unknown field/)}
 assert.equal({}.polluted,undefined,'no prototype pollution');assert.equal(regText(),keep,'a refused request writes nothing');
 // stage and undo
 r=await post('/api/assets/stage',{id:'oak-tree',stage:'staged'});assert.equal(r.status,200,r.text);assert.equal(r.json.row.stage,'staged');const moveId=r.json.change.id;
 let s=await raw('GET','/api/assets/summary');assert.equal(s.status,200);assert.equal(s.json.enabled,true);assert.equal(s.json.stages.staged,1);assert.equal(s.json.stages['in-game'],1);assert.equal(s.json.stages.credited,1);
 assert.equal(s.json.rows.find(x=>x.id==='oak-tree').undo,moveId);assert.equal(s.json.records[0].id,moveId);assert.equal(s.json.newFiles.items[0].candidates[0].id,'oak-tree');assert.ok(JSON.stringify(s.json).length<30000);
 assert.equal((await post('/api/records/undo',{id:addId})).status,409,'the add cannot be undone while the move is on top');
 r=await post('/api/records/undo',{id:moveId});assert.equal(r.status,200,r.text);assert.equal(regJson().assets.at(-1).stage,'received');
 assert.equal((await post('/api/records/undo',{id:moveId})).status,409,'already undone');
 fs.writeFileSync(regFile,regText().replace('"notes":"n"','"notes":"edited in VS Code"'));
 r=await post('/api/records/undo',{id:addId});assert.equal(r.status,409,'the row changed after the record');assert.match(r.json.error,/changed/);assert.equal(regJson().assets.at(-1).notes,'edited in VS Code','and the edit is still there');

 // V4b: attach a file from assets-src/ to a row
 s=await raw('GET','/api/assets/summary');assert.equal(s.json.newFiles.total,1);
 const keepF=regText();
 for(const [b,code] of [[{id:'oak-tree',file:'Incoming/other.glb'},404],[{id:'oak-tree',file:'../Incoming/oak_tree.glb'},400],[{id:'oak-tree',file:'C:\\x.glb'},400],[{id:'oak-tree',file:'Incoming/oak_tree.txt'},400],[{id:'ghost',file:'Incoming/oak_tree.glb'},404],[{id:'__proto__',file:'Incoming/oak_tree.glb'},400],[{id:'oak-tree'},400],[{file:'Incoming/oak_tree.glb'},400],[{id:'oak-tree',file:5},400],[{id:'oak-tree',file:'Incoming/oak_tree.glb',extra:1},400]]){const x=await post('/api/assets/file',b);assert.equal(x.status,code,JSON.stringify(b)+' '+x.text)}
 const xp=await raw('POST','/api/assets/file','{"id":"oak-tree","file":"Incoming/oak_tree.glb","__proto__":{"x":1}}',T());assert.equal(xp.status,400);
 assert.equal((await raw('POST','/api/assets/file',JSON.stringify({id:'oak-tree',file:'Incoming/oak_tree.glb'}),{'Content-Type':'application/json'})).status,403,'no token');
 assert.equal(regText(),keepF,'refused attachments write nothing');
 r=await post('/api/assets/file',{id:'oak-tree',file:'Incoming/oak_tree.glb'});assert.equal(r.status,200,r.text);assert.equal(r.json.change.label,'Attached oak_tree.glb to Oak tree');assert.deepEqual(regJson().assets.at(-1).files,['Incoming/oak_tree.glb']);const attId=r.json.change.id;
 assert.equal((await post('/api/assets/file',{id:'oak-tree',file:'Incoming/oak_tree.glb'})).status,409,'a file goes to one row');
 s=await raw('GET','/api/assets/summary');assert.equal(s.json.newFiles.total,0,'the attached file is no longer new');assert.deepEqual(s.json.rows.find(x=>x.id==='oak-tree').files,['Incoming/oak_tree.glb']);
 assert.equal((await post('/api/records/undo',{id:attId})).status,200);assert.deepEqual(regJson().assets.at(-1).files,[]);assert.equal((await post('/api/records/undo',{id:attId})).status,409);
 // without records the routes say so
 const noRec=createHubServer({root}),p2=await noRec.listen();
 const off=await new Promise(ok=>{const d=JSON.stringify({name:'A',kind:'model'});const q=http.request({host:'127.0.0.1',port:p2,method:'POST',path:'/api/assets/add',headers:{Host:`127.0.0.1:${p2}`,Origin:`http://127.0.0.1:${p2}`,'Content-Type':'application/json','Content-Length':d.length,'X-Hub-Token':'x'}},res=>{res.resume();res.on('end',()=>ok(res.statusCode))});q.end(d)});
 assert.equal(off,503);
 const sum=await new Promise(ok=>http.get({host:'127.0.0.1',port:p2,path:'/api/assets/summary',headers:{Host:`127.0.0.1:${p2}`}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok(JSON.parse(t)))}));assert.deepEqual(sum,{enabled:false});
 await noRec.close();
}finally{await srv.close()}

// ── the master: RECORD: lines in a reply (fake CLI)
{
 fs.writeFileSync(regFile,realText);
 fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:20,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
 const env={HUB_FAKE_SCENARIO:'master',HUB_FAKE_OUT:path.join(root,'fake-out.json')};
 const recs=createRecords({root,load:async()=>({assets:[]}),originals:async()=>['Incoming/oak_tree.glb']});
 const chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,records:recs});
 const idle=()=>waitFor(()=>!chat.working());
 const say=async(reply)=>{env.HUB_FAKE_REPLY=reply;assert.ok(chat.send({text:'we are adding assets'}).chat);await idle();return chat.view().messages.at(-1)};
 const rowsNow=()=>JSON.parse(fs.readFileSync(regFile,'utf8')).assets;
 const logOf=()=>fs.existsSync(path.join(root,'.hub','records.jsonl'))?fs.readFileSync(path.join(root,'.hub','records.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l)):[];
 const n0=rowsNow().length;

 // the status block tells the master the stages and the row ids
 const status=statusText({root,records:recs});assert.match(status,/Assets: wanted \d+, received \d+, staged \d+/);assert.match(status,/Asset rows \(id stage;/);
 await sleep(30);assert.match(statusText({root,records:recs}),/converted \d+, in game \d+, credited \d+/,'the shipped counts arrive once the slow part is read');

 // a good reply: two records, a junk line, a bad kind, a stage for an id that is not in the register, a try at converted
 const target=rowsNow().find(r=>!r.covers&&r.stage==='received');
 let m=await say(['Adding them now.','RECORD: asset add name="Oak tree" kind=model stage=wanted source="https://example.com/oak"','RECORD: asset add name="Elm tree" kind=model stage=received',`RECORD: asset stage ${target.id} staged`,'RECORD: asset stage ghost-row staged','RECORD: asset add name="Axe" kind=weapon',`RECORD: asset stage ${target.id} converted`,'RECORD: delete everything','ACTION: test'].join('\n'));
 assert.equal(m.role,'master');
 assert.equal(m.records.length,3,JSON.stringify(m));assert.deepEqual(m.records.map(x=>x.text),['Recorded: Oak tree → wanted','Recorded: Elm tree → received',`Recorded: ${target.name} → staged`]);
 assert.equal(m.recordErrors.length,1);assert.match(m.recordErrors[0],/ghost-row.*No asset with that id/);
 assert.equal(m.notUnderstood.length,3);assert.ok(m.notUnderstood.some(t=>/weapon|kind/.test(t)));assert.ok(m.notUnderstood.some(t=>/converted|stage must be/.test(t)));assert.ok(m.notUnderstood.some(t=>/delete everything/.test(t)));
 assert.deepEqual(m.actions,[{op:'test'}],'ACTION lines still work next to RECORD lines');
 assert.equal(rowsNow().length,n0+2);assert.equal(rowsNow().find(r=>r.id===target.id).stage,'staged');assert.ok(!rowsNow().some(r=>r.stage==='converted'||r.stage==='in-game'&&!r.covers&&r.id==='oak-tree'),'the master set no converted or in-game row');
 assert.deepEqual(logOf().slice(-3).map(x=>x.by),['master','master','master'],'every record says it came from the master');assert.deepEqual(m.records.map(x=>x.id),logOf().slice(-3).map(x=>x.id),'the message keeps the change ids');
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.hub','chat.json'),'utf8')).messages.at(-1).records.length,3,'saved with the chat');
 // Undo through the same route the page uses
 const srv2=createHubServer({root,records,chat:null}),port2=await srv2.listen();
 const undoVia=id=>new Promise(ok=>{const d=JSON.stringify({id});const q=http.request({host:'127.0.0.1',port:port2,method:'POST',path:'/api/records/undo',headers:{Host:`127.0.0.1:${port2}`,Origin:`http://127.0.0.1:${port2}`,'Content-Type':'application/json','Content-Length':d.length,'X-Hub-Token':records.token}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,json:JSON.parse(t)}))});q.end(d)});
 try{
  assert.equal((await undoVia(m.records[2].id)).status,200);assert.equal(rowsNow().find(r=>r.id===target.id).stage,'received');
  assert.equal((await undoVia(m.records[2].id)).status,409);
  assert.equal((await undoVia(m.records[1].id)).status,200);assert.equal((await undoVia(m.records[0].id)).status,200);assert.equal(fs.readFileSync(regFile,'utf8'),realText,'all three undone: the register is exactly as it started');
 }finally{await srv2.close()}

 // V4b: the master attaches a file it was told about (the status block above made the hub read the list)
 m=await say(`Attaching it.\nRECORD: asset file ${target.id} "Incoming/oak_tree.glb"\nRECORD: asset file ${target.id} "Incoming/not-there.glb"\nRECORD: asset file ${target.id} "../../secret.glb"`);
 assert.equal(m.records.length,1);assert.match(m.records[0].text,/^Recorded: Attached oak_tree\.glb to /);assert.equal(m.recordErrors.length,1);assert.match(m.recordErrors[0],/not in assets-src/);assert.equal(m.notUnderstood.length,1);
 assert.deepEqual(rowsNow().find(r=>r.id===target.id).files,['Incoming/oak_tree.glb']);assert.equal(logOf().at(-1).by,'master');
 const srv3=createHubServer({root,records,chat:null}),port3=await srv3.listen();
 try{const d=JSON.stringify({id:m.records[0].id});const code=await new Promise(ok=>{const q=http.request({host:'127.0.0.1',port:port3,method:'POST',path:'/api/records/undo',headers:{Host:`127.0.0.1:${port3}`,Origin:`http://127.0.0.1:${port3}`,'Content-Type':'application/json','Content-Length':d.length,'X-Hub-Token':records.token}},res=>{res.resume();res.on('end',()=>ok(res.statusCode))});q.end(d)});assert.equal(code,200);assert.deepEqual(rowsNow().find(r=>r.id===target.id).files,[])}finally{await srv3.close()}
 fs.writeFileSync(regFile,realText);
 // at most 6 per reply, and the rest are listed
 m=await say(Array.from({length:9},(_,i)=>`RECORD: asset add name="Box ${i}" kind=model`).join('\n'));
 assert.equal(m.records.length,6);assert.equal(m.notUnderstood.length,3);assert.match(m.notUnderstood[0],/more than 6/);assert.equal(rowsNow().length,n0+6);
 // lines below PLAN: are not applied
 const before=rowsNow().length;
 m=await say('Here is the plan.\nPLAN:\n# Add things\n\nRECORD: asset add name="Below plan" kind=model\n\n## Run\nmodel: sonnet\nwhy: x\nsize: S\nneeds: npm test\n');
 assert.equal(m.records,undefined);assert.equal(m.notUnderstood,undefined);assert.equal(rowsNow().length,before);assert.ok(m.plan,'the plan is still filed');
 // a refused-only reply has errors and no records; a plain reply has none of the fields
 m=await say('RECORD: asset add name="Box 1" kind=model');assert.equal(m.records,undefined);assert.match(m.recordErrors[0],/already exists/);
 m=await say('Nothing to record.');assert.equal(m.records,undefined);assert.equal(m.recordErrors,undefined);assert.equal(m.notUnderstood,undefined);
 // a broken store never loses the reply
 const broken=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,records:{applyMaster(){throw new Error('boom')}}});
 env.HUB_FAKE_REPLY='RECORD: asset add name="X" kind=model\nDone.';broken.send({text:'go'});await waitFor(()=>!broken.working());const bm=broken.view().messages.at(-1);assert.match(bm.text,/Done/);assert.deepEqual(bm.recordErrors,['The records could not be applied.']);
 // no records store: RECORD lines are ignored
 const plain=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env});env.HUB_FAKE_REPLY='RECORD: asset add name="Y" kind=model';plain.send({text:'go'});await waitFor(()=>!plain.working());assert.equal(plain.view().messages.at(-1).records,undefined);assert.ok(!rowsNow().some(r=>r.name==='Y'));
 await chat.shutdown();await broken.shutdown();await plain.shutdown();
}
console.log('hub-records-server: ok');
