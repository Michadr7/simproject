// The water cooler model (water-cooler-asset.js, the project owner's own Blender model) for the office and the warehouse. Loaded once with GLTFLoader and cloned per room;
// addWaterCooler() returns a group at once and fills it when the model has decoded. Origin on the floor, front +z (turn it with yaw), 1 unit = 1 m.
import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {WATER_COOLER_GLB} from './water-cooler-asset.js';

export const COOLER_SIZE=Object.freeze({w:.37,d:.42,h:1.34}); // from the model's manifest
let loading=null;
const load=()=>loading||(loading=new GLTFLoader().parseAsync(Uint8Array.from(atob(WATER_COOLER_GLB),c=>c.charCodeAt(0)).buffer,'').then(g=>g.scene));
export function addWaterCooler(parent,{x,z,yaw=0}){
 const group=new T.Group();group.name='water-cooler';group.position.set(x,0,z);group.rotation.y=yaw;parent.add(group);
 group.userData.ready=load().then(scene=>{const c=scene.clone(true);c.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;if(o.material?.transparent){o.material=o.material.clone();o.material.side=T.DoubleSide;o.material.depthWrite=false;o.renderOrder=2}});group.add(c);return group}).catch(()=>group); // a model that fails to decode leaves the cooler invisible but usable
 return group;
}