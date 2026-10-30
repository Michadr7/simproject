// The property registry in use: where each building's door is in the world, and what the door does for a given player.
// The data is MAP.properties (map-definition.js); a house's door comes from its model (props-assets.js, measured at the Kenney front door) placed with its landmark.
import {MAP} from './map-definition.js';
import {propInfo} from './props.js';

export const PROPERTIES=MAP.properties;
export const propertyById=id=>PROPERTIES.find(p=>p.id===id)||null;

// The world position of a house's door (in the doorway, at the front wall), the way it faces and its size; null for a property with no model door.
export function doorOf(property){
 if(!property?.landmark)return null;
 const l=MAP.landmarks.find(x=>x.id===property.landmark),door=l&&propInfo(l.prop).door;if(!door)return null;
 const s=Math.sin(l.yaw),c=Math.cos(l.yaw); // three.js rotation about y: x' = x cos + z sin, z' = -x sin + z cos
 return {x:l.x+door.x*c+door.z*s,z:l.z-door.x*s+door.z*c,faceX:s,faceZ:c,width:door.width,height:door.height};
}

// What the door does for a player who owns `ownedIds`. Interiors do not exist yet, so even an owner finds the door shut with a note; every other case is locked.
export function doorState(property,ownedIds=[]){
 const name=property.name;
 if(property.enterable===false)return {state:'closed',open:false,label:name+' · not open',title:name,message:property.reason};
 if(property.access==='public')return {state:'public',open:true,label:'Enter '+name,title:name,message:'Open to everyone in its hours.'};
 if(property.access==='tenant')return {state:'tenant',open:ownedIds.includes(property.id),label:name,title:name,message:'For its tenant.'};
 if(ownedIds.includes(property.id))return {state:'owned',open:false,label:'Your door · '+name,title:name,message:'This is your home. The inside is not built yet; it arrives in a later update.'};
 const owner=property.owner;
 if(!owner)return {state:'vacant',open:false,label:'Locked · For sale',title:name,message:'The door is locked. This house is vacant and for sale.'};
 if(owner.type==='npc')return {state:'npc',open:false,label:'Locked · '+owner.name+"'s home",title:name,message:'The door is locked. '+owner.name+' lives here, and nobody answers.'};
 return {state:'locked',open:false,label:'Locked',title:name,message:'The door is locked.'};
}

// Every door the player can walk up to in the world, with its state (recomputed if ownership ever changes).
export const worldDoors=(ownedIds=[])=>PROPERTIES.map(p=>({property:p,door:doorOf(p)})).filter(d=>d.door&&d.property.enterable!==false).map(d=>({id:d.property.id,...d.door,...doorState(d.property,ownedIds)}));
