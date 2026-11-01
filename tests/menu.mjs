import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {parseServerAddress,createMainMenu,loadSettings,saveSettings,DEFAULT_SERVER,SERVER_KEY,SETTINGS_KEY} from '../dist/main-menu.js';

// --- Address parsing -------------------------------------------------------------------------------------------------
const ok=(text,url)=>assert.deepEqual(parseServerAddress(text),{ok:true,url},`"${text}" -> ${url}`);
const bad=text=>{const r=parseServerAddress(text);assert.equal(r.ok,false,`"${text}" is refused`);assert(r.error.length>10,'with a reason')};
ok('',DEFAULT_SERVER);ok('   ',DEFAULT_SERVER);
ok('localhost','ws://localhost:8080');ok('192.168.1.20','ws://192.168.1.20:8080');ok('192.168.1.20:9000','ws://192.168.1.20:9000');
ok('ws://example.com','ws://example.com');ok('wss://play.example.com:8443','wss://play.example.com:8443');ok(' ws://10.0.0.5:8080 ','ws://10.0.0.5:8080');
ok('[::1]','ws://[::1]:8080');ok('ws://localhost:8080/some/path?x=1','ws://localhost:8080');
bad('http://example.com');bad('javascript:alert(1)');bad('ws://user:pass@host');bad('two words');bad('ws://');bad('a'.repeat(300));bad('file:///etc/passwd');

// --- Settings ----------------------------------------------------------------------------------------------------------
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
assert.deepEqual(loadSettings(memory()),{quality:'high'},'default');
{const s=memory();assert(saveSettings(s,{quality:'low'}));assert.deepEqual(loadSettings(s),{quality:'low'});s.m.set(SETTINGS_KEY,'{"quality":"<script>"}');assert.deepEqual(loadSettings(s),{quality:'high'},'unknown values fall back');s.m.set(SETTINGS_KEY,'not json');assert.deepEqual(loadSettings(s),{quality:'high'},'corrupt saves fall back')}
assert.equal(saveSettings({setItem(){throw new Error('blocked')}},{quality:'low'}),false,'blocked storage does not throw');
assert.deepEqual(loadSettings({getItem(){throw new Error('blocked')}}),{quality:'high'});

// --- The menu, with fake DOM, network and timers -----------------------------------------------------------------------
function build({connectResult=true,saved={}}={}){
 const els=new Proxy({},{get:(t,id)=>t[id]??(t[id]={id,hidden:false,disabled:false,value:'',textContent:'',dataset:{},addEventListener(){}})});
 const storage=memory();for(const [k,v] of Object.entries(saved))storage.m.set(k,v);
 const net={connects:[],disconnects:0,connectedCbs:new Set(),disconnectedCbs:new Set()};
 const timers=[];const log=[];
 const menu=createMainMenu({
  $:id=>els[id],storage,
  connect:url=>{net.connects.push(url);return connectResult},
  disconnect:()=>{net.disconnects++},
  onConnected:cb=>{net.connectedCbs.add(cb);return()=>net.connectedCbs.delete(cb)},
  onDisconnected:cb=>{net.disconnectedCbs.add(cb);return()=>net.disconnectedCbs.delete(cb)},
  play:()=>log.push('play'),applyQuality:q=>log.push('quality:'+q),openCredits:()=>log.push('credits'),
  setTimer:(fn,ms)=>{timers.push({fn,ms,live:true});return timers.length-1},clearTimer:i=>{if(timers[i])timers[i].live=false},
 });
 return {els,storage,net,timers,log,menu,connected:()=>[...net.connectedCbs].forEach(cb=>cb('id')),dropped:()=>[...net.disconnectedCbs].forEach(cb=>cb())};
}
const visible=t=>['menuHome','menuMultiplayerPanel','menuSettingsPanel'].filter(id=>!t.els[id].hidden);

{ // Panels
 const t=build();assert.deepEqual(visible(t),['menuHome']);
 t.els.menuMultiplayer.onclick();assert.deepEqual(visible(t),['menuMultiplayerPanel']);
 t.els.menuMultiplayerBack.onclick();assert.deepEqual(visible(t),['menuHome']);
 t.els.menuSettings.onclick();assert.deepEqual(visible(t),['menuSettingsPanel']);
 t.els.menuSettingsBack.onclick();assert.deepEqual(visible(t),['menuHome']);
 t.els.menuCredits.onclick();assert.deepEqual(t.log,['credits']);
 assert.equal(t.net.connects.length,0,'browsing the menu never connects');
}
{ // Settings: saved, applied, restored
 const t=build();t.els.menuQuality.value='low';t.els.menuQuality.onchange();assert.deepEqual(t.log,['quality:low']);assert.equal(loadSettings(t.storage).quality,'low');
 const again=build({saved:{[SETTINGS_KEY]:JSON.stringify({quality:'low'})}});assert.equal(again.els.menuQuality.value,'low','the saved choice is shown');assert.deepEqual(again.log,['quality:low'],'and applied at start');
 assert.deepEqual(build().log,[],'the default needs no work at start');
}
{ // Host: connects to this computer, starts the game once the server answers
 const t=build();t.els.menuMultiplayer.onclick();t.els.menuHost.onclick();
 assert.deepEqual(t.net.connects,[DEFAULT_SERVER]);assert(t.els.menuHost.disabled&&t.els.menuJoin.disabled,'buttons lock while connecting');assert.equal(t.log.includes('play'),false);
 t.els.menuHost.onclick();assert.equal(t.net.connects.length,1,'a second click while connecting does nothing');
 t.connected();assert.deepEqual(t.log,['play']);assert.deepEqual(visible(t),['menuHome']);assert(!t.els.menuHost.disabled,'buttons unlock');assert.equal(t.net.connectedCbs.size+t.net.disconnectedCbs.size,0,'handlers are released');assert(!t.timers[0].live,'the timeout is cleared');
 t.connected();assert.deepEqual(t.log,['play'],'a later "connected" cannot start the game twice');
}
{ // Host: nothing is running
 const t=build();t.els.menuHost.onclick();t.dropped();
 assert.equal(t.log.includes('play'),false,'no game starts');assert.equal(t.els.menuNetStatus.dataset.kind,'error');assert(/npm run server/.test(t.els.menuNetStatus.textContent));assert(!t.els.menuHost.disabled);assert(t.net.disconnects>=2,'the dead socket is cleaned up');
 t.els.menuHost.onclick();assert.equal(t.net.connects.length,2,'and you can try again');
}
{ // Join: a bad address never touches the network; a good one is remembered
 const t=build();t.els.menuAddress.value='http://nope';t.els.menuJoin.onclick();assert.equal(t.net.connects.length,0);assert.equal(t.els.menuNetStatus.dataset.kind,'error');
 t.els.menuAddress.value='192.168.1.20';t.els.menuJoin.onclick();assert.deepEqual(t.net.connects,['ws://192.168.1.20:8080']);assert.equal(t.storage.m.get(SERVER_KEY),'192.168.1.20');
 t.connected();assert.deepEqual(t.log,['play']);
 assert.equal(build({saved:{[SERVER_KEY]:'192.168.1.20'}}).els.menuAddress.value,'192.168.1.20','the last address is filled in next time');
}
{ // Join: a connection that never answers times out; Back cancels one in progress
 const t=build();t.els.menuAddress.value='10.0.0.9';t.els.menuJoin.onclick();assert.equal(t.timers[0].ms,8000);t.timers[0].fn();
 assert(/No answer from ws:\/\/10\.0\.0\.9:8080/.test(t.els.menuNetStatus.textContent));assert(!t.els.menuJoin.disabled);assert.equal(t.log.includes('play'),false);
 const c=build();c.els.menuMultiplayer.onclick();c.els.menuHost.onclick();c.els.menuMultiplayerBack.onclick();
 assert.deepEqual(visible(c),['menuHome']);assert(!c.els.menuHost.disabled);assert.equal(c.net.connectedCbs.size,0);c.connected();assert.equal(c.log.includes('play'),false,'a cancelled attempt cannot start the game');
}
{ // A browser that refuses the socket outright (an https page cannot open ws://) fails cleanly
 const t=build({connectResult:false});t.els.menuHost.onclick();assert.equal(t.els.menuNetStatus.dataset.kind,'error');assert(!t.els.menuHost.disabled);assert.equal(t.log.includes('play'),false);
}

// --- The page itself ---------------------------------------------------------------------------------------------------
const html=await readFile('dist/index.html','utf8');
for(const id of ['welcome','start','menuMultiplayer','menuSettings','menuCredits','menuHost','menuJoin','menuAddress','menuQuality','menuNetStatus','menuMultiplayerBack','menuSettingsBack'])assert(html.includes(`id="${id}"`),`${id} is in the page`);
assert(!/id="menuDev/i.test(html),'the Dev Mode button is not in the page: dev.js adds it, so deleting the dev files removes it');
const image=html.match(/url\((assets\/[^)]+)\)/)?.[1];assert(image,'the menu names its background image');
const size=(await stat('dist/'+image)).size;assert(size>10_000&&size<600_000,`the background is a web-sized image (${Math.round(size/1024)} KB), not the 1.6 MB original`);
const css=await readFile('dist/style.css','utf8');
assert(/\.main-menu\{[^}]*backdrop-filter:none/.test(css),'no backdrop blur over the canvas');
assert(/\.menu-panel\[hidden\]/.test(css),'hidden panels stay hidden even though .menu-panel sets display');
console.log('Main menu: address parsing (bare hosts, ports, ws/wss, refusals), saved settings, panels, host and join (success, refusal, timeout, cancel, no double start), and the page and its background image passed.');
