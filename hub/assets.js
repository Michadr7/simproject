// Mikkadr Hub, P3c: the asset tracker's pure rules. No file or model access here: hub/assets-load.mjs reads the dist modules and hands plain data in.
// `describeModules` turns the asset modules' metadata into one record per shipped asset (never the huge base64 fields), `buildAssets` merges those with the register
// (assets-register.json: wanted and received items, and a pack entry for every shipped source folder) and the game's text (to decide what is really in the game),
// and `groupByPack` makes the sub-categories the page shows, so a kit of 117 pieces folds into one row.
import {createHash} from 'node:crypto';
export const STAGES=Object.freeze(['wanted','received','converted','in-game','retired']);
export const KINDS=Object.freeze(['model','sound','texture','picture']);

// Readable names from game ids: "f-tv-cabinet" -> "TV cabinet", "industrial-q" -> "Industrial building Q", "sports-car-2" -> "Sports car 2". A few ids get a hand-written name.
const ACRONYMS={suv:'SUV',tv:'TV'};
const NAMES={'prop.fuel-pump':'Fuel pump (gas)','prop.fuel-pump-diesel':'Fuel pump (diesel)','prop.fuel-nozzle':'Fuel nozzle (gas)','prop.fuel-nozzle-diesel':'Fuel nozzle (diesel)','prop.fuel-can':'Fuel can','offroad':'Off-road pickup','worktruck':'Worktruck (pickup)','sawmill-v4':'Sawmill (v4)','axe':'Axe (starter)','logging-axe':'Logging axe','steel-axe':'Steel axe','logging-chainsaw':'Logging chainsaw','coop':'Chicken coop','log':'Wood log'};
export function nice(id){
 if(NAMES[id])return NAMES[id];
 const parts=id.replace(/^prop\./,'').replace(/^f-/,'').split(/[.\-_]+/).filter(Boolean);
 if(parts[0]==='industrial'&&parts.length===2)parts.splice(1,0,'building');
 const words=parts.map(w=>ACRONYMS[w]||(w.length===1?w.toUpperCase():w));
 return words[0].replace(/^./,c=>c.toUpperCase())+(words.length>1?' '+words.slice(1).join(' '):'');
}
const treeName=id=>{const [kind,n]=id.split('.');return `${kind.replace(/^./,c=>c.toUpperCase())} tree${n?' '+n:''}`};
const round=n=>Math.round(n*100)/100;
const sizeOf=p=>p&&p.width!=null?{w:round(p.width),d:round(p.depth),h:round(p.height)}:p&&p.bounds&&p.bounds.min&&p.bounds.max?{w:round(p.bounds.max.x-p.bounds.min.x),d:round(p.bounds.max.z-p.bounds.min.z),h:round(p.bounds.max.y-p.bounds.min.y)}:null;
const sumTriangles=parts=>Object.values(parts||{}).reduce((n,x)=>n+(x&&x.triangles||0),0);

// meta: {props, nature, rigged, axes, saws, forklift, flatbed, waterCooler:boolean, characters:[{id,name,source}], vehiclePictures:[ids], signPictures:number}
// Returns [{id, name, kind, source, triangles, size, module, viewer}] where `viewer` says how the 3D viewer can build it: createProp, nature, glb, parts, none.
export function describeModules(meta){
 const out=[];
 for(const [id,p] of Object.entries(meta.props||{}))out.push({id:'prop:'+id,gameId:id,name:nice(id),kind:'model',source:p.source,triangles:p.triangles??null,size:sizeOf(p),module:'props-assets.js',viewer:'createProp'});
 for(const [id,m] of Object.entries(meta.nature?.models||{}))out.push({id:'nature:'+id,gameId:id,name:treeName(id),kind:'model',source:m.source||'nature-assets.js',triangles:m.triangles??null,size:m.height!=null?{w:round((m.canopyRadius||0)*2),d:round((m.canopyRadius||0)*2),h:round(m.height)}:null,module:'nature-assets.js',viewer:'nature',creditKey:'nature/'+(m.source||'')});
 for(const [id,m] of Object.entries(meta.rigged||{}))out.push({id:'rigged:'+id,gameId:id,name:nice(id),kind:'model',source:m.source,triangles:m.triangles??m.report?.triangles??null,size:sizeOf(m),module:'rigged-assets.js',viewer:'glb',skinned:true,byModule:true});
 for(const [id,a] of Object.entries(meta.axes||{}))out.push({id:'axe:'+id,gameId:id,name:nice(id),kind:'model',source:a.source,triangles:a.triangles??null,size:sizeOf(a),module:'axe-assets.js',viewer:'mesh'});
 for(const [id,a] of Object.entries(meta.saws||{}))out.push({id:'saw:'+id,gameId:id,name:nice(id),kind:'model',source:a.source,triangles:a.triangles??null,size:sizeOf(a),module:'saw-assets.js',viewer:'mesh'});
 if(meta.forklift)out.push({id:'forklift',gameId:'forklift',name:'Forklift',kind:'model',source:meta.forklift.source,triangles:meta.forklift.triangles??sumTriangles(meta.forklift.parts),size:sizeOf(meta.forklift),module:'forklift-assets.js',viewer:'parts',byModule:true});
 if(meta.flatbed)out.push({id:'flatbed',gameId:'flatbed',name:'Tylan Flatbed',kind:'model',source:meta.flatbed.source,triangles:meta.flatbed.triangles??sumTriangles(meta.flatbed.parts),size:sizeOf(meta.flatbed),module:'flatbed-assets.js',viewer:'parts',byModule:true});
 if(meta.waterCooler)out.push({id:'water-cooler',gameId:'water-cooler',name:'Water cooler',kind:'model',source:'assets/city_life_watercooler/water-cooler.glb',triangles:null,size:null,module:'water-cooler-asset.js',viewer:'glb',byModule:true});
 for(const c of meta.characters||[])out.push({id:'character:'+c.id,gameId:c.id,name:c.name,kind:'model',source:c.source,triangles:null,size:null,module:'character-'+c.id+'.js',viewer:'glb',skinned:true,byModule:true});
 if((meta.vehiclePictures||[]).length)out.push({id:'pictures:vehicles',gameId:'vehicle-pictures',name:`Vehicle pictures (${meta.vehiclePictures.length})`,kind:'picture',source:'module:vehicle-pictures',triangles:null,size:null,module:'vehicle-pictures.js',viewer:'none',byModule:true,noCredit:true});
 if(meta.signPictures)out.push({id:'pictures:signs',gameId:'sign-pictures',name:`Sign pictures (${meta.signPictures})`,kind:'picture',source:'module:sign-pictures',triangles:null,size:null,module:'sign-pictures.js',viewer:'none',byModule:true,noCredit:true});
 return out;
}

// A game id counts as referenced when it appears between quotes in the game's own code (or the map). It misses ids built from pieces, so the register can force it:
// overrides = {gameId or derived id: {file, why}}. The test in step 5 checks that each override names a file that exists.
export const quotedIn=(id,text)=>{const e=id.replace(/[.*+?^${}()|[\]\\\-]/g,'\\$&');return new RegExp(`['"\`]${e}['"\`]`).test(text)};

// Module-level assets (the characters, the pictures, the forklift) are used by importing their module, not by quoting an id.
export const moduleImported=(module,text)=>{const m=module.replace(/\.js$/,'').replace(/[.*+?^${}()|[\]\\\-]/g,'\\$&');return new RegExp('["\'/]'+m+'\\.js["\']').test(text)};

// Original model and sound files (paths relative to assets-src, forward slashes) that no register entry accounts for: not listed in a `files`, and not under a `covers` prefix
// (a prefix matches the whole path or the file's own name, since the tool modules record only the name). Only a warning: the originals are not in the repo.
export function unregisteredOriginals(paths,register){
 const listed=new Set(),covers=[];
 for(const r of register.assets||[]){for(const f of r.files||[])listed.add(f);for(const c of r.covers||[])covers.push(c)}
 return paths.filter(p=>{const name=p.slice(p.lastIndexOf('/')+1);return !listed.has(p)&&!covers.some(c=>p.startsWith(c)||name.startsWith(c))});
}

// Claims the register makes that nothing backs: a hand-written entry may not say converted or in-game (the modules decide that), a pack entry's `covers` must match at least
// one shipped asset, and an override must name a file in dist that really contains its `needle`. `readDist(file)` returns that file's text or null.
export function claimProblems(register,derived,readDist){
 const out=[];
 for(const r of register.assets||[]){
  if(r.covers&&r.covers.length){
   const hit=derived.some(d=>r.covers.some(c=>d.source&&d.source.startsWith(c)));
   if(!hit)out.push(`${r.id}: its covers match no shipped asset`);
  }else if(r.stage==='in-game'||r.stage==='converted')out.push(`${r.id}: a register entry cannot claim "${r.stage}" itself; the dist modules decide that`);
 }
 for(const [k,o] of Object.entries(register.inGameOverrides||{})){
  const text=readDist?readDist(o.file):null;
  if(text==null)out.push(`override ${k}: dist/${o.file} does not exist`);
  else if(!o.needle)out.push(`override ${k}: needs a "needle", text that must appear in dist/${o.file}`);
  else if(!text.includes(o.needle))out.push(`override ${k}: dist/${o.file} no longer contains ${JSON.stringify(o.needle)}`);
  if(!o.why)out.push(`override ${k}: says no why`);
 }
 return out;
}

// Longest register prefix that covers a source wins ('Veichles/Logging Truck/' beats 'Veichles/').
export function packFor(source,register){
 let best=null,len=-1;
 for(const r of register.assets||[])for(const c of r.covers||[])if(source&&source.startsWith(c)&&c.length>len){best=r;len=c.length}
 return best;
}

export function buildAssets({register,derived,gameText,creditFor}){
 const overrides=register.inGameOverrides||{};
 const rows=[];
 const packs=[]; // an entry with `covers` describes a pack of shipped assets (source, licence, credit): it is the group's header, not a row
 for(const r of register.assets||[]){if(r.covers&&r.covers.length){packs.push(r);continue}rows.push({...r,origin:'register',pack:r.pack||r.name,evidence:null,hasCredit:null,triangles:r.triangles??null,size:null})}
 let unregistered=0,overridden=0,unreferenced=[];
 for(const d of derived){
  const entry=packFor(d.source,register);
  const o=overrides[d.gameId]||overrides[d.id];
  const referenced=d.byModule?moduleImported(d.module,gameText):quotedIn(d.gameId,gameText);
  const inGame=referenced||!!o;
  if(!inGame)unreferenced.push(d.id);
  if(o&&!referenced)overridden++;
  if(!entry)unregistered++;
  const credit=creditFor&&!d.noCredit?(creditFor(d.source)||(d.creditKey?creditFor(d.creditKey):null)):null;
  rows.push({id:d.id,gameId:d.gameId,name:d.name,kind:d.kind,stage:inGame?'in-game':'converted',origin:'module',pack:entry?(entry.pack||entry.name):'(no register entry)',registered:!!entry,source:d.source,licence:entry?.licence||credit?.licence||'',credit:credit?.who||entry?.credit||'',hasCredit:d.noCredit?null:!!credit,plannedUse:'',files:[],notes:'',triangles:d.triangles,size:d.size,module:d.module,viewer:d.viewer,skinned:!!d.skinned,hash:d.hash||null,evidence:referenced?'referenced in game code':o?`override: ${o.why} (${o.file})`:'no reference found'});
 }
 markShipped(rows);
 const byStage={};for(const r of rows)byStage[r.stage]=(byStage[r.stage]||0)+1;
 return {assets:rows,packs,summary:{total:rows.length,fromRegister:rows.filter(r=>r.origin==='register').length,packEntries:packs.length,fromModules:derived.length,byStage,unregistered,overridden,unreferenced}};
}

// Sub-categories: one group per pack, ordered by how much is in the game, then by name. Each group counts its stages so a folded row still tells the story.
export function groupByPack(assets,packs=[]){
 const m=new Map();
 for(const a of assets){if(!m.has(a.pack))m.set(a.pack,{pack:a.pack,items:[],stages:{},triangles:0,info:packs.filter(p=>p.pack===a.pack)});const g=m.get(a.pack);g.items.push(a);g.stages[a.stage]=(g.stages[a.stage]||0)+1;g.triangles+=a.triangles||0}
 const rank=g=>(g.stages['in-game']||0)+(g.stages.converted||0);
 return [...m.values()].sort((a,b)=>rank(b)-rank(a)||a.pack.localeCompare(b.pack));
}

// How the studio draws an asset: a spec for window.renderAsset in hub/studio.html. Converted and shipped assets use the game's own builders; a received model uses the
// vendored GLTFLoader on its GLB or glTF in assets-src; FBX is not drawn (convert first); wanted assets and received ones with no file on disk get a labelled grey placeholder.
export function previewSpec(a){
 const label=a.name,kindLabel=a.kind,stage=a.stage;
 if(a.origin==='module'){
  const id=a.gameId;
  if(a.id==='forklift')return {mode:'forklift'};
  if(a.id==='flatbed')return {mode:'prop',id:'flatbed'};
  if(a.id==='water-cooler')return {mode:'module-glb',module:'/dist/water-cooler-asset.js',export:'WATER_COOLER_GLB'};
  if(a.id.startsWith('character:'))return {mode:'module-glb',module:`/dist/character-${id}.js`,export:'default',scale:'character'};
  if(a.id==='pictures:vehicles')return {mode:'dataurl',module:'/dist/vehicle-pictures.js',export:'PICTURES',key:'worktruck-yellow'};
  if(a.id==='pictures:signs')return {mode:'dataurl',module:'/dist/sign-pictures.js',export:'SIGN_PICTURES',index:0};
  if(a.viewer==='createProp'||a.viewer==='glb'&&a.id.startsWith('rigged:'))return {mode:'prop',id};
  if(a.viewer==='nature')return {mode:'nature',id};
  if(a.viewer==='mesh')return {mode:'held',id};
  return {mode:'placeholder',label,kindLabel,stage,why:'no way to draw this yet'};
 }
 const files=a.files||[];
 const glb=files.find(f=>/\.(glb|gltf)$/i.test(f));
 if(a.kind==='model'&&glb)return {mode:'url',url:'/assets-src/'+glb.split('/').map(encodeURIComponent).join('/')};
 const why=a.kind==='sound'?'sound':files.some(f=>/\.fbx$/i.test(f))?'FBX: convert first':a.stage==='wanted'?'not received yet':files.length?'not drawable':'original not on disk';
 return {mode:'placeholder',label,kindLabel,stage,why};
}

// The picture's cache key: a hash of the asset's content (module entry or file bytes, set by the loader), the way it is drawn, and the studio page's own hash,
// so a picture is redrawn only when one of them changes.
export function previewKey(a,studioVersion){
 const h=a.hash||createHash('sha1').update(JSON.stringify([a.id,a.name,a.kind,a.stage,a.files||[]])).digest('hex');
 return createHash('sha1').update(JSON.stringify([h,previewSpec(a),studioVersion])).digest('hex').slice(0,20);
}
// ---- Recently changed: which assets are new or different since the last run. `prev` is {id:{sig,changedAt,kind}} from the last run (empty on the very first run, which is only a
// baseline: nothing is marked). A signature covers the content hash, stage, name, files and triangles, so a model re-imported, a stage moved or a file added all count.
export const RECENT_DAYS=7;
export function signature(a){return createHash('sha1').update(JSON.stringify([a.hash||null,a.stage,a.name,a.files||[],a.triangles??null])).digest('hex').slice(0,16)}
export function trackChanges(prev,assets,now=Date.now()){
 const baseline=!prev||Object.keys(prev).length===0,next={},changed=[];
 for(const a of assets){
  const sig=signature(a),old=prev&&prev[a.id];
  if(!old)next[a.id]={sig,changedAt:baseline?null:now,kind:baseline?null:'new'};
  else if(old.sig!==sig)next[a.id]={sig,changedAt:now,kind:'changed'};
  else next[a.id]=old;
  if(!baseline&&(!old||old.sig!==sig))changed.push(a.id);
 }
 return {next,changed,baseline};
}
export const isRecent=(entry,now=Date.now(),days=RECENT_DAYS)=>!!(entry&&entry.changedAt&&now-entry.changedAt<days*86400000);

// ---- The frame budget (the brief: about 15 skinned characters, 10 cars and 300 draw calls on screen). Triangles are what the assets can tell us; draw calls they cannot.
export const BUDGET={characters:15,cars:10};
export function heaviest(assets,n=12){
 return assets.filter(a=>a.origin==='module'&&a.triangles>0).sort((a,b)=>b.triangles-a.triangles).slice(0,n);
}
export function frameBudget(assets){
 const shipped=assets.filter(a=>a.origin==='module'&&a.triangles>0);
 const chars=shipped.filter(a=>a.skinned&&a.id.startsWith('character:')),cars=shipped.filter(a=>(a.pack==='Quaternius Cars'||a.pack==='Vehicles')&&a.stage==='in-game'&&!/forklift|flatbed/.test(a.id));
 const max=l=>l.reduce((m,a)=>a.triangles>m.triangles?a:m,l[0]||{triangles:0});
 const c=max(chars),v=max(cars);
 return {characters:{count:BUDGET.characters,heaviest:c.name||null,each:c.triangles||0,total:BUDGET.characters*(c.triangles||0)},cars:{count:BUDGET.cars,heaviest:v.name||null,each:v.triangles||0,total:BUDGET.cars*(v.triangles||0)}};
}
// ---- Where an asset is used. `findUses` walks a data tree (the map, the interior layouts) and counts every string under one of `keys` that is a known game id, grouped by a place label.
// `placeOf(node)` names the place of a node that has coordinates (the map passes the district); a node without coordinates inherits its parent's place, then its own `id`.
// Returns {gameId: {total, places:{label:count}}}. Only the named keys count, so a word like "store" or "car" elsewhere in the map is not mistaken for a model.
export function findUses(tree,{ids,keys,placeOf=null,root='data'}){
 const out={};
 const add=(id,place)=>{const u=out[id]??={total:0,places:{}};u.total++;u.places[place]=(u.places[place]||0)+1};
 const walk=(node,place)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const x of node)walk(x,place);return}
  let here=place;
  if(placeOf){const p=placeOf(node);if(p)here=p}
  if(here===place&&typeof node.id==='string'&&!ids.has(node.id))here=node.id;
  for(const [k,v] of Object.entries(node)){
   if(typeof v==='string'){if(keys.has(k)&&ids.has(v))add(v,here||root)}
   else walk(v,here);
  }
 };
 walk(tree,null);
 return out;
}

// The text of an asset's uses for a card or the viewer: "map 14 (Cedar Heights 9, Westside 5) · furniture 3 (house-c@9.5x7.5) · code: tools.js".
export function usesText(u,limit=4){
 if(!u)return '';
 const part=(label,x)=>{if(!x||!x.total)return null;const pl=Object.entries(x.places).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));return `${label} ${x.total} (${pl.slice(0,limit).map(([k,n])=>`${k} ${n}`).join(', ')}${pl.length>limit?`, +${pl.length-limit} more`:''})`};
 const bits=[part('map',u.map),part('interiors',u.interiors)].filter(Boolean);
 if(u.code&&u.code.length)bits.push('code: '+u.code.slice(0,4).join(', ')+(u.code.length>4?`, +${u.code.length-4}`:''));
 return bits.join(' · ');
}
// ---- Outdated register rows. A received or wanted row whose file (or an explicit `shippedAs`, for one with no file on disk) is already a shipped asset is stale: the game has it.
// `markShipped` sets `shippedAs` (the shipped asset's id) and `shippedName` on such rows; the page lists them so they can be removed, and the checklist skips them.
export function markShipped(rows){
 const shipped=rows.filter(r=>r.origin==='module'),byId=new Map(shipped.map(r=>[r.id,r])),name=f=>f.slice(f.lastIndexOf('/')+1);
 for(const r of rows){
  if(r.origin!=='register'||(r.stage!=='received'&&r.stage!=='wanted'))continue;
  let hit=r.shippedAs?byId.get(r.shippedAs):null;
  if(!hit)for(const f of r.files||[]){hit=shipped.find(s=>s.source===f||s.source===name(f));if(hit)break}
  if(hit){r.shippedAs=hit.id;r.shippedName=hit.name}else delete r.shippedAs;
 }
 return rows;
}