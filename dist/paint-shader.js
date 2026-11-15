// Vehicle paint in the shader (0.34): recolours the pixels of a model's body texture that are near its own paint hue (see paint.js). Shared by the game (driving.js) and the picture renderer (vehicle-studio.html).
// 0.35.10 (VD3): the same patch also carries the damage look: grime, scratches and paint chips from one small generated texture (damage-textures.js), driven by the uniform uWear (x: mud, reserved for the ATV, y: damage 0..1), and
// a crack texture on the glass driven by uCrack. Every vehicle uses the SAME programs ('vehicle-paint', 'vehicle-glass'): damage only changes uniform values, so a crash never compiles a new shader.
import * as THREE from './vendor/three.module.js';
import {paintUniforms,colourOf,coloursOf} from './paint.js';
import {WEAR_PNG,CRACK_PNG} from './damage-textures.js';
// Paint (paint.js): the body material is patched once to recolour pixels near the model's paint hue; the numbers are per-material uniforms, so every vehicle has its own colour and all share one shader program.
const bodyMaterial=material=>Array.isArray(material)?material[0]:material;
// The two shared textures (made once, by headless Blender: scripts/make-damage-textures.py): 128 px wear (RGB: scratches, grime, chips) and 256 px crack. Until the PNG decodes (or without a DOM, in a test) a 1 px black texture stands in.
const blank=()=>{const t=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);t.needsUpdate=true;return t};
function load(uri,{repeat,anisotropy=4}){if(typeof document==='undefined')return blank();const t=new THREE.TextureLoader().load(uri);t.colorSpace=THREE.NoColorSpace;t.anisotropy=anisotropy;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping}else{t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping}return t}
let texWear=null,texCrack=null;
const wearTexture=()=>texWear||(texWear=load(WEAR_PNG,{repeat:true})),crackTexture=()=>texCrack||(texCrack=load(CRACK_PNG,{repeat:false}));
export const WEAR_TILE=1.1; // metres of vehicle surface per repeat of the wear texture
// The glass crack's place: [x, y, scale] added to the object-space position on the glass before the lookup (per model: the windscreen is not in the same spot on every body). Default: centred.
export const CRACK_PLACE={default:[0,0,1.6],shortbed:[.05,1.82,1.7],flatbed:[0,2.5,1.4]}; // the S70's windscreen (x -0.63..0.63, y 1.41..2.23, facing +z) and the flatbed's front glass; only front-facing glass (normal z > 0.3) shows the crack
const VARYINGS='varying vec3 vWPos;varying vec3 vWNrm;';
const VERT=s=>s.replace('#include <common>',`#include <common>\n${VARYINGS}`).replace('#include <begin_vertex>',`#include <begin_vertex>\nvWPos=transformed;vWNrm=objectNormal;`);
// the texture plane follows the face's strongest axis (the paint has no UVs): top and bottom faces use x/z, sides z/y, fronts and backs x/y
const PLANE='vec2 vPlane(vec3 p,vec3 n){vec3 a=abs(n);return a.x>=a.y&&a.x>=a.z?p.zy:(a.y>=a.z?p.xz:p.xy);}';
function patchPaint(material){
 if(material.userData.paint)return material.userData.paint;
 const u={uPaint:{value:new THREE.Vector4(-1,1,1,0)},uBand:{value:0},uWear:{value:new THREE.Vector2(0,0)}};material.userData.paint=u;
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u,{uWearTex:{value:wearTexture()}});shader.vertexShader=VERT(shader.vertexShader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
${VARYINGS}uniform vec4 uPaint;uniform float uBand;uniform vec2 uWear;uniform sampler2D uWearTex;${PLANE}
vec3 pRgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 pHsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`).replace('#include <map_fragment>',`#include <map_fragment>
if(uBand>0.){vec3 h=pRgb2hsv(diffuseColor.rgb);float dh=abs(fract(h.x-uPaint.w+.5)-.5);float m=(1.-smoothstep(uBand*.6,uBand,dh))*smoothstep(.12,.25,h.y);
if(m>0.){float nh=uPaint.x>=0.?fract(uPaint.x+(h.x-uPaint.w)*.4):h.x;diffuseColor.rgb=mix(diffuseColor.rgb,pHsv2rgb(vec3(nh,clamp(h.y*uPaint.y,0.,1.),h.z*uPaint.z)),m);}}
if(uWear.y>0.){float w=uWear.y;vec3 t=texture2D(uWearTex,vPlane(vWPos,vWNrm)/${WEAR_TILE.toFixed(2)}).rgb;float low=.45+.55*smoothstep(1.6,.2,vWPos.y);
float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(lum),w*.35)*(1.-w*.22);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.5,.42),smoothstep(0.,.4,w)*.55*low*(.7+.6*t.g));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.11,.08),t.g*smoothstep(.04,.6,w)*low*.8);
float sc=smoothstep(.35,.85,t.r)*smoothstep(.02,.3,w);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.7,.68,.64),sc*.8);
float ch=step(.5,t.b)*smoothstep(.5,.9,w);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.2,.11),ch*.7);}`)};
 material.customProgramCacheKey=()=>'vehicle-paint';material.needsUpdate=true;return u;
}
// The glass: one crack texture over the pane, shown by uCrack 0..1 (nothing at 0). uCrackMap: x, y offset and the size in metres of the picture.
function patchGlass(material){
 if(material.userData.crack)return material.userData.crack;
 const u={uCrack:{value:0},uCrackMap:{value:new THREE.Vector3(...CRACK_PLACE.default)}};material.userData.crack=u;
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u,{uCrackTex:{value:crackTexture()}});shader.vertexShader=VERT(shader.vertexShader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
${VARYINGS}uniform float uCrack;uniform vec3 uCrackMap;uniform sampler2D uCrackTex;${PLANE}`).replace('#include <map_fragment>',`#include <map_fragment>
if(uCrack>0.){vec2 cp=(vPlane(vWPos,vWNrm)-uCrackMap.xy)/uCrackMap.z+.5;float k=texture2D(uCrackTex,cp).r*step(0.,cp.x)*step(cp.x,1.)*step(0.,cp.y)*step(cp.y,1.)*step(.3,vWNrm.z);k=smoothstep(.12,.55,k*(.5+uCrack*.9));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.95,.97,1.),k);diffuseColor.a=max(diffuseColor.a,k*.92);diffuseColor.a=min(1.,diffuseColor.a+uCrack*.08);}`)};
 material.customProgramCacheKey=()=>'vehicle-glass';material.needsUpdate=true;return u;
}
// The paint and glass materials of a vehicle mesh (found once): the body's own paint material (the S70, the flatbed) or the model's body material, and the glass parts.
function lookParts(mesh){
 if(mesh.userData.lookParts)return mesh.userData.lookParts;
 const paints=[],glass=[];
 const own=mesh.userData?.paint;if(own&&own.isMaterial)paints.push(own);else{const m=bodyMaterial(mesh.material);if(m&&m.userData)paints.push(m)}
 mesh.traverse(o=>{if(o.isMesh&&/glass$/.test(o.name)&&o.material&&!glass.includes(o.material))glass.push(o.material)});
 return mesh.userData.lookParts={paints,glass};
}
export function applyPaint(mesh,model,colourId){
 const parts=lookParts(mesh);for(const m of parts.paints)patchPaint(m);for(const m of parts.glass)patchGlass(m); // every vehicle's materials are patched when it is built (the one program per kind compiles with the first draw, never at a crash)
 if(mesh.userData?.paint?.isMaterial){const c=colourOf(model,colourId)||coloursOf(model)[0];if(c)mesh.userData.paint.color.set(c.swatch);return} // a model with its own paint material (the S70, the flatbed): set the colour itself
 const m=bodyMaterial(mesh.material);if(!m||!m.userData)return;
 const n=paintUniforms(model,colourId),u=patchPaint(m);u.uPaint.value.set(n.hue,n.sat,n.val,n.src);u.uBand.value=n.band;
}
// The damage look (damage.js lookOf): wear 0..1 on the paint, crack 0..1 on the glass. Only touches a uniform that changed. Returns how many glass materials took the crack (0: this model has no separate glass: no crack, nothing faked).
export function applyLook(mesh,look,model='default'){
 const parts=lookParts(mesh);for(const m of parts.paints){const u=patchPaint(m);if(u.uWear.value.y!==look.wear)u.uWear.value.y=look.wear}
 const place=CRACK_PLACE[model]||CRACK_PLACE.default;
 for(const m of parts.glass){const u=patchGlass(m);if(u.uCrack.value!==look.crack)u.uCrack.value=look.crack;if(u.uCrackMap.value.z!==place[2]||u.uCrackMap.value.x!==place[0]||u.uCrackMap.value.y!==place[1])u.uCrackMap.value.set(place[0],place[1],place[2])}
 return parts.glass.length;
}
