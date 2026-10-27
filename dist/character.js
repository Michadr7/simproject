import * as T from './vendor/three.module.js';
import { normalizeAppearance } from './appearance.js';
// Arm proportions (metres, in the arm's local space). The hand centre sits HAND below the elbow.
export const ELBOW=.25,HAND=.31;
export function createCharacter(appearance){
 const group=new T.Group(),hairGroup=new T.Group();group.add(hairGroup);
 const material={};for(const key of ['skin','hair','shirt','trousers'])material[key]=new T.MeshStandardMaterial({roughness:.9});
 const shoes=new T.MeshStandardMaterial({color:'#303735',roughness:1});
 function mesh(parent,geometry,x,y,z,m){const obj=new T.Mesh(geometry,m);obj.position.set(x,y,z);obj.castShadow=true;parent.add(obj);return obj}
 function oval(parent,x,y,z,sx,sy,sz,m){const obj=mesh(parent,new T.SphereGeometry(1,12,8),x,y,z,m);obj.scale.set(sx,sy,sz);return obj}
 function taper(parent,top,bottom,height,x,y,z,m){return mesh(parent,new T.CylinderGeometry(top,bottom,height,10),x,y,z,m)}
 // Shaped garment silhouette: waist, chest and sloped shoulders.
 const rings=[[.97,.235],[1.05,.24],[1.27,.265],[1.37,.27],[1.43,.225],[1.46,.15]];
 const points=[[.97,0],...rings,[1.46,0]].map(([y,r])=>new T.Vector2(r,y));
 const torso=mesh(group,new T.LatheGeometry(points,12),0,0,0,material.shirt);torso.scale.z=.62;torso.name='torso';
 const pelvis=mesh(group,new T.LatheGeometry([[.81,0],[.81,.185],[.89,.215],[1.045,.212],[1.045,0]].map(([y,r])=>new T.Vector2(r,y)),12),0,0,0,material.trousers);pelvis.scale.z=.62;pelvis.name='pelvis';
 taper(group,.082,.09,.14,0,1.5,0,material.skin);
 oval(group,0,1.76,0,.18,.235,.17,material.skin);
 for(const x of [-.18,.18])oval(group,x,1.75,0,.035,.055,.035,material.skin);
 const eye=new T.MeshStandardMaterial({color:'#35372e'});
 for(const x of [-.067,.067])oval(group,x,1.79,.153,.017,.022,.011,eye);
 oval(group,0,1.735,.168,.025,.035,.035,material.skin);
 // Collar, seams and a contrasting sole give the simple mesh a clothing silhouette.
 const collar=taper(group,.105,.13,.055,0,1.455,0,material.shirt);collar.scale.z=.8;
 const seam=new T.MeshStandardMaterial({color:'#7e8074',roughness:1});
 // Shirt overlaps the narrower, closed trouser top; no coincident belt surface.
 const legs=[],arms=[],forearms=[];
 for(const x of [-.135,.135]){const hip=new T.Group();hip.position.set(x,.94,0);group.add(hip);taper(hip,.115,.08,.77,0,-.40,0,material.trousers);oval(hip,0,-.855,.055,.105,.075,.19,shoes);oval(hip,0,-.905,.055,.108,.025,.193,seam);legs.push(hip)}
 // Two-joint arm: upperArm pivots at the shoulder, forearm pivots at the elbow.
 // arms[i] is the upperArm group (walking swing rotates it); forearms[i] bends at the elbow.
 for(const x of [-.29,.29]){
  const upperArm=new T.Group();upperArm.name=x<0?'upperArm-left':'upperArm-right';upperArm.position.set(x,1.4,0);group.add(upperArm);
  // A continuous sleeve profile blends into the chest without a separate shoulder ball.
  const profile=[[-.25,.085],[-.17,.098],[-.06,.1],[.015,.065],[.025,.02]].map(([y,r])=>new T.Vector2(r,y));
  const sleeve=mesh(upperArm,new T.LatheGeometry(profile,12),0,0,0,material.shirt);sleeve.scale.z=.95;
  const forearm=new T.Group();forearm.name=x<0?'forearm-left':'forearm-right';forearm.position.set(0,-ELBOW,0);upperArm.add(forearm);
  // Small joint sphere keeps the elbow closed while the forearm bends out of the sleeve.
  oval(forearm,0,0,0,.072,.072,.068,material.skin);
  taper(forearm,.076,.063,.30,0,-.14,0,material.skin);
  oval(forearm,0,-HAND,.005,.063,.075,.055,material.skin);
  upperArm.userData.forearm=forearm;arms.push(upperArm);forearms.push(forearm);
 }

 function apply(value){const a=normalizeAppearance(value);for(const key in material)material[key].color.set(a[key]);while(hairGroup.children.length){const child=hairGroup.children[0];hairGroup.remove(child);child.geometry.dispose()}
 const hair=(x,y,z,sx,sy,sz)=>oval(hairGroup,x,y,z,sx,sy,sz,material.hair);
 // Hemisphere follows the scalp and keeps the forehead/face exposed.
 const cap=mesh(hairGroup,new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI*.5),0,1.82,0,material.hair);
 cap.scale.set(.186,a.style==='Shaved'?.178:.205,.177);
 if(a.style==='Short')hair(0,1.96,-.02,.17,.075,.15);
 if(a.style==='Side part'){const sweep=hair(-.035,1.975,.015,.17,.085,.155);sweep.rotation.z=-.18;hair(-.17,1.83,-.015,.032,.1,.13)}
 if(a.style==='Bob'){hair(0,1.75,-.10,.195,.19,.12);for(const x of [-.17,.17])hair(x,1.73,-.035,.055,.18,.12)}
 if(a.style==='Bun'){hair(0,1.82,-.12,.16,.15,.08);hair(0,1.98,-.19,.105,.10,.105)}
 }
 apply(appearance);return {group,legs,arms,forearms,apply};
}
