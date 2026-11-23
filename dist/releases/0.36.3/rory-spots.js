// rory-spots.js: Rory's real camp, benches and edge-of-town spots (map coordinates), data only; feeds the N4 visitors (dist/visitors.js, notes/npc-movement-design.md). Pure: no DOM, no three.js, no map imports.
// Every point was checked on the real map with the crowd's own blocker and cost (walk-legs.js townWalkBlocked and townWalkCost over world.blockedStatic and the building boxes): not blocked, and every pair routes with findRoute without falling back to a straight line (tests/rory-routes.mjs re-checks all of it).
// Source of each point: the two benches are the real MAP.plazas bench points that walk-legs.js already walks to (bench:oak-south-w, bench:alder-square: the test checks they still match walkPlacePoint). The camp and the edge points are verge spots beside the real roads (nothing in MAP names a camp or an edge spot, see notes/eval/outbox/rory-spots.md).
export const RORY_SPOTS=Object.freeze([
 Object.freeze({id:'rory-camp',x:-98,z:12,kind:'camp',note:'rough camp on the grass 7 m south of the West Fork track (MAP.roads node westFork -100,5), west of Oak Street'}),
 Object.freeze({id:'rory-bench',x:9,z:18.8,kind:'bench',note:'Oak Street south bench (walk-legs bench:oak-south-w)',place:'bench:oak-south-w'}),
 Object.freeze({id:'rory-bench-square',x:19.5,z:-116.5,kind:'bench',note:'Alder Square bench (walk-legs bench:alder-square)',place:'bench:alder-square'}),
 Object.freeze({id:'rory-edge-south',x:-24,z:62,kind:'edge',note:'verge of Alder Avenue south end (MAP.roads node alderSouth -30,60)'}),
 Object.freeze({id:'rory-edge-county',x:-36,z:-100,kind:'edge',note:'verge where the County Road meets Alder cross street (MAP.roads node alderCrossW -30,-90), the town edge to the north west'}),
 Object.freeze({id:'rory-edge-east',x:150,z:75,kind:'edge',note:'grass verge south of Freight South, Eastbank (MAP.roads edge freight-south, z 68)'}),
]);
export const RORY_CAMP_ID='rory-camp';
export const RORY_MAX_ROUTE_M=450;    // longest allowed walking route between any two spots (about 107 game minutes at WALK_SPEED 2.1 m/s)
export const RORY_MAX_DETOUR=3.2;     // longest allowed route as a multiple of the straight line, counting a short straight line as 100 m (the town pavement graph forces detours around Oak Street)
