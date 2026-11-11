// Mikkadr Hub, P3c: reads the register, the dist asset modules and the game's text, and hands plain metadata to hub/assets.js.
// It keeps only small fields (source, size, triangles): `pos` and `nor` in PROPS are huge base64 strings and never leave this file.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {describeModules,buildAssets,groupByPack,findUses,quotedIn,moduleImported} from './assets.js';

export const ASSET_MODULES=Object.freeze(['props-assets','nature-assets','rigged-assets','axe-assets','saw-assets','forklift-assets','flatbed-assets','water-cooler-asset','sign-pictures','vehicle-pictures','character-male','character-female']);
const SMALL=['source','width','depth','height','triangles','bounds','trunkRadius','canopyRadius','length'];
const pick=o=>{const r={};for(const k of SMALL)if(o&&o[k]!==undefined)r[k]=o[k];return r};
const pickAll=map=>Object.fromEntries(Object.entries(map||{}).map(([k,v])=>[k,pick(v)]));

export function readRegister(root){return JSON.parse(fs.readFileSync(path.join(root,'assets-register.json'),'utf8'))}

export function readGameText(root){
 const dist=path.join(root,'dist'),skip=new Set(ASSET_MODULES);
 const files=fs.readdirSync(dist).filter(f=>f.endsWith('.js')&&!skip.has(f.slice(0,-3)));
 const byFile=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(dist,f),'utf8')]));
 return {files,byFile,text:Object.values(byFile).join('\n')};
}

const sha=x=>createHash('sha1').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex').slice(0,20);

// Content hashes per derived asset id, from the full module entries (which stay inside this file) so a picture is redrawn only when its own model changes.
function hashesOf(m){
 const h={};
 for(const [id,p] of Object.entries(m.props.PROPS))h['prop:'+id]=sha(p);
 for(const [id,p] of Object.entries(m.nature.NATURE.models))h['nature:'+id]=sha([p,m.nature.NATURE.textures]);
 for(const [id,p] of Object.entries(m.rigged.RIGGED))h['rigged:'+id]=sha(p);
 for(const [id,p] of Object.entries(m.axes.AXES))h['axe:'+id]=sha(p);
 for(const [id,p] of Object.entries(m.saws.SAWS))h['saw:'+id]=sha(p);
 h.forklift=sha(m.forklift.FORKLIFT);h.flatbed=sha(m.flatbed.FLATBED);h['water-cooler']=sha(m.cooler.WATER_COOLER_GLB);
 h['pictures:vehicles']=sha(m.vehicles.PICTURES['worktruck-yellow']);h['pictures:signs']=sha(m.signs.SIGN_PICTURES[0]);
 return h;
}

export async function loadMeta(root){
 const L=n=>import(pathToFileURL(path.join(root,'dist',n+'.js')).href);
 const [props,nature,rigged,axes,saws,forklift,flatbed,cooler,signs,vehicles]=await Promise.all(['props-assets','nature-assets','rigged-assets','axe-assets','saw-assets','forklift-assets','flatbed-assets','water-cooler-asset','sign-pictures','vehicle-pictures'].map(L));
 const rg=pickAll(rigged.RIGGED);for(const [id,m] of Object.entries(rigged.RIGGED))if(m.report&&m.report.triangles!=null)rg[id].triangles=m.report.triangles;
 const hashes=hashesOf({props,nature,rigged,axes,saws,forklift,flatbed,cooler,vehicles,signs});
 for(const k of ['male','female'])hashes['character:'+k]=sha((await L('character-'+k)).default);
 return {hashes,
  props:pickAll(props.PROPS),
  nature:{models:pickAll(nature.NATURE.models)},
  rigged:rg,
  axes:pickAll(axes.AXES),saws:pickAll(saws.SAWS),
  forklift:pick(forklift.FORKLIFT),flatbed:pick(flatbed.FLATBED),
  waterCooler:typeof cooler.WATER_COOLER_GLB==='string'&&cooler.WATER_COOLER_GLB.length>0,
  characters:[{id:'male',name:'Male character (modular)',source:'module:character-male'},{id:'female',name:'Female character (modular)',source:'module:character-female'}],
  vehiclePictures:Object.keys(vehicles.PICTURES),
  signPictures:signs.SIGN_PICTURES.length};
}

// The hash of a received asset's drawable file (a glTF also takes its .bin); null when it has none on disk.
function fileHash(root,files){
 const f=(files||[]).find(x=>/\.(glb|gltf)$/i.test(x));if(!f)return null;
 const full=path.join(root,'assets-src',f);if(!fs.existsSync(full))return null;
 const parts=[fs.readFileSync(full)];if(/\.gltf$/i.test(f)){const bin=full.replace(/\.gltf$/i,'.bin');if(fs.existsSync(bin))parts.push(fs.readFileSync(bin))}
 return sha(Buffer.concat(parts));
}

// Model and sound originals under assets-src (relative paths, forward slashes). Empty when the folder is not on this machine: it is not in the repo.
export function listOriginals(root){
 const base=path.join(root,'assets-src'),out=[];
 if(!fs.existsSync(base))return out;
 const walk=(dir,rel)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;if(e.isDirectory())walk(path.join(dir,e.name),r);else if(/\.(glb|gltf|fbx|obj|wav|mp3|ogg)$/i.test(e.name))out.push(r)}};
 walk(base,'');return out;
}

// The studio's measurements ({id:{triangles,size}}), or {} before any picture has been drawn.
export function readMeasured(root){try{return JSON.parse(fs.readFileSync(path.join(root,'.hub','previews','manifest.json'),'utf8'))}catch{return {}}}

// Where each shipped asset is used: placements in the map (by district), pieces in the interior layouts (by house type), and the game files that name it.
// Returns {gameId: {map:{total,places}, interiors:{total,places}, code:[files]}}.
export async function collectUses(root,derived,byFile){
 const L=n=>import(pathToFileURL(path.join(root,'dist',n+'.js')).href);
 const {MAP,FUEL_STATIONS,zoneAtPoint}=await L('map-definition'),{INTERIOR_LAYOUTS}=await L('interior-layouts');
 const ids=new Set(derived.map(d=>d.gameId)),out={};
 const slot=id=>out[id]??={map:{total:0,places:{}},interiors:{total:0,places:{}},code:[]};
 const merge=(where,found)=>{for(const [id,u] of Object.entries(found)){const s=slot(id)[where];s.total+=u.total;for(const [p,n] of Object.entries(u.places))s.places[p]=(s.places[p]||0)+n}};
 const district=n=>typeof n.x==='number'&&typeof n.z==='number'?(zoneAtPoint(n.x,n.z)||{}).name||null:null;
 merge('map',findUses({MAP:{yards:MAP.yards,landmarks:MAP.landmarks,vehicles:MAP.vehicles,stations:FUEL_STATIONS}},{ids,keys:new Set(['prop','model']),placeOf:district,root:'map'}));
 for(const [key,layout] of Object.entries(INTERIOR_LAYOUTS))merge('interiors',findUses(layout,{ids,keys:new Set(['id']),root:key}));
 for(const d of derived)for(const [file,text] of Object.entries(byFile||{}))if(d.byModule?moduleImported(d.module,text):quotedIn(d.gameId,text))slot(d.gameId).code.push(file);
 return out;
}

// Everything the page and the tests need, in one call.
export async function loadAssets(root){
 const register=readRegister(root),meta=await loadMeta(root),{files,text,byFile}=readGameText(root);
 const {creditFor}=await import(pathToFileURL(path.join(root,'dist','credits.js')).href);
 const derived=describeModules(meta).map(d=>({...d,hash:meta.hashes[d.id]||null}));
 const built=buildAssets({register,derived,gameText:text,creditFor});
 const uses=await collectUses(root,derived,byFile);
 // an override (the characters, loaded by a template import) names the file that uses the asset
 for(const d of derived){const o=(register.inGameOverrides||{})[d.id]||(register.inGameOverrides||{})[d.gameId];if(o){const u=uses[d.gameId]??={map:{total:0,places:{}},interiors:{total:0,places:{}},code:[]};if(!u.code.includes(o.file))u.code.push(o.file)}}
 for(const a of built.assets)if(a.origin==='module')a.uses=uses[a.gameId]||null;
 for(const a of built.assets)if(a.origin==='register')a.hash=fileHash(root,a.files);
 // what the studio measured when it drew a picture fills the numbers the modules do not record (the characters, the water cooler, the sawmill); a stated number always wins
 const measured=readMeasured(root);
 for(const a of built.assets){const m=measured[a.id];if(!m)continue;if(a.triangles==null&&m.triangles!=null)a.triangles=m.triangles;if(!a.size&&m.size)a.size=m.size}
 return {register,derived,gameFiles:files,...built,groups:groupByPack(built.assets,built.packs)};
}
