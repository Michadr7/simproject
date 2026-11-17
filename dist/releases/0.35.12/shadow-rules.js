// Shadows, the pure part (notes/visual-overhaul-design.md, Stage 4): every number and rule, so it can be tested without a renderer. No three.js, no DOM.
// High quality: the ONE sun-and-moon light keeps its one shadow map; the box around the player is tighter (90 m, was 130 m: sharper, fewer casters), it moves in whole
// texels (no shimmer while walking) and the shadow fades out while the sun or moon is low (and the pass is not drawn at all then).
// Low quality: no shadow map; one instanced mesh of soft dark patches under people and vehicles (+1 draw call). shadows.js applies all of it on three.js.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

// ── The shadow map (High) ──────────────────────────────────────────────────────────────────────────────────────────────
export const SHADOW_BOX=90,SHADOW_MAP=2048,SHADOW_FAR=130;       // metres across, texels across (unchanged), depth of the box along the light (unchanged)
export const SHADOW_TEXEL=SHADOW_BOX/SHADOW_MAP;                 // 4.4 cm of ground per texel (it was 6.3 cm with the 130 m box)
export const FADE_FROM=6,FADE_FULL=12;                           // degrees of the sun's or moon's real height: no shadow under 6, full shadow over 12
export const DAY_LIGHT=3.1;                                      // the directional light's strength at noon (daynight.js MOODS.day.lightStrength)

// The two axes of the shadow map on the ground side, for a unit vector d that points TO the light: exactly what three.js builds with lookAt and up = +y.
export function shadowBasis(d){
 const l=Math.hypot(d[2],d[0]),right=l>1e-6?[d[2]/l,0,-d[0]/l]:[1,0,0];
 return {right,up:[d[1]*right[2]-d[2]*right[1],d[2]*right[0]-d[0]*right[2],d[0]*right[1]-d[1]*right[0]]};
}
// Moves the middle of the box onto the texel grid: the same grid for every position, so a texel always covers the same ground while the light's direction holds.
// target: [x, y, z] the point the box follows. Returns the world offset to add to the light and its target, and the whole-texel cell the box is in.
export function snapShadow(target,d,texel=SHADOW_TEXEL){
 const {right,up}=shadowBasis(d),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],a=dot(target,right),b=dot(target,up),i=Math.round(a/texel)+0,j=Math.round(b/texel)+0,da=i*texel-a,db=j*texel-b;
 return {cell:[i,j],offset:[right[0]*da+up[0]*db,right[1]*da+up[1]*db,right[2]*da+up[2]*db]};
}
// The real height in degrees of whichever body gives the light (the sun by day, the moon by night). sky: what skyAt returned.
export const bodyElevation=sky=>Math.asin(clamp(Math.abs(sky.sunDir[1]),0,1))*180/Math.PI;
export const shadowFade=degrees=>smoothstep(FADE_FROM,FADE_FULL,degrees);
// What the shadow map does this frame. enabled: the renderer's shadow switch (High, and the dev panel's Shadows switch). indoors: a room in the world scene (its lights stay at noon).
// strength: 0 to 1, how dark the shadow is. draw: whether the shadow pass runs at all (it is skipped while the shadow is fully faded: the whole pass is saved).
export function shadowPlan({sky,enabled=true,indoors=false}){
 const strength=indoors?1:shadowFade(bodyElevation(sky));
 return {strength,draw:enabled&&strength>0};
}

// ── Blob shadows (Low) ─────────────────────────────────────────────────────────────────────────────────────────────────
export const BLOB=Object.freeze({capacity:48,range:80,lift:.04,opacity:.42,showFrom:.02,person:.48,vehiclePad:1.25,fallback:{hx:1,hz:2.2}});
// How dark the patches are: they follow the directional light (0 when the sun or moon is on the horizon, 0.42 at noon, about 0.15 under the moon).
export const blobOpacity=sky=>BLOB.opacity*Math.sqrt(clamp(sky.lightStrength/DAY_LIGHT,0,1));
// Whether the patches are drawn: Low quality, outdoors (not in a room), and dark enough to see.
export const blobsShown=({low,outdoors,opacity})=>!!low&&!!outdoors&&opacity>BLOB.showFrom;
// Picks what gets a patch: everything within BLOB.range of the centre, the nearest first when there are more than fit.
// people: [{x, y, z}] (feet). vehicles: [{x, y, z, hx, hz, yaw}] (half width and half length). Returns [{x, y, z, sx, sz, yaw, box, source}], at most `capacity`.
export function blobList({people=[],vehicles=[],centre={x:0,z:0},capacity=BLOB.capacity}={}){
 const out=[],near=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.z)&&Math.hypot(p.x-centre.x,p.z-centre.z)<=BLOB.range;
 for(const p of people)if(near(p))out.push({x:p.x,y:p.y||0,z:p.z,sx:BLOB.person*2,sz:BLOB.person*2,yaw:0,box:0,source:p});
 for(const v of vehicles)if(near(v))out.push({x:v.x,y:v.y||0,z:v.z,sx:(v.hx||BLOB.fallback.hx)*2*BLOB.vehiclePad,sz:(v.hz||BLOB.fallback.hz)*2*BLOB.vehiclePad,yaw:v.yaw||0,box:1,source:v});
 if(out.length>capacity){const d=o=>(o.x-centre.x)**2+(o.z-centre.z)**2;out.sort((a,b)=>d(a)-d(b));out.length=capacity}
 return out;
}
// The fade edit for three.js r160's shadow lookup: the light's `shadow.radius` (unused by the soft filter the game runs) becomes the shadow's strength, 0 to 1.
// Its default is 1, so every other light (the rooms' lamps) keeps full shadows. shadows.js puts this text in place of `return shadow;` in getShadow.
export const FADE_GLSL='return mix( 1.0, shadow, clamp( shadowRadius, 0.0, 1.0 ) );';
