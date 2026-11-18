michadr.

# PET3 actor report (`pet3-actor.md`)

## Files created or changed
- [dist/pet-actor.js](file:///c:/Users/Michael/Documents/Projects/simproject/dist/pet-actor.js) (201 lines, no BOM; header comment 75 chars): Three.js cat actor module (`createPetActor({THREE, GLTFLoader, url}) -> {load, group, pickRadius, visible, setPet, update, anchorPoint, dispose}`) plus pure exported helpers (`WALK_STRIDE`, `RUN_STRIDE`, `MAX_DT`, `ARRIVE_DIST`, `TURN_RATE`, `PICK_RADIUS`, `BACK_OFFSET_Y`, `clampDt`, `wrapAngle`, `strideSpeed`, `turnToward`, `stepLocomotion`, `scheduleClip`, `resolveAnchor`, `clearPetCache`):
  - **Shared GLB load & clone**: caches the `GLTFLoader.loadAsync` promise per resolved URL (`new URL(url, document.baseURI).href`), strips any lights, clones the rigged hierarchy (`cloneSkinnedScene`) sharing `geometry` and `material` while giving each actor an independent `Skeleton` and `AnimationMixer`, sets `castShadow = true`, `receiveShadow = true`, and `frustumCulled = false` on the `SkinnedMesh`.
  - **Stride-matched walk & zero-slide**: derived from `scripts/cat-v2.py` (`pose_walk` 1.0 s cycle): front stance paw travel `0.2428 m`, hind stance paw travel `0.2090 m` -> `WALK_STRIDE = 0.226` m per 1.0 s walk cycle (`0.226 * speed` m/s); `Run` uses `RUN_STRIDE = 2.4` m per `0.667 s` cycle (`~3.598 m/s`). Clamps `dt` to `MAX_DT = 0.1`, smooths yaw exponentially toward travel (`TURN_RATE = 10` rad/s), and switches to `'idle'` on arrival (`ARRIVE_DIST = 0.03` m).
  - **Crossfade & no-restart**: uses `blendTime(from, to)` from `dist/pet-view.js`, never restarts or resets an active matching clip (only updates `setEffectiveTimeScale` if speed changes), and sets `LoopOnce` + `clampWhenFinished` for one-shot clips (`Meow`, `Stretch`, `Lie_Down`, `Get_Up`).
  - **Anchors, visibility & zero per-frame allocation**: exposes `anchorPoint('mouth'|'head'|'back')` (reading `anchor_mouth`, `anchor_head`, and `spine2` + `BACK_OFFSET_Y = 0.07`, with rotated pre-load fallback), `pickRadius` (`0.35`, matching `CAT_RADIUS`), and `visible` getter/setter wired to `group.visible`. Reuses `stepOut` and `anchorOut` with zero per-update allocations.
- [dist/assets/pets/cat.glb](file:///c:/Users/Michael/Documents/Projects/simproject/dist/assets/pets/cat.glb) (630,880 bytes, exact copy of [assets-src/cat/cat_v2.glb](file:///c:/Users/Michael/Documents/Projects/simproject/assets-src/cat/cat_v2.glb)).
- [tests/pet-actor.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/tests/pet-actor.mjs) (225 lines, no BOM): GLB header/JSON validation + unit & real-`THREE` integration tests.
- [PROJECT-INDEX.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-INDEX.md) and [PROJECT-BRIEF.md](file:///c:/Users/Michael/Documents/Projects/simproject/PROJECT-BRIEF.md): regenerated via `npm run index`.

## Packaging check (`scripts/package-release.mjs`)
- Checked [scripts/package-release.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/scripts/package-release.mjs), [scripts/build-launcher.mjs](file:///c:/Users/Michael/Documents/Projects/simproject/scripts/build-launcher.mjs), and [wrangler.jsonc](file:///c:/Users/Michael/Documents/Projects/simproject/wrangler.jsonc):
  - `package-release.mjs` only copies `dist/*.js`, `dist/style.css`, and `dist/vendor/*.js` into `dist/releases/<version>/`; `dist/assets/` stays at `dist/assets/` (just like `dist/assets/timber/*.glb`).
  - `wrangler.jsonc` serves `./dist` directly, and `build-launcher.mjs` copies `'assets'` recursively (`cpSync(..., {recursive: true})`).
  - Because `pet-actor.js` resolves `DEFAULT_CAT_URL` (`'assets/pets/cat.glb'`) against `document.baseURI`, **no edit to `scripts/package-release.mjs` is needed**.

## Tests and checks run (real output)
`node tests/pet-actor.mjs; node tests/pet-view.mjs; node tests/pets.mjs; npm run index; node tests/brief.mjs`:
```text
PASS pet-actor: GLB verified (630880B, 24 joints, 12 clips), stride/turn/crossfade/anchors, shared clone & zero-alloc update.
PASS pet-view: clipFor variety/sleep/hunger, nextWaypoint bounds/furniture, blendTime, petSnapshot validation, interiorSpawn, purity.
PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood

> city-life-local-multiplayer@0.35.21 index
> node scripts/build-index.mjs

brief 2834 tokens (target 3000), index 33778 tokens (target 34000); 232 modules, 14 generated, 291 tests, 30 scripts; 13 modules without a header comment
brief tests passed: 232 modules listed, brief 2834 and index 33778 estimated tokens (budgets 3000 and 34000)
```

## What I could NOT verify
- Parsing the real `dist/assets/pets/cat.glb` through `GLTFLoader` in Node: `GLTFLoader.loadImageSource` requires browser globals (`self.URL` and image decoding for the embedded JPEG albedo), so live `GLTFLoader` decoding + WebGL rendering of `cat.glb` was not run here. Instead, `tests/pet-actor.mjs` parses the real `cat.glb` binary/JSON chunk directly (confirming 630,880 bytes, 1 mesh/1 primitive with `mouth_open`, 24 joints, all 12 clip names matching `CLIP_IDS`, `anchor_mouth`, `anchor_head`, `spine2`, and 0 lights) and runs `createPetActor` with the real `dist/vendor/three.module.js` (`SkinnedMesh`, `Skeleton`, `AnimationMixer`, `AnimationClip`) against an in-memory stubbed GLTF scene.
- Full `npm run release -- --force` and full `npm test` suite were not run (only `dist/pet-actor.js`, `tests/pet-actor.mjs`, and `dist/assets/pets/cat.glb` were added; `game.js` was not touched).

## Exact ~10 lines to add to `dist/game.js` (and `dist/jobs.js` note)
1. In `dist/jobs.js` (when wiring save persistence): add `pets: normalizePets(raw?.pets)` (imported from `./pets.js`) to `freshProgress` / `normalizeProgress` if not already present.
2. In `dist/game.js` (10 lines total — imports, actor creation/load, `enterHome` spawn, `frame()` update, `candidates()` E-prompt, and multiplayer snapshot):
```js
import {createPetActor} from './pet-actor.js';
import {clipFor,nextWaypoint,interiorSpawn,petSnapshot} from './pet-view.js';
import {feed as feedPet,pat as patPet,moodOf,hungerOf} from './pets.js';
const catActor=createPetActor({THREE,GLTFLoader});let catWp=null,catStep=0;
if(globalThis.document?.baseURI)catActor.load().catch(e=>console.warn('Cat model missing: dist/assets/pets/cat.glb',e));
// inside enterHome(target=studioHome):
{const pet=GameState.progress.pets?.pet,hid=home.kind==='studio'?'studio':home.id,ok=!!pet&&pet.homeId===hid;catActor.visible=ok;if(ok){const sp=interiorSpawn(hid,home.room.layout||hid);catActor.setPet(petSnapshot(pet,{...sp,nowMinutes:gameMinutes(GameState.progress)}));home.room.scene.add(catActor.group);catWp=null}}
// inside frame(now), after updateZones(view):
{const pet=GameState.progress.pets?.pet,hid=home.kind==='studio'?'studio':home.id,show=inside&&(home.room.floor||0)===0&&pet?.homeId===hid;catActor.visible=show;if(show){const t=gameMinutes(GameState.progress),m=moodOf(pet,t),b=home.room.layout||{W:12,D:10};if(m==='walk'&&!catWp)catWp=nextWaypoint(b,pet.adoptedAt,catStep++);if(m!=='walk')catWp=null;const c=clipFor(pet,t,{moving:!!catWp,seed:pet.adoptedAt});if(catActor.update(view,{x:catWp?.x??catActor.group.position.x,z:catWp?.z??catActor.group.position.z,yaw:catActor.group.rotation.y,...c}).arrived)catWp=null}}
// inside candidates() under if(inside){ ... } before return all:
{const pet=GameState.progress.pets?.pet;if(floor===0&&catActor.visible&&pet){const need=hungerOf(pet,gameMinutes(GameState.progress)).stage!=='fed';add('cat',{x:catActor.group.position.x,z:catActor.group.position.z},()=>catActor.anchorPoint(need?'mouth':'head'),need?`Feed ${pet.name}`:`Pet ${pet.name}`,()=>{const t=gameMinutes(GameState.progress),r=need?feedPet(pet,t):patPet(pet,t);if(r.ok){GameState.progress={...GameState.progress,pets:{...GameState.progress.pets,pet:r.pet}};persist()}else toast(need?`${pet.name} is not hungry.`:`${pet.name} just had a pat.`)},1.15+catActor.pickRadius)}}
// when sending multiplayer state (if syncing pets):
// petSnapshot(GameState.progress.pets?.pet,{x:catActor.group.position.x,z:catActor.group.position.z,yaw:catActor.group.rotation.y,nowMinutes:gameMinutes(GameState.progress)})
```

## Confidence per part
- `dist/pet-actor.js` (stride/turn/crossfade/anchors/clone-safe cache/zero-alloc `update`): **High** — unit-tested and exercised with real `THREE.AnimationMixer`, `SkinnedMesh`, and `Skeleton` in `tests/pet-actor.mjs`.
- `dist/assets/pets/cat.glb`: **High** — byte-identical to `assets-src/cat/cat_v2.glb` (`630,880` bytes), GLB JSON verified (`24` joints, `12` clips, `mouth_open`, anchors, `0` lights); live browser GLTFLoader render awaits PET3 `game.js` wiring.
- `game.js` ~10-line wiring snippet: **High** — checked against live symbols in `dist/game.js`, `dist/pet-view.js`, and `dist/pets.js`; not executed inside `game.js` directly per `AGENTS.md` boundary.
