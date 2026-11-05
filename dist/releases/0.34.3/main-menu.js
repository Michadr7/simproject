// Main menu: Play, Multiplayer (host / join), Settings, Credits. The DOM lives in index.html (#welcome); game.js passes in what the menu needs.
// Online: the hosted relay (worker/lobby.js) with lobby codes. Local server: a browser page cannot start a server, so "host" means "use the relay running on this computer" and "join" means "use the relay at this address".
import {normalizeLobbyCode,REFUSED} from './relay-protocol.js';
export const DEFAULT_SERVER='ws://localhost:8080';
export const LIVE_RELAY='wss://simproject.ghostjumper007.workers.dev';
// Where the online relay is for a page at this address: the site's own (the live site, `npx wrangler dev` on 8787), except a page on this computer
// served by something without a relay (`npm run dev`, a file) uses the live one, which allows localhost pages.
export function relayBase(loc){
 const host=loc?.hostname??'',local=!host||['localhost','127.0.0.1','[::1]','::1'].includes(host);
 if(!/^https?:$/.test(loc?.protocol??'')||local&&loc.port!=='8787')return LIVE_RELAY;
 return (loc.protocol==='https:'?'wss://':'ws://')+loc.host;
}
// What the player reads when the relay says no.
export function refusalText(reason){
 return {[REFUSED.update]:'This copy of the game is older than the server. Reload to update, then join again.',
  [REFUSED.serverOld]:'The server is older than this game. It is probably being updated: try again in a minute.',
  [REFUSED.full]:'That lobby is full (8 players).',
  [REFUSED.noLobby]:'No lobby has that code. Check it, or create a new lobby.'}[reason]||'The server turned the connection down.';
}
export const SERVER_KEY='citylife.server.v1',SETTINGS_KEY='citylife.settings.v1';
const CONNECT_TIMEOUT_MS=8000;

// Accepts "", "localhost", "192.168.1.20", "192.168.1.20:9000", "ws://host:port" or "wss://host". A bare host gets the relay's port, 8080.
export function parseServerAddress(text){
 const raw=String(text??'').trim();
 if(!raw)return {ok:true,url:DEFAULT_SERVER};
 if(raw.length>200||/\s/.test(raw))return {ok:false,error:'That address has spaces or is too long.'};
 const hasScheme=/^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
 let u;try{u=new URL(hasScheme?raw:'ws://'+raw)}catch{return {ok:false,error:'That does not look like an address. Try 192.168.1.20 or ws://192.168.1.20:8080.'}}
 if(u.protocol!=='ws:'&&u.protocol!=='wss:')return {ok:false,error:'Use a ws:// or wss:// address (or just the host name).'};
 if(!u.hostname||u.username||u.password)return {ok:false,error:'Enter only a host name or IP address, with an optional port.'};
 const port=!hasScheme&&!u.port?'8080':u.port;
 const host=u.hostname.includes(':')?`[${u.hostname.replace(/^\[|\]$/g,'')}]`:u.hostname;
 return {ok:true,url:`${u.protocol}//${host}${port?':'+port:''}`};
}

// Settings that survive a reload. Anything unreadable or unexpected falls back to the default.
export function loadSettings(storage){
 try{const v=JSON.parse(storage.getItem(SETTINGS_KEY)||'null');return {quality:v?.quality==='low'?'low':'high'}}catch{return {quality:'high'}}
}
export function saveSettings(storage,settings){try{storage.setItem(SETTINGS_KEY,JSON.stringify({quality:settings.quality==='low'?'low':'high'}));return true}catch{return false}}

export function createMainMenu({$,storage,connect,disconnect,onConnected,onDisconnected,onRefused=()=>()=>{},needUpdate=()=>{},relay=LIVE_RELAY,play,applyQuality,openCredits,setTimer=setTimeout,clearTimer=clearTimeout}){
 const panels=['menuHome','menuMultiplayerPanel','menuSettingsPanel'];
 const show=id=>{for(const p of panels)$(p).hidden=p!==id;if(id!=='menuMultiplayerPanel')setStatus('')};
 const setStatus=(text,kind='')=>{$('menuNetStatus').textContent=text;$('menuNetStatus').dataset.kind=kind};
 const setBusy=busy=>{for(const id of ['menuHost','menuJoin','menuCreateLobby','menuJoinLobby'])$(id).disabled=busy};
 let pending=null;

 function finish(ok,failureText){
  if(!pending)return;
  const attempt=pending;pending=null;
  clearTimer(attempt.timer);attempt.offConnected();attempt.offDisconnected();attempt.offRefused();
  setBusy(false);
  if(ok){setStatus('Connected.','ok');show('menuHome');play();return}
  disconnect();
  setStatus(failureText||attempt.failure,'error');
 }
 function start(url,failure){
  if(pending)return;
  disconnect(); // connect() drops any old socket and reports it; do that before our handlers exist
  setBusy(true);setStatus(`Connecting to ${url} …`);
  // A refusal comes before the socket closes, so its reason wins over the generic failure.
  const attempt=pending={url,failure:failure(url),timer:null,offConnected:onConnected(()=>finish(true)),offDisconnected:onDisconnected(()=>finish(false)),offRefused:onRefused(reason=>{if(reason===REFUSED.update)needUpdate();finish(false,refusalText(reason))})};
  attempt.timer=setTimer(()=>finish(false,`No answer from ${url} after ${CONNECT_TIMEOUT_MS/1000} seconds.`),CONNECT_TIMEOUT_MS);
  // Handlers are registered first because a refused connection can report failure before connect() returns.
  if(!connect(url))finish(false);
 }
 const cancel=()=>{if(pending){const a=pending;pending=null;clearTimer(a.timer);a.offConnected();a.offDisconnected();a.offRefused();disconnect();setBusy(false)}setStatus('')};

 $('menuMultiplayer').onclick=()=>show('menuMultiplayerPanel');
 $('menuSettings').onclick=()=>show('menuSettingsPanel');
 $('menuCredits').onclick=()=>openCredits();
 for(const id of ['menuMultiplayerBack','menuSettingsBack'])$(id).onclick=()=>{cancel();show('menuHome')};

 const offline=url=>`Could not reach the online server (${url}). Check your connection and try again.`;
 $('menuCreateLobby').onclick=()=>start(relay+'/relay/new',offline);
 $('menuJoinLobby').onclick=()=>{
  const code=normalizeLobbyCode($('menuLobbyCode').value);
  if(!code){setStatus('A lobby code is 6 letters and numbers, like K7MPQ2.','error');return}
  $('menuLobbyCode').value=code;
  start(relay+'/relay/'+code,offline);
 };
 $('menuLobbyCode').addEventListener?.('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('menuJoinLobby').onclick()}});
 $('menuHost').onclick=()=>start(DEFAULT_SERVER,url=>`Could not reach a game server on this computer (${url}). Start it with "npm run server" in the project folder, then try again.`);
 $('menuJoin').onclick=()=>{
  const parsed=parseServerAddress($('menuAddress').value);
  if(!parsed.ok){setStatus(parsed.error,'error');return}
  try{storage.setItem(SERVER_KEY,$('menuAddress').value.trim())}catch{}
  start(parsed.url,url=>`Could not reach ${url}. Check the address and that the host is running the game server.`);
 };
 $('menuAddress').addEventListener?.('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('menuJoin').onclick()}});
 try{$('menuAddress').value=storage.getItem(SERVER_KEY)||''}catch{}

 const settings=loadSettings(storage);
 $('menuQuality').value=settings.quality;
 $('menuQuality').onchange=()=>{settings.quality=$('menuQuality').value==='low'?'low':'high';saveSettings(storage,settings);applyQuality(settings.quality)};
 if(settings.quality==='low')applyQuality('low'); // the renderer already starts in the high setting

 show('menuHome');
 return {show,cancel,get pending(){return !!pending},settings};
}
