// Sign in with Google (worker/google.js) with a fake token endpoint, on SQLite; and the Account panel's Google button and return messages.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {handleGoogle,checkIdToken,decodeJwtPayload,OAUTH_COOKIE} from '../worker/google.js';
import {handleAccounts,SESSION_COOKIE,findOrCreateUser} from '../worker/accounts.js';
import {handleRequest} from '../worker/lobby.js';
import {createAccountMenu,SIGNIN_TEXT} from '../dist/account-menu.js';

const db=new DatabaseSync(':memory:');db.exec(await readFile('migrations/0001_accounts.sql','utf8'));
const D1={prepare:sql=>{let a=[];const st=db.prepare(sql);const api={bind:(...x)=>{a=x;return api},first:async()=>st.get(...a)??null,all:async()=>({results:st.all(...a)}),run:async()=>({meta:{changes:Number(st.run(...a).changes)}})};return api}};
const CLIENT='458836423148-test.apps.googleusercontent.com',SITE='https://simproject.ghostjumper007.workers.dev';
const env={DB:D1,GOOGLE_CLIENT_ID:CLIENT,GOOGLE_CLIENT_SECRET:'shh'};
const now=1_800_000_000_000;
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=claims=>`${b64({alg:'RS256'})}.${b64(claims)}.sig`;
const claimsFor=(nonce,extra={})=>({iss:'https://accounts.google.com',aud:CLIENT,exp:now/1000+600,nonce,sub:'g-42',email:'Ada@Example.com',email_verified:true,given_name:'Ada',...extra});

// Not set up: back to the menu with a clear reason, and /api/me offers no Google button
let res=await handleGoogle(new Request(SITE+'/auth/google/start'),{DB:D1,GOOGLE_CLIENT_ID:CLIENT},now);
assert.equal(res.status,302);assert.equal(res.headers.get('location'),SITE+'/?signin=unavailable');
assert.deepEqual((await (await handleAccounts(new Request(SITE+'/api/me'),{DB:D1,GOOGLE_CLIENT_ID:CLIENT},now)).json()).methods,[]);
assert.deepEqual((await (await handleAccounts(new Request(SITE+'/api/me'),env,now)).json()).methods,['google']);

// Start: off to Google with everything the flow needs, and the secrets of this attempt in a short-lived HttpOnly cookie
res=await handleRequest(new Request(SITE+'/auth/google/start'),env);
assert.equal(res.status,302);const to=new URL(res.headers.get('location'));
assert.equal(to.origin+to.pathname,'https://accounts.google.com/o/oauth2/v2/auth');
const q=Object.fromEntries(to.searchParams);
assert.equal(q.client_id,CLIENT);assert.equal(q.redirect_uri,SITE+'/auth/google/callback');assert.equal(q.response_type,'code');assert.equal(q.scope,'openid email profile');assert.equal(q.code_challenge_method,'S256');
const set=res.headers.get('set-cookie');assert.match(set,new RegExp(`^${OAUTH_COOKIE}=[^;]+; Path=/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600$`));
const [state,nonce,verifier]=set.split(';')[0].split('=')[1].split('.');
assert.equal(q.state,state);assert.equal(q.nonce,nonce);assert(verifier.length>=43&&verifier.length<=128);
const expected=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');assert.equal(q.code_challenge,expected,'PKCE S256');
assert.equal(new URL(new Request('http://127.0.0.1:8787/auth/google/start').url).origin,'http://127.0.0.1:8787');
const local=new URL((await handleGoogle(new Request('http://127.0.0.1:8787/auth/google/start'),env,now)).headers.get('location'));assert.equal(local.searchParams.get('redirect_uri'),'http://127.0.0.1:8787/auth/google/callback','local tests use the local callback');

// Callback
const cookie=`${OAUTH_COOKIE}=${state}.${nonce}.${verifier}`;
let sent=null;
const google=(claims,ok=true)=>async(url,opts)=>{sent={url,body:Object.fromEntries(new URLSearchParams(opts.body))};return new Response(JSON.stringify({id_token:jwt(claims)}),{status:ok?200:400})};
const callback=(query,fetchFn,c=cookie)=>handleGoogle(new Request(`${SITE}/auth/google/callback?${query}`,{headers:{cookie:c}}),env,now,fetchFn);
const where=r=>r.headers.get('location').replace(SITE+'/?','');
assert.equal(where(await callback('error=access_denied&state='+state,google({}))),'signin=cancelled');
assert.equal(where(await callback('code=c&state=wrong',google({}))),'signin=failed&why=state','another tab\'s or an attacker\'s state is refused');
assert.equal(where(await callback('code=c&state='+state,google({}),'')),'signin=failed&why=state','no cookie: refused');
assert.equal(where(await callback('state='+state,google({}))),'signin=failed&why=code');
assert.equal(where(await callback('code=c&state='+state,google(claimsFor(nonce),false))),'signin=failed&why=exchange');
assert.equal(where(await callback('code=c&state='+state,async()=>{throw new TypeError('down')})),'signin=failed&why=network');
for(const [bad,why] of [[{iss:'https://evil.example'},'issuer'],[{aud:'someone-else'},'audience'],[{exp:now/1000-1},'expired'],[{nonce:'other'},'nonce'],[{sub:''},'subject']])
 assert.equal(where(await callback('code=c&state='+state,google(claimsFor(nonce,bad)))),'signin=failed&why='+why);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0,'no failure made a session');
res=await callback('code=the-code&state='+state,google(claimsFor(nonce)));
assert.equal(where(res),'signedin=google');
assert.deepEqual(sent.body,{code:'the-code',client_id:CLIENT,client_secret:'shh',redirect_uri:SITE+'/auth/google/callback',grant_type:'authorization_code',code_verifier:verifier},'the exchange sends the code, the secret and the PKCE verifier');
assert.equal(sent.url,'https://oauth2.googleapis.com/token');
const cookies=res.headers.getSetCookie();assert(cookies.some(c=>c.startsWith(OAUTH_COOKIE+'=;')&&c.includes('Max-Age=0')),'the attempt cookie is cleared');
const session=cookies.find(c=>c.startsWith(SESSION_COOKIE+'='));assert(session);
const me=await (await handleAccounts(new Request(SITE+'/api/me',{headers:{cookie:session.split(';')[0]}}),env,now)).json();
assert.equal(me.user.name,'Ada');assert.deepEqual(me.user.providers,['google']);
assert.equal(db.prepare('SELECT email FROM identities WHERE provider=?').get('google').email,'ada@example.com');
// The same Google account again: the same user. An unverified email is never used for linking.
assert.equal(await findOrCreateUser(env,{provider:'google',subject:'g-42'},now),me.user.id);
assert.equal(checkIdToken(claimsFor('n',{email_verified:false}),{clientId:CLIENT,nonce:'n',now}).identity.email,null);
assert.equal(checkIdToken(claimsFor('n',{aud:[CLIENT,'x']}),{clientId:CLIENT,nonce:'n',now}).identity.subject,'g-42','a list audience that names us is fine');
assert.equal(decodeJwtPayload('nonsense'),null);assert.equal(decodeJwtPayload('a.!!!.c'),null);
assert.equal((await handleGoogle(new Request(SITE+'/auth/google/start',{method:'POST'}),env,now)).status,405);

// The Account panel: the Google button follows the server; clicking it leaves for /auth/google/start; the return is reported
class El{constructor(){this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.dataset={}}}
const panel=(methods,user,returned)=>{const els=new Map(),$=id=>els.get(id)??els.set(id,new El()).get(id),log=[];
 const cloud={user:null,methods:[],me:async()=>{cloud.user=user;cloud.methods=methods;return {available:true,user}},sync:async()=>({status:'synced'}),logout:async()=>{},devLogin:async()=>true};
 const m=createAccountMenu({$,cloud,reload:()=>log.push('reload'),show:()=>log.push('show'),navigate:u=>log.push(u),returned});return {$,log,m}};
{const p=panel([],null);await p.m.start();assert(p.$('accountGoogle').disabled);assert.match(p.$('accountGoogle').textContent,/coming soon/);assert(p.$('accountDevLogin').hidden);}
{const p=panel(['google','dev'],null);await p.m.start();assert(!p.$('accountGoogle').disabled);assert.equal(p.$('accountGoogle').textContent,'Sign in with Google');assert(!p.$('accountDevLogin').hidden);
 p.$('accountGoogle').onclick();assert.deepEqual(p.log,['/auth/google/start']);}
{const p=panel(['google'],{id:'u',name:'Ada',providers:['google']},{signedin:'google'});await p.m.start();assert.deepEqual(p.log,['show'],'back from Google: the Account panel opens');assert.match(p.$('accountStatus').textContent,/^Signed in\./);assert(p.$('accountSignedOut').hidden);}
for(const why of ['cancelled','failed','unavailable']){const p=panel(['google'],null,{signin:why});await p.m.start();assert.equal(p.$('accountStatus').textContent,SIGNIN_TEXT[why]);assert.deepEqual(p.log,['show'])}
console.log('Google sign-in: not-set-up fallback, the redirect (client, callback, scopes, state, nonce, PKCE S256, HttpOnly attempt cookie), cancelled/state/code/exchange/network failures, ID token issuer/audience/expiry/nonce/subject checks, success (session, attempt cookie cleared, verified email kept), and the Account panel\'s Google button and return messages passed.');
