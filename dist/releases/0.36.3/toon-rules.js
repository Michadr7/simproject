// Pure 3-band toon ramp and sunlit Fresnel rim rules (notes/visual-identity-design.md, V-A). No three.js, no DOM.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a*(1-t)+b*t;
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

export const TOON_STRENGTH_DEFAULT=1,TOON_STRENGTH_MIN=0,TOON_STRENGTH_MAX=1;
export const TOON=Object.freeze({
 band1Low:.08,band1High:.18,midLevel:.52,
 band2Low:.48,band2High:.62,litLevel:1.0,
 roughOn:.90,roughOff:.94,
 rimPower:4,rimLow:.15,rimHigh:.35,rimStrength:.14,
});

export const clampToonStrength=v=>Number.isFinite(v)?clamp(v,TOON_STRENGTH_MIN,TOON_STRENGTH_MAX):TOON_STRENGTH_DEFAULT;

// Maps direct dotNL in [0, 1] monotonically to 3 smoothstepped bands (0.0 -> 0.52 -> 1.0).
export function toonRamp(dotNL){
 const x=clamp(Number.isFinite(dotNL)?dotNL:0,0,1);
 return smoothstep(TOON.band1Low,TOON.band1High,x)*TOON.midLevel+smoothstep(TOON.band2Low,TOON.band2High,x)*(TOON.litLevel-TOON.midLevel);
}

// 1 on stylized objects (roughness <= 0.90), fading to 0 on matte ground (roughness >= 0.94).
export function toonWeight(roughness,strength=TOON_STRENGTH_DEFAULT){
 const r=Number.isFinite(roughness)?clamp(roughness,0,1):1;
 return (1-smoothstep(TOON.roughOn,TOON.roughOff,r))*clampToonStrength(strength);
}

// Sunlit grazing Fresnel rim: <= 0.14, strictly 0 when dotNL <= 0.15 or on matte ground.
export function toonRim(dotNL,dotNV,roughness=.85,strength=TOON_STRENGTH_DEFAULT){
 const nl=clamp(Number.isFinite(dotNL)?dotNL:0,0,1),nv=clamp(Number.isFinite(dotNV)?dotNV:1,0,1);
 return Math.pow(1-nv,TOON.rimPower)*smoothstep(TOON.rimLow,TOON.rimHigh,nl)*TOON.rimStrength*toonWeight(roughness,strength);
}

// Combined direct-irradiance scalar factor (replaces raw dotNL on stylized materials; equals dotNL when weight is 0).
export function toonIrradianceFactor(dotNL,dotNV,roughness=.85,strength=TOON_STRENGTH_DEFAULT){
 const d=clamp(Number.isFinite(dotNL)?dotNL:0,0,1),w=toonWeight(roughness,strength);
 return mix(d,toonRamp(d),w)+toonRim(d,dotNV,roughness,strength);
}

const f=v=>Number.isInteger(v)?v+'.0':String(v);
// GLSL snippet replacing the two dotNL/irradiance lines in THREE.ShaderChunk.lights_physical_pars_fragment (RE_Direct_Physical).
export function toonGLSL(strengthExpr=f(TOON_STRENGTH_DEFAULT)){
 const T=TOON;
 return `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	float toonRamp = smoothstep( ${f(T.band1Low)}, ${f(T.band1High)}, dotNL ) * ${f(T.midLevel)} + smoothstep( ${f(T.band2Low)}, ${f(T.band2High)}, dotNL ) * ${f(+(T.litLevel-T.midLevel).toFixed(4))};
	float toonW = ( 1.0 - smoothstep( ${f(T.roughOn)}, ${f(T.roughOff)}, material.roughness ) ) * clamp( ${strengthExpr}, 0.0, 1.0 );
	float toonRim = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), ${f(T.rimPower)} ) * smoothstep( ${f(T.rimLow)}, ${f(T.rimHigh)}, dotNL ) * ${f(T.rimStrength)} * toonW;
	vec3 irradiance = ( mix( dotNL, toonRamp, toonW ) + toonRim ) * directLight.color;`;
}
