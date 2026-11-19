// The dock's roller door and the forklift's way through it (DESIGN 4.16 J step 2, D2). Pure: no THREE, no game state.
// The hall is a separate scene, 36 m wide, and the building outside is 17 m wide, so a crossing is a short fade, not a continuous drive: the forklift is turned half a circle through the door
// (what was ahead inside is ahead outside: forks first stay forks first), so inside x and z map to outside as a rotation about the door. The same forklift state carries on: speed, fork height, load.
//   inside (room metres): the door is at x IN.x in the front wall z IN.wall; the forklift crosses when its middle passes z IN.line
//   outside (world metres): the apron north of the warehouse; the door is at x OUT.x in the wall at z OUT.wall; it crosses back when its middle passes z OUT.line
// The two landings are 0.8 m clear of the other side's trigger line, so a crossing never bounces straight back.
export const IN=Object.freeze({x:13.2,wall:12,line:10.4,land:9.6,halfWidth:.8,gap:2}); // gap: half the width of the inside door
export const OUT=Object.freeze({x:161.8,wall:32.52,line:30.7,land:29.9,halfWidth:.8,gap:1.85}); // the model's one loading door: a 3.7 m wide, 2.15 m high opening in the north wall at world x 161.8 (the dock plate lies in front of it, map-definition.js yards)
export const YARD=Object.freeze({x0:152,x1:175,z0:20,z1:31.5}); // the paved apron the forklift may drive on outside ("The forklift stays in the yard")
// The loading zone (D3): a green painted area on the apron in front of the roller door, 2.4 x 1.5 m, one pallet at a time. A forklift that comes out of the door facing north carries its pallet 1.4 m ahead of its middle, so it is set down about z 28.6.
export const ZONE=Object.freeze({x:161.8,z:28.6,hx:1.2,hz:.75});
export const inZone=(x,z)=>Math.abs(x-ZONE.x)<=ZONE.hx&&Math.abs(z-ZONE.z)<=ZONE.hz;
export const HOLD=4,OPEN_TIME=.9,NEAR=3.2; // seconds the door stays up after the forklift has gone, seconds to roll, metres from the door that make it roll up
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export const toOutside=s=>({...s,x:OUT.x-(s.x-IN.x),z:OUT.land-(s.z-IN.line),yaw:wrap(s.yaw+Math.PI)});
export const toInside=s=>({...s,x:IN.x-(s.x-OUT.x),z:IN.land-(s.z-OUT.line),yaw:wrap(s.yaw+Math.PI)});

// the forklift is travelling toward +z (its velocity along z is positive) and is within ~28 degrees of the z axis
const towardWall=s=>s.speed*Math.cos(s.yaw)>.05&&Math.abs(Math.sin(s.yaw))<.47;
// crossing out: through the open door from inside; crossing in: from the apron into the hall. `open`: the door is up.
export const crossesOut=(s,open)=>!!open&&s.z>=IN.line&&Math.abs(s.x-IN.x)<=IN.halfWidth&&towardWall(s);
export const crossesIn=(s,open)=>!!open&&s.z>=OUT.line&&Math.abs(s.x-OUT.x)<=OUT.halfWidth&&towardWall(s);

// the door: {t: 0 shut .. 1 open, hold: seconds left before it comes down}; `near`: the forklift is within NEAR of it
export const freshDoor=()=>({t:0,hold:0});
export function stepDoor(d,{near,dt}){
 const hold=near?HOLD:Math.max(0,d.hold-dt),want=hold>0?1:0,t=Math.max(0,Math.min(1,d.t+Math.sign(want-d.t)*Math.min(Math.abs(want-d.t),dt/OPEN_TIME)));
 return t===d.t&&hold===d.hold?d:{t,hold};
}
export const passable=d=>d.t>=.95; // up far enough for the forklift (and its mast) to pass
export const nearDoor=(where,s)=>where==='inside'?Math.hypot(s.x-IN.x,s.z-IN.wall)<NEAR&&Math.abs(s.x-IN.x)<IN.gap+1:Math.hypot(s.x-OUT.x,s.z-OUT.wall)<NEAR&&Math.abs(s.x-OUT.x)<OUT.gap+1;

// Outdoors the forklift stays on the apron (hull and forks inside the rectangle); inside the door line only passable doorway cells are open (warehouse.js)
export const inYard=(x,z)=>x>=YARD.x0&&x<=YARD.x1&&z>=YARD.z0&&z<=YARD.z1;
// Outside: the doorway cells through the building's wall (its collider starts at about z 31.8; the wall face is z 32.52, measured at the person door): open to the forklift while the door is up. (x, z) in world metres.
export const inDoorwayOut=(x,z)=>Math.abs(x-OUT.x)<=OUT.gap-.3&&z>OUT.wall-1.1&&z<OUT.wall+3;
// Inside: the front wall is open to the forklift where the door is, while it is up. (x, z) in room metres.
export const inDoorway=(x,z)=>Math.abs(x-IN.x)<=IN.gap-.3&&z>IN.wall-.5&&z<IN.wall+3;
