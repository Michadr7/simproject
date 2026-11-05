// Accounts and cloud saves for the `simproject` Worker (routes under /api/). Storage: the D1 database bound as env.DB (migrations/0001_accounts.sql).
//   GET  /api/me              who is signed in: {user:{id,name,providers}} or {user:null}
//   GET  /api/save            the cloud save: {save, revision, savedAt, game} (save null when there is none)
//   PUT  /api/save            {file, baseRevision}: stored as revision+1, or 409 {revision,savedAt,game} if the cloud copy moved on since baseRevision
//   POST /api/logout          ends this session
//   POST /api/dev-login       {name}: local development only (env.DEV_LOGIN === '1' and a localhost address); signs in as dev:<name>
// Sign-in methods (Google, email links) add identities through signIn(); they are built in later steps.
// Sessions: a random token in an HttpOnly cookie; only its SHA-256 is stored. Changes need the X-City-Life header and a same-site Origin (no cross-site requests).
import {SAVE_FORMAT,SAVE_FORMAT_VERSION} from '../dist/save-file-format.js';

export const SESSION_COOKIE='cl_session',SESSION_DAYS=30,MAX_SAVE_BYTES=512*1024,MIN_SAVE_INTERVAL_MS=3000;
const DAY=86400000;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const fail=(status,error,extra={})=>json({error,...extra},status);

const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const newToken=()=>b64url(crypto.getRandomValues(new Uint8Array(32)));
export async function sha256(text){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
export function readCookie(request,name){
 for(const part of (request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim()}
 return null;
}
const sessionCookie=(token,maxAge)=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const isLocal=url=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);

// A change must come from this site's own page: the custom header cannot be sent cross-site without a CORS preflight we never answer, and Origin must match.
export function sameSiteChange(request){
 if(request.headers.get('x-city-life')!=='1')return false;
 const origin=request.headers.get('origin');
 return !origin||origin===new URL(request.url).origin;
}

export async function currentUser(request,env,now){
 const token=readCookie(request,SESSION_COOKIE);
 if(!token||token.length>100)return null;
 const row=await env.DB.prepare('SELECT s.user_id AS id, u.display_name AS name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token),now).first();
 return row?{id:row.id,name:row.name,tokenHash:await sha256(token)}:null;
}

// Finds or creates the user for an identity, linking by verified email when another identity already has it. Returns the user id.
export async function findOrCreateUser(env,{provider,subject,email=null,name=''},now){
 const db=env.DB;
 const known=await db.prepare('SELECT user_id FROM identities WHERE provider=? AND subject=?').bind(provider,subject).first();
 if(known)return known.user_id;
 const mail=email?String(email).toLowerCase():null;
 let userId=mail?(await db.prepare('SELECT user_id FROM identities WHERE email=? LIMIT 1').bind(mail).first())?.user_id:null;
 if(!userId){userId=crypto.randomUUID();await db.prepare('INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)').bind(userId,String(name).slice(0,40),now).run()}
 await db.prepare('INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)').bind(provider,subject,userId,mail,now).run();
 return userId;
}
// Starts a session for a user: returns the Set-Cookie header value.
export async function startSession(env,userId,now){
 const token=newToken();
 await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token),userId,now,now+SESSION_DAYS*DAY).run();
 await env.DB.prepare('DELETE FROM sessions WHERE user_id=? AND expires_at<=?').bind(userId,now).run(); // tidy this user's expired ones
 return sessionCookie(token,SESSION_DAYS*86400);
}
export async function signIn(env,identity,now){const userId=await findOrCreateUser(env,identity,now);return {userId,cookie:await startSession(env,userId,now)}}

// Only the envelope is checked here; the game normalises everything inside it when it loads (save-file.js), so the Worker needs none of the game's code.
export function checkSaveFile(file){
 if(!file||typeof file!=='object'||file.format!==SAVE_FORMAT)return 'not a save file';
 if(!Number.isInteger(file.formatVersion)||file.formatVersion<1||file.formatVersion>SAVE_FORMAT_VERSION)return 'unknown save format';
 if(!file.profile||typeof file.profile!=='object')return 'no player in the save';
 return null;
}

export async function handleAccounts(request,env,now=Date.now()){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!env.DB)return fail(503,'accounts are not set up on this server');
 const changing=method!=='GET'&&method!=='HEAD';
 if(changing&&!sameSiteChange(request))return fail(403,'forbidden');

 if(path==='/api/dev-login'&&method==='POST'){
  if(env.DEV_LOGIN!=='1'||!isLocal(request.url))return fail(404,'not found');
  const body=await request.json().catch(()=>({}));const name=String(body.name||'tester').replace(/[^a-z0-9-]/gi,'').slice(0,20)||'tester';
  const {cookie}=await signIn(env,{provider:'dev',subject:name,email:body.email||null,name},now);
  return json({ok:true},200,{'set-cookie':cookie});
 }
 const user=await currentUser(request,env,now);
 if(path==='/api/me'&&method==='GET'){
  // methods: the sign-in buttons this server can offer (Google once its client id and secret are set; dev only locally).
  const methods=[...(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET?['google']:[]),...(env.DEV_LOGIN==='1'&&isLocal(request.url)?['dev']:[])];
  if(!user)return json({user:null,methods});
  const {results}=await env.DB.prepare('SELECT provider FROM identities WHERE user_id=?').bind(user.id).all();
  return json({user:{id:user.id,name:user.name,providers:[...new Set(results.map(r=>r.provider))]},methods});
 }
 if(path==='/api/logout'&&method==='POST'){
  if(user)await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(user.tokenHash).run();
  return json({ok:true},200,{'set-cookie':sessionCookie('',0)});
 }
 if(path==='/api/save'){
  if(!user)return fail(401,'sign in first');
  const row=await env.DB.prepare('SELECT data, game, saved_at, revision FROM saves WHERE user_id=?').bind(user.id).first();
  if(method==='GET')return json(row?{save:JSON.parse(row.data),revision:row.revision,savedAt:row.saved_at,game:row.game}:{save:null,revision:0,savedAt:null,game:null});
  if(method==='PUT'){
   const text=await request.text();
   if(text.length>MAX_SAVE_BYTES)return fail(413,'save too big');
   let body;try{body=JSON.parse(text)}catch{return fail(400,'bad request')}
   const problem=checkSaveFile(body?.file);if(problem)return fail(400,problem);
   if(!Number.isInteger(body.baseRevision)||body.baseRevision<0)return fail(400,'baseRevision missing');
   const current=row?.revision??0;
   if(body.baseRevision!==current)return fail(409,'the cloud save changed',{revision:current,savedAt:row?.saved_at??null,game:row?.game??null});
   if(row&&now-row.saved_at<MIN_SAVE_INTERVAL_MS)return fail(429,'too soon',{retryAfterMs:MIN_SAVE_INTERVAL_MS-(now-row.saved_at)});
   const game=typeof body.file.game==='string'?body.file.game.slice(0,12):null,data=JSON.stringify(body.file);
   // The revision check is repeated inside the write, so two writes racing from the same base cannot both win.
   const result=row
    ?await env.DB.prepare('UPDATE saves SET data=?, game=?, saved_at=?, revision=revision+1 WHERE user_id=? AND revision=?').bind(data,game,now,user.id,current).run()
    :await env.DB.prepare('INSERT OR IGNORE INTO saves (user_id, data, game, saved_at, revision) VALUES (?, ?, ?, ?, 1)').bind(user.id,data,game,now).run();
   if(!result.meta?.changes)return fail(409,'the cloud save changed',{revision:current+1});
   return json({ok:true,revision:current+1,savedAt:now});
  }
 }
 return fail(404,'not found');
}
