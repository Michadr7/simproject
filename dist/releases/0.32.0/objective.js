// One answer to "where should the player go next?", shared by the objective arrow, the beacon (ring and diamond) and the minimap.
// Before this, the gig code and the beacon code both wrote the arrow in the same frame and the beacon always won, and the market
// doorway beacon kept showing during a gig. Priority: an active gig, then a delivery you are carrying, then the market (its doorway
// from the street, its counter once you are inside), otherwise nothing.
//
// Inputs
//   progress   saved progress (activeJob, phase)
//   place      {inside, shop}: inside the studio, and which shop (if any) you are in
//   room       the current room name used by gig targets ('street', 'cafe', ...)
//   gigTarget  (job) => {x, z, room} where the gig wants you now
//   delivery   {x, z, name} where the carried order goes
//   world      {marketDoor:{x,z}, counter:{local:{x,z}, world:{x,y,z}}, cafeDoor:{x,z}}
// Output
//   kind    'gig' | 'delivery' | 'door' | 'counter' | 'none'
//   aim     {x, z} the arrow points at, in the space the player is standing in (shop-local inside a shop), or null for no arrow
//   beacon  the ring and diamond to draw (world position, how far to lift the diamond, how close hides it), or null
//   gig     for a gig: its target and where its marker is drawn
export function resolveObjective({progress,place={},room='street',gigTarget,delivery,world}){
 const job=progress?.activeJob,outdoors=!place.inside&&!place.shop;
 if(job){
  const target=gigTarget(job),here=target.room===room;
  // A cafe gig seen from the street is marked at the cafe's door.
  const display=target.room==='cafe'&&place.shop!=='cafe'?{x:world.cafeDoor.x,z:world.cafeDoor.z}:target;
  return {kind:'gig',aim:here?target:outdoors?display:null,beacon:null,gig:{target,display,here}};
 }
 if(progress?.phase==='carrying')return outdoors?{kind:'delivery',aim:{x:delivery.x,z:delivery.z},beacon:{x:delivery.x,z:delivery.z,y:0,lift:0,hideWithin:0},gig:null}:none();
 if(outdoors){const door=world.marketDoor;return {kind:'door',aim:{x:door.x,z:door.z},beacon:{x:door.x,z:door.z,y:0,lift:.7,hideWithin:2.4},gig:null}}
 if(place.shop==='market'){const {local,world:at}=world.counter;return {kind:'counter',aim:{x:local.x,z:local.z},beacon:{x:at.x,z:at.z,y:at.y,lift:0,hideWithin:1.8,local:{x:local.x,z:local.z}},gig:null}}
 return none();
}
const none=()=>({kind:'none',aim:null,beacon:null,gig:null});
