// The day and night rig (dist/daynight.js): pure functions of the clock. Bounded, continuous (also across midnight), the same answer for the same time,
// the four mood anchors, NIGHT_FLOOR, the fog limit, the colour grade and its GLSL twin. The packaged-game part at the end checks the wiring (sky.js, game.js).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SUNRISE,SUNSET,NIGHT_FLOOR,NIGHT_FLOOR_MIN,NIGHT_FLOOR_MAX,EXPOSURE_MIN,EXPOSURE_MAX,FOG_FAR_MAX,MIN_LIGHT_ELEVATION,MOODS,MOOD_NAMES,toLinear,wrapMinutes,clampNightFloor,sunHeight,sunDirection,moonDirection,moodAt,lightDirection,skyAt,GRADE,grade,gradeGLSL,litGround} from '../dist/daynight.js';
import {bootGame} from './support/boot-game.mjs';

const near=(a,b,eps,msg)=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);
const near3=(a,b,eps,msg)=>a.forEach((v,i)=>near(v,b[i],eps,`${msg} [${i}]`));
const flat=o=>typeof o==='number'?[o]:Array.isArray(o)?o.flatMap(flat):Object.values(o).flatMap(flat);
const len=v=>Math.hypot(...v),luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
const clock=(h,m=0)=>h*60+m;

// --- Constants the rest of the game leans on ---------------------------------------------------------------------------
assert.equal(SUNRISE,360);assert.equal(SUNSET,1080);assert.equal(NIGHT_FLOOR,.12,'the starting night floor the user chose');
assert.equal(NIGHT_FLOOR_MIN,.04);assert.equal(NIGHT_FLOOR_MAX,.30);assert(FOG_FAR_MAX<=155,'fog ends before scenery is culled (tests/culling.mjs pins 155 to 200)');
assert.deepEqual(MOOD_NAMES,['dawn','day','dusk','night']);
for(const name of MOOD_NAMES){const m=MOODS[name];for(const k of ['top','horizon','light','hemiSky','hemiGround'])assert.match(m[k],/^#[0-9a-f]{6}$/,`${name}.${k} is a colour`);assert(m.fogFar<=FOG_FAR_MAX&&m.fogNear<m.fogFar,`${name}: fog distances`)}
assert.equal(MOODS.day.lightStrength,3.1);assert.equal(MOODS.day.hemiStrength,1.7);assert.equal(MOODS.day.fogNear,65);assert.equal(MOODS.day.fogFar,155);assert.equal(MOODS.day.exposure,1.12); // day keeps the values the game had before the rig

// --- Every output is finite and in range, for all 1,440 minutes ---------------------------------------------------------
for(let m=0;m<1440;m++){
 const s=skyAt(m);
 for(const v of flat(s))assert(Number.isFinite(v),`finite at ${m}`);
 for(const k of ['top','horizon','lightColor','hemiSky','hemiGround'])for(const c of s[k])assert(c>=0&&c<=1,`${k} in 0..1 at ${m}`);
 near(Object.values(s.weights).reduce((a,b)=>a+b,0),1,1e-9,`weights sum to 1 at ${m}`);for(const v of Object.values(s.weights))assert(v>=0&&v<=1);
 for(const k of ['sunDir','moonDir','lightDir'])near(len(s[k]),1,1e-9,`${k} is a unit vector at ${m}`);
 assert(s.lightDir[1]>=Math.sin(MIN_LIGHT_ELEVATION*Math.PI/180)-1e-9,`the light never comes from under ${MIN_LIGHT_ELEVATION} degrees (${m})`);
 assert(s.lightStrength>=0&&s.lightStrength<=3.1+1e-9,`light strength at ${m}`);assert(s.hemiStrength>0&&s.hemiStrength<=1.7+1e-9,`hemisphere strength at ${m}`);
 assert(s.fogFar<=FOG_FAR_MAX&&s.fogFar>=120-1e-9&&s.fogNear>=30-1e-9&&s.fogNear<s.fogFar,`fog at ${m}`);
 assert(s.exposure>=1-1e-9&&s.exposure<=1.12+1e-9,`exposure at ${m}`);
 for(const k of ['stars','glow','sunDisc','moonDisc','sunGlow'])assert(s[k]>=0&&s[k]<=1+1e-9,`${k} in 0..1 at ${m}`);
}

// --- The same answer for the same time; the clock wraps; bad input is noon ---------------------------------------------
assert.deepEqual(skyAt(1000.5),skyAt(1000.5));assert.deepEqual(skyAt(100),skyAt(1540));assert.deepEqual(skyAt(-60),skyAt(1380));assert.deepEqual(skyAt(1440),skyAt(0));
assert.equal(wrapMinutes(NaN),720);assert.deepEqual(skyAt(undefined),skyAt(720));

// --- Continuous: no jump between neighbouring moments, and none across midnight or noon (where dawn and dusk swap) ------
// The light's colour and direction do flip at the horizon, where its strength is 0: so the light is compared as colour x strength and direction x strength.
{const view=m=>{const s=skyAt(m);return [...s.top,...s.horizon,...s.hemiSky,...s.hemiGround,s.hemiStrength,s.fogNear/100,s.fogFar/100,s.exposure,s.stars,s.glow,s.sunDisc,s.moonDisc,s.sunGlow,...s.sunDir,...Object.values(s.weights),...s.lightColor.map(c=>c*s.lightStrength/3.1),...s.lightDir.map(c=>c*s.lightStrength/3.1)]};
 let worst=0,at=0;
 for(let i=0;i<1440*4;i++){const a=view(i/4),b=view((i+1)/4);for(let k=0;k<a.length;k++){const d=Math.abs(a[k]-b[k]);if(d>worst){worst=d;at=i/4}}}
 assert(worst<.03,`no step above 0.03 per quarter minute (half a real second): worst ${worst.toFixed(4)} at minute ${at}`);
 near3(view(1439.999),view(0),1e-3,'across midnight');near3(view(719.999),view(720.001),1e-3,'across noon');near3(view(359.99),view(360.01),5e-3,'across sunrise');near3(view(1079.99),view(1080.01),5e-3,'across sunset');}

// --- Sun and moon ------------------------------------------------------------------------------------------------------
near(sunHeight(360),0,1e-9,'sunrise 06:00');near(sunHeight(1080),0,1e-9,'sunset 18:00');near(sunHeight(720),1,1e-9,'noon');near(sunHeight(0),-1,1e-9,'midnight');
{const rise=sunDirection(360),noon=sunDirection(720),set=sunDirection(1080);
 assert(rise[0]>.99&&Math.abs(rise[1])<1e-9,'the sun rises in the east (+x)');assert(set[0]<-.99,'and sets in the west');
 assert(noon[1]>.8&&noon[2]>.5&&Math.abs(noon[0])<1e-9,'at noon it stands high in the south (+z; north is -z)');near(Math.asin(noon[1])*180/Math.PI,55,1,'55 degrees high at noon');
 for(const m of [0,200,360,700,1080,1300])near3(moonDirection(m),sunDirection(m).map(v=>-v),1e-12,'the moon is the opposite point of the sky');
 assert(lightDirection(720)[1]>.8,'by day the light is the sun');near3(lightDirection(0),moonDirection(0),1e-9,'at midnight the light is the moon');
 near(skyAt(360).lightStrength,0,1e-9,'the light is off exactly at sunrise');near(skyAt(1080).lightStrength,0,1e-9,'and at sunset: the swap of sun and moon is not seen');}

// --- The four mood anchors ---------------------------------------------------------------------------------------------
{const lin=name=>Object.fromEntries(['top','horizon','light','hemiSky','hemiGround'].map(k=>[k,toLinear(MOODS[name][k])]));
 const noon=skyAt(720),night=skyAt(0),D=lin('day'),N=lin('night');
 assert.deepEqual(noon.weights,{dawn:0,day:1,dusk:0,night:0});assert.deepEqual(night.weights,{dawn:0,day:0,dusk:0,night:1});
 near3(noon.top,D.top,1e-9,'noon sky top');near3(noon.horizon,D.horizon,1e-9,'noon horizon');near3(noon.lightColor,D.light,1e-9,'noon light');near3(noon.hemiSky,D.hemiSky,1e-9,'noon hemisphere');
 assert.equal(noon.lightStrength,3.1);near(noon.hemiStrength,1.7,1e-9,'noon hemisphere strength');assert.equal(noon.fogNear,65);assert.equal(noon.fogFar,155);near(noon.exposure,1.12,1e-9,'noon exposure');assert.equal(noon.stars,0);assert.equal(noon.glow,0);
 near3(night.top,N.top,1e-9,'midnight sky top');near3(night.horizon,N.horizon,1e-9,'midnight horizon');near3(night.lightColor,N.light,1e-9,'midnight light');
 assert.equal(night.fogNear,30);assert.equal(night.fogFar,120);assert.equal(night.stars,1);assert.equal(night.glow,1);near(night.exposure,1,1e-9,'midnight exposure');
 // dawn and dusk are fullest around sunrise and sunset, and are different moods
 const dawn=skyAt(clock(6)),dusk=skyAt(clock(18));
 assert(dawn.weights.dawn>.95&&dawn.weights.dusk===0,'06:00 is dawn');assert(dusk.weights.dusk>.95&&dusk.weights.dawn===0,'18:00 is dusk');
 assert(dusk.horizon[0]>dusk.horizon[2]*2,'the dusk horizon is warm');assert(dawn.horizon[0]>dawn.horizon[2],'the dawn horizon is warm');assert(night.horizon[2]>night.horizon[0],'the night horizon is blue');
 assert(dusk.sunGlow>.9&&dawn.sunGlow>.9&&noon.sunGlow===0&&night.sunGlow===0,'the warm lobe on the horizon belongs to dawn and dusk');
 // the shorter night the user asked for: all night from about 19:40 to 04:20, none of it before sunset or after sunrise
 near(moodAt(clock(19,40)).night,1,.01,'all night by 19:40');near(moodAt(clock(4,20)).night,1,.01,'still all night at 04:20');
 assert(moodAt(clock(19,20)).night<.97&&moodAt(clock(4,40)).night<.97,'not yet all night at 19:20; no longer at 04:40');
 assert.equal(moodAt(clock(18)).night,0);assert.equal(moodAt(clock(6)).night,0);assert.equal(moodAt(clock(8)).day,1);assert.equal(moodAt(clock(16)).day,1);assert(moodAt(clock(7)).day<.5&&moodAt(clock(17)).day<.5,'day has not taken over at 07:00 or 17:00');
 let full=0;for(let m=0;m<1440;m++)if(moodAt(m).night>.99)full++;assert(full>=500&&full<=540,`full night lasts about 8 h 40 (${full} game minutes, ${(full/30).toFixed(1)} real minutes)`);}

// --- NIGHT_FLOOR -------------------------------------------------------------------------------------------------------
assert.equal(clampNightFloor(0),NIGHT_FLOOR_MIN);assert.equal(clampNightFloor(1),NIGHT_FLOOR_MAX);assert.equal(clampNightFloor(NaN),NIGHT_FLOOR);assert.equal(skyAt(0).nightFloor,NIGHT_FLOOR);
const GROUND=toLinear('#8a9a7c');
for(const floor of [.04,.08,.12,.2,.3]){
 const night=skyAt(0,{nightFloor:floor}),noon=skyAt(720,{nightFloor:floor});
 near(night.lightStrength,3.1*floor,1e-9,`the moon is the day sun x ${floor}`);near(night.hemiStrength,1.7*floor,1e-9,`the night hemisphere is the day one x ${floor}`);
 assert.deepEqual({...noon,nightFloor:0},{...skyAt(720),nightFloor:0},'the floor changes nothing at noon');
 const seen=grade(litGround(night,GROUND),night.exposure);
 assert(luma(seen)>=.008,`unlit ground is still readable at floor ${floor}: ${luma(seen).toFixed(4)} linear`);assert(seen[2]>seen[0],'and it leans blue, not red');
}
{const seen=f=>luma(grade(litGround(skyAt(0,{nightFloor:f}),GROUND),skyAt(0,{nightFloor:f}).exposure)),day=luma(grade(litGround(skyAt(720),GROUND),skyAt(720).exposure));
 assert(seen(.12)>=.02,`at the starting floor the street reads: ${seen(.12).toFixed(4)} linear`);assert(seen(.04)<seen(.12)&&seen(.12)<seen(.3),'a higher floor is a lighter night');assert(seen(.3)<day*.6,'even the lightest night is clearly darker than day');}
assert.equal(skyAt(0,{nightFloor:.01}).nightFloor,.04);assert.equal(skyAt(0,{nightFloor:9}).nightFloor,.30);
near(skyAt(720,{exposureScale:2}).exposure,2.24,1e-9,'the dev exposure slider multiplies');assert.equal(skyAt(720,{exposureScale:99}).exposure,skyAt(720,{exposureScale:EXPOSURE_MAX}).exposure);assert.equal(skyAt(720,{exposureScale:0}).exposure,skyAt(720,{exposureScale:EXPOSURE_MIN}).exposure);

// --- The colour grade --------------------------------------------------------------------------------------------------
{let last=[-1,-1,-1];for(let i=0;i<=400;i++){const v=i/50,out=grade([v,v,v],1.12);for(let k=0;k<3;k++){assert(out[k]>=0&&out[k]<=1,'in 0..1');assert(out[k]>=last[k]-1e-12,`rises with the input (${v})`)}last=out}
 assert.deepEqual(grade([0,0,0]),[0,0,0]);assert.deepEqual(grade([-1,-1,-1]),[0,0,0]);for(const v of grade([50,50,50]))assert.equal(v,1);
 const mid=grade([.25,.25,.25],1.12);assert(Math.max(...mid)-Math.min(...mid)<.03,'mid grey stays nearly grey');
 const dark=grade([.01,.01,.01],1);assert(dark[2]>dark[0]*1.15,'darks turn blue');
 const sat=c=>(Math.max(...c)-Math.min(...c))/Math.max(...c);assert(sat(grade([.012,.006,.006],1))<sat([.012,.006,.006]),'dark things lose colour');
 const bright=grade([2,2,2],1);assert(bright[0]>bright[2],'highlights lean warm');
 assert.deepEqual(grade([.3,.5,.2],1.1),grade([.3,.5,.2],1.1));
 // the GLSL twin carries the same constants and is the function three.js calls
 const glsl=gradeGLSL(),has=v=>glsl.includes(Number.isInteger(v)?v+'.0':String(v));
 assert.match(glsl,/^vec3 CustomToneMapping\( vec3 color \) \{/);assert(glsl.includes('toneMappingExposure'));
 for(const v of [GRADE.gain,GRADE.white*GRADE.white,GRADE.shadowEnd,GRADE.highStart,GRADE.highEnd,GRADE.satLow,GRADE.satHigh,GRADE.satEnd,...GRADE.luma,...GRADE.shadowTint,...GRADE.highTint])assert(has(v),`the GLSL has ${v}`);}

// --- The wiring: sky.js on three.js, without a renderer -----------------------------------------------------------------
{const THREE=await import('../dist/vendor/three.module.js'),{createSky,installGrade,INDOOR_EXPOSURE}=await import('../dist/sky.js');
 assert.equal(installGrade(),true,'the grade replaced the empty CustomToneMapping');assert(THREE.ShaderChunk.tonemapping_pars_fragment.includes(gradeGLSL()));assert.equal((THREE.ShaderChunk.tonemapping_pars_fragment.match(/vec3 CustomToneMapping/g)||[]).length,1,'exactly one CustomToneMapping');installGrade();assert.equal((THREE.ShaderChunk.tonemapping_pars_fragment.match(/vec3 CustomToneMapping/g)||[]).length,1,'installing twice changes nothing');
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b9cbd0');scene.fog=new THREE.Fog('#b9cbd0',65,155);
 const hemi=new THREE.HemisphereLight('#d8e8f0','#777655',1.7),sun=new THREE.DirectionalLight('#ffe3b9',3.1),renderer={toneMappingExposure:1},hills=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());hills.name='distant-hills';scene.add(hemi,sun,sun.target,hills);
 const before=scene.children.length,sky=createSky({scene,renderer,sun,hemi});
 assert.equal(scene.children.length,before+2,'the sky adds two objects: the dome and the stars');assert(scene.getObjectByName('sky-dome')&&scene.getObjectByName('sky-stars'));
 assert.equal(renderer.toneMapping,THREE.CustomToneMapping);
 const lights=()=>{let n=0;scene.traverse(o=>{if(o.isLight)n++});return n};assert.equal(lights(),2,'no light added');
 const at={x:10,z:-20};
 sky.update(720,{target:at});
 near(sun.intensity,3.1,1e-9,'noon sun');near(hemi.intensity,1.7,1e-9,'noon hemisphere');assert.equal(scene.fog.near,65);assert.equal(scene.fog.far,155);near(renderer.toneMappingExposure,1.12,1e-9,'noon exposure');
 assert.equal(sky.stars.visible,false,'no stars drawn by day');assert(sun.position.y>40&&sun.position.z>at.z,'the sun stands high in the south');near(sun.target.position.x,at.x,1e-9,'the light follows the player');
 near3(scene.fog.color.toArray(),skyAt(720).horizon,1e-6,'fog is the horizon colour');near3(hills.material.color.toArray(),[1,1,1],1e-6,'the hills keep their day colours at noon');
 const noonPos=sun.position.clone();sky.update(480,{target:at});assert(sun.position.distanceTo(noonPos)>10,'the sun moves across the sky');assert(sun.position.x>at.x,'in the morning it is in the east');
 sky.update(0,{target:at});
 near(sun.intensity,3.1*NIGHT_FLOOR,1e-9,'midnight: the same light is the moon');near(hemi.intensity,1.7*NIGHT_FLOOR,1e-9,'midnight hemisphere');assert.equal(scene.fog.far,120);assert.equal(sky.stars.visible,true);assert.equal(lights(),2,'still two lights at midnight');
 assert(hills.material.color.r<.2,'the hills go dark with the sky');assert(sky.dome.material.uniforms.uTop.value.b<.02,'the dome is dark at midnight');
 // indoors in the world scene (shops, the office, the warehouse): the lights stay at their day values for now; the sky outside follows the clock
 sky.update(0,{target:at,indoors:true});near(sun.intensity,3.1,1e-9,'shop at midnight: day light');near(hemi.intensity,1.7,1e-9,'shop at midnight: day hemisphere');assert.equal(renderer.toneMappingExposure,INDOOR_EXPOSURE);assert.equal(scene.fog.far,120);
 // the dev sliders: time for the picture only, the floor, the exposure
 sky.tune({nightFloor:.3});sky.update(0,{target:at});near(sun.intensity,3.1*.3,1e-9,'floor slider');sky.tune({nightFloor:99});assert.equal(sky.tuning().nightFloor,.3,'clamped');
 sky.tune({nightFloor:null,minutes:720});sky.update(0,{target:at});near(sun.intensity,3.1,1e-9,'the time slider overrides the clock for the picture');assert.equal(sky.state().minutes,720);
 sky.tune({minutes:null,exposureScale:1.5});sky.update(720,{target:at});near(renderer.toneMappingExposure,1.12*1.5,1e-9,'exposure slider');sky.tune({exposureScale:null});assert.deepEqual(sky.tuning(),{minutes:null,nightFloor:NIGHT_FLOOR,exposureScale:1});
 assert.equal(sky.dome.geometry.index.count/3<=800,true,'the dome is small');assert.equal(sky.dome.material.depthWrite,false);assert.equal(sky.dome.castShadow,false);}

// --- The packaged game: the rig is wired in, and nothing is added or removed between noon and midnight -------------------
{const game=await readFile('dist/game.js','utf8');
 assert(!/const daylight=/.test(game),'the old one-line day and night is gone');assert(/createSky\(/.test(game)&&/sky\.update\(/.test(game),'game.js builds and updates the sky');
 assert(/powerPreference:[^;]*quality==='high'\?'high-performance':'low-power'/.test(game),'High asks for the fast GPU, Low keeps low-power');
 const g=await bootGame(),S=g.GameState;
 try{
  g.pump(1);const scene=g.scene(),count=()=>{let lights=0,dir=0,objects=0;scene.traverse(o=>{objects++;if(o.isLight)lights++;if(o.isDirectionalLight)dir++});return {lights,dir,objects}};
  const sun=()=>{let l;scene.traverse(o=>{if(o.isDirectionalLight)l=o});return l},hemi=()=>{let l;scene.traverse(o=>{if(o.isHemisphereLight)l=o});return l};
  assert(scene.getObjectByName('sky-dome'),'the world scene has the sky dome');assert(scene.getObjectByName('sky-stars'),'and the stars');
  S.progress.routine.minutes=720;g.pump(.2);const noon=count(),noonSun=sun().intensity,noonPos=sun().position.clone(),noonFog=scene.fog.color.clone();
  assert.equal(noon.dir,1,'one directional light');assert.equal(noon.lights,2,'two lights in the world: the hemisphere and the sun');near(noonSun,3.1,.05,'noon sun strength');near(hemi().intensity,1.7,.05,'noon hemisphere');
  S.progress.routine.minutes=0;g.pump(.2);const night=count();
  assert.deepEqual({lights:night.lights,dir:night.dir},{lights:noon.lights,dir:noon.dir},'the same lights at midnight: nothing recompiles at dusk');assert.equal(night.objects,noon.objects,'no object added or removed either');
  near(sun().intensity,3.1*NIGHT_FLOOR,.02,'the moon is the sun x NIGHT_FLOOR');near(hemi().intensity,1.7*NIGHT_FLOOR,.02,'the hemisphere dims at night (it never did before)');
  assert(sun().position.distanceTo(noonPos)<1,'the midnight moon stands where the noon sun stood');assert(scene.fog.color.b<noonFog.b*.3,'the fog went dark');assert(scene.fog.far<=155&&scene.fog.far>=119,'fog far in range');assert.equal(scene.getObjectByName('sky-stars').visible,true);
  S.progress.routine.minutes=540;g.pump(.2);assert.equal(scene.getObjectByName('sky-stars').visible,false);assert(sun().position.distanceTo(noonPos)>20,'the sun moves across the sky: at 09:00 it is not where it is at noon');assert(sun().position.x>S.me.position.x+20,'in the morning it is in the east');
 }finally{await g.done()}
}
console.log('daynight tests passed');
