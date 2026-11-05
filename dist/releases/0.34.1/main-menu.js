// Main menu: Play, Multiplayer (host / join), Settings, Credits. The DOM lives in index.html (#welcome); game.js passes in what the menu needs.
// A browser page cannot start a server, so "host" means "use the relay running on this computer" and "join" means "use the relay at this address".
export const DEFAULT_SERVER='ws://localhost:8080';
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

export function createMainMenu({$,storage,connect,disconnect,onConnected,onDisconnected,play,applyQuality,openCredits,setTimer=setTimeout,clearTimer=clearTimeout}){
 const panels=['menuHome','menuMultiplayerPanel','menuSettingsPanel'];
 const show=id=>{for(const p of panels)$(p).hidden=p!==id;if(id!=='menuMultiplayerPanel')setStatus('')};
 const setStatus=(text,kind='')=>{$('menuNetStatus').textContent=text;$('menuNetStatus').dataset.kind=kind};
 const setBusy=busy=>{$('menuHost').disabled=busy;$('menuJoin').disabled=busy};
 let pending=null;

 function finish(ok,failureText){
  if(!pending)return;
  const attempt=pending;pending=null;
  clearTimer(attempt.timer);attempt.offConnected();attempt.offDisconnected();
  setBusy(false);
  if(ok){setStatus('Connected.','ok');show('menuHome');play();return}
  disconnect();
  setStatus(failureText||attempt.failure,'error');
 }
 function start(url,failure){
  if(pending)return;
  disconnect(); // connect() drops any old socket and reports it; do that before our handlers exist
  setBusy(true);setStatus(`Connecting to ${url} …`);
  const attempt=pending={url,failure:failure(url),timer:null,offConnected:onConnected(()=>finish(true)),offDisconnected:onDisconnected(()=>finish(false))};
  attempt.timer=setTimer(()=>finish(false,`No answer from ${url} after ${CONNECT_TIMEOUT_MS/1000} seconds.`),CONNECT_TIMEOUT_MS);
  // Handlers are registered first because a refused connection can report failure before connect() returns.
  if(!connect(url))finish(false);
 }
 const cancel=()=>{if(pending){const a=pending;pending=null;clearTimer(a.timer);a.offConnected();a.offDisconnected();disconnect();setBusy(false)}setStatus('')};

 $('menuMultiplayer').onclick=()=>show('menuMultiplayerPanel');
 $('menuSettings').onclick=()=>show('menuSettingsPanel');
 $('menuCredits').onclick=()=>openCredits();
 for(const id of ['menuMultiplayerBack','menuSettingsBack'])$(id).onclick=()=>{cancel();show('menuHome')};

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
