// The warehouse's floor plan as plain data (0.35 step 2b, DESIGN 4.16 C), shared by the rules (forest.js) and the room (warehouse.js). No three.js here.
// The hall is 36 x 24 m (HALL), the shelving three units of eight bays running east-west with 4 m aisles between them (a forklift turns in 3.5 m), three levels high:
//   face A  the back-wall unit, looking into aisle 1          face B and C  the two sides of the first free-standing unit (B looks into aisle 1, C into aisle 2)
//   face D and E  the two sides of the second unit (D looks into aisle 2, E into aisle 3)
// A slot is one shelf cell: a face, a bay (1..8 along x) and a level (1..3). Level 1 is the floor and can be reached by hand; levels 2 and 3 need the forklift.
// Slot ids look like 'B4-2' (face B, bay 4, level 2). Room-local metres, +z is the door side (the front wall), +y up.
export const HALL=Object.freeze({halfW:18,halfD:12,height:7});
export const FACES=Object.freeze(['A','B','C','D','E']),BAYS=8,LEVELS=3,BAY_PITCH=1.8,CELL_DEPTH=1.35,HAND_LEVEL=1;
// the deck each level's planks lie on (level 1 is the floor itself), and the height of the uprights
export const LEVEL_Y=Object.freeze([.14,1.5,2.85]),FRAME_HEIGHT=4.25;
// each face: the cell row's z, which way it looks (+1 toward +z), and its aisle's standing line (where you stand to reach it)
export const FACE_ROWS=Object.freeze({
 A:{z:-11.3,looks:1,stand:-9.5},B:{z:-5.9,looks:-1,stand:-7.7},C:{z:-4.55,looks:1,stand:-2.75},D:{z:.775,looks:-1,stand:-1.0},E:{z:2.125,looks:1,stand:3.9}
});
// the three units (a unit is one or two faces back to back): where it stands and how big it is, for collision and for the drawing
export const UNITS=Object.freeze([
 {id:'wall',faces:['A'],z:-11.3,depth:CELL_DEPTH},{id:'first',faces:['B','C'],z:-5.225,depth:CELL_DEPTH*2},{id:'second',faces:['D','E'],z:1.45,depth:CELL_DEPTH*2}
]);
export const bayX=bay=>+((bay-(BAYS+1)/2)*BAY_PITCH).toFixed(3); // bay 1..8 -> -6.3 .. 6.3
export const slotId=(face,bay,level)=>`${face}${bay}-${level}`;
export const RACK_SLOTS=Object.freeze(FACES.flatMap(face=>Array.from({length:BAYS},(_,b)=>b+1).flatMap(bay=>Array.from({length:LEVELS},(_,l)=>l+1).map(level=>{
 const r=FACE_ROWS[face];return Object.freeze({id:slotId(face,bay,level),face,bay,level,x:bayX(bay),z:r.z,y:LEVEL_Y[level-1],yaw:0,stand:Object.freeze({x:bayX(bay),z:r.stand})})}))));
export const RACK_IDS=Object.freeze(RACK_SLOTS.map(s=>s.id)),RACK_ID_PATTERN=/^[A-E][1-8]-[1-3]$/;
export const slotById=id=>RACK_SLOTS.find(s=>s.id===id)||null;
export const reachableByHand=id=>{const s=slotById(id);return !!s&&s.level<=HAND_LEVEL};
// where things stand inside the hall (front zone, z 6.8 to 12): the delivery pile and the dock at the front right, the order table at the front left, three staging pallets between
export const WAREHOUSE_PILE=Object.freeze({x:13.2,z:9.4}),WAREHOUSE_TABLE=Object.freeze({x:-12,z:9.4}),DOCK_DOOR=Object.freeze({x:13.2,width:4});
export const WAREHOUSE_STAGING=Object.freeze([5,7,9].map((x,i)=>Object.freeze({id:'S'+(i+1),x,z:8.2})));
// the interior spec the map uses (the same fields as a shop's interior: where you come in, the exit door, how close it opens, the trigger line)
export const WAREHOUSE_INTERIOR=Object.freeze({frontWallZ:12,entry:{x:0,z:10.9},spawn:{x:0,z:10.1},exit:{x:0,z:11},counter:{x:0,z:-2},exitDoor:{kind:'double',z:11.96,width:2.2,height:2.7,near:{halfWidth:2.4,z:9.7},trigger:{halfWidth:.9,z:11.3}}});
