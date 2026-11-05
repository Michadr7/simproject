// Cloud saves end to end: the game's client (dist/cloud-save.js) against the real Worker code (worker/accounts.js) on SQLite, with two browsers on one account.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {handleAccounts,MIN_SAVE_INTERVAL_MS} from '../worker/accounts.js';
import {createCloud,planSync,fingerprint,loadCloudState} from '../dist/cloud-save.js';
import {writeStoredSave,readStoredSave,loadBackups,makeSaveFile} from '../dist/save-file.js';

const db=new DatabaseSync(':memory:');db.exec(await readFile('migrations/0001_accounts.sql','utf8'));
const D1={prepare:sql=>{let a=[];const st=db.prepare(sql);const api={bind:(...x)=>{a=x;return api},first:async()=>st.get(...a)??null,all:async()=>({results:st.all(...a)}),run:async()=>({meta:{changes:Number(st.run(...a).changes)}})};return api}};
const env={DB:D1,DEV_LOGIN:'1'};let now=1_800_000_000_000;const tick=()=>{now+=MIN_SAVE_INTERVAL_MS+1};
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function browser(){
 const storage=memory();let jar='';
 const fetchFn=async(path,opts={})=>{
  const headers={...opts.headers,origin:'http://127.0.0.1:8787',...(jar?{cookie:jar}:{})};
  const res=await handleAccounts(new Request('http://127.0.0.1:8787'+path,{method:opts.method||'GET',headers,body:opts.body}),env,now);
  const set=res.headers.get('set-cookie');if(set)jar=set.split(';')[0].endsWith('=')?'':set.split(';')[0];
  return res;
 };
 return {storage,cloud:createCloud({fetchFn,storage,version:'0.34.4',now:()=>now})};
}
const player=(cash,name='Ada')=>({profile:{playerId:'p1',name,progress:{cash}},character:{name}});
const cash=b=>readStoredSave(b.storage).profile.progress.cash;

// planSync on its own: every case
{const a=readStoredSave((()=>{const s=memory();writeStoredSave(s,player(1));return s})()),b=readStoredSave((()=>{const s=memory();writeStoredSave(s,player(2));return s})());
 const file=s=>makeSaveFile(s,{version:'x'});
 assert.equal(planSync({local:null,cloud:{save:null,revision:0},state:null,userId:'u'}).action,'none');
 assert.deepEqual(planSync({local:a,cloud:{save:null,revision:0},state:null,userId:'u'}),{action:'upload',base:0});
 assert.equal(planSync({local:null,cloud:{save:file(a),revision:3},state:null,userId:'u'}).action,'download');
 assert.equal(planSync({local:a,cloud:{save:file(a),revision:3},state:null,userId:'u'}).action,'mark','the same save on both sides');
 assert.equal(planSync({local:b,cloud:{save:file(a),revision:3},state:{userId:'u',revision:3,fingerprint:fingerprint(a)},userId:'u'}).action,'upload','only this browser changed');
 assert.equal(planSync({local:a,cloud:{save:file(b),revision:4},state:{userId:'u',revision:3,fingerprint:fingerprint(a)},userId:'u'}).action,'download','only the cloud changed');
 assert.equal(planSync({local:b,cloud:{save:file(b),revision:4},state:{userId:'u',revision:3,fingerprint:fingerprint(a)},userId:'u'}).action,'mark');
 const c=readStoredSave((()=>{const s=memory();writeStoredSave(s,player(3));return s})());
 assert.equal(planSync({local:c,cloud:{save:file(b),revision:4},state:{userId:'u',revision:3,fingerprint:fingerprint(a)},userId:'u'}).action,'ask','both changed');
 assert.equal(planSync({local:b,cloud:{save:file(a),revision:3},state:{userId:'other',revision:3,fingerprint:fingerprint(a)},userId:'u'}).action,'ask','another account\'s record proves nothing');
 assert.equal(planSync({local:a,cloud:{save:{format:'junk'},revision:2},state:null,userId:'u'}).action,'upload','a damaged cloud save is replaced');}

// Two browsers, one account
const A=browser(),B=browser();
assert.equal((await A.cloud.sync()).status,'signed-out');
writeStoredSave(A.storage,player(100));
assert(await A.cloud.devLogin('ada'));assert.equal((await A.cloud.sync()).status,'uploaded','first sign-in: this browser\'s save goes up');
assert.equal(loadCloudState(A.storage).revision,1);
assert.equal((await A.cloud.pushIfChanged()).status,'unchanged');
// B has no save: signing in brings the cloud one down (and there is nothing to back up)
assert(await B.cloud.devLogin('ada'));assert.equal((await B.cloud.sync()).status,'downloaded');assert.equal(cash(B),100);
// Playing on A: pushes only when changed
tick();writeStoredSave(A.storage,player(250));assert.equal((await A.cloud.pushIfChanged()).status,'uploaded');assert.equal(loadCloudState(A.storage).revision,2);
// B untouched since its sync: the newer cloud save simply comes down, the old one is backed up
tick();assert.equal((await B.cloud.sync()).status,'downloaded');assert.equal(cash(B),250);assert.equal(loadBackups(B.storage)[0].save.profile.progress.cash,100);assert.equal(loadBackups(B.storage)[0].reason,'before cloud download');
// Both change: A uploads first; B's push meets a 409 and its sync asks
tick();writeStoredSave(A.storage,player(400));assert.equal((await A.cloud.pushIfChanged()).status,'uploaded');
tick();writeStoredSave(B.storage,player(999));assert.equal((await B.cloud.pushIfChanged()).status,'conflict','never overwrites the other browser\'s newer save');
const ask=await B.cloud.sync();assert.equal(ask.status,'conflict');assert.equal(ask.here.cash,999);assert.equal(ask.cloud.cash,400);assert.equal(ask.cloud.game,'0.34.4');assert(ask.cloud.savedAt);
// Keep this browser's: it becomes the cloud save; A then downloads it
tick();assert.equal((await ask.resolve('here')).status,'uploaded');tick();assert.equal((await A.cloud.sync()).status,'downloaded');assert.equal(cash(A),999);
// Or use the cloud's: both change again, B picks the cloud
tick();writeStoredSave(A.storage,player(10));await A.cloud.pushIfChanged();writeStoredSave(B.storage,player(20));tick();
const ask2=await B.cloud.sync();assert.equal(ask2.status,'conflict');assert.equal((ask2.resolve('cloud')).status,'downloaded');assert.equal(cash(B),10);assert.equal(loadBackups(B.storage)[0].save.profile.progress.cash,20,'the discarded save is still in Backups');
// Another account on the same browser does not inherit the sync record
const C=browser();writeStoredSave(C.storage,player(5,'Bo'));await C.cloud.devLogin('bo');assert.equal((await C.cloud.sync()).status,'uploaded');
await C.cloud.logout();assert.equal(C.cloud.user,null);assert.equal((await C.cloud.sync()).status,'signed-out');assert.equal((await C.cloud.pushIfChanged()).status,'skipped');
// A server without accounts (npm run dev) or no network: says so, never throws
const none=createCloud({fetchFn:async()=>new Response('nope',{status:404}),storage:memory(),version:'x'});assert.equal((await none.sync()).status,'unavailable');
const offline=createCloud({fetchFn:async()=>{throw new TypeError('network')},storage:memory(),version:'x'});assert.equal((await offline.sync()).status,'unavailable');
console.log('Cloud saves: every sync case, first upload, download on a new browser, push only when changed, the other browser catches up (old save backed up), a both-changed conflict never overwrites and resolves either way, per-account sync records, sign-out, and no server or no network.');
