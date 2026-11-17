// Hal Brennan in person at Willow Farmhouse (notes/gigs-starter-design.md section 2 beat 4 and the 2026-11-13 addendum, stage G3): one Farmer-outfit character standing by the porch.
// No three.js import: game.js passes createCharacter, outfit, the scene and a ground-height function. Nothing here allocates per frame (numbers only).
// Cost: one character (the same rig as a clerk). Beyond HAL_VIEW metres, or when he is not at the farm, he is hidden and not animated.
import {PLACES} from './starter.js';
export const HAL_VIEW=70,HAL_TALK_VIEW=9,HAL_TURN=4; // metres he is drawn, metres he turns his head toward you, how fast he turns (1/s)
export const HAL_LOOK={body:'male',outfit:'Farmer',skin:'#c9a07f',hair:'#9b9a96'};
// The yaw (about +y, 0 faces +z) that turns from `yaw` toward the point (dx,dz) by at most the fraction `k` of the way; pure.
export const turnToward=(yaw,dx,dz,k)=>{const want=Math.atan2(dx,dz);let d=want-yaw;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return yaw+d*Math.max(0,Math.min(1,k))};
export function createHal({scene,createCharacter,outfit,groundAt}){
 const avatar=createCharacter(outfit(HAL_LOOK.body,HAL_LOOK.outfit,{skin:HAL_LOOK.skin,hair:HAL_LOOK.hair})),group=avatar.group,X=PLACES.hal.x,Z=PLACES.hal.z;
 group.name='hal';group.position.set(X,groundAt(X,Z),Z);group.rotation.y=0;group.visible=false;scene.add(group);
 let shown=false,frame=0;
 return {group,x:X,z:Z,get visible(){return shown},
  // dt seconds, player {x,z}, here = halHere(progress)
  update(dt,player,here){
   const dx=player.x-X,dz=player.z-Z,d2=dx*dx+dz*dz,show=here&&d2<HAL_VIEW*HAL_VIEW;
   if(show!==shown){shown=show;group.visible=show;if(show)group.position.y=groundAt(X,Z)}
   if(!show)return;
   if((++frame&63)===0)group.position.y=groundAt(X,Z); // the ground under him can change while the chunk loads
   avatar.update(dt);
   if(d2<HAL_TALK_VIEW*HAL_TALK_VIEW)group.rotation.y=turnToward(group.rotation.y,dx,dz,1-Math.exp(-dt*HAL_TURN));
  }};
}
