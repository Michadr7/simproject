// The update notice: version comparison, the banner (shown, "not now", reload saves first), timers, and the packaged game finding a newer version.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseVersion,isNewer,installUpdateNotice,CHECK_EVERY_MS,FIRST_CHECK_MS} from '../dist/update-check.js';
import {El,bootGame} from './support/boot-game.mjs';

// ── version rules ──────────────────────────────────────────────────────────────────────────────────────
assert.deepEqual(parseVersion('0.34.0'),[0,34,0]);assert.equal(parseVersion('0.34'),null);assert.equal(parseVersion('v1.0.0'),null);assert.equal(parseVersion(undefined),null);
assert(isNewer('0.35.0','0.34.0')&&isNewer('0.34.1','0.34.0')&&isNewer('1.0.0','0.99.9')&&isNewer('0.100.0','0.99.0'),'higher in the major, minor or patch number (numbers, not text: 0.100 is above 0.99)');
assert(!isNewer('0.34.0','0.34.0')&&!isNewer('0.33.9','0.34.0')&&!isNewer('0.9.0','0.10.0'),'the same or older is not newer');
assert(!isNewer('banana','0.34.0')&&!isNewer(null,'0.34.0')&&!isNewer('0.35.0','broken'),'anything unreadable is never an update');

// ── the banner, with fake timers ───────────────────────────────────────────────────────────────────────
function rig({running='0.34.0',answer={version:'0.34.0'}}={}){
 const els=new Map(['updateBanner','updateText','updateReload','updateLater'].map(id=>[id,new El()])),calls=[],timers=[];
 const document={getElementById:id=>els.get(id)||null};
 let reply=answer;const notice=installUpdateNotice({document,version:running,fetchJson:async url=>{calls.push(url);if(reply instanceof Error)throw reply;return reply},beforeReload:()=>calls.push('save'),reload:()=>calls.push('reload'),setTimeoutFn:(fn,ms)=>{timers.push(['timeout',ms,fn]);return 1},setIntervalFn:(fn,ms)=>{timers.push(['interval',ms,fn]);return 2}});
 return {els,calls,timers,notice,banner:els.get('updateBanner'),answer:v=>{reply=v}};
}
{ const r=rig();
 assert(r.banner.hidden,'the banner starts hidden');assert.deepEqual(r.timers.map(t=>[t[0],t[1]]),[['timeout',FIRST_CHECK_MS],['interval',CHECK_EVERY_MS]],'one check a few seconds after loading, then every 10 minutes');assert.equal(CHECK_EVERY_MS,600000);
 assert.equal(await r.notice.check(),null);assert(r.banner.hidden,'the same version: nothing shown');assert.deepEqual(r.calls,['version.json'],'it asks the site for version.json');
 r.answer({version:'0.35.0'});assert.equal(await r.notice.check(),'0.35.0');assert(!r.banner.hidden,'a newer version shows the banner');assert(/0\.35\.0/.test(r.els.get('updateText').textContent),'and names it');
 assert.equal(await r.notice.check(),null,'the next check does not announce it twice');
 r.els.get('updateLater').click();assert(r.banner.hidden,'"not now" hides the banner');assert.equal(await r.notice.check(),null);assert(r.banner.hidden,'and the same version does not come back');
 r.answer({version:'0.36.0'});assert.equal(await r.notice.check(),'0.36.0');assert(!r.banner.hidden,'an even newer version shows it again');
 r.calls.length=0;r.els.get('updateReload').click();assert.deepEqual(r.calls,['save','reload'],'Reload saves the game first, then reloads');
}
for(const [name,answer] of [['offline',new Error('network down')],['no answer',null],['not a version',{version:'soon'}],['an older version',{version:'0.1.0'}]]){const r=rig({answer});assert.equal(await r.notice.check(),null,name);assert(r.banner.hidden,`${name}: the banner stays hidden`)}
{ const els=new Map(['updateBanner','updateReload'].map(id=>[id,new El()])),calls=[];
 installUpdateNotice({document:{getElementById:id=>els.get(id)||null},version:'0.34.0',fetchJson:async()=>null,beforeReload:()=>{throw new Error('disk full')},reload:()=>calls.push('reload'),setTimeoutFn:()=>1,setIntervalFn:()=>2});
 const warn=console.warn;console.warn=()=>{};els.get('updateReload').click();console.warn=warn;assert.deepEqual(calls,['reload'],'a failed save does not block the reload') }
{ const none=installUpdateNotice({document:{getElementById:()=>null},version:'0.34.0',fetchJson:async()=>({version:'9.0.0'}),setTimeoutFn:()=>1,setIntervalFn:()=>2});assert.equal(none.banner,null);assert.equal(await none.check(),null,'a page without the banner markup does nothing') }
// ── the release script and the page ────────────────────────────────────────────────────────────────────
const pkg=JSON.parse(await readFile('package.json','utf8')),versionFile=await readFile('dist/version.js','utf8'),site=JSON.parse(await readFile('dist/version.json','utf8')),html=await readFile('dist/index.html','utf8'),headers=await readFile('dist/_headers','utf8');
assert.match(versionFile,new RegExp(`export const VERSION='${pkg.version.replace(/\./g,'\\.')}';`),'version.js carries the package version');
assert.equal(site.version,pkg.version,'version.json on the site names the same version');assert(/^\d{4}-\d{2}-\d{2}$/.test(site.released),'and the day it was released');
assert(/\/version\.json\s+Cache-Control: no-cache/.test(headers),'version.json is never cached');
for(const id of ['updateBanner','updateText','updateReload','updateLater'])assert(html.includes(`id="${id}"`),`${id} is in the page`);
assert(/<div id="updateBanner" hidden/.test(html),'the banner starts hidden in the markup');

// ── the packaged game finds a newer version ────────────────────────────────────────────────────────────
{ const asked=[],saved=[];globalThis.fetch=async url=>{asked.push(String(url));return {ok:true,json:async()=>({version:'99.0.0'})}};globalThis.location={reload:()=>saved.push('reload')};
 const g=await bootGame();const banner=g.find('updateBanner');assert(banner.hidden,'the game hides the banner at start');
 await new Promise(r=>setTimeout(r,FIRST_CHECK_MS+1000));
 assert(asked.includes('version.json'),'the game asked for version.json');assert(!banner.hidden,'a newer version shows the banner in the real game');assert(/99\.0\.0/.test(g.find('updateText').textContent),'with the version number');
 g.find('updateReload').click();assert.deepEqual(saved,['reload'],'Reload reloads the page (the game saved first: it was running)');
 await g.done();delete globalThis.fetch;delete globalThis.location }
console.log('Update notice: numeric version rules, a banner that shows once per newer version and can be dismissed, Reload saves first, a quiet failure when offline or the file is unreadable, a first check after 2.5 s then every 10 minutes, version.js and version.json written by the release script, never cached, and the packaged game showing the banner for a newer version.');
