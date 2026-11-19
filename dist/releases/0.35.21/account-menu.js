// The main menu's Account panel: sign in or out, the cloud save's state, Sync now, and the "which save to keep?" choice. The rules are in cloud-save.js.
import {money} from './save-menu.js';

const when=iso=>iso?new Date(iso).toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const line=s=>`${s.name} · ${money(s.cash)} · day ${s.day}, ${s.clock}${s.vehicles?` · ${s.vehicles} vehicle${s.vehicles>1?'s':''}`:''}${s.savedAt?` · saved ${when(s.savedAt)}`:''}${s.game?` · v${s.game}`:''}`;

// The sign-in buttons follow what the server offers (cloud.methods): Google once it is set up, the developer sign-in only under `wrangler dev` on this computer.
// reload(): the save changed, start the page again. navigate(url): leave for Google's sign-in page. returned: the query the server sent us back with (signedin / signin=...).
export const SIGNIN_TEXT={cancelled:'Sign-in cancelled.',unavailable:'Sign-in with Google is not set up on this server yet.',failed:'Google sign-in did not work. Please try again.'};
export function createAccountMenu({$,cloud,reload,show,navigate=()=>{},returned=null}){
 const status=(text,kind='')=>{$('accountStatus').textContent=text;$('accountStatus').dataset.kind=kind};
 let conflict=null;
 function render(){
  const user=cloud.user,google=cloud.methods.includes('google');
  $('accountSignedOut').hidden=!!user;$('accountSignedIn').hidden=!user;
  $('accountDevLogin').hidden=!cloud.methods.includes('dev');
  $('accountGoogle').disabled=!google;$('accountGoogle').textContent=google?'Sign in with Google':'Sign in with Google · coming soon';
  if(user)$('accountWho').textContent=`Signed in as ${user.name||'player'}${user.providers?.length?` (${user.providers.join(', ')})`:''}.`;
  $('accountConflict').hidden=!conflict;
  if(conflict){$('accountConflictHere').textContent='This browser: '+line(conflict.here);$('accountConflictCloud').textContent='Cloud: '+line(conflict.cloud)}
 }
 async function sync(){
  status('Checking the cloud save…');
  const r=await cloud.sync();conflict=null;
  if(r.status==='downloaded'){status('Loading the cloud save…','ok');reload();return r}
  if(r.status==='conflict'){conflict=r;status('This browser and the cloud have different saves. Which one do you want to keep?','error');show?.()}
  else status({'synced':'Your save is in the cloud.','uploaded':'Your save is in the cloud.','signed-out':'','unavailable':'Accounts are not available on this server.','offline':'Offline: the cloud save will sync later.','later':'Synced a moment ago.'}[r.status]??('Could not sync: '+(r.error||r.status)),r.status==='synced'||r.status==='uploaded'?'ok':r.status==='error'?'error':'');
  render();return r;
 }
 async function choose(which){
  if(!conflict)return;
  const r=await conflict.resolve(which);conflict=null;
  if(r.status==='downloaded'){status('Loading the cloud save…','ok');reload();return}
  if(r.status==='uploaded')status('This browser\'s save is now the cloud save.','ok');else{status('That did not work ('+r.status+'). Try Sync now.','error')}
  render();
 }
 $('accountKeepLocal').onclick=()=>choose('here');
 $('accountUseCloud').onclick=()=>choose('cloud');
 $('accountSyncNow').onclick=()=>sync();
 $('accountSignOut').onclick=async()=>{await cloud.logout();conflict=null;status('Signed out. Your save stays on this browser.');render()};
 $('accountDevLoginGo').onclick=async()=>{
  const name=($('accountDevName').value||'tester').trim();
  if(!await cloud.devLogin(name)){status('The developer sign-in only works under `npx wrangler dev` on this computer.','error');return}
  await sync();
 };
 $('accountGoogle').onclick=()=>{status('Opening Google…');navigate('/auth/google/start')};
 // On page load: find out who is signed in and sync quietly (a conflict opens this panel). Coming back from Google opens it too, with the outcome.
 async function start(){
  const who=await cloud.me();
  if(who.user)await sync();else{status(who.available?'':'Accounts are not available on this server.');render()}
  if(returned?.signedin&&who.user){if(!conflict&&$('accountStatus').dataset.kind!=='error')status(`Signed in. ${$('accountStatus').textContent}`.trim(),'ok');show?.()}
  else if(returned?.signin){status(SIGNIN_TEXT[returned.signin]||SIGNIN_TEXT.failed,returned.signin==='cancelled'?'':'error');show?.()}
 }
 render();
 return {start,sync,render};
}
