import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {lookOf,smokeOf,BANDS,bandOf,HOOD_WRECKED_SECONDS,misfirePeriod,misfiring,MISFIRE_SECONDS,WEAR_START} from '../dist/damage.js';
import {engineVoice,createAudio} from '../dist/audio.js';
import {createSmoke,SMOKE_MAX,SMOKE_COLOURS} from '../dist/smoke.js';
import {createProp} from '../dist/props.js';
import {applyPaint,applyLook} from '../dist/paint-shader.js';
import {WEAR_PNG,CRACK_PNG} from '../dist/damage-textures.js';

// VD3 look and sound: the band to wear / crack / smoke mapping is pure; a crash only changes uniforms, never the shader program.
// ---- the mapping
{const conds=[1000,850,849,700,699,400,399,150,149,1,0];let last=-1;
 assert.deepEqual(lookOf(1000),{wear:0,crack:0,smoke:0,band:'fine'},'a perfect vehicle looks perfect');assert.equal(lookOf(WEAR_START).wear,0,'no grime from WEAR_START (900) up');
 for(const c of conds){const l=lookOf(c);assert(l.wear>=0&&l.wear<=1&&l.crack>=0&&l.crack<=1,'0..1 at '+c);assert(l.wear>=last,'wear never shrinks as cond falls ('+c+')');last=l.wear;assert.equal(l.smoke,bandOf(c).smoke,'smoke tier is the band\'s at '+c)}
 assert.equal(lookOf(0).wear,1,'wrecked: full wear');assert(lookOf(799).wear>.25&&lookOf(799).wear<.5&&lookOf(650).wear>.25&&lookOf(650).wear<.5,'Worn (VD7a): a visible film from the first scuffs, .25 to .5 across the band');assert(lookOf(150).wear>.7,'Damaged: heavy');
 assert.deepEqual(BANDS.map(b=>lookOf(b.min).crack),[0,0,.45,.8,1],'glass: none at Fine and Worn, light at Damaged, heavy at Limping, full at Wrecked');
 assert.deepEqual([0,1,2].map(t=>BANDS.filter(b=>b.smoke===t).map(b=>b.id)),[['fine','worn'],['damaged'],['limping','wrecked']],'tiers: grey, dark, black');
 assert.deepEqual(lookOf(Number.NaN),lookOf(1000),'bad input reads as perfect');
}
// ---- smoke numbers: the hood smokes from Damaged, a wrecked one for 60 s only
{assert.equal(smokeOf(1000).hoodRate,0);assert.equal(smokeOf(700).hoodRate,0,'Worn: no hood smoke');assert(smokeOf(300).hoodRate>0&&smokeOf(100).hoodRate>smokeOf(300).hoodRate,'more from Limping');
 assert(smokeOf(0,10).hoodRate>0&&smokeOf(0,HOOD_WRECKED_SECONDS-1).hoodRate>0,'wrecked: smokes after the crash');assert.equal(smokeOf(0,HOOD_WRECKED_SECONDS).hoodRate,0,'and stops after 60 s');assert.equal(smokeOf(0).hoodRate,0,'a wreck from an old save does not smoke');
 assert(smokeOf(700).exhaustMul>1&&smokeOf(100).exhaustMul>smokeOf(300).exhaustMul,'the exhaust smokes more as it wears');assert.equal(smokeOf(1000).tier,0);assert.equal(smokeOf(300).tier,1);assert.equal(smokeOf(100).tier,2)}
// ---- sound: roughness by band, a misfire on a fixed phase (no random), silent when not running
{const V=(cond,time=.5,o={})=>engineVoice({speed:5,top:10,throttle:1,cond,time,...o});
 assert(V(700).rough>V(1000).rough&&V(300).rough>V(700).rough&&V(100).rough>V(300).rough,'rougher with each band');assert.deepEqual(V(1000),engineVoice({speed:5,top:10,throttle:1}),'a perfect engine sounds as before');
 assert.equal(misfirePeriod(1000),0);assert.equal(misfirePeriod(700),0);assert.equal(misfirePeriod(300),1.7);assert.equal(misfirePeriod(100),.8);
 assert.equal(misfiring(300,1.7*3+.05),true);assert.equal(misfiring(300,1.7*3+MISFIRE_SECONDS+.01),false,'a short dip every 1.7 s when Damaged');assert.equal(misfiring(100,.8*5+.05),true,'every 0.8 s when Limping');assert.equal(misfiring(1000,0),false);
 const dip=V(300,1.7*2+.05),ok=V(300,1.7*2+.5);assert(dip.misfire&&dip.gain<ok.gain*.3&&dip.freq<ok.freq,'the misfire dips level and pitch');assert.deepEqual(V(300,3.4+.05),V(300,3.4+.05),'deterministic');
 assert.equal(V(300,.05,{running:false}).gain,0,'off is silent')}
// ---- one program: every vehicle, every condition, the same shader text and cache key
{const fake=src=>({uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <map_fragment>'});
 const keys=new Set(),texts=new Map(),glassTexts=new Set(),conds=[1000,800,699,500,399,200,149,50,1,0];let glassPatched={};
 for(const model of ['shortbed','flatbed','worktruck','offroad']){const mesh=createProp(model,{apply:m=>m});applyPaint(mesh,model,'red');
  const paints=[],glass=[];mesh.traverse(o=>{if(o.isMesh){for(const m of [].concat(o.material))if(m.userData.paint?.uWear){if(!paints.includes(m))paints.push(m)}else if(m.userData.crack&&!glass.includes(m))glass.push(m)}});
  assert(paints.length>0,model+': the body paint is patched');
  for(const c of conds){applyLook(mesh,lookOf(c),model);for(const m of paints){keys.add(m.customProgramCacheKey());const s=fake();m.onBeforeCompile(s);texts.set(model+c+paints.indexOf(m),s.fragmentShader+s.vertexShader);assert.equal(m.userData.paint.uWear.value.y,lookOf(c).wear,model+': uWear follows cond '+c)}
   for(const m of glass){keys.add(m.customProgramCacheKey());const s=fake();m.onBeforeCompile(s);glassTexts.add(s.fragmentShader+s.vertexShader);assert.equal(m.userData.crack.uCrack.value,lookOf(c).crack,model+': uCrack follows cond '+c)}}
  glassPatched[model]=glass.length}
 assert.deepEqual([...keys].sort(),['vehicle-glass','vehicle-paint'],'exactly two program keys for every vehicle at every condition');
 assert.equal(new Set(texts.values()).size,1,'the paint shader text is identical for every vehicle and every condition (one program, uniforms differ)');assert.equal(glassTexts.size,1,'and the glass shader text too');
 assert.deepEqual(glassPatched,{shortbed:1,flatbed:1,worktruck:0,offroad:0},'cracks: the S70 and the flatbed have a separate glass; the worktruck and the off-road pickup have the glass baked into the body texture (no crack, nothing faked)');
 // uniforms only change on change (same object, same value after a repeat)
 const mesh=createProp('shortbed',{apply:m=>m});applyPaint(mesh,'shortbed','red');applyLook(mesh,lookOf(300),'shortbed');const u=mesh.userData.paint.userData.paint.uWear,vref=u.value;applyLook(mesh,lookOf(300),'shortbed');assert.equal(u.value,vref,'the same uniform object');
 assert.equal(applyLook(createProp('offroad',{apply:m=>m}),lookOf(0),'offroad'),0,'no glass material: reported as 0 (no crack)')}
// ---- smoke pool: 150 points, one Points object, a colour per tier, never over the pool
{assert.equal(SMOKE_MAX,150);const scene=new THREE.Scene(),s=createSmoke(scene,{random:()=>.5});assert.equal(s.particles.max,150);const col=s.points.geometry.getAttribute('color');assert.equal(col.count,150,'a colour per point');assert.equal(s.points.material.vertexColors,true);
 const tip={x:0,y:1,z:0,dx:0,dz:0},at=i=>[...col.array.slice(i*3,i*3+3)];const want=t=>new THREE.Color(SMOKE_COLOURS[t]).toArray();
 s.emit('x',1,tip,1,0);assert.deepEqual(at(0).map(v=>+v.toFixed(4)),want(0).map(v=>+v.toFixed(4)),'tier 0 grey');s.emit('x',1,tip,1,1);assert.deepEqual(at(1).map(v=>+v.toFixed(4)),want(1).map(v=>+v.toFixed(4)),'tier 1 dark');s.burst(tip,1,2);assert.deepEqual(at(2).map(v=>+v.toFixed(4)),want(2).map(v=>+v.toFixed(4)),'tier 2 black');
 assert(want(1)[0]<want(0)[0]&&want(2)[0]<want(1)[0],'each tier darker than the last');
 for(let i=0;i<600;i++){s.emit('exhaust',1/60,tip,30,0);s.emit('hood',1/60,tip,6,2);s.update(1/60)}assert(s.particles.alive<=150&&s.update(0)<=150,'bounded at 150 even with exhaust and hood smoke at once');assert.equal(scene.children.filter(c=>c.isPoints).length,1,'one draw call')}
// ---- sound: the stall and a long crank are made (a fake context), muted and over-limit are refused
{class P{constructor(v=0){this.value=v}setTargetAtTime(v){this.target=v}setValueAtTime(v){this.value=v}linearRampToValueAtTime(v){this.ramp=v}}
 class N{constructor(k,c){this.kind=k;c.nodes.push(this)}connect(n){return n}start(){}stop(){}}
 class Ctx{constructor(){this.nodes=[];this.currentTime=0;this.sampleRate=100;this.destination=new N('d',this)}resume(){}createGain(){const n=new N('gain',this);n.gain=new P(1);return n}createOscillator(){const n=new N('osc',this);n.frequency=new P(440);return n}createBiquadFilter(){const n=new N('filter',this);n.frequency=new P(350);n.Q=new P(1);return n}createBufferSource(){return new N('src',this)}createBuffer(c,l){return {length:l,getChannelData:()=>new Float32Array(l)}}}
 const m=new Map(),a=createAudio({AudioContextClass:Ctx,storage:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}});assert.equal(a.stall(),false,'no sound before the first click');a.unlock();
 assert.equal(a.stall(),true,'the engine dying is heard');a.setMuted(true);assert.equal(a.stall(),false,'but not when muted');a.setMuted(false);
 const at={x:0,z:0},srcs=()=>0;assert.equal(a.ignition(at,at,{tier:'low',seconds:3}),true,'a long crank (a damaged engine) plays');assert.equal(a.ignition(at,at,{seconds:3}),true)}
// ---- the textures: real PNGs, small
{for(const [n,u,max] of [['wear',WEAR_PNG,70000],['crack',CRACK_PNG,20000]]){assert(u.startsWith('data:image/png;base64,'),n+' is a PNG data URI');const b=Buffer.from(u.split(',')[1],'base64');assert.equal(b.subarray(1,4).toString(),'PNG');assert(b.length<max,n+' stays small ('+b.length+' bytes)');const w=b.readUInt32BE(16),h=b.readUInt32BE(20);assert.equal(w,h,'square');assert(w===256,n+' size '+w)}}
console.log('Damage look and sound: wear 0 at Fine growing to 1 at Wrecked, glass cracks from Damaged, smoke tiers grey, dark, black, a hood smoke for 60 s on a wreck, rougher engine and a misfire by band, a stall and a long crank, one paint program and one glass program for every vehicle at every condition, a pool of 150 smoke points, two small generated textures.');