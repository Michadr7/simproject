// Mikkadr Hub, P3c step 3: draws one 256 px picture per asset into .hub/previews/<key>.png, with the method of scripts/render-vehicle-pictures.mjs:
// headless Edge (software WebGL) opens hub/studio.html from the local asset server and the PNG of each asset comes back to this script, which writes it.
// A picture's key is a content hash (see previewKey in assets.js), so only new or changed assets are drawn. `.hub/previews/manifest.json` records, per asset id, its key,
// the triangles and size the studio measured, and whether the picture is a placeholder or failed.
//   node hub/assets-render.mjs [--force] [--only=<text in the id>] [--limit=<n>]      (EDGE=<path to msedge.exe> if Edge is somewhere else)
// No model is called. Console output is counts and names only.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadAssets} from './assets-load.mjs';
import {previewSpec,previewKey} from './assets.js';
import {createHubServer} from './server.js';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const previewDir=root=>path.join(root,'.hub','previews');
export const studioVersion=root=>createHash('sha1').update(fs.readFileSync(path.join(root,'hub','studio.html'))).digest('hex').slice(0,12);
export const readManifest=root=>{try{return JSON.parse(fs.readFileSync(path.join(previewDir(root),'manifest.json'),'utf8'))}catch{return {}}};

// Which assets need drawing: no picture file under their current key, or --force.
export function plan(root,assets,{force=false,only=null}={}){
 const dir=previewDir(root),version=studioVersion(root),manifest=readManifest(root),todo=[],current={};
 for(const a of assets){
  const key=previewKey(a,version);current[a.id]=key;
  if(only&&!a.id.includes(only))continue;
  if(force||!fs.existsSync(path.join(dir,key+'.png'))||!manifest[a.id]||manifest[a.id].key!==key)todo.push({asset:a,key,spec:previewSpec(a)});
 }
 return {todo,current,version,manifest};
}

export async function renderPreviews(root,{force=false,only=null,limit=Infinity,log=console.log}={}){
 const {assets}=await loadAssets(root);
 const {todo,current,manifest}=plan(root,assets,{force,only});
 const dir=previewDir(root);fs.mkdirSync(dir,{recursive:true});
 const batch=todo.slice(0,limit),stats={assets:assets.length,drawn:0,placeholders:0,failed:0,kept:assets.length-todo.length,remaining:todo.length-batch.length,failures:[]};
 if(batch.length){
  const require=createRequire(import.meta.url),WebSocket=require('ws');
  const srv=createHubServer({root}),port=await srv.listen();
  const edge=process.env.EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',debugPort=9446,profile=path.join(os.tmpdir(),'citylife-asset-studio');
  if(!fs.existsSync(edge)){await srv.close();throw new Error('Edge not found at '+edge+' (set EDGE)')}
  fs.mkdirSync(profile,{recursive:true});
  const proc=spawn(edge,['--headless=new','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'--window-size=300,300','about:blank'],{stdio:'ignore'});
  try{
   let targets;for(let i=0;i<50;i++){try{targets=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();if(targets.some(t=>t.type==='page'))break}catch{}await sleep(200)}
   const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
   let id=0;const pending=new Map();ws.on('message',m=>{const d=JSON.parse(m);if(d.id&&pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id)}});
   const cdp=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}))});
   const run=async js=>{const r=await cdp('Runtime.evaluate',{expression:js,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,300));return r.result.result.value};
   await cdp('Page.enable');await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/studio.html`});
   for(let i=0;i<100;i++){if(await run('!!window.studioReady').catch(()=>false))break;await sleep(300)}
   if(!await run('!!window.studioReady'))throw new Error('the studio page did not start');
   for(const {asset,key,spec} of batch){
    const r=await run(`renderAsset(${JSON.stringify(spec)})`);
    fs.writeFileSync(path.join(dir,key+'.png'),Buffer.from(r.png.split(',')[1],'base64'));
    manifest[asset.id]={key,triangles:r.triangles??null,size:r.size??null,placeholder:!!r.placeholder,error:r.error||null,drawn:new Date().toISOString()};
    if(r.error){stats.failed++;stats.failures.push(asset.id+': '+r.error)}else if(r.placeholder)stats.placeholders++;else stats.drawn++;
    log(`${asset.id}${r.error?' FAILED':r.placeholder?' (placeholder)':''}`);
   }
   ws.close();
  }finally{proc.kill();await srv.close();await sleep(300);fs.rmSync(profile,{recursive:true,force:true})}
 }
 // forget manifest entries for assets that no longer exist and delete pictures nothing points at (only after a full pass, so a partial run keeps what it has)
 for(const k of Object.keys(manifest))if(!current[k])delete manifest[k];
 if(stats.remaining===0&&!only){const live=new Set(Object.values(current));for(const f of fs.readdirSync(dir))if(f.endsWith('.png')&&!live.has(f.slice(0,-4)))fs.unlinkSync(path.join(dir,f))}
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,1));
 return stats;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
 const opt=n=>(args.find(a=>a.startsWith('--'+n+'='))||'').split('=')[1];
 const s=await renderPreviews(root,{force:args.includes('--force'),only:opt('only')||null,limit:opt('limit')?+opt('limit'):Infinity});
 console.log(`Pictures: ${s.assets} assets; drawn ${s.drawn}, placeholders ${s.placeholders}, failed ${s.failed}, unchanged ${s.kept}, left to do ${s.remaining}.`);
 for(const f of s.failures)console.log('  '+f);
 process.exit(0);
}
