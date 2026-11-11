// Asset routes and pictures (Mikkadr Hub P3c steps 3 and 4): the allowlist and the picture cache keys. The real server and its security checks are in hub-server.mjs.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRoute,hostAllowed,typeOf} from '../hub/server.js';
import {previewSpec,previewKey} from '../hub/assets.js';
import {loadAssets} from '../hub/assets-load.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

// Pure routing: what is allowed, what is not.
const P=7777,H=`127.0.0.1:${P}`;
const ok=p=>resolveRoute(root,p,H,P);
for(const p of ['/studio.html','/viewer.html','/builders.js','/orbit.js','/compare.js','/previews/catalog.json','/register','/dist/props.js','/dist/vendor/three.module.js','/dist/vendor/GLTFLoader.js','/assets-src/assets/Sawmillv4.glb','/assets-src/Tools/Chainsaw/Material_baseColor.jpg','/previews/manifest.json','/previews/0123456789abcdef0123.png'])assert(ok(p).file,`${p} is served`);
for(const p of ['/package.json','/server.js','/.dev.vars','/hub/watcher.js','/hub/usage.jsonl','/.hub/usage.jsonl','/hub/plans.js','/plans/x.json','/.hub/assets.html','/dist/releases/0.35.4/game.js','/dist/saves/x.json','/assets-src/Sounds/water_drink.wav','/assets-src/anything.fbx','/assets-src/notes.md','/previews/nothex.png','/node_modules/ws/index.js','/api/waitingx','/web/x.json'])assert.equal(ok(p).status,404,`${p} is refused (404)`);
for(const p of ['/assets-src/../package.json.png','/assets-src/../../x.glb','/dist/../server.js','/dist/vendor/../../server.js','/previews/../usage.jsonl'])assert([403,404].includes(ok(p).status)&&!ok(p).file,`${p} cannot escape`);
assert.equal(ok('/assets-src/a\\b.glb').status,400,'backslashes are refused');
assert.equal(resolveRoute(root,'/studio.html','evil.example:7777',P).status,403,'a foreign Host is refused');
assert.equal(resolveRoute(root,'/studio.html','127.0.0.1:9999',P).status,403,'another port in the Host is refused');
assert.equal(resolveRoute(root,'/studio.html',undefined,P).status,403,'no Host is refused');
assert(hostAllowed('localhost:7777',7777)&&!hostAllowed('localhost',7777)&&!hostAllowed('127.0.0.1:7777.evil.com',7777));
assert.equal(typeOf('a.glb'),'model/gltf-binary');
// every resolved file stays inside the project
for(const p of ['/studio.html','/dist/props.js','/assets-src/assets/Sawmillv4.glb','/register'])assert(!path.relative(root,ok(p).file).startsWith('..'));

// Picture keys: stable, and they change when the content, the way of drawing or the studio changes.
const r=await loadAssets(root);
const keys=new Map();
for(const a of r.assets){const k=previewKey(a,'v1');assert(/^[a-f0-9]{20}$/.test(k));assert.equal(k,previewKey(a,'v1'),`${a.id} key is stable`);assert.notEqual(k,previewKey(a,'v2'),'a new studio redraws');keys.set(k,(keys.get(k)||0)+1)}
const withHash=r.assets.filter(a=>a.hash);
assert(r.assets.filter(a=>a.origin==='module').every(a=>a.hash),'every shipped asset carries a content hash ('+withHash.length+' with one)');
const house=r.assets.find(a=>a.id==='prop:house-a');assert.notEqual(previewKey(house,'v1'),previewKey({...house,hash:'changed'},'v1'),'changed content redraws');
// Each drawing mode is one the studio knows, and received models in assets-src use the loader on a real file.
const MODES=new Set(['prop','forklift','held','nature','module-glb','url','dataurl','placeholder']);
const modes={};for(const a of r.assets){const s=previewSpec(a);assert(MODES.has(s.mode),`${a.id}: mode ${s.mode}`);modes[s.mode]=(modes[s.mode]||0)+1;if(s.mode==='url')assert(ok(s.url.replace(/%20/g,'%20')).file,`${a.id}: its file URL is on the allowlist`)}
assert.equal(previewSpec(r.assets.find(a=>a.id==='forklift')).mode,'forklift');
assert.equal(previewSpec(r.assets.find(a=>a.id==='grab3d-man-base')).mode,'placeholder','a wanted asset gets a placeholder');
const received={origin:'register',kind:'model',stage:'received',name:'X'};
assert(/FBX/.test(previewSpec({...received,files:['fuel_can/fuel_can.fbx']}).why),'an FBX is not drawn: convert first');
const viaUrl=previewSpec({...received,files:['Tools/Some Axe.glb']});assert.equal(viaUrl.mode,'url');assert.equal(viaUrl.url,'/assets-src/Tools/Some%20Axe.glb','a received GLB is loaded from assets-src, its path encoded');assert(ok(viaUrl.url.replace(/%20/g,' ')).file,'and that path is on the allowlist');
assert.equal(previewSpec(r.assets.find(a=>a.id==='quaternius-closet')).why,'original not on disk');
console.log(`Asset server: allowlist, Host and Origin checks, read-only and loopback pinned; ${r.assets.length} picture keys stable, drawing modes ${JSON.stringify(modes)}.`);
