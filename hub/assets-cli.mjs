// P3c: the asset command

// Mikkadr Hub, P3c: the asset command. `npm run assets` draws any missing or changed pictures (headless Edge, no model call), then rebuilds .hub/assets.html with the pictures built in.
//   npm run assets                    draw what changed, rebuild the page, print counts
//   npm run assets -- --no-pictures   rebuild the page from the pictures already drawn
//   npm run assets -- --force         redraw every picture
//   npm run assets -- --open          also open the page in the default browser
//   (the 3D viewer is served by `npm run hub`, which replaced the old --serve)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {loadAssets} from './assets-load.mjs';
import {previewKey,previewSpec,trackChanges,isRecent,usesText} from './assets.js';
import {checklistFor} from './checklist.js';
import {renderAssetsPage,attentionItems} from './assets-page.js';
import {renderPreviews,previewDir,studioVersion,readManifest} from './assets-render.mjs';
import {acquireLock,releaseLock} from './run-store.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),PAGE=path.join(ROOT,'.hub','assets.html');
const args=process.argv.slice(2),flag=n=>args.includes(n);

// One line for the viewer: how far an asset is from the game, and what stops it.
const importText=a=>{if(a.origin!=='register'||(a.stage!=='received'&&a.stage!=='wanted'))return '';if(a.shippedAs)return `Outdated: already ships as ${a.shippedName}`;const c=checklistFor(a);return c.ready?`Ready to import (/ steps done)`:` of  steps done; `};

// The viewer's list: small facts and the drawing spec for every asset (never model data).
export const catalogOf=(assets,version,manifest={},changes={})=>assets.map(a=>{const m=manifest[a.id]||{},c=changes[a.id]||{};return {import:importText(a),used:a.origin==='module'?(usesText(a.uses,6)||'nowhere in the game'):'',changedAt:isRecent(c)?c.changedAt:null,changeKind:isRecent(c)?c.kind:null,id:a.id,name:a.name,pack:a.pack,stage:a.stage,kind:a.kind,origin:a.origin,triangles:a.triangles??m.triangles??null,size:a.size||m.size||null,source:a.source||'',licence:a.licence||'',credit:a.credit||'',plannedUse:a.plannedUse||'',notes:a.notes||'',evidence:a.evidence||'',key:previewKey(a,version),spec:previewSpec(a)}});

// What changed since the last run, kept in .hub/previews/changes.json (the first run is only a baseline).
const readChanges=dir=>{try{return JSON.parse(fs.readFileSync(path.join(dir,'changes.json'),'utf8'))}catch{return {}}};

export async function buildPage(root=ROOT){
 const data=await loadAssets(root),version=studioVersion(root),manifest=readManifest(root),dir=previewDir(root);
 const pictures=new Map();
 for(const a of data.assets){const file=path.join(dir,previewKey(a,version)+'.png');if(fs.existsSync(file))pictures.set(a.id,'data:image/png;base64,'+fs.readFileSync(file).toString('base64'))}
 const prev=readChanges(dir),tracked=trackChanges(prev,data.assets);
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'changes.json'),JSON.stringify(tracked.next));
 const html=renderAssetsPage({groups:data.groups,summary:data.summary,pictures,manifest,changes:tracked.next});
 fs.mkdirSync(path.dirname(PAGE),{recursive:true});fs.writeFileSync(PAGE,html);
 fs.writeFileSync(path.join(root,'.hub','attention.json'),JSON.stringify({generatedAt:Date.now(),items:attentionItems(data.assets,manifest)})); // read by the hub's Waiting for you list
 fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify(catalogOf(data.assets,version,manifest,tracked.next)));
 return {data,pictures,html,tracked};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // drawing pictures starts Edge, a heavy process: it never overlaps an agent run (they share .hub/run.lock)
 if(!flag('--no-pictures')){const lock=acquireLock(ROOT,'assets');if(!lock.ok){console.error(`Not drawing pictures: ${lock.holder} holds the run lock (an agent run is working). Try again when it is done, or use --no-pictures.`);process.exit(1)}
  try{const s=await renderPreviews(ROOT,{force:flag('--force'),log:()=>{}});console.log(`Pictures: ${s.drawn} drawn, ${s.placeholders} placeholders, ${s.failed} failed, ${s.kept} unchanged.`);for(const f of s.failures)console.log('  '+f)}finally{releaseLock(ROOT,'assets')}}
 const {data,pictures,html,tracked}=await buildPage();
 const s=data.summary;
 console.log(`Assets: ${s.total} (${Object.entries(s.byStage).map(([k,v])=>`${v} ${k}`).join(', ')}) in ${data.groups.length} packs; ${pictures.size} pictures built in; page ${Math.round(html.length/1024)} KB.`);
 console.log(tracked.baseline?'Changes: first run, this is the baseline.':`Changes since the last run: ${tracked.changed.length?tracked.changed.join(', '):'none'}`);
 console.log('Wrote '+PAGE);
 if(flag('--serve')){console.log('--serve moved: run npm run hub (the 3D viewer is at /viewer.html).');process.exit(2)}
 if(flag('--open'))execFile('cmd',['/c','start','',PAGE]);
 process.exit(0);
}
