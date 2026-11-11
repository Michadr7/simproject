// Asset tracker page (Mikkadr Hub P3c step 4, hub/assets-page.js): static (no scripts), escaped, one card per asset, packs folded by size, and the attention list.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderAssetsPage,attention,facts,sizeText} from '../hub/assets-page.js';
import {loadAssets} from '../hub/assets-load.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const r=await loadAssets(root);
const png='data:image/png;base64,iVBORw0KGgo=';
const pictures=new Map(r.assets.slice(0,10).map(a=>[a.id,png]));
const html=renderAssetsPage({groups:r.groups,summary:r.summary,pictures,manifest:{},generatedAt:Date.UTC(2026,10,10,12)});

assert(html.startsWith('<!doctype html>'));
assert(!/<script/i.test(html),'a static page: no scripts');
assert(!/\son(click|load|error)=/i.test(html),'no inline handlers');
assert(!/<link|@import|https?:\/\/(?!www\.w3|127\.0\.0\.1:8765\/viewer\.html)/i.test(html.replace(/https?:\/\/[^"'\s<)]*(grab3d|kenney|poly\.pizza|quaternius)[^"'\s<)]*/gi,'')),'no external resources are loaded');
assert.equal((html.match(/<article class="item/g)||[]).length,r.assets.length,'one card per asset');
assert.equal((html.match(/<details class="pack/g)||[]).length,r.groups.length+1,'one folded row per pack, plus the folded Before-the-public-release section');
assert(html.includes('Before the public release')&&!/<details [^>]*later[^>]*\sopen>/.test(html),'credit and licence rows wait in a folded section');
const main=html.slice(html.indexOf('Needs attention'),html.indexOf('Before the public release'));assert(!/>credit<|>licence</.test(main),'the main attention list has no credit or licence rows');
// folding: a pack of more than 3 starts closed, a small one open
const open=(html.match(/<details class="pack[^>]*\sopen>/g)||[]).length,small=r.groups.filter(g=>g.items.length<=3).length;
assert.equal(open,small,'only small packs start open');
assert(r.groups.some(g=>g.items.length>3),'there are folded packs');
for(const s of ['wanted','received','converted','in-game'])assert(html.includes(`id="f-${s}"`),`a filter for ${s}`);
assert(html.includes('body:has(#f-wanted:checked)'),'the stage filter is CSS only');
assert(html.includes(png),'a picture is built in as a data URI');
assert(html.includes('127.0.0.1:8765/viewer.html#prop%3Ahouse-a'),'a model links to its place in the viewer');assert(!html.includes('viewer.html#grab3d-man-base'),'a wanted asset has no 3D link');
assert(html.includes('no picture'),'an asset without a picture says so');

// escaping: names and notes from the register are text, never markup
const evil={pack:'<img src=x onerror=alert(1)>',items:[{id:'x',name:'<script>alert(1)</script>',stage:'wanted',kind:'model',pack:'p',notes:'a & b "q"',licence:'',credit:'',origin:'register'}],stages:{wanted:1},triangles:0};
const eh=renderAssetsPage({groups:[evil],summary:{total:1,fromModules:0,byStage:{wanted:1}},pictures:new Map(),manifest:{}});
assert(!eh.includes('<script>alert')&&!eh.includes('<img src=x'),'markup in names is escaped');
assert(eh.includes('a &amp; b &quot;q&quot;'));

// facts and attention
assert.equal(sizeText({w:10.4,d:8.2,h:6.7}),'10.4 × 8.2 × 6.7 m');assert.equal(sizeText(null),'');
assert.equal(facts({id:'a',triangles:null,size:null},{a:{triangles:7,size:{w:1,d:1,h:1}}}).triangles,7,'the studio measurement fills a gap');
assert.equal(facts({id:'a',triangles:5,size:null},{a:{triangles:7}}).triangles,5,'a known value wins');
const A=[{id:'u',name:'U',stage:'converted',origin:'module'},{id:'c',name:'C',stage:'in-game',origin:'module',hasCredit:false},{id:'o',name:'O',stage:'in-game',origin:'module',evidence:'override: why (f.js)'},{id:'k',name:'K',stage:'received',origin:'register',licence:'CC-BY 3.0'},{id:'s',name:'S',stage:'in-game',origin:'module',licence:'CC-BY-4.0',hasCredit:true},{id:'w',name:'W',stage:'wanted',origin:'register',licence:'CC-BY 3.0'},{id:'p',name:'P',stage:'in-game',origin:'module'}];
assert.deepEqual(attention(A,{p:{error:'boom'}}).map(x=>x.id+':'+x.kind),['u:unused','c:credit','o:override','k:licence','p:picture'],'shipped and credited CC-BY is fine, wanted CC-BY waits, the rest is flagged');

// the real data
const att=attention(r.assets,{});
assert(att.some(x=>x.id==='prop:f-side-table'&&x.kind==='unused'),'the unused side table is reported');
console.log(`Assets page: ${r.assets.length} cards in ${r.groups.length} packs (${open} open), ${att.length} items needing attention, no scripts, ${Math.round(html.length/1024)} KB with 10 sample pictures.`);
