// What a pallet looks like (user feedback 2026-11-06: "the pallets are still full blocks"): a real wooden pallet instead of a slab, and the planks drawn board by board on top of it.
// Pallet: three runners along the forks' direction (z) with the two tine pockets between them, a deck of cross boards on top and three bottom boards. 1.04 across x 1.24 along z, 0.14 high (pallets.js PALLET).
// One merged geometry (13 boxes, 156 triangles) shared by every pallet: the racks, the floor and the forks. Planks: boardAt(i) is the i-th plank of a stack, four across, ten high.
import * as THREE from './vendor/three.module.js';
import {PALLET} from './pallets.js';

export const BOARD={w:.22,t:.088,l:1.2},COLS=4;
// plank i of a stack: its place across (x) and height (y) above the pallet's top, relative to the stack's middle
export const boardAt=i=>({x:((i%COLS)-(COLS-1)/2)*(BOARD.w+.02),y:BOARD.t/2+Math.floor(i/COLS)*(BOARD.t+.004)});
export const TONES=['#c99f63','#bf9358','#d3ab6e','#b78a50'].map(c=>new THREE.Color(c));

let cached=null;
export function palletGeometry(){
 if(cached)return cached;
 const parts=[],{w,d,h}=PALLET,deck=.022,runner=h-2*deck;
 const add=(sx,sy,sz,x,y,z)=>{const g=new THREE.BoxGeometry(sx,sy,sz);g.translate(x,y,z);parts.push(g.toNonIndexed())};
 for(const x of [-(w/2-.05),0,w/2-.05])add(.1,runner,d,x,deck+runner/2,0); // three runners along z: the pockets are the two gaps between them
 for(let i=0;i<7;i++)add(w,deck,.14,0,h-deck/2,-d/2+.07+i*((d-.14)/6)); // the deck: seven boards across
 for(const z of [-d/2+.06,0,d/2-.06])add(w,deck,.1,0,deck/2,z); // three bottom boards
 const n=parts.reduce((s,g)=>s+g.attributes.position.count,0),pos=new Float32Array(n*3),nor=new Float32Array(n*3);let o=0;
 for(const g of parts){pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose()}
 const merged=new THREE.BufferGeometry();merged.setAttribute('position',new THREE.BufferAttribute(pos,3));merged.setAttribute('normal',new THREE.BufferAttribute(nor,3));merged.computeBoundingSphere();
 return cached=merged;
}
export const PALLET_TRIANGLES=13*12;
