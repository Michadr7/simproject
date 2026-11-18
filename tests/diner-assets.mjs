// Diner D-B assets: GLB parser (tris, anchors, sizes, no Draco, recipe parts) and CC0 Ogg Vorbis sound checks.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {RECIPES} from '../dist/diner-recipes.js';
import {DINER_SHOTS,DINER_LOOPS,DINER_FILES,DINER_MAX_FILE_BYTES,DINER_MAX_TOTAL_BYTES,pickShot} from '../dist/diner-sounds.js';

function parseGlb(filePath){
 const buf=fs.readFileSync(filePath);
 assert.equal(buf.toString('latin1',0,4),'glTF',filePath+' magic');
 assert.equal(buf.readUInt32LE(4),2,filePath+' glTF v2');
 const jLen=buf.readUInt32LE(12);
 assert.equal(buf.readUInt32LE(16),0x4E4F534A,filePath+' JSON chunk');
 const json=JSON.parse(buf.toString('utf8',20,20+jLen));
 assert.ok(!(json.extensionsUsed||[]).includes('KHR_draco_mesh_compression'),filePath+' no Draco');
 const nodesByName=new Map((json.nodes||[]).map((n,i)=>[n.name,{...n,index:i}]));
 const meshes=new Map();let totalTris=0,primCount=0;
 for(const n of json.nodes||[]){
  if(n.mesh===undefined)continue;
  const m=json.meshes[n.mesh];let tris=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of m.primitives){
   primCount++;
   if(p.indices!==undefined)tris+=json.accessors[p.indices].count/3;
   else if(p.attributes?.POSITION!==undefined)tris+=json.accessors[p.attributes.POSITION].count/3;
   const pos=json.accessors[p.attributes.POSITION];
   if(pos?.min&&pos?.max)for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos.min[k]);max[k]=Math.max(max[k],pos.max[k])}
  }
  totalTris+=tris;meshes.set(n.name,{tris,min,max});
 }
 return {json,nodesByName,meshes,totalTris,primCount,bytes:buf.length};
}

const EXPECTED={
 'espresso_machine.glb':{meshes:['Espresso_Body','Espresso_Lever'],anchors:['anchor_cup_tray','anchor_portafilter','anchor_steam_puff','anchor_lever','anchor_button','anchor_sound']},
 'coffee_grinder.glb':{meshes:['Grinder_Body'],anchors:['anchor_portafilter','anchor_button','anchor_sound']},
 'flat_grill.glb':{meshes:['Grill_Body','Grill_Spatula'],anchors:['anchor_patty','anchor_egg','anchor_toast','anchor_spatula','anchor_sound']},
 'pizza_oven.glb':{meshes:['Oven_Body','Oven_Peel'],anchors:['anchor_pizza','anchor_peel','anchor_timer','anchor_sound']},
 'prep_board.glb':{meshes:['Prep_Board'],anchors:['anchor_plate','anchor_stack','anchor_knife']},
 'cash_register.glb':{meshes:['Register_Body','Service_Bell'],anchors:['anchor_drawer','anchor_bell','anchor_sound']},
 'menu_board.glb':{meshes:['Menu_Board'],anchors:['anchor_board']},
 'tableware.glb':{meshes:['plate','cup_mug','cup_demitasse','glass','cup_iced','cup_takeaway','milk_pitcher'],anchors:[]},
 'food_parts.glb':{meshes:['coffee_grounds','espresso_shot','hot_water','steamed_milk','milk_foam','ice','cold_milk','cocoa','tea_bag','bun_bottom','bun_top','patty','cheese','lettuce','tomato','onion','sauce','bacon','bread_bottom','bread_top','fried_egg','ham','grilled_cheese','club_stack','fries','dough_base','tomato_sauce','mozzarella','pepperoni','mushroom','pepper','olives','basil'],anchors:[]}
};

let grandTris=0,roomPrims=0;
const parsed={};
for(const [file,spec] of Object.entries(EXPECTED)){
 const g=parseGlb(new URL('../dist/assets/diner/'+file,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
 parsed[file]=g;grandTris+=g.totalTris;
 if(file!=='tableware.glb'&&file!=='food_parts.glb')roomPrims+=g.primCount;
 assert.equal(g.json.materials?.length,1,file+' shares 1 material');
 for(const m of spec.meshes)assert.ok(g.meshes.has(m),`${file} missing mesh ${m}`);
 for(const a of spec.anchors)assert.ok(g.nodesByName.has(a),`${file} missing anchor ${a}`);
}
assert.ok(grandTris<2500,`total triangles ${grandTris} must be < 2500`);
assert.ok(roomPrims<=11,`room fixture primitives ${roomPrims} within +10 extra draw calls budget`);

// Tableware & food parts: pivot at base (min.y === 0), food parts < 150 tris each, all recipe parts covered.
for(const name of EXPECTED['tableware.glb'].meshes){
 const info=parsed['tableware.glb'].meshes.get(name);
 assert.ok(Math.abs(info.min[1])<0.002,`${name} base pivot y=${info.min[1]}`);
 assert.ok(parsed['tableware.glb'].nodesByName.has('anchor_top_'+name),`missing anchor_top_${name}`);
}
for(const name of EXPECTED['food_parts.glb'].meshes){
 const info=parsed['food_parts.glb'].meshes.get(name);
 assert.ok(info.tris>0&&info.tris<150,`${name} tris=${info.tris} must be < 150`);
 assert.ok(Math.abs(info.min[1])<0.002,`${name} base pivot y=${info.min[1]}`);
 assert.ok(parsed['food_parts.glb'].nodesByName.has('anchor_top_'+name),`missing anchor_top_${name}`);
}
const allPartMeshes=new Set([...parsed['tableware.glb'].meshes.keys(),...parsed['food_parts.glb'].meshes.keys()]);
for(const r of RECIPES)for(const p of r.parts)assert.ok(allPartMeshes.has(p.id),`recipe ${r.id} part ${p.id} missing from GLBs`);

// Room fixture ground/size sanity
for(const f of ['espresso_machine.glb','coffee_grinder.glb','flat_grill.glb','pizza_oven.glb','prep_board.glb','cash_register.glb','menu_board.glb']){
 for(const [name,info] of parsed[f].meshes){
  assert.ok(info.min[1]>=-0.01&&info.max[1]<=1.0,`${f}:${name} height range [${info.min[1]},${info.max[1]}]`);
 }
}

// Sounds: 15 clips, mono 22.05 kHz Ogg Vorbis, each < 40 KB, total < 400 KB, pure registry + pickShot.
assert.equal(DINER_FILES.length,15);
assert.equal(new Set(DINER_FILES).size,15);
let totalSoundBytes=0;
for(const f of DINER_FILES){
 const p=new URL(`../dist/assets/sounds/${f}.ogg`,import.meta.url);
 assert.ok(fs.existsSync(p),`${f}.ogg exists`);
 const sz=fs.statSync(p).size,b=fs.readFileSync(p),pk=27+b[26];
 assert.equal(b.toString('latin1',0,4),'OggS',`${f}.ogg OggS`);
 assert.equal(b[pk+11],1,`${f}.ogg mono`);
 assert.equal(b.readUInt32LE(pk+12),22050,`${f}.ogg 22.05 kHz`);
 assert.ok(sz<DINER_MAX_FILE_BYTES,`${f}.ogg ${sz} B < ${DINER_MAX_FILE_BYTES}`);
 totalSoundBytes+=sz;
}
assert.ok(totalSoundBytes<DINER_MAX_TOTAL_BYTES,`total diner sound ${totalSoundBytes} B < ${DINER_MAX_TOTAL_BYTES}`);

for(const [k,s] of Object.entries(DINER_SHOTS)){
 assert.ok(Object.isFrozen(s)&&s.level>0&&s.level<=1&&s.jitter>=0,k);
 const p=pickShot(k,()=>0.5,-1);
 assert.equal(p.file,s.clips[0]);assert.equal(p.rate,1);assert.equal(p.level,s.level);
}
for(const [k,l] of Object.entries(DINER_LOOPS))assert.ok(Object.isFrozen(l)&&l.level>0&&l.level<=1,k);
assert.equal(pickShot('nope',()=>0.5),null);

const sndSrc=fs.readFileSync(new URL('../dist/diner-sounds.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert.ok(!sndSrc.includes(bad),'diner-sounds.js pure: '+bad);

console.log(`PASS diner-assets.mjs: 9 GLBs (${grandTris} tris total, ${roomPrims} room meshes, 33 food parts <150 tris, all ${RECIPES.length} recipes covered), 15 CC0 Ogg clips (${(totalSoundBytes/1024).toFixed(1)} KB total).`);
