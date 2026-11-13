# Character swap G1: the Grab3D man and woman, findings and design

Written 2026-11-12 by the G1 build run (plan `2026-11-13-character-swap-g1-inspect-the-grab3d-man-and-woman`, revision 1).
No game code and nothing in `assets-src/` was changed.

**How the files were read.** The run's shell only allows `npm test`, so no script, Blender or image tool was used. Both GLBs were read
directly: a GLB starts with its glTF JSON in plain text, which holds every structural fact below (meshes, materials, skins,
animations, accessor counts, byte lengths, the node's `extras`). Things that need the pixels or the vertices themselves (texture
dimensions, the exact pose, facing, normals, fingers) are marked **not verified** and are the first checks of G2.

## 1. Findings

### The short answer
Both files are **static, single-mesh scans with no skeleton and no animation**. They cannot be dropped onto the current
character system as they are: rigging them is the main job, and it can't be done in this repo's Node tooling alone.

### Side by side

| | man-base-character.glb | woman-base-character.glb |
|---|---|---|
| Generator / source | glTF-Transform 4.5.1; `extras`: "Created by grab3d", grab3d.com, licence **CC0-1.0**, created 2026-10-29 | same |
| Meshes / primitives | 1 mesh, 1 primitive (`man-base-character`) | 1 mesh, 1 primitive (`woman-base-character`) |
| Materials | 1 (`Material_0`, PBR, `doubleSided: true`) | 1 (same layout) |
| Vertex attributes | POSITION, NORMAL, TEXCOORD_0 only (no JOINTS_0 / WEIGHTS_0) | same |
| Skins (skeletons) | **none** (no `skins`, no bones; the scene has one node) | **none** |
| Animations | **none** (no `animations` array) | **none** |
| Vertices | 143,446 | 166,130 |
| Triangles | **262,348** (787,044 indices, 32-bit) | **305,702** (917,106 indices, 32-bit) |
| Bounding box (m), x × z × y | 1.081 × 0.342 × **1.800 tall** | 0.903 × 0.303 × **1.680 tall** |
| Feet at | y = 0.00007 (stands on the origin) | y = 0.00013 |
| Units / up | metres, +Y up (glTF standard) | same |
| Node offset | translation (0.0001, 0, -0.0247) | (0.0033, 0, -0.0317) |
| Textures | 3 JPEGs, all embedded: base colour 2,658,622 B, normal map 1,057,140 B, metal-rough 895,721 B (**4.61 MB**) | 3 JPEGs, embedded: 2,456,674 B, 991,387 B, 827,198 B (**4.28 MB**) |
| Geometry bytes | 4.59 MB vertices + 3.15 MB indices = **7.74 MB** | 5.32 MB + 3.67 MB = **8.98 MB** |
| GLB size | ~12.35 MB (binary chunk 12,349,944 B) | ~13.26 MB (13,259,856 B) |
| **Embedded like `character-male.js`** (base64 = ×4/3) | **≈ 16.5 MB** | **≈ 17.7 MB** |

For comparison, the current `character-male.js` / `character-female.js` are 1.4 to 1.8 MB, and each holds 6 to 8 outfits plus 7 clips.

### Answers to the plan's questions
- **One mesh or parts?** One mesh. Head, clothes, hands and shoes are one surface with one material. **Materials are not separate:**
  skin, hair and clothes are painted into a single base-colour texture, so tinting skin or hair the way `applyParts` does
  (`material.userData.role`) is impossible. The only route to a tint is a hand-painted mask texture plus a shader change
  (not proposed here).
- **Skeleton?** None. No bone names, bone count, rest pose or bind matrices exist to compare. The Quaternius rig that `character.js`
  expects (parts `Head`, `Body`, `Legs`, `Feet`; bones `Body`, `Abdomen`, `Torso`, `Chest`, `Head`, `Head_end`,
  `UpperArm/LowerArm/Wrist` L/R, `UpperLeg/LowerLeg` L/R, the foot control bones `FootL/FootR`, the poles `PTL/PTR`, and
  `Thumb/Index/Middle/Ring/Pinky<n>` L/R) has no counterpart at all.
- **Scale:** already metres. The man is 1.80 m, the woman 1.68 m. The game's male player is about 1.95 m (`MODEL_SCALE = .0104`
  on the Quaternius centimetre rig). To keep the camera, reach targets, seats and mouth position the same, scale the man ×1.083
  and the woman by the same factor (to ≈1.82 m), so the pair keeps its real height difference.
- **Rest pose:** **probably an A-pose (not verified).** The width is 60% of the height for the man (1.081 / 1.800) and 54% for the
  woman. A T-pose would be about as wide as tall (≈1.8 m); arms at the sides would be about 0.5 m. Working back from typical arm
  length, the arms hang roughly 25 to 30° out from the body.
- **Facing:** **not verified.** The box is nearly symmetric front to back (z ±0.171 m man, ±0.151 m woman), so the JSON doesn't
  show which way the model faces. glTF convention and the current rig both use +Z forward; G2 must check this with a render.
- **Clips:** none. Not Idle, not Walk, not Run.
- **Problems found, or still to check:**
  1. *No rig and no clips* (the blocker).
  2. *Far too heavy:* 262k and 306k triangles per character, roughly 20 to 40 times a normal game character. One player alone
     is fine on the user's GPU, but the shop clerks, office clerk and pedestrians all come from `createCharacter`. The base64 size
     (16 to 18 MB each) would also make startup about ten times slower. Both need decimating to about 10 to 15k triangles
     and the textures shrinking (see the build steps).
  3. *Texture pixel size:* **not verified** (the run couldn't decode JPEG headers). At 2.4 to 2.7 MB a base-colour JPEG is
     most likely 2048² or 4096².
  4. *Fingers/hands:* **not verified.** A scan this dense will have hands, but scanned and generated meshes often fuse the fingers
     into one shape. If so, the finger curl (`applyGrip`) becomes a mitten closing, which still works.
  5. *Normals:* a NORMAL attribute is present. `doubleSided: true` hides inside-out faces from view but not from lighting, so
     flipped normals can't be ruled out from the JSON. Turn double-siding off once a render shows the normals are fine; it saves
     back-face shading.
  6. *Textures embedded:* yes, all three are in the GLB (`bufferView` images), so nothing is missing.
  7. *Credits:* CC0, but `credits.js` needs an entry (a test fails without one). Per the standing note, the wording can wait until
     the public release.

## 2. Recommended design

### Choice: option 1 (fixed-look bodies `male2` / `female2`), rigged onto a copy of the Quaternius skeleton
- **Option 2 (modular mapping) is ruled out:** each model is one mesh with one material, so there are no parts to map.
- **Option 3 with a foreign skeleton** (for example an auto-rigger's `mixamorig:*` bones) would need a bone-name map for about
  25 names in `character.js`, a retarget of every clip across different rest poses and bone axes, a new finger list, and new
  foot-control handling. `solveLeg` depends on the Quaternius `FootL/FootR` control bones, and other rigs don't have them. That's
  the riskiest path.
- **Recommended:** rig each scan in Blender onto **the Quaternius armature itself** (same bone names, same hierarchy, same bone
  axes), skin it with automatic weights, and export a skinned GLB. That makes option 3's bone map the identity: the existing
  clips, IK, grip, lean, crouch and seated code work unchanged. The creator then offers each new body as one fixed look (option 1).
- **Main risk:** the clips are local rotations and only transfer cleanly if each bone keeps the Quaternius bone's orientation.
  The scan's A-pose and different limb lengths have to be handled when binding: pose the armature to the A-pose, bind, deform
  the mesh into the rig's rest pose, then rebind at the original rest. The moving clip tracks (the hips' `Body` position and
  the `FootL/FootR` positions) are in rig centimetres and may need scaling by the leg-length ratio. G2 is a spike that proves
  this on the man before anything else is built.
- **Fallback if G2 fails:** an external auto-rigger plus a bone-name map (option 3). Uploading the models to a web service
  needs the user's yes first.

### What each file would need

**`dist/appearance.js`**
- `BODIES` gains `['male2', …]` and `['female2', …]` (labels are the user's call; for example "Man (scan)", "Woman (scan)").
- A new `FIXED_BODIES` set and `hasParts(body)`. Today `OUTFITS[body] || OUTFITS.male` would silently give `male2` the men's
  outfits, so every helper must check `hasParts` first:
  - `partChoices` and `quickOutfits` return `[]` for a fixed body.
  - `randomLook` leaves the parts alone and only randomises the colours (or returns its input).
  - `normalizeAppearance`: for a fixed body, keep `head/top/legs/feet` if they are any known outfit id (male or female), otherwise
    the defaults. Skin and hair are still stored, so switching back to `male`/`female` restores them. Every field stays present,
    so the save shape doesn't change.
- **Save format:** keep the key `citylife.character.v1` and `version: 2`. Adding body ids is additive, and old v1/v2 saves load
  exactly as now. A new save with `body: 'male2'` opened by an older release falls back to `male` through `normalizeAppearance`.
  That's graceful, so no version bump is needed. `profile.js` only reads `name`, so it's unaffected.

**`dist/character.js`**
- `loadCharacterAssets` loads `character-male2.js` and `character-female2.js` as well. Load them **lazily** (only when a fixed body
  is chosen or worn), so the startup path doesn't grow for players who never use them.
- `extract`: a fixed body has one skinned mesh and no `Head/Body/Legs/Feet` part groups. Store it as one record (for example
  `parts.set('__whole', …)`).
- `applyParts`: for a fixed body, add the one mesh and skip roles and tinting. It keeps its own textured material.
- `build`: the scale per body becomes data (`MODEL_SCALE` per kind) instead of one constant. Everything else (bone lookups, clips,
  `bindEnd`, `idleLocal`, finger grip, hand socket, mouth) runs unchanged if the bone names match.
- Fallback for a missing `Head_end`: already handled (the female rig lacks it).
- If the hands turn out fused, `gripFingers` still fills from the `Sprint` clip's finger tracks. Nothing to change.

**Creator UI (`dist/game.js` around the preview avatar, `dist/index.html`)**
- The body selector shows four bodies.
- For a fixed body: hide or disable the part rows, the quick-outfit buttons and the skin/hair swatches, and show one line such as
  "Fixed look: no outfit or colour choices". "Random" only changes the name-free bits, or is disabled.
- `tests/creator.mjs` grows cases for the fixed bodies.

**`scripts/build-characters.mjs`**
- Leave the Quaternius path alone. Add a separate script, `scripts/build-scan-characters.mjs`, that takes the rigged GLB from
  Blender and writes `dist/character-male2.js` / `character-female2.js`:
  - decimate to about 12k triangles (meshoptimizer `simplify`, already used by `build-props.mjs` through `TOOL_DIR`)
  - textures resized with `sharp` to 1024² base colour, the normal map at 512² or dropped, metal-rough dropped (roughness .85
    as on the Quaternius materials)
  - the Quaternius clip set attached by name, the same 7 clips as today
  - a round-trip check like the existing one
  - **target ≤ 2 MB base64 per body**
- The Blender step (rigging) lives in `scripts/rig-scan.py`, which the user runs with `blender -b -P`. The agent can't run Blender.

**Tests:** appearance round trips (old v1/v2 saves, new fixed bodies, a fixed body falling back to `male` when the id is
unknown), the character build check (bones present by name, 7 clips), and a size guard on the new embedded files.

### Code that depends on Quaternius bone names, and how it works on the new rig
Every bone name is used inside `dist/character.js`. `game.js`, `consumption.js`, `shops.js`, `office.js`, `warehouse.js` and
`neighborhood.js` only call the API (`reach`, `hold`, `setLean`, `setCrouch`, `setSeated`, `setTwoHanded`, `alignHeld`,
`setHandCurl`, `mouth`), so they need no change. With the recommended rig (same names), every row below works as it is. The
"if names differ" column is what the fallback rig (option 3) would need.

| Code (character.js) | Bones used | On the recommended rig | If names differ (fallback) |
|---|---|---|---|
| `build`: arm IK setup, `idleLocal`, `rig.R/L` | `UpperArm/LowerArm/Wrist` L/R | unchanged | map 6 names; the wrist must be a child of the lower arm |
| `solveArm`, `startFromIdle` (reach, consumption's hand-to-mouth, seated reach, nozzle hold) | same arm bones | unchanged; elbow pole uses `rig.out` measured from the rest pose | as above |
| `placeHeld` and the hand socket (`hold`, tools, cups, nozzle, gas can) | `WristR`, `LowerArmR` | unchanged; the socket rescales to 1 m by the wrist's world scale | as above, then re-tune `grip` offsets if hand size differs |
| `gripWithLeft` (two-handed axe chop) | `WristR`, `UpperArmL` + left arm IK | unchanged | as above |
| `applyGrip`, `gripFingers` (tool curl, log-on-shoulder curl) | `Thumb/Index/Middle/Ring/Pinky<n>` L/R, plus the `Sprint` clip's finger tracks | unchanged; fused fingers curl as a mitten | map the finger names, or skip the curl (it degrades to an open hand) |
| `solveLeg` (walking, running, crouch knees) | `UpperLeg/LowerLeg` L/R, foot control bones `FootL/FootR`, `bindEnd` | unchanged; the foot position tracks may need scaling to the new leg length (G2 checks this) | other rigs have no foot control bones: use the ankle bone's animated position instead, or skip `solveLeg` |
| `applyArmSwing`, `applyTwist` (pedestrian swing, shoulder twist) | `FootR/FootL` (stride), `Torso`, `Chest` | unchanged | map `Torso/Chest` to two spine bones |
| `applyLean` (chop lean, `setLean`) | `Abdomen`, `Torso`, `Chest` | unchanged | map to three spine bones |
| `lowerBody` (crouch, `setCrouch`) | `Body` (hips) position | unchanged | map to the hips bone |
| `applySeated` (chairs, benches, office, café) | `UpperLeg/LowerLeg` L/R | unchanged | as legs |
| mouth position (`api.mouth`, eating and drinking) | `Head`, `Head_end` (optional) | unchanged | map `Head`; no end bone uses the 0.22 m fallback |
| `api.bone(name)` | any | no current callers in `dist/*.js` | — |
| clips (`Idle_Neutral`, `Walk`, `Run`, `Sprint`, `Interact`, `Wave`, `Idle`) | track names are bone names | unchanged (the same clips are attached) | retarget every clip (SkeletonUtils), the riskiest part |
| build script: foot reskin, `PTL/PTR`, finger tracks | `FootL/FootR`→`LowerLeg`, poles, fingers | the scan rig must keep `PTL/PTR` and the foot control bones so the clips' tracks find targets; the scan script drops pole tracks as today | — |

### Performance flag (before anything is built)
- As delivered: 262k / 306k triangles and 16.5 / 17.7 MB embedded, per character. **Not acceptable** for NPCs or startup.
- Target after G3: about 12k triangles (the player costs about +10k triangles over a Quaternius outfit, which is negligible at
  165 FPS), 1 draw call, 1 to 2 textures at 1024², ≤ 2 MB base64. Loaded lazily, so 0 MB at startup unless a fixed body is
  worn. NPCs keep the Quaternius bodies.

## 3. Build steps as small plans

| Plan | What | Model | Size | Sonnet? |
|---|---|---|---|---|
| **G2: rig spike (man only)** | `scripts/rig-scan.py` (Blender, run by the user): decimate a copy to about 12k triangles, fit the Quaternius armature (from the pack FBX) to the scan, A-pose bind then rebind at the rig's rest pose, export a skinned GLB outside the repo. First check facing, pose, fingers, normals and texture sizes with a render. Pass if Walk/Run/Idle look right in a throwaway viewer page. | Opus | M | No: rig maths and judgement; the user runs Blender |
| **G3: scan build script** | `scripts/build-scan-characters.mjs`: rigged GLB to `dist/character-male2.js`; texture resize and drop, attach the 7 Quaternius clips by name, round-trip check, size guard test (≤ 2 MB) | Sonnet | S | Yes, against the size and round-trip tests |
| **G4: appearance and save** | `appearance.js`: `FIXED_BODIES`, `hasParts`, `normalizeAppearance`/`partChoices`/`quickOutfits`/`randomLook` for fixed bodies; tests for old v1/v2 saves and new bodies (no version bump) | Sonnet | S | Yes: pure functions with tests (the save rules are decided above) |
| **G5: character.js support** | lazy load of the `*2` files, the whole-mesh part record, scale per body, untinted material; tests that a fixed body builds with all named bones and plays its clips | Sonnet | S/M | Yes, if G2 kept the bone names; otherwise Opus for the bone map |
| **G6: creator UI** | four bodies in the selector, part and colour rows hidden for a fixed body, the "Fixed look" line, `tests/creator.mjs` cases | Sonnet | S | Yes |
| **G7: woman** | run G2's script and G3's build for `woman-base-character.glb`, plus the credit entry | Sonnet (user runs Blender) | S | Yes, once G2's script is proven |
| **G8: play check and tune** | the user plays: chop, nozzle, eating, sitting, crouch; tune the scale, the grip offsets and the foot-track scaling if needed | Sonnet (Opus if the IK misbehaves) | S | Mostly |

Order: G2 first (everything depends on it, and its result may switch the design to the fallback), then G3, then G4 to G6
(independent of each other once G3 exists), then G7 and G8. Releases: anything under `dist/` needs `npm run release -- --force`
before `npm test` (tests run the packaged release).
