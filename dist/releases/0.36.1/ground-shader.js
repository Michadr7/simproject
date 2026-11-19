// GD1 ground shader base (notes/ground-detail-design.md 1a): patchGround(material,kind) adds an onBeforeCompile to an EXISTING ground material, so it costs no draw call and no mesh.
// Everything is a function of world x,z (a varying), so it is seamless across planes and chunks. The colour still comes from the material colour, map and the sky rig's lights; only the albedo is multiplied.
// High: macro patches + clumps + two offset texture reads blended by noise (hides the 4 to 7 m tiling). Low: macro patches + clumps, one read. One program per kind (ground-rules GROUND_KINDS, at most 10).
import {GROUND_KINDS,DRY_KINDS,GD_MACRO_SCALE,GD_MESO_SCALE,GD_DARK,GD_LIGHT,GD_MESO_DARK,GD_MESO_LIGHT,GD_DRY_TINT,GD_DRY_AMOUNT,GD_DETAIL_NEAR,GD_DETAIL_FAR,GD_NOTILE_SCALE,GD_NOTILE_LO,GD_NOTILE_HI,GD_NOTILE_ZOOM,GD_NOTILE_ROT,GD_NOTILE_OFFSET,GD_SEED_MACRO,GD_SEED_MESO,GD_SEED_NOTILE,GD_EDGE_SCALE,GD_EDGE_CLOD_SCALE,GD_BLEND_DEPTH,GD_EDGE_LOW_H,GD_MUD_RIM_DARK,GD_SEED_EDGE,GD_SEED_CLOD,edgeOf,hexToLinear} from './ground-rules.js';
import * as R from './ground-rules.js';import {SKY_HORIZON} from './sky.js';
export const GROUND_UNIFORMS={uGdAmount:{value:1},uGdWet:{value:R.GD_WET_DEFAULT},uSkyHorizon:SKY_HORIZON}; // uGdWet: the dormant env.wet hook (0..1, no weather yet); uSkyHorizon: the ONE shared sky uniform from sky.js // 1 = ground detail on, 0 = the plain old albedo (safety switch)
let high=true;
export function setGroundQuality(isHigh){high=!!isHigh} // called by applyQuality before it marks every material for recompile
export const groundQualityHigh=()=>high;
export const setGroundWet=v=>{GROUND_UNIFORMS.uGdWet.value=Math.min(1,Math.max(0,v))}; // rain later: scales mud wetness and puddle level, costs nothing extra
export const groundProgramKey=(kind,isHigh=high,edge=false)=>'ground-'+kind+(isHigh&&edge?'-e':'')+(isHigh?'':'-lo'); // GD2: the soft edge only exists on High (Low keeps the hard rectangle)
const num=n=>{const s=String(n);return /[.e]/.test(s)?s:s+'.0'};
const vec2=a=>'vec2('+num(a[0])+','+num(a[1])+')';
const vec3=a=>'vec3('+a.map(num).join(',')+')';
// GD3: the per-surface detail of ONE kind (design 1c, 1d). Returns GLSL pieces: defs (#define), pars (functions/uniforms), color (colour detail, faded between GD_DETAIL_NEAR and FAR), after (wet mud, not faded) and which hooks the kind needs.
// Low = cheap variant: colour only (no fake normals, no cracks, no flecks, no ridges, no seam, no sky sheen). Dirt serves gravel roads through the per-material uniform uGdGravel (no extra program).
export function groundDetail(kind,isHigh=high){
 const o={defs:'',pars:'',color:'',after:'',height:false,rough:false,sheen:false};
 if(!R.GD_DETAIL_KINDS.includes(kind))return o;
 const D=(n,v)=>'#define '+n+' '+(typeof v==='number'?num(v):v)+'\n',L=h=>vec3(hexToLinear(h));
 const seeds=D('GD_SEED_DETAIL',vec2(R.GD_SEED_DETAIL));
 if(kind==='grass'||kind==='farm'||kind==='valley'){
  o.defs=seeds+D('GD_CLUMP_CELL',R.GD_CLUMP_CELL)+D('GD_CLUMP_DARK',R.GD_CLUMP_DARK)+D('GD_SEED_CLUMP',vec2(R.GD_SEED_CLUMP))+D('GD_GRASS_H',R.GD_GRASS_H)+(isHigh?D('GD_FLECK_CELL',R.GD_FLECK_CELL)+D('GD_FLECK_FILL',R.GD_FLECK_FILL)+D('GD_FLECK_GAIN',R.GD_FLECK_GAIN):'');
  o.color=' float gdCl=gdNoise(q/GD_CLUMP_CELL+GD_SEED_CLUMP);gdColor*=mix(GD_CLUMP_DARK,1.,smoothstep(.25,.6,gdCl));\n'+(isHigh?' {vec2 gdFc=q/GD_FLECK_CELL;float gdFh=gdHash(floor(gdFc)+GD_SEED_DETAIL);gdColor*=mix(1.,GD_FLECK_GAIN,step(1.-GD_FLECK_FILL,gdFh)*step(length(fract(gdFc)-.5),.3));}\n gdH=gdCl*GD_GRASS_H;\n':'');
  o.height=isHigh}
 else if(kind==='forest'){
  o.defs=seeds+D('GD_LITTER',R.GD_LITTER)+D('GD_LITTER_CELL',R.GD_LITTER_CELL)+D('GD_LITTER_MIX',R.GD_LITTER_MIX)+D('GD_LITTER_H',R.GD_LITTER_H)+R.GD_LITTER_COLORS.map((c,i)=>D('GD_LITTER_'+i,L(c))).join('');
  o.color=' vec2 gdLc=q/GD_LITTER_CELL,gdLi=floor(gdLc);float gdLh=gdHash(gdLi+GD_SEED_DETAIL),gdLm=step(gdLh,GD_LITTER)*(1.-smoothstep(.28,.4,length(fract(gdLc)-.5))),gdLs=gdLh/GD_LITTER;\n'
   +' vec3 gdLcol=gdLs<.34?GD_LITTER_0:(gdLs<.67?GD_LITTER_1:GD_LITTER_2);gdColor=mix(gdColor,gdLcol*(.8+.4*gdHash(gdLi+7.7)),gdLm*GD_LITTER_MIX);\n'+(isHigh?' gdH=gdLm*GD_LITTER_H;\n':'');
  o.height=isHigh}
 else if(kind==='dirt'){
  o.defs=seeds+D('GD_PEBBLE_CELL',R.GD_PEBBLE_CELL)+D('GD_PEBBLE_OCC',R.GD_PEBBLE_OCC)+D('GD_PEBBLE_R',vec2(R.GD_PEBBLE_R))+D('GD_PEBBLE_H',R.GD_PEBBLE_H)+D('GD_PEBBLE_TOP',R.GD_PEBBLE_TOP)+D('GD_PEBBLE_RIM',R.GD_PEBBLE_RIM)+D('GD_SEED_PEBBLE',vec2(R.GD_SEED_PEBBLE))
   +D('GD_GRAVEL_CELL',R.GD_GRAVEL_CELL)+D('GD_GRAVEL_OCC',R.GD_GRAVEL_OCC)+D('GD_GRAVEL_R',vec2(R.GD_GRAVEL_R))+D('GD_GRAVEL_H',R.GD_GRAVEL_H)+D('GD_GRAVEL_GAP',R.GD_GRAVEL_GAP)+R.GD_GRAVEL_TINTS.map((c,i)=>D('GD_GRAVEL_T'+i,vec3(c))).join('')
   +(isHigh?D('GD_CRACK',R.GD_CRACK)+D('GD_CRACK_CELL',R.GD_CRACK_CELL)+D('GD_CRACK_W',R.GD_CRACK_W)+D('GD_CRACK_WARP',R.GD_CRACK_WARP)+D('GD_CRACK_MASK_SCALE',R.GD_CRACK_MASK_SCALE)+D('GD_CRACK_COVER',R.GD_CRACK_COVER)+D('GD_CRACK_H',R.GD_CRACK_H)+D('GD_SEED_CRACK',vec2(R.GD_SEED_CRACK)):'');
  o.pars='uniform float uGdGravel;\nvec2 gdPebble(vec2 p,float occ,vec2 rr){vec2 i=floor(p),f=fract(p);float h0=gdHash(i);if(h0>=occ)return vec2(0.);\n float r=mix(rr.x,rr.y,gdHash(i+5.3));vec2 c=r+(1.-2.*r)*vec2(gdHash(i+17.1),gdHash(i+43.7));float d=length(f-c)/r;return d<1.?vec2(sqrt(1.-d*d),h0/occ):vec2(0.);}\n';
  o.color=' float gdPc=mix(GD_PEBBLE_CELL,GD_GRAVEL_CELL,uGdGravel);vec2 gdPb=gdPebble(q/gdPc+GD_SEED_PEBBLE,mix(GD_PEBBLE_OCC,GD_GRAVEL_OCC,uGdGravel),mix(GD_PEBBLE_R,GD_GRAVEL_R,uGdGravel));float gdPin=step(.0001,gdPb.x);\n'
   +' float gdShD=mix(1.,mix(GD_PEBBLE_RIM,1.+GD_PEBBLE_TOP,gdPb.x),gdPin);vec3 gdTint=gdPb.y<.34?GD_GRAVEL_T0:(gdPb.y<.67?GD_GRAVEL_T1:GD_GRAVEL_T2);vec3 gdShG=mix(vec3(GD_GRAVEL_GAP),gdTint*(1.+GD_PEBBLE_TOP*gdPb.x),gdPin);\n gdColor*=mix(vec3(gdShD),gdShG,uGdGravel);\n'
   +(isHigh?' float gdCk=0.;{vec2 gdWp=q/GD_CRACK_CELL+(vec2(gdNoise(q*.9+GD_SEED_CRACK),gdNoise(q*.9+GD_SEED_CRACK+31.))-.5)*GD_CRACK_WARP*2.;vec2 gdFr=abs(fract(gdWp)-.5);float gdEg=.5-max(gdFr.x,gdFr.y);\n'
   +'  gdCk=(1.-smoothstep(0.,GD_CRACK_W,gdEg))*smoothstep(GD_CRACK_COVER,GD_CRACK_COVER+.1,gdNoise(q*GD_CRACK_MASK_SCALE+GD_SEED_CRACK))*(1.-uGdGravel);}\n gdColor*=1.-gdCk*GD_CRACK;\n gdH=gdPb.x*mix(GD_PEBBLE_H,GD_GRAVEL_H,uGdGravel)-gdCk*GD_CRACK_H;\n':'');
  o.height=isHigh}
 else if(kind==='plowed'){
  o.defs=seeds+D('GD_FURROW_PERIOD',R.GD_FURROW_PERIOD)+D('GD_FURROW_AMP',R.GD_FURROW_AMP)+D('GD_FURROW_H',R.GD_FURROW_H)+D('GD_CLOD_CELL',R.GD_CLOD_CELL)+D('GD_CLOD_H',R.GD_CLOD_H);
  o.color=' float gdFs=sin(q.y*6.2831853/GD_FURROW_PERIOD),gdCr=smoothstep(.2,1.,gdFs),gdCh=gdNoise(q/GD_CLOD_CELL+GD_SEED_DETAIL);gdColor*=1.+gdFs*GD_FURROW_AMP*.3+gdCr*(gdCh-.5)*.25;\n'+(isHigh?' gdH=gdFs*.5*GD_FURROW_H+gdCr*gdCh*GD_CLOD_H;\n':'');
  o.height=isHigh}
 else if(kind==='paving'){
  o.defs=seeds+D('GD_SLAB',R.GD_SLAB)+D('GD_SLAB_JITTER',R.GD_SLAB_JITTER)+(isHigh?D('GD_SLAB_EDGE',R.GD_SLAB_EDGE)+D('GD_SLAB_EDGE_DARK',R.GD_SLAB_EDGE_DARK):'');
  o.color=' vec2 gdSc=q/GD_SLAB;gdColor*=1.+(gdHash(floor(gdSc)+GD_SEED_DETAIL)-.5)*2.*GD_SLAB_JITTER;\n'+(isHigh?' {vec2 gdSf=fract(gdSc)*GD_SLAB,gdSe=min(gdSf,GD_SLAB-gdSf);gdColor*=mix(1.,GD_SLAB_EDGE_DARK,1.-smoothstep(0.,GD_SLAB_EDGE,min(gdSe.x,gdSe.y)));}\n':'')}
 else if(kind==='mud'){
  o.defs=seeds+D('GD_PUDDLE_LEVEL',R.GD_PUDDLE_LEVEL)+D('GD_PUDDLE_SOFT',R.GD_PUDDLE_SOFT)+D('GD_PUDDLE_SCALE',R.GD_PUDDLE_SCALE)+D('GD_PUDDLE_SCALE2',R.GD_PUDDLE_SCALE2)+D('GD_PUDDLE_MIX2',R.GD_PUDDLE_MIX2)+D('GD_SEED_PUDDLE',vec2(R.GD_SEED_PUDDLE))+D('GD_SEED_PUDDLE2',vec2(R.GD_SEED_PUDDLE2))
   +D('GD_MUD_WET',R.GD_MUD_WET)+D('GD_WET_DARK',R.GD_WET_DARK)+D('GD_WET_ROUGH',R.GD_WET_ROUGH)+D('GD_PUDDLE_ROUGH',R.GD_PUDDLE_ROUGH)+D('GD_PUDDLE_DARK',R.GD_PUDDLE_DARK)
   +(isHigh?D('GD_MUD_RIDGE',R.GD_MUD_RIDGE)+D('GD_MUD_RIDGE_CELL',R.GD_MUD_RIDGE_CELL)+D('GD_MUD_CLOD_SCALE',R.GD_MUD_CLOD_SCALE)+D('GD_MUD_H',R.GD_MUD_H)+D('GD_SEED_PEBBLE',vec2(R.GD_SEED_PEBBLE))+D('GD_F0',R.GD_F0)+D('GD_SHEEN_GAIN',R.GD_SHEEN_GAIN)+D('GD_SKY_GAMMA',R.GD_SKY_GAMMA):'');
  o.pars=isHigh?'uniform vec3 uSkyHorizon;\n':'';
  // gdPud (0..1) = how much of this fragment is puddle: low spots of a noise below the level (x wet), never in the ragged rim (gdEdgeM), faded with distance
  o.color=' float gdLow=gdNoise(q*GD_PUDDLE_SCALE+GD_SEED_PUDDLE)*(1.-GD_PUDDLE_MIX2)+gdNoise(q*GD_PUDDLE_SCALE2+GD_SEED_PUDDLE2)*GD_PUDDLE_MIX2,gdLv=GD_PUDDLE_LEVEL*uGdWet;\n'
   +' float gdPd=(1.-smoothstep(gdLv-GD_PUDDLE_SOFT,gdLv+GD_PUDDLE_SOFT,gdLow))*gdEdgeM;gdPud=gdPd*gdDet;\n'
   +(isHigh?' float gdRg=1.-abs(2.*gdNoise(q/GD_MUD_RIDGE_CELL+GD_SEED_DETAIL)-1.),gdMh=mix(gdNoise(q*GD_MUD_CLOD_SCALE+GD_SEED_PEBBLE),gdRg,GD_MUD_RIDGE);gdColor*=1.+.3*(gdMh-.5);gdH=mix(gdMh*GD_MUD_H,0.,gdPd);\n':'');
  o.after=' {float gdWt=uGdWet*GD_MUD_WET;gdColor*=mix(1.,GD_WET_DARK,gdWt)*mix(1.,GD_PUDDLE_DARK,gdPud);gdRoughT=mix(mix(1.,GD_WET_ROUGH,gdWt),GD_PUDDLE_ROUGH,gdPud);gdRoughK=1.;}\n';
  o.height=isHigh;o.rough=true;o.sheen=isHigh}
 if(o.height)o.defs+=D('GD_NORMAL',R.GD_NORMAL)+D('GD_NORMAL_NEAR',R.GD_NORMAL_NEAR)+D('GD_NORMAL_FAR',R.GD_NORMAL_FAR);
 return o}
export function groundShaderParts(kind,isHigh=high,edge=false){
 edge=!!(edge&&isHigh&&edgeOf(kind));
 const det=groundDetail(kind,isHigh),dry=DRY_KINDS.includes(kind),lin=hexToLinear(GD_DRY_TINT),luma=lin[0]*.2126+lin[1]*.7152+lin[2]*.0722;
 const defs=`#define GD_MACRO_SCALE ${num(GD_MACRO_SCALE)}
#define GD_MESO_SCALE ${num(GD_MESO_SCALE)}
#define GD_DARK ${num(GD_DARK)}
#define GD_LIGHT ${num(GD_LIGHT)}
#define GD_MESO_DARK ${num(GD_MESO_DARK)}
#define GD_MESO_LIGHT ${num(GD_MESO_LIGHT)}
#define GD_DETAIL_NEAR ${num(GD_DETAIL_NEAR)}
#define GD_DETAIL_FAR ${num(GD_DETAIL_FAR)}
#define GD_SEED_MACRO ${vec2(GD_SEED_MACRO)}
#define GD_SEED_MESO ${vec2(GD_SEED_MESO)}
`+(dry?`#define GD_DRY_HUE ${vec3(lin.map(v=>v/luma))}
#define GD_DRY_AMOUNT ${num(GD_DRY_AMOUNT)}
`:'')+(isHigh?`#define GD_NOTILE_SCALE ${num(GD_NOTILE_SCALE)}
#define GD_NOTILE_LO ${num(GD_NOTILE_LO)}
#define GD_NOTILE_HI ${num(GD_NOTILE_HI)}
#define GD_NOTILE_ZOOM ${num(GD_NOTILE_ZOOM)}
#define GD_NOTILE_ROT mat2(${num(Math.cos(GD_NOTILE_ROT))},${num(Math.sin(GD_NOTILE_ROT))},${num(-Math.sin(GD_NOTILE_ROT))},${num(Math.cos(GD_NOTILE_ROT))})
#define GD_NOTILE_OFFSET ${vec2(GD_NOTILE_OFFSET)}
#define GD_SEED_NOTILE ${vec2(GD_SEED_NOTILE)}
`:'')+(edge?`#define GD_EDGE_SCALE ${num(GD_EDGE_SCALE)}
#define GD_EDGE_CLOD_SCALE ${num(GD_EDGE_CLOD_SCALE)}
#define GD_BLEND_DEPTH ${num(GD_BLEND_DEPTH)}
#define GD_EDGE_LOW_H ${num(GD_EDGE_LOW_H)}
#define GD_MUD_RIM_DARK ${num(kind==='mud'?GD_MUD_RIM_DARK:1)}
#define GD_SEED_EDGE ${vec2(GD_SEED_EDGE)}
#define GD_SEED_CLOD ${vec2(GD_SEED_CLOD)}
`:'');
 const common=`${defs}${det.defs}uniform float uGdAmount;uniform float uGdWet;varying vec3 vGWorld;
float gdHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float gdNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(gdHash(i),gdHash(i+vec2(1.,0.)),f.x),mix(gdHash(i+vec2(0.,1.)),gdHash(i+vec2(1.,1.)),f.x),f.y);}
`+(edge?`uniform vec4 uGdBox;uniform vec3 uGdEdge;
float gdBayer(vec2 p){ivec2 i=ivec2(mod(p,4.0));int n=i.x+i.y*4;
 float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return (m[n]+.5)/16.;}
`:'');
 const vertex='\n#include <project_vertex>\nvGWorld=(modelMatrix*vec4(transformed,1.)).xyz;';
 // GD2: uGdBox = the plane's rectangle (x0,z0,x1,z1 in world metres), uGdEdge = (ramp width, jitter, unused). d is metres inside the rectangle, so the soft band is always inside it. The upper plane's clod height
 // (gdH) and the plane below (grass, height GD_EDGE_LOW_H) are blended by the Mishkinis depth window: the clods survive longest, then a 4x4 Bayer dither cuts the fragment (no transparency, no sorting).
 const edgeCode=edge?`
 {vec2 gdP=vGWorld.xz;float gdD=min(min(gdP.x-uGdBox.x,uGdBox.z-gdP.x),min(gdP.y-uGdBox.y,uGdBox.w-gdP.y));
  float gdT=clamp((gdD-gdNoise(gdP*GD_EDGE_SCALE+GD_SEED_EDGE)*uGdEdge.y)/uGdEdge.x,0.,1.);gdEdgeM=gdT*gdT*(3.-2.*gdT);
  float gdA=gdEdgeM+gdNoise(gdP*GD_EDGE_CLOD_SCALE+GD_SEED_CLOD),gdB=1.-gdEdgeM+GD_EDGE_LOW_H,gdTop=max(gdA,gdB)-GD_BLEND_DEPTH;
  float gdWu=max(gdA-gdTop,0.),gdWl=max(gdB-gdTop,0.);
  if(uGdAmount>.5&&gdWu/(gdWu+gdWl)<gdBayer(gl_FragCoord.xy))discard;}
`:'';
 const fragment=`
 float gdEdgeM=1.,gdH=0.,gdNk=0.,gdPud=0.,gdRoughT=1.,gdRoughK=0.;${edgeCode}
#ifdef USE_MAP
 vec4 gdSample=texture2D(map,vMapUv);
${isHigh?` {float gdW=smoothstep(GD_NOTILE_LO,GD_NOTILE_HI,gdNoise(vGWorld.xz*GD_NOTILE_SCALE+GD_SEED_NOTILE));
  gdSample=mix(gdSample,texture2D(map,GD_NOTILE_ROT*vMapUv*GD_NOTILE_ZOOM+GD_NOTILE_OFFSET),gdW);}
`:''} diffuseColor*=gdSample;
#endif
 {float gdFar=clamp((length(vGWorld-cameraPosition)-GD_DETAIL_NEAR)/(GD_DETAIL_FAR-GD_DETAIL_NEAR),0.,1.);
  float gdMacro=gdNoise(vGWorld.xz*GD_MACRO_SCALE+GD_SEED_MACRO),gdMeso=gdNoise(vGWorld.xz*GD_MESO_SCALE+GD_SEED_MESO);
  float gdTone=mix(GD_DARK,GD_LIGHT,gdMacro)*mix(1.,mix(GD_MESO_DARK,GD_MESO_LIGHT,gdMeso),1.-gdFar);
  vec3 gdColor=diffuseColor.rgb*gdTone;
${dry?`  gdColor=mix(gdColor,GD_DRY_HUE*dot(gdColor,vec3(.2126,.7152,.0722)),GD_DRY_AMOUNT*gdMacro);
`:''}${edge&&kind==='mud'?`  gdColor*=mix(GD_MUD_RIM_DARK,1.,gdEdgeM);
`:''}  {float gdDet=1.-gdFar;vec2 q=vGWorld.xz;vec3 gdPlain=gdColor;
${det.color}  gdColor=mix(gdPlain,gdColor,gdDet);
${det.after}${det.height?'  gdNk=1.-smoothstep(GD_NORMAL_NEAR,GD_NORMAL_FAR,length(vGWorld-cameraPosition));'+"\n":""}  }
  diffuseColor.rgb=mix(diffuseColor.rgb,gdColor,uGdAmount);}`;
 // hooks after the normal, roughness and emissive chunks: fake normals from the height (Mikkelsen bump, unnormalised so it is in metres), wet roughness, puddle sky sheen (Schlick fresnel x the shared sky horizon colour)
 const normal=det.height?'\n#include <normal_fragment_maps>\n {vec3 gdSx=dFdx(-vViewPosition),gdSy=dFdy(-vViewPosition);float gdA=gdH*gdNk*uGdAmount*GD_NORMAL;vec2 gdD=vec2(dFdx(gdA),dFdy(gdA));vec3 gdR1=cross(gdSy,normal),gdR2=cross(normal,gdSx);float gdDt=dot(gdSx,gdR1)*faceDirection;normal=normalize(abs(gdDt)*normal-sign(gdDt)*(gdD.x*gdR1+gdD.y*gdR2));}':'';
 const rough=det.rough?'\n#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,gdRoughT,gdRoughK*uGdAmount);':'';
 const emissive=det.sheen?'\n#include <emissivemap_fragment>\n {float gdC=clamp(dot(normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz),normalize(vViewPosition)),0.,1.),gdF=GD_F0+(1.-GD_F0)*pow(1.-gdC,5.);totalEmissiveRadiance+=pow(uSkyHorizon,vec3(GD_SKY_GAMMA))*gdF*GD_SHEEN_GAIN*gdPud*uGdAmount;}':'';
 return {common:common+det.pars,vertex,fragment,normal,rough,emissive};
}
// world.js calls this once for each ground material it builds (additive; the material, its colour, map and polygon offset stay as they were).
export function patchGround(material,kind){
 if(!GROUND_KINDS.includes(kind))throw new Error('unknown ground kind '+kind);
 material.userData.groundKind=kind;
 // GD2: material.userData.groundEdge={x0,x1,z0,z1} (world metres, the plane's rectangle) turns the soft border on (High only, kinds with an entry in GD_EDGE). world.js sets it through softEdge().
 const box=()=>{const b=material.userData.groundEdge;return b&&edgeOf(kind)?b:null};
 material.onBeforeCompile=shader=>{
  const b=box(),parts=groundShaderParts(kind,high,!!b);
  Object.assign(shader.uniforms,GROUND_UNIFORMS);
  if(b&&high&&edgeOf(kind)){const e=edgeOf(kind);shader.uniforms.uGdBox={value:[b.x0,b.z0,b.x1,b.z1]};shader.uniforms.uGdEdge={value:[e.w,e.j,0]}}
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGWorld;').replace('#include <project_vertex>',parts.vertex);
  if(kind==='dirt')shader.uniforms.uGdGravel={value:material.userData.groundGravel?1:0}; // R3a gravel roads: the SAME 'dirt' program; this material's own uniform picks the dense-gravel look
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+parts.common).replace('#include <map_fragment>',parts.fragment);
  if(parts.normal)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',parts.normal);
  if(parts.rough)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',parts.rough);
  if(parts.emissive)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',parts.emissive);
 };
 material.customProgramCacheKey=()=>groundProgramKey(kind,high,!!box());
 return material;
}
