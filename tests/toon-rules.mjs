// V-A (notes/visual-identity-design.md): pure 3-band toon ramp, ground roughness exemption, sunlit rim, and GLSL constant match.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TOON,TOON_STRENGTH_DEFAULT,TOON_STRENGTH_MIN,TOON_STRENGTH_MAX,clampToonStrength,toonRamp,toonWeight,toonRim,toonIrradianceFactor,toonGLSL} from '../dist/toon-rules.js';

const near=(a,b,eps=1e-9,msg='')=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);

// 1. 3-band toon ramp: monotonic in [0, 1], flat plateaus at 0.0, 0.52, and 1.0.
{let prev=-1;
 for(let i=0;i<=1000;i++){
  const x=i/1000,y=toonRamp(x);
  assert(y>=0&&y<=1,`ramp in [0,1] at ${x}`);
  assert(y>=prev-1e-12,`ramp monotonic at ${x}: ${y} < ${prev}`);
  prev=y;
 }
 assert.equal(toonRamp(0),0);assert.equal(toonRamp(TOON.band1Low),0,'shadow band');
 near(toonRamp(.25),TOON.midLevel,1e-9,'midtone plateau');near(toonRamp(.45),TOON.midLevel,1e-9,'midtone plateau end');
 assert.equal(toonRamp(TOON.band2High),1,'lit band');assert.equal(toonRamp(1),1);
 assert.equal(toonRamp(-1),0);assert.equal(toonRamp(2),1);assert.equal(toonRamp(NaN),0);}

// 2. Ground exemption via roughness and dev strength toggle.
{assert.equal(toonWeight(.85),1,'props/characters get full toon');assert.equal(toonWeight(TOON.roughOn),1);
 assert.equal(toonWeight(TOON.roughOff),0,'matte ground exempt');assert.equal(toonWeight(.98),0);assert.equal(toonWeight(1),0);
 assert(toonWeight(.92)>0&&toonWeight(.92)<1,'smooth transition between 0.90 and 0.94');
 assert.equal(toonWeight(.85,0),0,'strength 0 disables toon');near(toonWeight(.85,.5),.5);
 assert.equal(clampToonStrength(-2),TOON_STRENGTH_MIN);assert.equal(clampToonStrength(5),TOON_STRENGTH_MAX);assert.equal(clampToonStrength(NaN),TOON_STRENGTH_DEFAULT);}

// 3. Sunlit Fresnel rim: <= 0.14, 0 when dotNL <= 0.15, 0 on matte ground, 0 when facing camera.
{for(let i=0;i<=20;i++)for(let j=0;j<=20;j++){
  const nl=i/20,nv=j/20,r=toonRim(nl,nv,.85,1);
  assert(r>=0&&r<=TOON.rimStrength+1e-12,`rim bounded at (${nl},${nv})`);
  if(nl<=TOON.rimLow)assert.equal(r,0,`no rim on shadow/backlit side (${nl})`);
 }
 near(toonRim(.5,0,.85,1),TOON.rimStrength,1e-9,'max rim at grazing sunlit edge');
 assert.equal(toonRim(.5,1,.85,1),0,'no rim facing camera');
 assert.equal(toonRim(.5,0,.96,1),0,'no rim on matte ground');
 assert.equal(toonRim(.5,0,.85,0),0,'no rim when strength is 0');}

// 4. Combined irradiance factor: matches dotNL on ground/disabled, stylized on objects.
{for(const d of [0,.1,.3,.5,.8,1]){
  near(toonIrradianceFactor(d,.5,.96,1),d,1e-9,`ground keeps Lambert dotNL (${d})`);
  near(toonIrradianceFactor(d,.5,.85,0),d,1e-9,`strength 0 keeps Lambert dotNL (${d})`);
 }
 assert.equal(toonIrradianceFactor(.05,.2,.85,1),0,'shadow band crushes low dotNL');
 near(toonIrradianceFactor(.3,1,.85,1),TOON.midLevel,1e-9,'midtone band at facing normal');}

// 5. GLSL twin carries every TOON constant and valid Three.js ShaderChunk identifiers.
{const glsl=toonGLSL(),has=v=>glsl.includes(Number.isInteger(v)?v+'.0':String(v));
 for(const id of ['dotNL','irradiance','directLight.direction','directLight.color','geometryNormal','geometryViewDir','material.roughness'])assert(glsl.includes(id),`GLSL references ${id}`);
 for(const v of [TOON.band1Low,TOON.band1High,TOON.midLevel,TOON.band2Low,TOON.band2High,+(TOON.litLevel-TOON.midLevel).toFixed(4),TOON.roughOn,TOON.roughOff,TOON.rimPower,TOON.rimLow,TOON.rimHigh,TOON.rimStrength])assert(has(v),`GLSL embeds ${v}`);
 const custom=toonGLSL('uToonStrength');assert(custom.includes('uToonStrength'));}

// 6. Purity: no DOM, no clock, no random, no three.js.
{const src=fs.readFileSync(new URL('../dist/toon-rules.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'toon-rules.js must not use '+bad);}

console.log('PASS toon-rules.mjs: 3-band monotonic ramp, matte ground exemption (roughness >= 0.94), sunlit rim <= 0.14, strength toggle, GLSL constant match, purity.');
