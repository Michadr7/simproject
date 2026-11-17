michadr.

# Opus audit B: cargo and carrying, NPCs and crowd (working copy dist/, 0.35.17)

Read-only audit. The only file written is this report. Tests run with `node tests/<name>.mjs` (they boot the packaged 0.35.17 release):
carry, cargo, cargo-game, carry-game, load-drag, npc-walk, npc-life, population and schedule PASS. night-lights FAILS (3783 vs 3764, the same as the owner saw). I also wrote scratch scripts in my temp folder that boot the game and compare scene objects by name and type, plus one that simulates crowd separation.

## Findings, worst first

### 1. Planks cannot be put down inside the warehouse (or any interior). X does nothing and shows no message. BREAKS PLAY. CONFIRMED (traced)
- `dist/game.js:713` putDownCarried: `if(!p.carry||inside||shop||putting||actionBusy())return;` The function just returns, with no toast.
- `dist/game.js:541` enterOffice sets `shop=o.key`, and the Ridgeline warehouse is an office of kind 'warehouse'. So inside the warehouse `shop` is set and X is ignored.
- Inside the warehouse the only ways to get rid of planks are:
  - "Stack the planks in rack N" (`game.js:610`, `forest.js:52` stackPlanks), which refuses off shift (`forest.js:53` 'Clock in to stack planks...'). It also refuses when the floor-level cell is full or there is no pallet room (`forest.js:57-58`).
  - Staging on an order (`game.js:613`), which only shows while an order still needs planks.
- Scenario: on shift, take a stack of 4 from a rack (`forest.js:64-71`, RECEIVE_BATCH 4). Stage it on an order that needs only 2, so 2 stay in your hands (`game.js:269` stageOnOrder keeps `left`). Clock out, or the order completes, or the floor cells nearby are full. Now:
  - X does nothing, with no message.
  - The rack prompt answers 'Clock in to stack planks'.
  - You cannot take the forklift, a tool, a nozzle or a vehicle, because the hands are full.
  
  The only escape is to walk out through the hinged door (E opens it) and press X outside. Nothing tells the player that. This matches "too many planks in the hands, cannot drop them, stuck".
- The old dead end (hands full and 12 stacks on the ground) is fixed in `carry.js:72-83`: the oldest stack is cleared, and `rescueCarry` runs on load (jobs.js). tests/carry.mjs passes. So the blocker that is left is the interior path above.
- Smallest fix:
  - (a) `game.js:713`: split the early return so an interior gives a message: `if(inside||shop){toast(inWarehouse()&&p.carry.kind==='planks'?'Stack them in a floor rack, or carry them outside to put them down.':'Carry it outside to put it down.');return}`. Also toast on `putting||actionBusy()` instead of failing silently.
  - (b) `forest.js:53`: allow the put-back off shift. `filledPay` already pays nothing when `!moved.shift` (`forest.js:50`), so removing the onShift guard (or skipping it only for a put-back) gives no money.
  - Better still: in the warehouse, X puts the stack back into the nearest floor cell that has room.
  - Add a regression test: carry planks in the warehouse off shift, press X, and expect either a toast or empty hands.
  
  Edits needed in the forbidden file game.js: line 713 (putDownCarried) as in (a).

### 2. Three or more people at the same spot: all but the first stand exactly on top of each other. WRONG BEHAVIOUR (the owner's eye-check "no two people stand on each other" fails). CONFIRMED (simulated)
- `dist/npc-crowd.js:41`: each person is pushed away only from the people placed earlier, measured from their own unpushed target `x,z`.
- When two points are within 5 cm of each other, the push direction is `e.yaw`. A pooled person's first yaw is `(id.length*1.7)%6.28` (`npc-crowd.js:35`), and flatmates' ids have the same length (`house-r2#1`, `house-r2#2`, `oak-apartments/5#1`...), so they get the same yaw.
- Person 3 is pushed 0.8 m from person 1 in the same direction as person 2. Person 2 then sits exactly 0.8 m away, which is not `< SEPARATION`, so nothing pushes 3 away from 2.
- Simulation (createNpcCrowd, four people 'outside' at `shop:market`): p01 at (19,-6.3); p02, p03 and p04 all at (19.3,-5.56). Distances p02-p03-p04 = 0.00.
- This also happens with flatmates sitting out at the same door: they get the same `pace` hash (`npc-walk.js:94`, from `b.from` and `b.place`), so they move in lockstep.
- Smallest fix in `npc-crowd.js:41`:
  - measure from the point as moved so far: `const sx=x+wx-placedX[i],sz=z+wz-placedZ[i]`;
  - in the coincident case, use a per-slot angle instead of yaw: `const a=placedX.length*2.39996`, then `wx+=Math.cos(a)*SEPARATION;wz+=Math.sin(a)*SEPARATION`.
  
  Add a 3-person case to a test, using a fake createCharacter as in my sim.

### 3. night-lights fails because the test's rule is stale. No scene object leaks. TEST WRONG. CONFIRMED (booted and diffed)
- The 19 objects come from the 9 pooled crowd characters being re-skinned (`npc-crowd.js:61-62` `slot.avatar.apply(lookOf(person))`) as different people come into range near the Eastbank worktruck between noon and 20:00.
- The diff by type, noon to 20:00:
  - +17 `Object3D:*_end` nodes: the male rig has 18 non-bone Object3D nodes per CharacterArmature, the female rig 1, so a slot switching from female to male adds 17;
  - SkinnedMesh parts: Formal -20, Worker +12, Casual_Hoodie +10.
- The count of CharacterArmature nodes stays at 22. Over 3 full day cycles the counts come back exactly (noon 3718, 20:00 3754 in my run), so nothing grows.
- Excluding only bones and SkinnedMeshes still leaves 17, because of the `_end` markers.
- Smallest fix in `tests/night-lights.mjs`, the `objects()` helper: skip character internals, e.g. `scene.traverse(o=>{for(let p=o;p;p=p.parent)if(p.isSkinnedMesh||p.name==='CharacterArmature')return;n++})`. Or exclude the crowd slot groups.
- The game code needs no change for the test, but see finding 4.

### 4. Changing a pooled character's body (male to female) leaks GPU memory and costs a hitch. MINOR (memory grows over a session). CONFIRMED (read)
- `dist/character.js:133-141` build() removes the old model but:
  - never disposes the old meshes' cloned materials. `Object.assign(kinds,{...meshes:[]})` at :141 runs before applyParts, so the dispose loop at :169 only ever sees the new, empty list;
  - never calls `skeleton.dispose()`. In three r160 every skeleton gets a bone DataTexture (`three.module.js:30377`), so one texture leaks per body swap.
- build() also clones the whole rig and makes a new AnimationMixer with every clip action, which can hitch on a swap. Pool slots swap bodies routinely (finding 3 shows it happening between two times of day).
- Smallest fix:
  - in build(), before line 141: `for(const m of kinds.meshes||[])for(const mt of [].concat(m.material))if(mt.userData.cloned)mt.dispose();kinds.skeleton?.dispose();kinds.mixer?.uncacheRoot(kinds.model);`
  - in `npc-crowd.js:61`, prefer a free slot whose last person has the same `body` (fewer rebuilds).

### 5. Free planks from the warehouse racks: possible exploit. WRONG BEHAVIOUR. PLAUSIBLE (not played)
- `forest.js:63` says the take-from-rack prompt is offered "only while one of your orders still needs planks". But `game.js:612` offers it whenever you are on shift and the cell has planks (`on&&!pr.carry`). `need` only changes the label.
- Scenario: take 4, walk out, press X (they become your `plankDrops`), load them on your truck, then `unloadAtDock` → `deliverPlanks` (`forest.js:111`) pays $1 a plank and adds them to stock. Repeat.
- Smallest fix: add `need.some(n=>n>0)&&` to the condition at `game.js:612` (forbidden file: requested edit). Or forbid leaving the warehouse with rack planks.

### 6. Delivery fallback can take another order's planks off the truck, and drops the order tag on a partial stack. MINOR. PLAUSIBLE (old saves only)
- `cargo.js:133-136` removePlanks counts and removes every plank, order planks included. When it splits a stack, it writes `{k:'planks',n:p.n-t}` without `o`.
- `game.js:363` uses it when `tagged.count<k.planks` (not only when it is 0), and `game.js:244` when an order fails.
- Scenario: a truck with order A tagged and some untagged planks from an old save. A partial tag count makes the fallback remove the last k.planks planks, which may belong to order B or to you.
- Fix: skip pieces with `o` in removePlanks (and keep `o` on a split), and use the fallback only when `tagged.count===0`.

### 7. Walkers blink out while their route is being worked out, and their pool slot is handed to someone else. MINOR. PLAUSIBLE
- `npc-crowd.js:25`: once the per-frame budget is used, `route()` returns null without caching it. `npc-walk.js:107` then reports 'hidden', and `npc-crowd.js:60` hides the person and frees the slot.
- When many trips start together (08:00, or after a teleport), people already drawn standing vanish for a few frames. Their slot can go to someone else, which forces a re-skin (and finding 4's cost).
- Fix: when `route` is null and `e.shown`, keep the last pose (`continue` without hide), or fall back to the plain straight route.

### 8. Pacing and separation ignore walls. MINOR. CONFIRMED (read; already noted as handoff item (d))
- `npc-walk.js:98` paces 2.4 m along world x only, with no `blocked` check.
- `npc-crowd.js:40-43` adds the separation and personal-space push without checking `blocked`.
- Doors whose street runs along z, and people pushed toward a building front, can end up inside walls.
- Fix: inject `blocked` into personPose's ctx and flip or zero the pace direction when its far end is blocked; clamp the push the same way.

### 9. Per-frame allocations. MINOR. CONFIRMED (read)
- `game.js:1580`: `pedestrians.people.filter(...).map(...)` on every physics substep while driving.
- `game.js:1620`: three `new THREE.Vector3`/`clone` per frame while an in-world talk panel is open.
- `npc-crowd.js:69` talkable: an array, one object per person and a sort every frame while you stand near a roster person. It is called from the interaction pass at `game.js:644`.
- crowd `update` itself, `personPose` and `routePoint` do not allocate. The roster plan is cached (`npc-dialogue.js:137-147`).

## Checked and fine (short)
- **Parcel in vehicle beds** (`gig-parcel.js:22-29`, `game.js:820`, `game.js:909`):
  - you cannot get in while carrying, and a held parcel with a loaded bed is refused (RACK_BUSY);
  - the parcel is drawn at the bed centre only while you are seated, and the bed's cargo cannot change while you are seated (loading needs your hands or the forklift, so you must be out). The saved state stays `drop:null`, so leaving the vehicle gives it back to your hands with no copy and no loss.
  
  Not checked visually: the carton's origin height against `BEDS[model].y`. Still open (as the handoff says): a parcel in a car cab, and a loaded bed that has room left.
- **Talk anchored to a pooled avatar:** showDialog sets `modal=true` (`game.js:514`), and stepWorld skips `npcCrowd.update` while modal (`game.js:1585-1589`). So the slot cannot be given to someone else during a conversation, and the camera anchor is safe.
- **cargo.js:** unloadOne and unloadKind skip order planks correctly, loadCarry refuses a mixed crate and timber load, and normalizeCargo trims to the space available.

## What I did NOT get to
- Playing the warehouse case in a browser or booted test (finding 1 is traced, not reproduced). I did not check whether the 18:00 closing throws the player out of the warehouse.
- The exploit in finding 5 end to end (lumberyard dock reach and pay).
- schedule.js and population.js logic in depth (only their tests were run). NPCs stuck on routes on the real map (that is stage N1's job). Pool starvation when more than 9 people are in range (entries are served in list order, not nearest first).
- `neighborhood.js` (the six named pedestrians) and hal.js interplay. Whether a slot ever shows the default 'Casual_2' look for a frame (by reading, apply runs before show, so it should not).
- How the stowed parcel sits on each bed (clipping), and the whole of the cargo-view drawing.
- The full `npm test`.
