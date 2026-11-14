// Accounts and cloud saves (worker/accounts.js) against a real SQLite database (node:sqlite) wearing D1's interface, with the real migration applied.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {handleAccounts,SESSION_COOKIE,MIN_SAVE_INTERVAL_MS,MAX_SAVE_BYTES,sha256,findOrCreateUser} from '../worker/accounts.js';
import {handleRequest} from '../worker/lobby.js';
import {SAVE_FORMAT,SAVE_FORMAT_VERSION} from '../dist/save-file.js';

function fakeD1(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 const prepare=sql=>{let args=[];const st=db.prepare(sql);const api={bind:(...a)=>{args=a;return api},first:async()=>st.get(...args)??null,all:async()=>({results:st.all(...args)}),run:async()=>{const r=st.run(...args);return {meta:{changes:Number(r.changes)}}}};return api};
 return {db,prepare};
}
const D1=fakeD1();D1.db.exec(await readFile('migrations/0001_accounts.sql','utf8'));
const env={DB:D1,DEV_LOGIN:'1'};
let now=1_800_000_000_000;
const LOCAL='http://127.0.0.1:8787',LIVE='https://simproject.ghostjumper007.workers.dev';
let cookie='';
const call=async(path,{method='GET',body,base=LOCAL,headers={},jar=true,e=env}={})=>{
 const h={...(method!=='GET'?{'x-eden-ridge':'1',origin:base}:{}),...(jar&&cookie?{cookie}:{}),...headers};
 const res=await handleAccounts(new Request(base+path,{method,headers:h,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)}),e,now);
 const set=res.headers.get('set-cookie');
 return {status:res.status,body:await res.json(),set};
};
const file=(cash,game='0.35.0')=>({format:SAVE_FORMAT,formatVersion:SAVE_FORMAT_VERSION,game,savedAt:new Date(now).toISOString(),profile:{name:'Ada',progress:{cash}},character:{name:'Ada'}});

// Without a database: a clear 503, not a crash
assert.equal((await call('/api/me',{e:{}})).status,503);
// Signed out
assert.deepEqual((await call('/api/me')).body,{user:null,methods:['dev']});
assert.equal((await call('/api/save')).status,401);
// The dev login exists only locally and only when switched on
assert.equal((await call('/api/dev-login',{method:'POST',body:{name:'ada'},e:{DB:D1}})).status,404,'off unless DEV_LOGIN=1');
assert.equal((await call('/api/dev-login',{method:'POST',body:{name:'ada'},base:LIVE})).status,404,'never on the live address');
// Changes need the header and this site's Origin
assert.equal((await call('/api/dev-login',{method:'POST',body:{name:'ada'},headers:{'x-eden-ridge':''}})).status,403);
assert.equal((await call('/api/dev-login',{method:'POST',body:{name:'ada'},headers:{origin:'https://evil.example'}})).status,403);
const login=await call('/api/dev-login',{method:'POST',body:{name:'ada',email:'Ada@Example.com'}});
assert.equal(login.status,200);assert.match(login.set,new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000$`));
cookie=login.set.split(';')[0];
const token=cookie.split('=')[1];
const stored=D1.db.prepare('SELECT token_hash FROM sessions').all();assert.equal(stored.length,1);assert.notEqual(stored[0].token_hash,token);assert.equal(stored[0].token_hash,await sha256(token),'only the hash is stored');
const me=(await call('/api/me')).body.user;assert.equal(me.name,'ada');assert.deepEqual(me.providers,['dev']);
// A wrong or forged cookie is nobody
assert.deepEqual((await call('/api/me',{jar:false,headers:{cookie:`${SESSION_COOKIE}=${'x'.repeat(43)}`}})).body,{user:null,methods:['dev']});

// Cloud save: none yet, then revisions; bad files, size, too-soon and stale writes are refused
assert.deepEqual((await call('/api/save')).body,{save:null,revision:0,savedAt:null,game:null});
assert.equal((await call('/api/save',{method:'PUT',body:{file:{format:'x'},baseRevision:0}})).status,400);
assert.equal((await call('/api/save',{method:'PUT',body:{file:{...file(1),formatVersion:SAVE_FORMAT_VERSION+1},baseRevision:0}})).status,400);
assert.equal((await call('/api/save',{method:'PUT',body:{file:file(1)}})).status,400,'baseRevision is required');
assert.equal((await call('/api/save',{method:'PUT',body:'x'.repeat(MAX_SAVE_BYTES+1)})).status,413);
let put=await call('/api/save',{method:'PUT',body:{file:file(100),baseRevision:0}});assert.deepEqual(put.body,{ok:true,revision:1,savedAt:now});
put=await call('/api/save',{method:'PUT',body:{file:file(200),baseRevision:1}});assert.equal(put.status,429,'not more often than every '+MIN_SAVE_INTERVAL_MS+' ms');
now+=MIN_SAVE_INTERVAL_MS;
put=await call('/api/save',{method:'PUT',body:{file:file(200),baseRevision:0}});assert.equal(put.status,409,'another browser already wrote revision 1');assert.equal(put.body.revision,1);assert.equal(put.body.game,'0.35.0');
put=await call('/api/save',{method:'PUT',body:{file:file(200),baseRevision:1}});assert.equal(put.body.revision,2);
const got=(await call('/api/save')).body;assert.equal(got.revision,2);assert.equal(got.save.profile.progress.cash,200);assert.equal(got.game,'0.35.0');

// Linking: the same verified email from another provider is the same person; a different email is someone else
const same=await findOrCreateUser(env,{provider:'google',subject:'g-123',email:'ADA@example.com',name:'Ada'},now);assert.equal(same,me.id);
assert.deepEqual((await call('/api/me')).body.user.providers.sort(),['dev','google']);
assert.equal(await findOrCreateUser(env,{provider:'google',subject:'g-123',email:'other@example.com'},now),me.id,'a known identity keeps its user');
assert.notEqual(await findOrCreateUser(env,{provider:'google',subject:'g-999',email:'bob@example.com'},now),me.id);
assert.notEqual(await findOrCreateUser(env,{provider:'google',subject:'g-998'},now),me.id,'no email: never linked');

// Sessions end: after 30 days, and on logout (cookie cleared, row deleted)
const later=now;now+=31*86400000;assert.deepEqual((await call('/api/me')).body,{user:null,methods:['dev']},'expired');now=later;
const out=await call('/api/logout',{method:'POST'});assert.equal(out.status,200);assert.match(out.set,/^cl_session=; .*Max-Age=0$/);
assert.deepEqual((await call('/api/me')).body,{user:null,methods:['dev']});assert.equal(D1.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE token_hash=?').get(await sha256(token)).n,0);
assert.equal((await call('/api/nothing')).status,404);
// The Worker routes /api/ here
const routed=await handleRequest(new Request(LOCAL+'/api/me'),env);assert.equal(routed.status,200);assert.deepEqual(await routed.json(),{user:null,methods:['dev']});
console.log('Accounts: no-database 503, dev login only locally and when switched on, header and Origin required for changes, HttpOnly cookie with only its hash stored, cloud save revisions (bad file, size, too soon, stale 409), linking by verified email, expiry, logout, and /api/ routing passed.');
