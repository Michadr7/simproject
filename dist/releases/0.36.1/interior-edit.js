// The interior editor's editing rules, as plain functions on a layout (interiors.js houseLayout): move, turn, remove, duplicate and add a piece, and turn a layout into what gets saved.
// Nothing here touches three.js or the page; the dev panel (dev.js) and the game (game.js, in its dev block) call these and then ask the room to refresh().
import {cleanItem,footprintOf,LOCKED,deriveSpots} from './interiors.js';
import {PROPS} from './props-assets.js';

export const STEPS={coarse:.25,fine:.05};
export const FURNITURE=Object.keys(PROPS).filter(id=>id.startsWith('f-')&&!LOCKED.has(id)).sort();
const turnYaw=(yaw,dir)=>{const q=((Math.round(yaw/(Math.PI/2))+dir)%4+4)%4;return q===3?-Math.PI/2:q*Math.PI/2};
const editable=(layout,floor,index)=>{const item=layout.items[floor]?.[index];return item&&!LOCKED.has(item.id)?item:null};
// Pull a piece back inside the room if its footprint sticks out of a wall.
function keepInside(layout,item){
 const hw=layout.W/2,hd=layout.D/2,r=footprintOf(item);
 if(r.x0<-hw)item.x+=-hw-r.x0;if(r.x1>hw)item.x-=r.x1-hw;if(r.z0<-hd)item.z+=-hd-r.z0;if(r.z1>hd)item.z-=r.z1-hd;
 item.x=+item.x.toFixed(3);item.z=+item.z.toFixed(3);
}
// Each returns true when something changed, so the caller knows whether to refresh the room.
export function moveItem(layout,floor,index,dx,dz){const item=editable(layout,floor,index);if(!item||![dx,dz].every(Number.isFinite))return false;const before=[item.x,item.z];item.x=+(item.x+dx).toFixed(3);item.z=+(item.z+dz).toFixed(3);keepInside(layout,item);return item.x!==before[0]||item.z!==before[1]}
export function rotateItem(layout,floor,index,dir){const item=editable(layout,floor,index);if(!item)return false;item.yaw=turnYaw(item.yaw,dir<0?-1:1);keepInside(layout,item);return true}
export function removeItem(layout,floor,index){if(!editable(layout,floor,index))return false;layout.items[floor].splice(index,1);return true}
// Returns the new piece's index, or -1.
export function duplicateItem(layout,floor,index){const item=editable(layout,floor,index);if(!item)return -1;const copy={...item,x:item.x+.5,z:item.z+.5};keepInside(layout,copy);layout.items[floor].push(copy);return layout.items[floor].length-1}
// A new piece in the middle of the room (standing on the floor), turned to face the door. Returns its index, or -1 for something that is not furniture.
export function addItem(layout,floor,id){const item=cleanItem({id,x:0,z:0,yaw:Math.PI,y:0});if(!item||LOCKED.has(id)||!layout.items[floor])return -1;keepInside(layout,item);layout.items[floor].push(item);return layout.items[floor].length-1}
// Put a layout's furniture back to another's (the generated one), keeping the building's own parts.
export function restoreItems(layout,generated){layout.items=generated.items.map(list=>list.map(i=>({...i})));const spots=deriveSpots(layout);if(spots.kitchen)Object.assign(layout.kitchen,spots.kitchen);if(spots.bed)layout.bed=spots.bed}
// What goes in interior-layouts.js: the furniture of every floor (not the stairs), cleaned and rounded.
export function toSaved(layout){return {items:layout.items.map(list=>list.filter(i=>!LOCKED.has(i.id)).map(cleanItem).filter(Boolean))}}
// A short label for a list: "sofa · x 2.5, z 0.3 · facing W".
export const FACING={0:'N',1:'W',2:'S',3:'E'};
export const describe=item=>{const q=((Math.round(item.yaw/(Math.PI/2))%4)+4)%4;return `${item.id.replace(/^f-/,'').replace(/-/g,' ')} · x ${item.x.toFixed(2)}, z ${item.z.toFixed(2)} · faces ${FACING[q]}${LOCKED.has(item.id)?' · fixed':''}`};
