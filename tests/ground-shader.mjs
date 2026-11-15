// GD1 ground shader base: the patch strings, the program keys, the JS noise mirror and the real world's materials (data and shader strings only; the test browser cannot judge looks).
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const R=await import('../dist/ground-rules.js'),S=await import('../dist/ground-shader.js'),{createWorld,setGroundQuality}=await import('../dist/world.js');
let n=0;const ok=(c,m)=>{assert(c,m);n++};

// pure rules
ok(R.GROUND_KINDS.length<=11&&new Set(R.GROUND_KINDS).size===R.GROUND_KINDS.length,'at most 11 ground kinds (10 from GD1 + the river valley), all different');
{let lo=1,hi=0;for(let i=0;i<4000;i++){const x=(i*37.7)%900-450,z=(i*91.3)%1500-700,a=R.valueNoise(x/9,z/9);lo=Math.min(lo,a);hi=Math.max(hi,a);ok(a>=0&&a<=1,'noise in 0..1');ok(R.valueNoise(x/9,z/9)===a,'noise is deterministic');
  const t=R.groundTone(x,z,i%90);ok(t>=R.GD_DARK*R.GD_MESO_DARK-1e-9&&t<=R.GD_LIGHT*R.GD_MESO_LIGHT+1e-9,'tone stays inside the named range')}
 ok(hi-lo>.7,'the noise really varies ('+(hi-lo).toFixed(2)+')')}
ok(Math.abs(R.groundTone(5,5,500)-R.groundTone(5,5,R.GD_DETAIL_FAR))<1e-12,'beyond the far distance only the macro colour remains');
ok(R.groundTone(5,5,0)!==R.groundTone(5,5,R.GD_DETAIL_FAR),'near, the clumps change the tone');
ok(R.macroAt(0,0)!==R.mesoAt(0,0)&&R.mesoAt(0,0)!==R.notileAt(0,0),'the three noises use different seeds');

// shader strings
const hi=S.groundShaderParts('grass',true),lo=S.groundShaderParts('grass',false),count=(s,t)=>s.split(t).length-1;
ok(hi.common.includes('uniform float uGdAmount')&&hi.common.includes('GD_MACRO_SCALE')&&hi.common.includes('GD_MESO_SCALE'),'High patch declares the uniform and the two scales');
ok(count(hi.fragment,'texture2D(map')===2&&hi.fragment.includes('GD_NOTILE_ROT'),'High reads the texture twice (no-tile)');
ok(count(lo.fragment,'texture2D(map')===1&&!lo.fragment.includes('GD_NOTILE')&&!lo.common.includes('GD_NOTILE'),'Low reads the texture once and has no no-tile code');
ok(hi.fragment.includes('GD_DRY_HUE')&&!S.groundShaderParts('dirt',true).fragment.includes('GD_DRY_HUE'),'the dry tint is for grass and farm only');
ok(S.groundShaderParts('farm',true).fragment.includes('GD_DRY_HUE'),'farm leans dry too');
ok(!/#define \w+ -?\d+\n/.test(hi.common),'every number in the defines is a float literal');
ok(S.groundProgramKey('grass',true)==='ground-grass'&&S.groundProgramKey('grass',false)==='ground-grass-lo','program keys are stable: ground-<kind> and ground-<kind>-lo');

// patch applied to a real standard-material shader
{const m=S.patchGround(new THREE.MeshStandardMaterial({color:'#8a9a7c'}),'grass'),sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
 m.onBeforeCompile(sh);
 ok('uGdAmount' in sh.uniforms,'the uniform reaches the shader');ok(sh.vertexShader.includes('vGWorld=(modelMatrix')&&sh.fragmentShader.includes('gdNoise(')&&!sh.fragmentShader.includes('#include <map_fragment>'),'the chunks were replaced');
 ok(m.customProgramCacheKey()==='ground-grass','the cache key is the kind');
 ok(m.color.getHexString()==='8a9a7c'&&m.roughness===1,'the material keeps its own colour');
 setGroundQuality(false);ok(m.customProgramCacheKey()==='ground-grass-lo','Low switches the key');const sl={uniforms:{},vertexShader:sh.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sl);ok(!sl.fragmentShader.includes('GD_NOTILE'),'Low compiles without no-tile');setGroundQuality(true)}
try{S.patchGround(new THREE.MeshStandardMaterial(),'lava');ok(false,'unknown kind must throw')}catch(e){ok(/unknown ground kind/.test(e.message),'unknown kinds are refused')}

// the real world: the patched materials are the existing ground materials
{const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity,streaming:true});
 const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const patched=meshes.filter(m=>m.material?.userData?.groundKind);
 ok(patched.length>=5,'ground meshes are patched ('+patched.length+')');
 const kinds=new Set(patched.map(m=>m.material.userData.groundKind)),keys=new Set(patched.map(m=>m.material.customProgramCacheKey()));
 ok(kinds.size<=11&&keys.size<=11&&keys.size===kinds.size,'one program key per kind, at most 11: '+[...keys].join(','));
 ok([...kinds].every(k=>R.GROUND_KINDS.includes(k)),'every kind is a known one');
 ok(patched.every(m=>m.material.isMeshStandardMaterial&&m.material.onBeforeCompile.toString().includes('groundShaderParts')),'patched materials are the existing standard ground materials (with their polygon offset)');
 ok(new Set(patched.map(m=>m.material.uuid)).size===patched.length,'each mesh keeps its own material');
 for(const name of ['ground-base-south','ground-base-north','ground-far-south']){const m=meshes.find(x=>x.name===name);if(m)ok(m.material.userData.groundKind==='grass','ground '+name+' is the grass kind')}
 ok(meshes.filter(m=>/^ground-(far|base|farm|forest)|^mud-|^field-|^dirt-road/.test(m.name)).every(m=>m.material.userData.groundKind),'every ground plane, field, mud patch and dirt road is patched');
 ok(!meshes.some(m=>/ground-detail|gd-/.test(m.name)),'no new ground meshes were added')}
// GD2 soft borders
{const E=R.GD_EDGE;
 for(const k of Object.keys(E))ok(R.GROUND_KINDS.includes(k)&&E[k].w>0&&E[k].j>=0,'edge entry for a known kind: '+k);
 ok(R.GD_BLEND_DEPTH===.2,'depth window is the reference .2');
 for(const k of ['mud','field','farm']){let seen0=false;const e=E[k];
  for(let i=0;i<600;i++){const x=(i*13.7)%300-150,z=(i*29.3)%300-150;
   ok(R.edgeCover(k,0,x,z).cover===0&&R.edgeCover(k,-.3,x,z).cover===0,k+': nothing survives at the edge or outside (the band is inside the rectangle)');
   const far=R.edgeCover(k,e.w+e.j+.001,x,z);ok(far.m===1&&far.cover===1,k+': fully opaque from width+jitter inside');
   const mid=R.edgeCover(k,e.w*.5+e.j*.3,x,z).cover;ok(mid>=0&&mid<=1,'cover in 0..1')}
  let partial=0;for(let i=0;i<400;i++){const c=R.edgeCover(k,e.w*.6+e.j*.2,i*.9,i*1.3).cover;if(c>.05&&c<.95)partial++}
  ok(partial>20,k+': the band has a ragged middle ('+partial+'/400 partial)')}
 {let prev=-1,mono=true;for(let d=0;d<4;d+=.05){const c=R.edgeCover('mud',d,10.3,-7.1).m;if(c<prev-1e-12)mono=false;prev=c}ok(mono,'the soft mask only grows toward the inside')}
 // dither: the bayer matrix has 16 distinct thresholds in (0,1)
 {const s=new Set();for(let x=0;x<4;x++)for(let y=0;y<4;y++){const b=R.bayerAt(x,y);ok(b>0&&b<1,'bayer in (0,1)');s.add(b)}ok(s.size===16,'16 distinct dither thresholds')}
 // shader strings
 const e=S.groundShaderParts('mud',true,true),n0=S.groundShaderParts('mud',true,false),l=S.groundShaderParts('mud',false,true);
 ok(e.common.includes('uniform vec4 uGdBox')&&e.common.includes('uniform vec3 uGdEdge')&&e.common.includes('gdBayer'),'edge patch declares the box, the edge and the dither');
 ok(e.fragment.includes('discard')&&e.fragment.includes('GD_BLEND_DEPTH')&&e.fragment.includes('GD_MUD_RIM_DARK'),'edge patch discards by the depth window and darkens the mud rim');
 ok(!n0.fragment.includes('discard')&&!n0.common.includes('uGdBox'),'without a box there is no edge code');
 ok(!l.fragment.includes('discard')&&!l.common.includes('uGdBox'),'Low keeps the hard edge (no edge code)');
 ok(!S.groundShaderParts('field',true,true).fragment.includes('GD_MUD_RIM_DARK;'),'only mud has the wet rim');
 ok(S.groundShaderParts('dirt',true,true).fragment.includes('discard')===false,'kinds without an edge entry never get edge code');
 ok(!/#define \w+ -?\d+\n/.test(e.common),'edge defines are float literals');
 ok(S.groundProgramKey('mud',true,true)==='ground-mud-e'&&S.groundProgramKey('mud',false,true)==='ground-mud-lo'&&S.groundProgramKey('mud',true,false)==='ground-mud','edge program keys');
 // patch on a real standard-material shader: per-material uniforms
 const m=S.patchGround(new THREE.MeshStandardMaterial({color:'#fff'}),'mud');m.userData.groundEdge={x0:-160,x1:-148,z0:-225.5,z1:-219.5};
 const sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh);
 ok(sh.uniforms.uGdBox.value.join()==='-160,-225.5,-148,-219.5'&&sh.uniforms.uGdEdge.value[0]===E.mud.w,'the box and the ramp reach the shader as uniforms');
 ok(m.customProgramCacheKey()==='ground-mud-e','a boxed material gets the edge program');
 S.setGroundQuality(false);const sl={uniforms:{},vertexShader:sh.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sl);ok(!('uGdBox' in sl.uniforms)&&!sl.fragmentShader.includes('uGdBox')&&m.customProgramCacheKey()==='ground-mud-lo','Low: no box uniform, hard edge');S.setGroundQuality(true);
 // the real world
 const scene=new THREE.Scene();createWorld(scene,{cullRadius:Infinity,streaming:true});const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const mud=meshes.filter(x=>/^mud-/.test(x.name)),fields=meshes.filter(x=>/^field-/.test(x.name)),zones=meshes.filter(x=>/^ground-(farm|forest)/.test(x.name));
 ok(mud.length>=4&&fields.length>=1&&zones.length>=1,'mud patches, fields and zone grounds exist');
 for(const x of [...mud,...fields,...zones]){const b=x.material.userData.groundEdge;ok(b&&b.x1>b.x0&&b.z1>b.z0&&x.material.customProgramCacheKey()==='ground-'+x.material.userData.groundKind+'-e','soft border box on '+x.name)}
 for(const x of mud){const b=x.material.userData.groundEdge,g=x.geometry.parameters;ok(Math.abs((b.x1-b.x0)-g.width)<1e-9&&Math.abs((b.z1-b.z0)-g.height)<1e-9&&Math.abs(x.position.y+.064)<1e-9,'mud box equals the plane and the plane stays at y -.064: '+x.name);ok(x.material.polygonOffset===true,'polygon offset kept')}
 const valley=meshes.find(x=>x.name==='river-valley');
 if(valley){ok(valley.material.userData.groundKind==='valley'&&valley.material.vertexColors===true&&valley.material.customProgramCacheKey()==='ground-valley','the river valley has its own ground program and keeps its vertex colours');
  const vs={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};valley.material.onBeforeCompile(vs);ok(vs.fragmentShader.includes('gdNoise(')&&!vs.fragmentShader.includes('#include <map_fragment>'),'the valley fragment shader is patched')}
 const keys=new Set();scene.traverse(o=>{if(o.isMesh&&o.material?.userData?.groundKind)keys.add(o.material.customProgramCacheKey())});ok(keys.size<=11,'ground programs in the real world: '+keys.size+' ('+[...keys].join(',')+')');
 console.log('ground programs: '+keys.size)}
// GD3 per-surface detail and wet mud
{const cover=(cell,occ,r)=>{let n=0,m=0;for(let i=0;i<60;i++)for(let j=0;j<60;j++){const x=i*.0937+3.1,z=j*.0911-7.7;m++;if(R.pebbleAt(x*cell*1.7,z*cell*1.7,cell,occ,r).h>0)n++}return n/m};
 // coverage measured over a bigger window than a few cells
 const covDirt=(()=>{let n=0,m=0;for(let i=0;i<300;i++)for(let j=0;j<300;j++){m++;if(R.pebbleAt(i*.05,j*.05).h>0)n++}return n/m})(),covGravel=(()=>{let n=0,m=0;for(let i=0;i<300;i++)for(let j=0;j<300;j++){m++;if(R.pebbleAt(i*.05,j*.05,R.GD_GRAVEL_CELL,R.GD_GRAVEL_OCC,R.GD_GRAVEL_R).h>0)n++}return n/m})();
 ok(Math.abs(covDirt-R.GD_PEBBLE_FILL)<.04,'dirt pebble coverage near GD_PEBBLE_FILL ('+covDirt.toFixed(3)+')');
 ok(covGravel>.45&&covGravel<.7&&covGravel>covDirt*3,'gravel is dense: coverage '+covGravel.toFixed(2)+' vs dirt '+covDirt.toFixed(2));
 ok(R.GD_PEBBLE_OCC>0&&R.GD_PEBBLE_OCC<=1&&R.GD_GRAVEL_OCC<=1,'occupancy in 0..1');
 for(let i=0;i<500;i++){const a=R.pebbleAt(i*.37,i*.91);ok(a.h>=0&&a.h<=1&&a.id>=0&&a.id<=1&&R.pebbleAt(i*.37,i*.91).h===a.h,'pebbles deterministic, height in 0..1')}
 // puddles: a share of the mud, none when dry, more when wetter, low spots first
 let pud=0,pud0=0,N=0;for(let i=0;i<200;i++)for(let j=0;j<200;j++){const low=R.puddleAt(i*.4-40,j*.4-40);N++;if(R.puddleMask(low,1)>.5)pud++;if(R.puddleMask(low,0)>.5)pud0++;ok(R.puddleMask(low,1)>=R.puddleMask(low,.5)-1e-12,'wetter never means fewer puddles')}
 ok(pud/N>.04&&pud/N<.4,'puddles cover a sensible share of the mud ('+(pud/N*100).toFixed(1)+'%)');ok(pud0===0,'no puddles when dry (wet 0)');
 ok(R.puddleMask(0,1)===1&&R.puddleMask(1,1)===0,'lowest spot is puddle, high ground is not');
 ok(Math.abs(R.schlick(1)-R.GD_F0)<1e-12&&Math.abs(R.schlick(0)-1)<1e-12&&R.schlick(.2)>R.schlick(.6),'fresnel: F0 looking straight down, 1 along the surface, rising toward grazing');
 ok(Math.abs(R.furrowAt(R.GD_FURROW_PERIOD/4)-1)<1e-9&&Math.abs(R.furrowAt(0))<1e-9&&Math.abs(R.furrowAt(.1)-R.furrowAt(.1+R.GD_FURROW_PERIOD))<1e-9,'furrows repeat every GD_FURROW_PERIOD');
 {let lo=9,hi=0;for(let i=0;i<300;i++){const s=R.slabTone(i*2.01,i*-1.3);lo=Math.min(lo,s);hi=Math.max(hi,s)}ok(lo>=1-R.GD_SLAB_JITTER-1e-9&&hi<=1+R.GD_SLAB_JITTER+1e-9&&hi-lo>R.GD_SLAB_JITTER,'slab jitter stays within GD_SLAB_JITTER and varies');ok(R.slabTone(.2,.3)===R.slabTone(1.7,1.9),'one tone per 2 m slab')}
 // shader strings: each surface has its own code; puddles only in mud
 const H=k=>S.groundShaderParts(k,true,false),Lo=k=>S.groundShaderParts(k,false,false),all=p=>p.common+p.fragment+p.normal+p.rough+p.emissive;
 ok(all(H('dirt')).includes('gdPebble')&&all(H('dirt')).includes('GD_CRACK')&&all(H('dirt')).includes('uGdGravel'),'dirt: pebbles, cracks and the gravel uniform');
 ok(!all(Lo('dirt')).includes('GD_CRACK')&&all(Lo('dirt')).includes('gdPebble'),'Low dirt: pebbles but no cracks');
 ok(all(H('forest')).includes('GD_LITTER_0')&&all(H('plowed')).includes('GD_FURROW_PERIOD')&&all(H('paving')).includes('GD_SLAB')&&all(H('paving')).includes('GD_SLAB_EDGE')&&!all(Lo('paving')).includes('GD_SLAB_EDGE'),'forest litter, plowed furrows, paving slabs (seam High only)');
 ok(all(H('grass')).includes('GD_FLECK_FILL')&&!all(Lo('grass')).includes('GD_FLECK')&&all(Lo('grass')).includes('GD_CLUMP_CELL'),'grass flecks High only, clumps on both');
 for(const k of R.GROUND_KINDS){const a=all(H(k)),b=all(Lo(k));ok(k==='mud'?a.includes('GD_PUDDLE_LEVEL')&&b.includes('GD_PUDDLE_LEVEL'):!a.includes('PUDDLE')&&!b.includes('PUDDLE')&&!a.includes('uSkyHorizon'),'puddles only in mud: '+k)}
 ok(H('mud').emissive.includes('uSkyHorizon')&&H('mud').emissive.includes('GD_F0')&&H('mud').common.includes('uniform vec3 uSkyHorizon'),'High mud: fresnel sky sheen from the shared horizon uniform');
 ok(Lo('mud').emissive===''&&!Lo('mud').common.includes('uSkyHorizon')&&Lo('mud').rough.includes('gdRoughT')&&Lo('mud').normal==='','Low mud: dark and glossy, no sheen, no fake normals');
 ok(H('mud').rough.includes('roughnessFactor')&&H('mud').normal.includes('dFdx')&&H('mud').fragment.includes('uGdWet')&&H('mud').fragment.includes('gdPud'),'High mud: roughness, fake normals, wet hook');
 for(const k of ['dirt','forest','plowed','grass','farm','mud'])ok(H(k).normal.includes('normal_fragment_maps')&&!Lo(k).normal,'fake normals High only: '+k);
 ok(H('paving').normal===''&&H('valley').normal===''&&H('wheat').normal==='','kinds without relief keep the plain normal');
 for(const k of R.GROUND_KINDS)for(const hi of [true,false]){const a=S.groundShaderParts(k,hi,false);ok(!/#define \w+ -?\d+\n/.test(a.common),'float literals in the defines: '+k+(hi?'':' lo'))}
 // gravel: same program as dirt, per-material uniform
 const mk=g=>{const m=S.patchGround(new THREE.MeshStandardMaterial({color:'#a39d8c'}),'dirt');if(g)m.userData.groundGravel=true;const sh={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh);return [m,sh]};
 const [mg,sg]=mk(true),[md,sd]=mk(false);ok(sg.uniforms.uGdGravel.value===1&&sd.uniforms.uGdGravel.value===0&&mg.customProgramCacheKey()===md.customProgramCacheKey()&&mg.customProgramCacheKey()==='ground-dirt','gravel and dirt share ONE program, the uniform chooses');
 ok(sg.uniforms.uSkyHorizon&&sg.uniforms.uGdWet&&sg.fragmentShader.includes('#include <normal_fragment_begin>')&&!sg.fragmentShader.includes('#include <map_fragment>'),'shared uniforms reach the shader');
 // the real world: the gravel roads use the dirt program with the gravel switch; mud keeps y -.064
 const scene=new THREE.Scene();createWorld(scene,{cullRadius:Infinity,streaming:true});const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const gr=meshes.filter(x=>/^gravel-road-/.test(x.name)),tr=meshes.filter(x=>/^track-/.test(x.name));
 ok(gr.length>=2&&gr.every(x=>x.material.userData.groundGravel===true&&x.material.customProgramCacheKey()==='ground-dirt'),'gravel roads: dirt program, gravel switch ('+gr.length+' meshes)');ok(tr.every(x=>!x.material.userData.groundGravel),'dirt tracks are not gravel');
 ok(meshes.filter(x=>/^mud-/.test(x.name)).every(x=>Math.abs(x.position.y+.064)<1e-9),'mud planes still at y -.064 (TR3, TR5 tracks sit above)');
 // the one shared sky uniform
 const SKY=await import('../dist/sky.js');ok(SKY.SKY_HORIZON.value.isColor&&S.GROUND_UNIFORMS.uSkyHorizon===SKY.SKY_HORIZON,'ONE shared sky horizon uniform, the same object in sky.js and the ground shader');
 {const sc=new THREE.Scene();sc.fog=new THREE.Fog('#b9cbd0',65,155);const hemi=new THREE.HemisphereLight('#fff','#777',1),sun=new THREE.DirectionalLight('#fff',1),sky=SKY.createSky({scene:sc,renderer:{toneMappingExposure:1},sun,hemi});
  for(const m of [720,1200,60]){sky.update(m);ok(Math.abs(SKY.SKY_HORIZON.value.r-sc.fog.color.r)<1e-9&&Math.abs(SKY.SKY_HORIZON.value.b-sc.fog.color.b)<1e-9,'the uniform follows the fog colour at minute '+m)}
  sky.update(720);const day=SKY.SKY_HORIZON.value.getHex();sky.update(60);ok(SKY.SKY_HORIZON.value.getHex()!==day,'night and day differ (puddles go dark at night)')}
 // programs: still the 11 of GD2
 const keys=new Set();scene.traverse(o=>{if(o.isMesh&&o.material?.userData?.groundKind)keys.add(o.material.customProgramCacheKey())});ok(keys.size<=11,'GD3 adds no program: '+keys.size);
 ok(S.setGroundWet&&(S.setGroundWet(.3),S.GROUND_UNIFORMS.uGdWet.value===.3)&&(S.setGroundWet(R.GD_WET_DEFAULT),true),'the env.wet hook: one shared uniform, no weather yet')}
console.log('ground-shader: '+n+' checks ok');
