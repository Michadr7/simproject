import * as T from './vendor/three.module.js';
import {createCharacter} from './character.js';import {outfit,palettes} from './appearance.js';import {createProp,propInfo} from './props.js';
// Routes stay on clear pavement lanes; endpoints pause like storefront visits.
// [body, outfit] for Alex, Sophie, Robert, Julia, Carlos and Megan (names match the bodies).
const LOOKS=[['male','Casual_2'],['female','Casual'],['male','Suit'],['female','Formal'],['male','Worker'],['female','Suit']];
export function createPedestrians(scene){const routes=[[-15,7,-6.7],[12,25,-5.6],[30,44,-6.7],[-12,3,18.8],[14,28,18.8],[35,47,18.8]];const people=routes.map(([a,b,z],i)=>{const avatar=createCharacter(outfit(...LOOKS[i],{skin:palettes.skin[i][1],hair:palettes.hair[(i*5)%6][1]}));avatar.swingArms=true;avatar.group.position.set(a+(b-a)*.3,.165,z);scene.add(avatar.group);return {...avatar,name:['Alex','Sophie','Robert','Julia','Carlos','Megan'][i],line:['Elena at the café is hiring. Speak to her at the counter before starting work.','The market opens at seven. Groceries cost less than eating out.','A studio here costs $90 to move into, including the first week.','I like the quieter side of Oak Street.','Keep enough aside for your weekly rent.','The café closes at six, but the market stays open until ten.'][i],a,b,z,direction:i%2?1:-1,wait:i*.3,phase:i}});return {people,update(dt,player){for(const p of people){let walking=false;if(p.wait>0)p.wait-=dt;else{const x=p.group.position.x+p.direction*dt*(2.1+(p.a%3)*.1);const close=Math.abs(x-player.x)<1.5&&Math.abs(p.z-player.z)<1.3;const targetZ=p.z+(close?(player.z>=p.z?-.9:.9):0);p.group.position.z=T.MathUtils.lerp(p.group.position.z,targetZ,1-Math.exp(-dt*5));if(Math.hypot(x-player.x,p.group.position.z-player.z)>.65){p.group.position.x=x;walking=true;p.phase+=dt*4.5}if(x>=p.b||x<=p.a){p.group.position.x=T.MathUtils.clamp(x,p.a,p.b);p.direction*=-1;p.wait=1.5+Math.abs(p.a%3)}}p.group.rotation.y=p.direction*Math.PI/2;p.setMotion(walking?2.1+(p.a%3)*.1:0);p.update(dt)}}}}
// The cars parked on Oak Street are the same converted Quaternius models as the cars in Alder Center (props-assets.js): real bodies and wheels, solid boxes from the model.
// They stand in the kerb lanes the town's other parked cars use (z -1.9 north, 13.9 south; a yaw of a quarter turn puts the long side along the street).
// fade is the world's sightline fade; the default lets tests build them without a world.
const PARKED=[['taxi','Taxi',23,-1.9,-Math.PI/2],['sports-car-2','Sports coupe',40,13.9,Math.PI/2],['suv','SUV',-35,-22,0]];
export function createVehicles(scene,colliders,fade={apply:material=>material}){
 return PARKED.map(([prop,name,x,z,yaw],i)=>{
  const info=propInfo(prop),mesh=createProp(prop,fade);mesh.position.set(x,0,z);mesh.rotation.y=yaw;scene.add(mesh);
  const cos=Math.round(Math.cos(yaw)),sin=Math.round(Math.sin(yaw)),turned=sin!==0;
  for(const b of info.colliders)colliders.push({x:x+b.x*cos+b.z*sin,z:z-b.x*sin+b.z*cos,hx:turned?b.hz:b.hx,hz:turned?b.hx:b.hz});
  return {id:'parked-'+i,name,group:mesh,x,z,spawn:{x,z},drivable:false};
 });
}