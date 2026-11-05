// Sign in with Google (OpenID Connect, authorization code flow with PKCE), run by the Worker.
//   GET /auth/google/start      -> 302 to Google, with state, nonce and a PKCE challenge kept in a short-lived HttpOnly cookie
//   GET /auth/google/callback   -> checks state, swaps the code for tokens (server to server, with the client secret), checks the ID token, signs in, 302 to /
// The ID token comes straight from Google's token endpoint over TLS, which OpenID Connect Core 3.1.3.7 accepts instead of a signature check;
// its issuer, audience, expiry and nonce are still checked. The email is used (for linking) only when Google says it is verified.
// Settings: GOOGLE_CLIENT_ID (wrangler.jsonc vars, public) and GOOGLE_CLIENT_SECRET (`npx wrangler secret put GOOGLE_CLIENT_SECRET`; .dev.vars for wrangler dev).
import {signIn,newToken} from './accounts.js';

export const OAUTH_COOKIE='cl_oauth',OAUTH_MINUTES=10;
const AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth',TOKEN_URL='https://oauth2.googleapis.com/token';
const ISSUERS=['https://accounts.google.com','accounts.google.com'];
export const googleReady=env=>!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);

const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const challengeFor=async verifier=>b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
const back=(origin,query,cookies=[])=>{const h=new Headers({location:`${origin}/?${query}`,'cache-control':'no-store'});for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:302,headers:h})};
const oauthCookie=(value,maxAge)=>`${OAUTH_COOKIE}=${value}; Path=/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const readCookie=(request,name)=>{for(const p of (request.headers.get('cookie')||'').split(';')){const i=p.indexOf('=');if(i>0&&p.slice(0,i).trim()===name)return p.slice(i+1).trim()}return null};
export function decodeJwtPayload(jwt){
 const part=String(jwt||'').split('.')[1];if(!part)return null;
 try{const s=atob(part.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder().decode(Uint8Array.from(s,c=>c.charCodeAt(0))))}catch{return null}
}
// Checks an ID token's claims; returns the identity or an error word.
export function checkIdToken(claims,{clientId,nonce,now}){
 if(!claims)return {error:'token'};
 if(!ISSUERS.includes(claims.iss))return {error:'issuer'};
 if(claims.aud!==clientId&&!(Array.isArray(claims.aud)&&claims.aud.includes(clientId)))return {error:'audience'};
 if(!Number.isFinite(claims.exp)||claims.exp*1000<now)return {error:'expired'};
 if(!nonce||claims.nonce!==nonce)return {error:'nonce'};
 if(typeof claims.sub!=='string'||!claims.sub)return {error:'subject'};
 return {identity:{provider:'google',subject:claims.sub,email:claims.email_verified===true&&typeof claims.email==='string'?claims.email:null,name:String(claims.given_name||claims.name||'').slice(0,40)}};
}

export async function handleGoogle(request,env,now=Date.now(),fetchFn=fetch){
 const url=new URL(request.url),origin=url.origin,redirectUri=`${origin}/auth/google/callback`;
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(!env.DB||!googleReady(env))return back(origin,'signin=unavailable');
 if(url.pathname==='/auth/google/start'){
  const state=newToken(),nonce=newToken(),verifier=newToken()+newToken(); // 86 characters: within PKCE's 43-128
  const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await challengeFor(verifier),code_challenge_method:'S256',prompt:'select_account'});
  return new Response(null,{status:302,headers:{location:`${AUTH_URL}?${q}`,'set-cookie':oauthCookie(`${state}.${nonce}.${verifier}`,OAUTH_MINUTES*60),'cache-control':'no-store'}});
 }
 if(url.pathname==='/auth/google/callback'){
  const clear=oauthCookie('',0);
  const [state,nonce,verifier]=(readCookie(request,OAUTH_COOKIE)||'').split('.');
  if(url.searchParams.get('error'))return back(origin,'signin=cancelled',[clear]); // the player said no on Google's page
  if(!state||url.searchParams.get('state')!==state)return back(origin,'signin=failed&why=state',[clear]);
  const code=url.searchParams.get('code');if(!code)return back(origin,'signin=failed&why=code',[clear]);
  let tokens;
  try{
   const res=await fetchFn(TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code',code_verifier:verifier})});
   if(!res.ok)return back(origin,'signin=failed&why=exchange',[clear]);
   tokens=await res.json();
  }catch{return back(origin,'signin=failed&why=network',[clear])}
  const checked=checkIdToken(decodeJwtPayload(tokens?.id_token),{clientId:env.GOOGLE_CLIENT_ID,nonce,now});
  if(checked.error)return back(origin,'signin=failed&why='+checked.error,[clear]);
  const {cookie}=await signIn(env,checked.identity,now);
  return back(origin,'signedin=google',[clear,cookie]);
 }
 return new Response('Not found',{status:404});
}
