// Hub v2 V4: asset records, rules

// Pure rules (hub/records.js), the store (hub/records-store.mjs) in temporary folders only (the real assets-register.json is read, never written), the strict RECORD: parser in hub/chat.js,
// the status lines, and the Assets page's pure helpers. Every refusal is tried with hostile input.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateFile,filePathProblem,MAX_FILES,validateAdd,validateStage,makeChange,applyRecord,undoRecord,checkChange,formatRegister,newId,slugOf,sameRow,rowOf,handRows,closestRows,linkProblem,recordLabel,MAX_NAME,MAX_SOURCE,MAX_LICENCE,MAX_NOTE,MAX_PER_REPLY} from '../hub/records.js';
import {createRecords} from '../hub/records-store.mjs';
import {writeAtomic} from '../hub/plans-store.mjs';
import {parseRecordLine,extractRecords,MASTER_RULES} from '../hub/chat.js';
import {STAGES,HAND_STAGES,REGISTER_STAGES,isCredited,claimProblems} from '../hub/assets.js';
import {assetLines,buildStatus,MAX_ASSET_ROWS} from '../hub/status.js';
import {withoutRecords} from '../hub/web/run-actions.js';
import {stripOf,moveOptions,groupRows,nextStep,nameFromFile,newFileLine,safeLink,readHidden,stageName,recordLine} from '../hub/web/assets-area.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),REPO=path.resolve(HERE,'..');
const realText=fs.readFileSync(path.join(REPO,'assets-register.json'),'utf8');
const tmp=()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'hub-records-'));fs.writeFileSync(path.join(d,'assets-register.json'),realText);return d};

// ── stages
assert.deepEqual([...STAGES],['wanted','received','staged','converted','in-game','retired']);
assert.deepEqual([...HAND_STAGES],['wanted','received','staged']);assert.deepEqual([...REGISTER_STAGES],['wanted','received','staged','retired']);
assert.equal(isCredited({stage:'in-game',hasCredit:true,licence:'CC0'}),true);
assert.equal(isCredited({stage:'in-game',hasCredit:null,licence:'CC0'}),true,'a picture needs no credit line');
assert.equal(isCredited({stage:'in-game',hasCredit:false,licence:'CC0'}),false,'a credit gap is not credited');
assert.equal(isCredited({stage:'in-game',hasCredit:true,licence:' '}),false,'no licence');
assert.equal(isCredited({stage:'converted',hasCredit:true,licence:'CC0'}),false);assert.equal(isCredited(null),false);
const register0=JSON.parse(realText);
assert.deepEqual(register0.stages,[...STAGES],'the register lists the same stages');
assert.deepEqual(claimProblems({assets:[{id:'x',stage:'staged'}]},[],null),[],'a register entry may be staged');
assert.equal(claimProblems({assets:[{id:'x',stage:'converted'}]},[],null).length,1,'a register entry still may not claim converted');
assert.equal(claimProblems({assets:[{id:'x',stage:'in-game'}]},[],null).length,1,'nor in-game');

// ── the register layout is stable: the real file round-trips byte for byte
assert.equal(formatRegister(register0),realText,'formatRegister writes the file exactly as it is');
assert.ok(!realText.startsWith('\uFEFF')&&!realText.includes('\r'),'no BOM, no CRLF');

// ── validateAdd: good input and the defaults
let v=validateAdd({name:'  Oak tree ',kind:'model'});
assert.deepEqual(v.value,{name:'Oak tree',kind:'model',source:'',licence:'',stage:'wanted',note:''});
v=validateAdd({name:'Rock',kind:'texture',stage:'staged',source:'https://example.com/a?b=c',licence:'CC0',note:'n'});assert.equal(v.value.source,'https://example.com/a?b=c');assert.equal(v.value.stage,'staged');
assert.ok(validateAdd({name:'椅子',kind:'model'}).value,'a name in another script is fine');

// ── validateAdd: hostile input, each refused with 400
const refuse=(input,re,label)=>{const r=validateAdd(input);assert.ok(r.error,`${label}: refused`);assert.equal(r.code,400,label);if(re)assert.match(r.error,re,label);return r};
const ok1={name:'A thing',kind:'model'};
for(const [n,label] of [['../../etc/passwd','dotdot path'],['C:\\evil\\x.glb','windows path'],['a/b','slash'],['a\\b','backslash'],['.hidden','leading dot'],['..','dots'],['/abs','abs path']])refuse({...ok1,name:n},/name/,'name '+label);
refuse({...ok1,name:''},/required/,'empty name');refuse({...ok1,name:'   '},/required/,'blank name');refuse({...ok1,name:'---'},/letter or digit/,'symbols only');
refuse({...ok1,name:'x'.repeat(MAX_NAME+1)},/at most 80/,'long name');assert.ok(validateAdd({...ok1,name:'x'.repeat(MAX_NAME)}).value,'80 is the limit');
for(const n of [5,null,['a'],{a:1},true,undefined])refuse({...ok1,name:n},/name/,'name type '+JSON.stringify(n));
for(const [n,label] of [['a\nb','newline'],['a\0b','NUL'],['a\u0007b','bell'],['a\u202eb','bidi override'],['a\u061cb','Arabic letter mark'],['a\u2060b','word joiner'],['a\u00adb','soft hyphen'],['a\ufe0fb','variation selector'],['a\u{E0041}b','tag character'],['a\ud800b','lone surrogate'],['a\ue000b','private use'],['a\u180eb','Mongolian vowel separator'],['a\u200db','zero width joiner'],['a\u200bb','zero width'],['a\u2028b','line separator'],['a\x7fb','DEL'],['a\u0085b','NEL'],['a\tb','tab'],['\ufeffa','BOM']])refuse({...ok1,name:n},/control/,'name control '+label);
for(const k of ['weapon','','MODEL','model ',5,null,['model'],{},'__proto__','constructor','toString'])refuse({...ok1,kind:k},/kind/,'kind '+JSON.stringify(k));
refuse({name:'A'},/kind/,'kind missing');
for(const s of ['converted','in-game','credited','retired','nope','',5,null,'__proto__','constructor'])refuse({...ok1,stage:s},/stage/,'stage '+JSON.stringify(s));
for(const s of ['file:///C:/x.glb','javascript:alert(1)','JAVASCRIPT:alert(1)','ftp://example.com/x','data:text/html,hi','//evil.com/x','C:\\x\\y.glb','/etc/passwd','x.glb','https://a b.com','https://a.com/ b','http://user:pw@host/x','http://localhost/x','http://127.0.0.1:8765/api','http://[::1]/x','http://10.0.0.5/x','http://192.168.1.1/x','http://172.20.0.1/x','http://169.254.169.254/x','http://printer.local/x','http://0.0.0.0/x','https://user@host/x','http:foo','https:///x','mailto:a@b.c','vbscript:x','blob:https://a/b','\\\\server\\share'])refuse({...ok1,source:s},/source/,'source '+s);
refuse({...ok1,source:'https://example.com/'+'a'.repeat(MAX_SOURCE)},/source is at most 300/,'long source');
refuse({...ok1,source:5},/source must be text/,'source type');refuse({...ok1,source:'https://a.com/\n'},/control/,'source newline');
refuse({...ok1,licence:'x'.repeat(MAX_LICENCE+1)},/licence is at most 80/,'long licence');refuse({...ok1,licence:'a\u0000'},/control/,'licence NUL');refuse({...ok1,licence:7},/licence/,'licence type');
refuse({...ok1,note:'x'.repeat(MAX_NOTE+1)},/note is at most 300/,'long note');refuse({...ok1,note:'a\rb'},/control/,'note CR');refuse({...ok1,note:{}},/note/,'note type');
for(const bad of [null,5,'x',[],[ok1]])refuse(bad,/object/,'not an object '+JSON.stringify(bad));
refuse({...ok1,extra:1},/Unknown field/,'unknown key');
refuse(JSON.parse('{"name":"A","kind":"model","__proto__":{"x":1}}'),/Unknown field/,'__proto__ key (own property from JSON.parse)');
refuse(JSON.parse('{"name":"A","kind":"model","constructor":{"prototype":{"x":1}}}'),/Unknown field/,'constructor key');
refuse(JSON.parse('{"name":"A","kind":"model","prototype":1}'),/Unknown field/,'prototype key');
assert.equal({}.x,undefined,'nothing polluted Object.prototype');
assert.equal(linkProblem(''),null);assert.equal(linkProblem('http://a.com'),null);assert.equal(linkProblem('HTTPS://A.COM/x?y=1#z'),null);

// ── validateStage
assert.deepEqual(validateStage({id:'kenney-furniture-kit',stage:'staged'}).value,{id:'kenney-furniture-kit',stage:'staged'});
for(const s of ['converted','in-game','credited','','nope',5,null,'__proto__','Wanted'])assert.equal(validateStage({id:'a',stage:s}).code,400,'stage '+JSON.stringify(s));
for(const id of ['','A','a b','../x','a/b','a\\b','__proto__','-x','a'.repeat(61),5,null,['a'],'a\n','a:b','prop:x'])assert.equal(validateStage({id,stage:'staged'}).code,400,'id '+JSON.stringify(id));
assert.equal(validateStage({id:'constructor',stage:'staged'}).value.id,'constructor','a plain word passes the pattern; the register lookup refuses it');
assert.equal(validateStage({id:'a',stage:'staged',extra:1}).code,400);assert.equal(validateStage(JSON.parse('{"id":"a","stage":"staged","__proto__":1}')).code,400);assert.equal(validateStage([]).code,400);

// ── ids
assert.equal(slugOf('Oak Tree (big)!'),'oak-tree-big');assert.equal(slugOf('Café Chaise'),'cafe-chaise');assert.equal(slugOf('椅子'),'');
assert.equal(newId('Oak tree',new Set()),'oak-tree');assert.equal(newId('Oak tree',new Set(['oak-tree'])),'oak-tree-2');assert.equal(newId('Oak tree',new Set(['oak-tree','oak-tree-2'])),'oak-tree-3');
assert.equal(newId('椅子',new Set()),'asset');assert.equal(newId('Forklift',new Set()),'forklift-2','a shipped module id is reserved');assert.equal(newId('Water cooler',new Set()),'water-cooler-2');
assert.ok(/^[a-z0-9][a-z0-9-]{0,59}$/.test(newId('x'.repeat(80),new Set())));

// ── makeChange / applyRecord / undoRecord (pure)
const reg=JSON.parse(realText),n0=reg.assets.length;
let m=makeChange({op:'asset-add',input:{name:'Oak tree',kind:'model',source:'https://example.com/oak'},register:reg,by:'you',at:1000,id:'rec-aaaaaa-0001'});
assert.ok(m.change,JSON.stringify(m));assert.equal(m.change.after.id,'oak-tree');assert.equal(m.change.after.stage,'wanted');assert.equal(m.change.before,null);
assert.deepEqual(Object.keys(m.change.after),['id','name','kind','stage','source','licence','credit','plannedUse','files','notes','pack'],'the key order of the existing rows');
assert.equal(reg.assets.length,n0,'makeChange changes nothing');
let a=applyRecord(reg,m.change);assert.equal(a.register.assets.length,n0+1);assert.equal(reg.assets.length,n0,'applyRecord returns a new register');assert.equal(a.register.assets.at(-1).id,'oak-tree');
assert.equal(applyRecord(a.register,m.change).code,409,'applying the same add twice is refused');
assert.equal(makeChange({op:'asset-add',input:{name:'oak TREE',kind:'model'},register:a.register,by:'you',at:1,id:'rec-aaaaaa-0002'}).code,409,'same name, any case, is refused');
let u=undoRecord(a.register,m.change);assert.equal(u.register.assets.length,n0);assert.deepEqual(u.register,reg,'undoing an add gives back the register');
assert.equal(formatRegister(u.register),realText,'and the file text too');
// the row changed after the record: undo refused
const edited={...a.register,assets:a.register.assets.map(r=>r.id==='oak-tree'?{...r,notes:'edited by hand'}:r)};
assert.equal(undoRecord(edited,m.change).code,409,'undo is refused when the row changed after the record');
assert.equal(undoRecord(reg,m.change).code,409,'undo is refused when the row is gone');
// stage moves
const first=handRows(reg)[0];assert.ok(first,'the register has a hand-set row');
const to=first.stage==='wanted'?'received':'wanted';
m=makeChange({op:'asset-stage',input:{id:first.id,stage:to},register:reg,by:'master',at:2000,id:'rec-aaaaaa-0003'});assert.ok(m.change,JSON.stringify(m));
assert.equal(m.change.by,'master');assert.equal(m.change.before.stage,first.stage);assert.equal(m.change.after.stage,to);assert.deepEqual(Object.keys(m.change.after),Object.keys(first),'the row keeps its key order');
a=applyRecord(reg,m.change);assert.equal(rowOf(a.register,first.id).stage,to);assert.equal(rowOf(reg,first.id).stage,first.stage);
assert.equal(applyRecord(a.register,m.change).code,409,'applying a move to a row that already moved is refused');
u=undoRecord(a.register,m.change);assert.deepEqual(u.register,reg);assert.equal(formatRegister(u.register),realText);
assert.equal(undoRecord(u.register,m.change).code,409,'undoing twice is refused (the row is not as the record left it)');
assert.equal(recordLabel(m.change),`${first.name}: ${first.stage} → ${to}`);
// what a move may not do
const pack=reg.assets.find(r=>r.covers),shippedLike={...reg,assets:[...reg.assets,{id:'sneaky',name:'Sneaky',kind:'model',stage:'in-game',files:[]}]};
assert.equal(makeChange({op:'asset-stage',input:{id:pack.id,stage:'staged'},register:reg,by:'you',at:1,id:'rec-aaaaaa-0004'}).code,404,'a pack entry is not a row');
assert.equal(makeChange({op:'asset-stage',input:{id:'sneaky',stage:'staged'},register:shippedLike,by:'you',at:1,id:'rec-aaaaaa-0004'}).code,409,'a row that claims in-game is not moved by hand');
assert.equal(makeChange({op:'asset-stage',input:{id:first.id,stage:first.stage},register:reg,by:'you',at:1,id:'rec-aaaaaa-0004'}).code,409,'no move to the same stage');
for(const id of ['nope','constructor','prototype','valueof'])assert.equal(makeChange({op:'asset-stage',input:{id,stage:'staged'},register:reg,by:'you',at:1,id:'rec-aaaaaa-0004'}).code,404,'id not in the register: '+id);
for(const id of ['toString','hasOwnProperty','__proto__'])assert.equal(makeChange({op:'asset-stage',input:{id,stage:'staged'},register:reg,by:'you',at:1,id:'rec-aaaaaa-0004'}).code,400,'not even an id: '+id);
for(const s of ['converted','in-game','credited'])assert.equal(makeChange({op:'asset-stage',input:{id:first.id,stage:s},register:reg,by:'master',at:1,id:'rec-aaaaaa-0004'}).code,400,'the master may never set '+s);
assert.equal(makeChange({op:'asset-add',input:{name:'X',kind:'model',stage:'in-game'},register:reg,by:'master',at:1,id:'rec-aaaaaa-0004'}).code,400,'nor add a row as in-game');
assert.equal(makeChange({op:'delete',input:{},register:reg,by:'you',at:1,id:'rec-aaaaaa-0004'}).code,400,'unknown op');assert.equal(makeChange({op:'asset-add',input:ok1,register:reg,by:'root',at:1,id:'rec-aaaaaa-0004'}).code,400,'unknown actor');
assert.equal(makeChange({op:'asset-add',input:ok1,register:{...reg,assets:new Array(2000).fill({id:'q',name:'q'})},by:'you',at:1,id:'rec-aaaaaa-0004'}).code,409,'a full register');
// stored changes are checked before use
const good=makeChange({op:'asset-add',input:ok1,register:reg,by:'you',at:5,id:'rec-bbbbbb-0001'}).change;assert.equal(checkChange(good),true);
for(const bad of [null,{},{...good,op:'rm'},{...good,id:'x'},{...good,by:'x'},{...good,at:'1'},{...good,before:{}},{...good,after:{...good.after,stage:'in-game'}},{...good,after:{...good.after,id:'../x'}},{...good,after:{...good.after,covers:['a']}},{...good,after:null}])assert.equal(checkChange(bad),false,'bad stored change '+JSON.stringify(bad).slice(0,60));
const ownRow=reg.assets.find(r=>!r.covers);
assert.equal(checkChange({...good,after:ownRow}),false,'a forged add of a hand-written row is refused');
assert.equal(checkChange({...good,after:{...good.after,files:['x.glb']}}),false,'a forged add with files');
const mv0=makeChange({op:'asset-stage',input:{id:ownRow.id,stage:ownRow.stage==='wanted'?'received':'wanted'},register:reg,by:'you',at:1,id:'rec-bbbbbb-0002'}).change;
assert.equal(checkChange(mv0),true);assert.equal(checkChange({...mv0,before:{...mv0.before,name:'Other'}}),false,'a forged move that also changes the name');assert.equal(checkChange({...mv0,after:{...mv0.after,notes:'x'}}),false,'or the notes');assert.equal(checkChange({...mv0,after:mv0.before}),false,'a move to the same stage');
assert.equal(applyRecord(reg,{...good,after:{...good.after,stage:'converted'}}).code,400,'a stored change cannot set converted either');
assert.ok(sameRow({a:1,b:2},{b:2,a:1}));assert.ok(!sameRow({a:1},{a:2}));

// ── the closest rows for a new file (script, no model)
const pool=[{id:'oak-tree',name:'Oak tree',stage:'wanted'},{id:'pine-tree',name:'Pine tree',stage:'wanted'},{id:'park-bench',name:'Park bench',stage:'received'}];
assert.equal(closestRows('Props/oak_tree_01.glb',pool)[0].id,'oak-tree');assert.equal(closestRows('Props/OakTree.glb',pool)[0].id,'oak-tree','camel case');
assert.equal(closestRows('zzz.glb',pool).length,0);assert.equal(closestRows('',pool).length,0);assert.ok(closestRows('tree.glb',pool,1).length===1);

// ── the store, in a temporary folder
{
 const root=tmp();let clock=1700000000000;const rs=createRecords({root,now:()=>clock,load:async()=>({assets:[{origin:'module',id:'prop:a',name:'A',stage:'in-game',hasCredit:true,licence:'CC0'},{origin:'module',id:'prop:b',name:'B',stage:'converted'},{origin:'module',id:'prop:c',name:'C',stage:'in-game',hasCredit:false,licence:'CC0'},{origin:'register',id:'zz',name:'Z',stage:'wanted'}]}),originals:async()=>['New/oak_tree.glb','Sounds/water_drink.wav']});
 const file=path.join(root,'assets-register.json'),logFile=path.join(root,'.hub','records.jsonl');
 const regText=()=>fs.readFileSync(file,'utf8'),logLines=()=>fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean):[];
 assert.equal(rs.checkToken(rs.token),true);assert.equal(rs.checkToken('x'),false);assert.equal(rs.checkToken(rs.token.replace(/./,c=>c==='a'?'b':'a')),false);assert.equal(rs.checkToken(undefined),false);assert.equal(rs.checkToken(5),false);
 // add
 let r=rs.add({name:'Oak tree',kind:'model',source:'https://example.com/oak',licence:'CC0',note:'big one'},'you');assert.ok(r.change,JSON.stringify(r));
 assert.equal(r.change.by,'you');assert.equal(r.change.label,'Added Oak tree (wanted)');assert.match(r.change.id,/^rec-[0-9a-z]{6,10}-[0-9a-f]{8}$/);assert.equal(r.row.id,'oak-tree');
 let after=JSON.parse(regText());assert.equal(after.assets.length,n0+1);assert.equal(after.assets.at(-1).source,'https://example.com/oak');
 assert.equal(regText(),formatRegister(after),'the file is still in its layout');assert.ok(!regText().startsWith('\uFEFF'));
 // the diff is small: every other line is untouched
 const oldL=realText.split('\n'),newL=regText().split('\n'),changed=newL.filter(l=>!oldL.includes(l));assert.equal(changed.length,2,'two lines differ: the new row, and the comma the old last row now needs');
 assert.equal(logLines().length,1);const rec1=JSON.parse(logLines()[0]);assert.equal(rec1.op,'asset-add');assert.equal(rec1.by,'you');assert.equal(rec1.before,null);assert.equal(rec1.after.id,'oak-tree');
 assert.deepEqual(fs.readdirSync(root).filter(f=>f.endsWith('.tmp')),[],'no temporary file is left behind');
 // errors never write
 const beforeText=regText();
 for(const [input,code] of [[{name:'../x',kind:'model'},400],[{name:'Oak tree',kind:'model'},409],[{name:'Q',kind:'sword'},400],[{name:'Q',kind:'model',source:'file:///C:/x'},400],[{name:'Q',kind:'model',stage:'in-game'},400]]){const e=rs.add(input,'you');assert.equal(e.code,code,JSON.stringify(input));assert.ok(e.error)}
 assert.equal(regText(),beforeText,'a refused add writes nothing');assert.equal(logLines().length,1,'and logs nothing');
 // stage
 r=rs.stage({id:'oak-tree',stage:'received'},'you');assert.ok(r.change);assert.equal(r.change.label,'Oak tree: wanted → received');assert.equal(JSON.parse(regText()).assets.at(-1).stage,'received');
 const mv=r.change.id;
 assert.equal(rs.stage({id:'oak-tree',stage:'received'}).code,409);assert.equal(rs.stage({id:'ghost',stage:'received'}).code,404);assert.equal(rs.stage({id:'oak-tree',stage:'in-game'}).code,400);assert.equal(rs.stage({id:'oak-tree',stage:'converted'},'master').code,400);
 // summary
 let s=await rs.summary();assert.equal(s.stages.received>=1,true);assert.equal(s.stages.converted,1);assert.equal(s.stages['in-game'],2);assert.equal(s.stages.credited,1,'only the in-game row with a credit and a licence');
 assert.equal(s.shipped.length,3,'module rows only');assert.equal(s.records.length,2);assert.equal(s.records[0].id,mv,'newest first');assert.equal(s.records[0].canUndo,true);
 const row=s.rows.find(x=>x.id==='oak-tree');assert.equal(row.undo,mv,'the row offers the undo of its latest change');assert.equal(row.stage,'received');
 assert.equal(s.newFiles.total,2);const nf=s.newFiles.items.find(i=>i.name==='oak_tree.glb');assert.equal(nf.candidates[0].id,'oak-tree');
 // undo of the add is refused while the move sits on top (the row changed after that record)
 assert.equal(rs.undo(rec1.id).code,409,'the row changed after the add');assert.match(rs.undo(rec1.id).error,/later change/,'newest first');
 s=await rs.summary();assert.equal(s.records.find(x=>x.id===rec1.id).canUndo,false,'the add shows no Undo while the move stands');
 // undo the move, then the add
 let un=rs.undo(mv);assert.ok(un.undone,JSON.stringify(un));assert.equal(JSON.parse(regText()).assets.at(-1).stage,'wanted');
 assert.equal(rs.undo(mv).code,409,'already undone');
 un=rs.undo(rec1.id);assert.ok(un.undone);assert.equal(regText(),realText,'both undone: the file is exactly as it started');
 s=await rs.summary();assert.equal(s.records.every(x=>x.undone),true);assert.equal(s.rows.find(x=>x.id==='oak-tree'),undefined);
 // undo hostile
 for(const id of ['',5,null,'../x','rec-1','__proto__','rec-aaaaaa-ffff\n',{},['rec-aaaaaa-0001']])assert.equal(rs.undo(id).code,400,'undo id '+JSON.stringify(id));
 assert.equal(rs.undo('rec-aaaaaa-ffff').code,404);
 // a hand edit between the record and the undo
 r=rs.add({name:'Rock',kind:'model'},'you');const rockId=r.change.id;
 fs.writeFileSync(file,regText().replace('"notes":""','"notes":"touched"'));
 assert.equal(rs.undo(rockId).code,409,'the row changed after the record (edited in VS Code)');assert.match(rs.undo(rockId).error,/changed/);
 // the hub will not rewrite a register laid out some other way
 fs.writeFileSync(file,JSON.stringify(JSON.parse(regText()),null,2)+'\n');const spread=regText();
 assert.equal(rs.add({name:'Another',kind:'model'}).code,409);assert.match(rs.add({name:'Another',kind:'model'}).error,/laid out/);assert.equal(regText(),spread);
 assert.equal(rs.undo(rockId).code,409);
 // a register that is not JSON / has no list
 fs.writeFileSync(file,'{ nope');assert.equal(rs.add({name:'Another',kind:'model'}).code,500);fs.writeFileSync(file,'{"assets":5}');assert.equal(rs.stage({id:'a',stage:'staged'}).code,500);
 fs.rmSync(file);assert.equal(rs.add({name:'Another',kind:'model'}).code,500);assert.equal((await rs.summary()).code,500);
 // a log with junk lines: the junk is skipped, the good records are found
 const root2=tmp(),rs2=createRecords({root:root2,now:()=>clock,load:async()=>{throw new Error('dist missing')},originals:async()=>{throw new Error('no folder')}});
 const x=rs2.add({name:'Chair',kind:'model'});fs.appendFileSync(path.join(root2,'.hub','records.jsonl'),'not json\n{"op":"asset-add"}\n{"undo":5}\n\n'+JSON.stringify({...JSON.parse(fs.readFileSync(path.join(root2,'.hub','records.jsonl'),'utf8').trim()),id:'rec-zzzzzz-0000',op:'rm'})+'\n');
 s=await rs2.summary();assert.equal(s.records.length,1,'bad lines are skipped');assert.match(s.loadError,/dist missing/);assert.deepEqual(s.shipped,[]);assert.equal(s.newFiles.total,0);
 assert.ok(rs2.undo(x.change.id).undone);
 // applyMaster: one result per line, applied one by one, by 'master'
 const root3=tmp(),rs3=createRecords({root:root3,now:()=>clock,load:async()=>({assets:[]}),originals:async()=>[]});
 const out=rs3.applyMaster([{op:'asset-add',input:{name:'Bench',kind:'model',stage:'received'}},{op:'asset-add',input:{name:'Bench',kind:'model'}},{op:'asset-stage',input:{id:'bench',stage:'staged'}},{op:'asset-stage',input:{id:'bench',stage:'converted'}}]);
 assert.deepEqual(out.map(o=>o.ok),[true,false,true,false]);assert.equal(out[0].stage,'received');assert.equal(out[2].label,'Bench: received → staged');assert.match(out[1].error,/already exists/);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root3,'.hub','records.jsonl'),'utf8').trim().split('\n')[0]).by,'master');
 assert.deepEqual(rs3.applyMaster(null),[]);
 const b=rs3.brief();await new Promise(r=>setTimeout(r,20));const b2=rs3.brief();
 assert.equal(b.known,false,'the first look does not wait for the slow part');assert.equal(b2.known,true);assert.equal(b.counts.staged,1);assert.ok(b.rows.some(x=>x.id==='bench'&&x.stage==='staged'));
 assert.equal(createRecords({root:fs.mkdtempSync(path.join(os.tmpdir(),'hub-records0-'))}).brief(),null,'no register: no brief');
}

// ── the RECORD: parser (hub/chat.js)
const P=parseRecordLine;
let p=P('RECORD: asset add name="Oak tree" kind=model stage=wanted source="https://example.com/oak" licence="CC0" note="a big one"');
assert.equal(p.op,'asset-add');assert.deepEqual(p.input,{name:'Oak tree',kind:'model',source:'https://example.com/oak',licence:'CC0',stage:'wanted',note:'a big one'});
p=P('RECORD: asset add name=Rock kind=texture');assert.deepEqual(p.input,{name:'Rock',kind:'texture',source:'',licence:'',stage:'wanted',note:''});
p=P('  RECORD:   asset   add   name="Two  spaces"   kind=sound  ');assert.equal(p.input.name,'Two  spaces');
p=P('RECORD: asset stage oak-tree staged');assert.deepEqual([p.op,p.input],['asset-stage',{id:'oak-tree',stage:'staged'}]);
p=P('RECORD: asset stage  oak-tree   retired  ');assert.equal(p.input.stage,'retired');
for(const [line,re] of [
 ['RECORD:','nothing after'],['RECORD:   ','nothing after'],['record: asset add name=A kind=model','nothing after'],['RECORD asset add name=A kind=model','nothing after'],['**RECORD:** asset add name=A kind=model','nothing after'],
 ['RECORD: asset delete oak-tree','only'],['RECORD: asset','only'],['RECORD: assets add name=A kind=model','only'],['RECORD: asset add','needs name'],['RECORD: asset add name="A"','needs name'],['RECORD: asset add kind=model','needs name'],
 ['RECORD: asset add name="A" kind=model name="B"','repeated'],['RECORD: asset add name="A" kind=model colour=red','not allowed'],['RECORD: asset add name="A" kind=model __proto__=x','could not read'],['RECORD: asset add name="A" kind=model constructor=x','not allowed'],
 ['RECORD: asset add name="A" kind=model junk','could not read'],['RECORD: asset add name="A kind=model','could not read'],['RECORD: asset add name="A"B" kind=model','could not read'],['RECORD: asset add name=A kind=model source=https://x.com/?a=b','could not read'],
 ['RECORD: asset add name="../../x" kind=model','name'],['RECORD: asset add name="C:\\x\\y.glb" kind=model','name'],['RECORD: asset add name="A" kind=weapon','kind'],['RECORD: asset add name="A" kind=model stage=in-game','stage'],['RECORD: asset add name="A" kind=model stage=converted','stage'],
 ['RECORD: asset add name="A" kind=model source="file:///C:/x"','source'],['RECORD: asset add name="A" kind=model source="javascript:alert(1)"','source'],['RECORD: asset add name="A" kind=model source="ftp://x.com/a"','source'],['RECORD: asset add name="A" kind=model source="/etc/passwd"','source'],
 ['RECORD: asset add name="'+'x'.repeat(81)+'" kind=model','at most 80'],['RECORD: asset add name="A" kind=model source="https://x.com/'+'a'.repeat(300)+'"','source'],['RECORD: asset add name="A" kind=model licence="'+'x'.repeat(81)+'"','licence'],['RECORD: asset add name="A" kind=model note="'+'x'.repeat(301)+'"','note'],
 ['RECORD: asset add name="A\u0007B" kind=model','control'],['RECORD: asset add name="A\u202eB" kind=model','control'],['RECORD: asset add name="A\u0000B" kind=model','control'],['RECORD: asset add name="A\tB" kind=model','control'],
 ['RECORD: asset add name="'+'x'.repeat(700)+'" kind=model','too long'],
 ['RECORD: asset stage','needs an id'],['RECORD: asset stage oak-tree','needs an id'],['RECORD: asset stage oak-tree staged extra','needs an id'],['RECORD: asset stage oak-tree converted','stage'],['RECORD: asset stage oak-tree in-game','stage'],['RECORD: asset stage oak-tree credited','stage'],
 ['RECORD: asset stage ../x staged','id'],['RECORD: asset stage __proto__ staged','id'],['RECORD: asset stage prop:chair staged','id'],['RECORD: asset stage Oak staged','id'],['RECORD: asset stage oak-tree "staged"','stage'],
 ]){const r=P(line);assert.ok(r.error,`refused: ${line.slice(0,70)}`);assert.match(r.error,new RegExp(re),line.slice(0,70));assert.equal(r.op,undefined)}
// 'id not in the register' is the store's job (404): the parser accepts a well-formed id
assert.equal(P('RECORD: asset stage constructor staged').op,'asset-stage');
assert.equal({}.x,undefined);
// extractRecords: only above PLAN: / COMMIT:, at most 6, the rest listed as not understood
let er=extractRecords('Sure.\nRECORD: asset add name="A" kind=model\nText between.\nRECORD: asset stage a staged\nACTION: test\nRECORD: junk here\n');
assert.equal(er.ops.length,2);assert.equal(er.notUnderstood.length,1);assert.match(er.notUnderstood[0],/RECORD: junk here/);
er=extractRecords('RECORD: asset add name="A" kind=model\nPLAN:\n# T\nRECORD: asset add name="B" kind=model\n');assert.equal(er.ops.length,1,'a RECORD: below PLAN: is not applied');assert.equal(er.notUnderstood.length,0,'and not shown as a problem (it is the plan\'s text)');
er=extractRecords('RECORD: asset add name="A" kind=model\nCOMMIT:\nfix\nRECORD: asset add name="B" kind=model\n');assert.equal(er.ops.length,1,'nor below COMMIT:');
er=extractRecords(Array.from({length:9},(x,i)=>`RECORD: asset add name="Item ${i}" kind=model`).join('\n'));
assert.equal(er.ops.length,MAX_PER_REPLY,'at most 6 per reply');assert.equal(er.notUnderstood.length,3);assert.match(er.notUnderstood[0],/more than 6/);
er=extractRecords(Array.from({length:6},()=>'RECORD: nonsense').concat(['RECORD: asset add name="Z" kind=model']).join('\n'));assert.equal(er.ops.length,0,'bad lines count toward the cap of 6');
assert.equal(extractRecords('').ops.length,0);assert.equal(extractRecords(null).ops.length,0);assert.equal(extractRecords('RECORD: asset add name="A" kind=model\r\nRECORD: asset stage a staged\r\n').ops.length,2,'CRLF');
assert.equal(extractRecords('see RECORD: asset add name="A" kind=model in the docs').ops.length,0,'a line must START with RECORD:');
assert.equal(extractRecords('> RECORD: asset add name="A" kind=model').ops.length,0,'a quoted line is not a record');
assert.equal(extractRecords('```\nRECORD: asset add name="A" kind=model\n```').ops.length,0,'a RECORD: line inside a code fence is an example, not a record');
assert.equal(extractRecords('~~~\nRECORD: asset add name="A" kind=model\n~~~\nRECORD: asset add name="B" kind=model').ops.length,1,'a line after the fence closes counts');
assert.equal(extractRecords('```\nRECORD: asset add name="A" kind=model').ops.length,0,'an unclosed fence hides the rest');
assert.equal(withoutRecords('```\nRECORD: x\n```\nRECORD: y\nend'),'```\nRECORD: x\n```\nend','a fenced example stays visible');
// shown lines are clean text
er=extractRecords('RECORD: asset add name="A\u202e\u0007B" kind=weapon');assert.ok(!/[\u202e\u0007]/.test(er.notUnderstood[0]));assert.ok(er.notUnderstood[0].length<=300);
// display
assert.equal(withoutRecords('Hi\nRECORD: asset add name="A" kind=model\nBye'),'Hi\nBye');assert.equal(withoutRecords('A\nPLAN:\nRECORD: x\n'),'A\nPLAN:\nRECORD: x','below PLAN: stays visible');

// ── MASTER_RULES and the status block
for(const w of ['RECORD: asset add','RECORD: asset stage','at most 6','not understood','Undo','You cannot set converted','ACTION the owner presses'])assert.ok(MASTER_RULES.includes(w),'MASTER_RULES says '+w);
assert.ok(MASTER_RULES.includes('READ-ONLY'));
const brief={counts:{wanted:2,received:1,staged:0,converted:3,'in-game':100,credited:90,retired:1},known:true,newFiles:2,newNames:['oak_tree.glb','x'.repeat(100)],rows:Array.from({length:25},(_,i)=>({id:'row-'+i,name:'R'+i,stage:'wanted'}))};
const lines=assetLines(brief);assert.equal(lines.length,3);
assert.match(lines[0],/Assets: wanted 2, received 1, staged 0, converted 3, in game 100, credited 90, retired 1/);assert.match(lines[1],/New files in assets-src\/.*: 2 \(oak_tree\.glb/);assert.ok(lines[1].length<500);assert.match(lines[1],/RECORD: asset file <id>/);
assert.match(lines[2],/row-0 wanted/);assert.match(lines[2],/\+5 more/);assert.ok(!lines[2].includes('row-20'),'at most '+MAX_ASSET_ROWS+' ids');
assert.match(assetLines({...brief,known:false})[0],/not read yet/);assert.deepEqual(assetLines(null),[]);assert.equal(assetLines({counts:{},rows:[]}).length,1);
const st=buildStatus({assets:brief,now:Date.UTC(2026,10,12,12,0)});assert.match(st,/Assets: wanted 2/);assert.ok(st.length<4500);
assert.ok(!buildStatus({}).includes('Assets:'),'no records, no asset line');

// ── the Assets page's pure helpers
const strip=stripOf({wanted:2,received:1,staged:0,converted:3,'in-game':100,credited:90,__proto__:7});
assert.deepEqual(strip.map(c=>c.key),['wanted','received','staged','converted','in-game','credited']);assert.deepEqual(strip.map(c=>c.hand),[true,true,true,false,false,false],'the three hand-set ones are marked');assert.deepEqual(strip.map(c=>c.count),[2,1,0,3,100,90]);
assert.equal(stripOf(null).every(c=>c.count===0),true);assert.deepEqual(moveOptions('wanted'),['received','staged','retired']);assert.deepEqual(moveOptions('retired'),['wanted','received','staged']);
const gr=groupRows([{id:'a',stage:'wanted'},{id:'b',stage:'staged'},{id:'c',stage:'in-game'},{id:'d',stage:'__proto__'},null]);assert.deepEqual([gr.wanted.length,gr.staged.length,gr.received.length,gr.retired.length],[1,1,0,0]);
assert.match(nextStep(null),/Reading/);
assert.match(nextStep({stages:{},newFiles:{total:1},rows:[]}),/^1 new file in assets-src\/ has no row/);assert.match(nextStep({stages:{},newFiles:{total:3},rows:[]}),/^3 new files .* have no row/);
assert.match(nextStep({stages:{},newFiles:{total:0},rows:[{name:'Oak',stage:'staged'},{name:'Elm',stage:'staged'}]}),/2 staged: Oak and 1 more are ready to convert/);
assert.match(nextStep({stages:{},rows:[{name:'Oak',stage:'received'}]}),/1 received: stage it/);assert.match(nextStep({stages:{},rows:[{name:'Oak',stage:'wanted'}]}),/1 wanted/);assert.match(nextStep({stages:{},rows:[]}),/Nothing is waiting/);
assert.equal(nameFromFile('oak_tree-01.glb'),'oak tree 01');assert.equal(newFileLine({name:'oak.glb'}),'New file: oak.glb. Which asset is it?');
assert.equal(safeLink('https://a.com/x'),'https://a.com/x');for(const bad of ['javascript:alert(1)','file:///x','//a.com','a.com','https://a b',5,null,'http:/x'])assert.equal(safeLink(bad),null,'safeLink '+bad);
assert.deepEqual(readHidden('["a","b",5]'),['a','b']);assert.deepEqual(readHidden('nope'),[]);assert.deepEqual(readHidden(null),[]);assert.equal(stageName('in-game'),'In game');assert.equal(stageName('__proto__'),'__proto__');
assert.equal(recordLine({label:'Added X (wanted)',by:'master',undone:true}),'Added X (wanted) (by the master) · undone');

// ── the new web files set text only
for(const f of ['assets-area.js','records-api.js']){const code=fs.readFileSync(path.join(REPO,'hub','web',f),'utf8');assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(/.test(code),f+' sets text only');assert.ok(!code.startsWith('\uFEFF'),f+' has no BOM')}
for(const f of ['hub/records.js','hub/records-store.mjs','hub/web/assets-area.js','hub/web/records-api.js','hub/chat.js','hub/server.js','hub/status.js','hub/hub-cli.mjs','hub/web/hub.css','assets-register.json','tests/hub-records.mjs','tests/hub-records-server.mjs'])if(fs.existsSync(path.join(REPO,f)))assert.ok(!fs.readFileSync(path.join(REPO,f),'utf8').startsWith('\uFEFF'),f+' has no BOM');

// ── review fixes: ids never clash, a shipped id is reserved, a failed write leaves no temporary file
{
 const rootA=tmp(),rsA=createRecords({root:rootA,now:()=>1700000000000,load:async()=>({assets:[{origin:'module',id:'chair',name:'Chair',stage:'in-game',hasCredit:true,licence:'CC0'}]}),originals:async()=>[]});
 const made=rsA.applyMaster(Array.from({length:6},(_,i)=>({op:'asset-add',input:{name:'Same second '+i,kind:'model'}})));
 assert.equal(new Set(made.map(x=>x.id)).size,6,'six records in one second all get their own id');assert.ok(made.every(x=>/^rec-[0-9a-z]{6,10}-[0-9a-f]{8}$/.test(x.id)));
 await rsA.summary();
 assert.equal(rsA.add({name:'Chair',kind:'model'}).row.id,'chair-2','a row may not take the id of a shipped asset');
 // an older change cannot be undone while a newer one on the same row stands; newest first works
 const a1=rsA.add({name:'Ladder',kind:'model'}),a2=rsA.stage({id:'ladder',stage:'received'}),a3=rsA.stage({id:'ladder',stage:'staged'});
 assert.equal(rsA.undo(a1.change.id).code,409);assert.equal(rsA.undo(a2.change.id).code,409,'a2 is under a3');
 assert.ok(rsA.undo(a3.change.id).undone);assert.ok(rsA.undo(a2.change.id).undone);assert.ok(rsA.undo(a1.change.id).undone);
 // an undo mark that is missing cannot bring an old record back once the row was added again
 const b1=rsA.add({name:'Stool',kind:'model'});fs.writeFileSync(path.join(rootA,'.hub','records.jsonl'),fs.readFileSync(path.join(rootA,'.hub','records.jsonl'),'utf8')); // (log intact)
 assert.ok(rsA.undo(b1.change.id).undone);const b2=rsA.add({name:'Stool',kind:'model'});assert.equal(rsA.undo(b1.change.id).code,409,'already undone');assert.ok(b2.change);
 // the tail of a forged log line: an add that copies a hand-written row is skipped, so Undo cannot delete that row
 const own=JSON.parse(fs.readFileSync(path.join(rootA,'assets-register.json'),'utf8')).assets.find(r=>!r.covers);
 fs.appendFileSync(path.join(rootA,'.hub','records.jsonl'),JSON.stringify({id:'rec-abcdef-0001',at:1,by:'you',op:'asset-add',before:null,after:own})+'\n');
 assert.equal(rsA.undo('rec-abcdef-0001').code,404,'a forged record is not in the log as far as the hub is concerned');
 // writeAtomic: a write that fails leaves no .tmp file
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-wa-')),target=path.join(dir,'t');fs.mkdirSync(target);
 assert.throws(()=>writeAtomic(target,'x'));assert.deepEqual(fs.readdirSync(dir),['t'],'no temporary file is left');
}

// ── V4b: attach a file from assets-src/ to a row (asset-file)
{
 const GOOD=['Veichles/forklift_low_poly/scene.gltf','Tools/Steel_Axe by Quaternius.glb','a/b.GLB','Sounds/water_drink.wav','x.fbx'];
 for(const p of GOOD)assert.equal(filePathProblem(p),null,'ok: '+p);
 const HOSTILE=['','ab','../x.glb','a/../b.glb','a/./b.glb','/abs.glb','C:\\x.glb','C:/x.glb','a\\b.glb','a//b.glb','a/b.exe','a/b','a/b.glb.exe','x.glb\n','a/b.glb ',' a.glb','a/ b /c.glb','a/b./c.glb','a/b.glb/','\u202e.glb','a\u0000b.glb','a\ud800.glb','\u{E0041}.glb','a/b*.glb','a/b?.glb','a"b.glb','a<b>.glb','a|b.glb','x'.repeat(300)+'.glb',5,null,['a.glb'],{}];
 for(const p of HOSTILE)assert.ok(filePathProblem(p),'refused: '+JSON.stringify(p).slice(0,40));
 assert.deepEqual(validateFile({id:'oak-tree',file:'a/b.glb'}).value,{id:'oak-tree',file:'a/b.glb'});
 for(const bad of [null,[],5,{id:'oak-tree'},{file:'a/b.glb'},{id:'__proto__',file:'a/b.glb'},{id:'Oak',file:'a/b.glb'},{id:'oak-tree',file:'../b.glb'},{id:'oak-tree',file:'a/b.glb',extra:1},JSON.parse('{"id":"oak-tree","file":"a/b.glb","__proto__":{"x":1}}')])assert.equal(validateFile(bad).code,400,JSON.stringify(bad));
 const row=handRows(reg).find(r=>r.stage==='wanted'),other=handRows(reg).find(r=>r.stage==='received'&&(r.files||[]).length===0);
 const mk=(input,o={})=>makeChange({op:'asset-file',input,register:o.register||reg,by:o.by||'you',at:1,id:'rec-cccccc-0001',originals:'originals' in o?o.originals:['New/a.glb','New/b.glb','Sounds/x.wav']});
 assert.equal(mk({id:row.id,file:'New/a.glb'},{originals:null}).code,409,'the file list has not been read');
 assert.equal(mk({id:row.id,file:'New/zzz.glb'}).code,404,'a file that is not in assets-src/');
 assert.equal(mk({id:'ghost',file:'New/a.glb'}).code,404);assert.equal(mk({id:pack.id,file:'New/a.glb'}).code,404,'not a pack row');
 assert.equal(mk({id:row.id,file:'../etc/x.glb'}).code,400);
 const retired={...reg,assets:reg.assets.map(r=>r.id===row.id?{...r,stage:'retired'}:r)};assert.equal(mk({id:row.id,file:'New/a.glb'},{register:retired}).code,409,'not onto a retired row');
 const c=mk({id:row.id,file:'New/a.glb'}).change;assert.ok(c,'attach');assert.equal(c.after.stage,'received','a wanted row becomes received');assert.deepEqual(c.after.files,[...(row.files||[]),'New/a.glb']);assert.deepEqual(Object.keys(c.after),Object.keys(row),'key order kept');
 assert.equal(recordLabel(c),`Attached a.glb to ${row.name} (now received)`);assert.equal(checkChange(c),true);
 const a=applyRecord(reg,c);assert.equal(rowOf(a.register,row.id).files.at(-1),'New/a.glb');assert.equal(applyRecord(a.register,c).code,409,'applied twice');
 assert.equal(mk({id:other.id,file:'New/a.glb'},{register:a.register}).code,409,'a file belongs to one row');assert.match(mk({id:other.id,file:'New/a.glb'},{register:a.register}).error,/already attached/);
 const u=undoRecord(a.register,c);assert.deepEqual(u.register,reg);assert.equal(formatRegister(u.register),realText,'undo gives back the exact file');
 const c2=mk({id:other.id,file:'New/b.glb'}).change;assert.equal(c2.after.stage,'received','a received row stays received');assert.equal(recordLabel(c2),`Attached b.glb to ${other.name}`);
 const full={...reg,assets:reg.assets.map(r=>r.id===other.id?{...r,files:Array.from({length:MAX_FILES},(_,i)=>'F/'+i+'.glb')}:r)};assert.equal(mk({id:other.id,file:'New/b.glb'},{register:full}).code,409,'20 files at most');
 // forged stored changes
 for(const bad of [{...c,after:{...c.after,files:[...c.after.files,'New/b.glb']}},{...c,after:{...c.after,stage:'staged'}},{...c,after:{...c.after,name:'Other'}},{...c,after:{...c.after,files:['../x.glb']}},{...c,before:{...c.before,files:['New/q.glb']}},{...c,after:{...c.before}},{...c,after:{...c.after,stage:'in-game'}}])assert.equal(checkChange(bad),false,'forged attach '+JSON.stringify(bad.after.files));
 // a forged record cannot use the stage op to change files
 const mvc=makeChange({op:'asset-stage',input:{id:row.id,stage:'staged'},register:reg,by:'you',at:1,id:'rec-cccccc-0002'}).change;assert.equal(checkChange({...mvc,after:{...mvc.after,files:['New/a.glb']}}),false);
 // the parser
 const P2=parseRecordLine;let q=P2('RECORD: asset file oak-tree "Folder/name.glb"');assert.deepEqual([q.op,q.input],['asset-file',{id:'oak-tree',file:'Folder/name.glb'}]);
 q=P2('RECORD: asset file  oak-tree   "Tools/Steel_Axe by Quaternius.glb"');assert.equal(q.input.file,'Tools/Steel_Axe by Quaternius.glb');
 for(const line of ['RECORD: asset file','RECORD: asset file oak-tree','RECORD: asset file oak-tree Folder/name.glb','RECORD: asset file oak-tree \'a/b.glb\'','RECORD: asset file oak-tree "a/b.glb" extra','RECORD: asset file "a/b.glb"','RECORD: asset file oak-tree "../b.glb"','RECORD: asset file oak-tree "a\\b.glb"','RECORD: asset file oak-tree "/abs.glb"','RECORD: asset file oak-tree "a/b.txt"','RECORD: asset file oak-tree "a/b\u202e.glb"','RECORD: asset file __proto__ "a/b.glb"','RECORD: asset file Oak "a/b.glb"','RECORD: asset file oak-tree "a/b"c.glb"','RECORD: asset file oak-tree ""'])assert.ok(P2(line).error,'refused: '+line.slice(0,60));
 assert.ok(MASTER_RULES.includes('RECORD: asset file <id>'));
 assert.equal(extractRecords('RECORD: asset file oak-tree "a/b.glb"\nRECORD: asset stage oak-tree staged').ops.length,2);
 // the store: the file list is read first on a press; the master uses the list it already has
 const rootF=tmp(),fileList=['Incoming/oak_tree.glb','Incoming/bench.glb'],rsF=createRecords({root:rootF,now:()=>1700000000000,load:async()=>({assets:[]}),originals:async()=>fileList});
 const w=handRows(JSON.parse(fs.readFileSync(path.join(rootF,'assets-register.json'),'utf8'))).find(r=>r.stage==='wanted');
 let r1=rsF.applyMaster([{op:'asset-file',input:{id:w.id,file:'Incoming/oak_tree.glb'}}]);assert.equal(r1[0].ok,false,'the master cannot attach before the list was read');assert.match(r1[0].error,/not been read/);
 r1=await rsF.attach({id:w.id,file:'Incoming/oak_tree.glb'},'you');assert.ok(r1.change,JSON.stringify(r1));assert.equal(r1.change.label,`Attached oak_tree.glb to ${w.name} (now received)`);assert.equal(r1.row.stage,'received');
 assert.equal((await rsF.attach({id:w.id,file:'Incoming/oak_tree.glb'})).code,409);assert.equal((await rsF.attach({id:w.id,file:'Incoming/nope.glb'})).code,404);assert.equal((await rsF.attach({id:w.id,file:'x/../y.glb'})).code,400);
 let sF=await rsF.summary();assert.ok(!sF.newFiles.items.some(i=>i.path==='Incoming/oak_tree.glb'),'an attached file is no longer new');assert.deepEqual(sF.rows.find(x=>x.id===w.id).files,['Incoming/oak_tree.glb']);assert.equal(sF.rows.find(x=>x.id===w.id).undo,r1.change.id);assert.equal(sF.records[0].label,r1.change.label);
 const mm=rsF.applyMaster([{op:'asset-file',input:{id:w.id,file:'Incoming/bench.glb'}}]);assert.equal(mm[0].ok,true,JSON.stringify(mm));assert.equal(mm[0].op,'asset-file');
 assert.equal(rsF.undo(r1.change.id).code,409,'the later attach is undone first');assert.ok(rsF.undo(mm[0].id).undone);assert.ok(rsF.undo(r1.change.id).undone);assert.equal(fs.readFileSync(path.join(rootF,'assets-register.json'),'utf8'),realText,'both attachments undone: the file is as it started');
 // an attach after a hand edit of the row is refused on undo
 const r2=await rsF.attach({id:w.id,file:'Incoming/bench.glb'});fs.writeFileSync(path.join(rootF,'assets-register.json'),fs.readFileSync(path.join(rootF,'assets-register.json'),'utf8').replace('Incoming/bench.glb"]','Incoming/bench.glb","hand/added.glb"]'));assert.equal(rsF.undo(r2.change.id).code,409);
}
console.log('hub-records: ok');
