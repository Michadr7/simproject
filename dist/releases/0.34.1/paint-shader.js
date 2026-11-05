// Vehicle paint in the shader (0.34): recolours the pixels of a model's body texture that are near its own paint hue (see paint.js). Shared by the game (driving.js) and the picture renderer (vehicle-studio.html).
import * as THREE from './vendor/three.module.js';
import {paintUniforms} from './paint.js';
// Paint (paint.js): the body material is patched once to recolour pixels near the model's paint hue; the numbers are per-material uniforms, so every vehicle has its own colour and all share one shader program.
const bodyMaterial=material=>Array.isArray(material)?material[0]:material;
function patchPaint(material){
 if(material.userData.paint)return material.userData.paint;
 const u={uPaint:{value:new THREE.Vector4(-1,1,1,0)},uBand:{value:0}};material.userData.paint=u;
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform vec4 uPaint;uniform float uBand;
vec3 pRgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 pHsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`).replace('#include <map_fragment>',`#include <map_fragment>
if(uBand>0.){vec3 h=pRgb2hsv(diffuseColor.rgb);float dh=abs(fract(h.x-uPaint.w+.5)-.5);float m=(1.-smoothstep(uBand*.6,uBand,dh))*smoothstep(.12,.25,h.y);
if(m>0.){float nh=uPaint.x>=0.?fract(uPaint.x+(h.x-uPaint.w)*.4):h.x;diffuseColor.rgb=mix(diffuseColor.rgb,pHsv2rgb(vec3(nh,clamp(h.y*uPaint.y,0.,1.),h.z*uPaint.z)),m);}}`)};
 material.customProgramCacheKey=()=>'vehicle-paint';material.needsUpdate=true;return u;
}
export function applyPaint(mesh,model,colourId){
 const m=bodyMaterial(mesh.material);if(!m||!m.userData)return;
 const n=paintUniforms(model,colourId),u=patchPaint(m);u.uPaint.value.set(n.hue,n.sat,n.val,n.src);u.uBand.value=n.band;
}
