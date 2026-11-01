// The reset safety net inside the real game (the packaged release, with a synthetic DOM and a renderer stub, like startup.mjs):
// a saved position inside a solid object, the R key, and the automatic rescue when you hold a key and cannot move.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
const SPAWN={x:-5,z:15},CAR={x:6,z:13.9}; // the 0.31 parked car (park-oak-3) and the spawn it once covered
const boot=position=>bootGame({position});
const at=g=>g.me.position,away=(p,o)=>Math.hypot(p.x-o.x,p.z-o.z);

{ // A clear saved position is kept exactly, and a new game starts on the spawn
 const g=await boot({x:1,z:-6.3});assert.equal(at(g.GameState).x,1);assert.equal(at(g.GameState).z,-6.3);await g.done();
 const fresh=await boot(null);assert.deepEqual([at(fresh.GameState).x,at(fresh.GameState).z],[SPAWN.x,SPAWN.z],'a free spawn is used as it is');await fresh.done();
}
{ // The 0.31.1 bug: a save made while stuck inside the car. Loading used to send you to the spawn; now you are put beside it, on clear ground, near where you were
 const g=await boot(CAR),p=at(g.GameState);
 assert(away(p,CAR)>=1.5,`you are not left inside the car (${away(p,CAR).toFixed(2)} m from its centre)`);assert(away(p,CAR)<=8,`and you are near where you were (${away(p,CAR).toFixed(2)} m)`);
 assert(away(p,SPAWN)>3,'not teleported back to the spawn');
 // R: back to the spawn (which is clear)
 Object.assign(p,{x:40,z:20});g.send('keydown','KeyR');assert.deepEqual([at(g.GameState).x,at(g.GameState).z],[SPAWN.x,SPAWN.z],'R returns to the starting point');
 await g.done();
}
{ // Stuck inside the car, holding W: after about a second you are moved out; nothing is teleported while you are simply walking
 const g=await boot({x:1,z:-6.3});
 // Walking north from here runs into the market's wall after a second or so. Pressing into a wall is not "stuck inside something": nothing may teleport you.
 g.send('keydown','KeyW');g.pump(.5);assert(at(g.GameState).z<-6.3,'walking forward moves you');
 {let previous={...at(g.GameState)},biggest=0;for(let i=0;i<100;i++){g.pump(.04);const p=at(g.GameState);biggest=Math.max(biggest,away(p,previous));previous={...p}}
  assert(biggest<.5,`no jump while walking or pressing into a wall (largest step ${biggest.toFixed(2)} m)`)}
 g.send('keyup','KeyW');
 Object.assign(at(g.GameState),{x:CAR.x,z:CAR.z});g.pump(.1);
 g.send('keydown','KeyW');g.pump(.5);assert(away(at(g.GameState),CAR)<.5,'stuck: the first half second changes nothing');
 // The moment of rescue is a jump; W is still held, so the character then walks back toward the car until its padded edge stops it.
 let jumpAt=null,best=0,before={...at(g.GameState)};
 for(let i=0;i<50;i++){g.pump(.04);const p=at(g.GameState),step=away(p,before);if(jumpAt===null&&step>1)jumpAt=.5+(i+1)*.04;best=Math.max(best,away(p,CAR));before={...p}}
 assert(jumpAt!==null,'a rescue happened');assert(jumpAt>.9&&jumpAt<1.4,`after about a second of being stuck (${jumpAt.toFixed(2)} s)`);
 assert(best>=2,`you were put on clear ground, outside the car's box and its standing room (${best.toFixed(2)} m from its centre)`);
 assert(away(at(g.GameState),CAR)>=1.2,'and you are not back inside it');
 g.send('keyup','KeyW');await g.done();
}
console.log('Rescue in the game: a clear save and a new game keep their place; a save made inside the parked car loads beside it, not at the spawn; R returns to a clear spawn; holding W while stuck inside a solid object moves you out after a second, and walking is never interrupted.');
