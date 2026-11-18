michadr.

# CAT-v2: Improved Cat Asset (`cat_v2.glb`) & CC0 Cat Sounds

Nothing was edited in `dist/` or shared repo files (`cat-finish.py`, `ASSETS.md`, `handoff.md`, etc. untouched). Nothing was run in Three.js or a browser.

## Files Created
- `scripts/cat-v2.py` (887 lines): reproducible Blender 5.2 build/render/glbcheck script reading `..\Assets Sim Project\cat.blend` (read-only).
- `assets-src/cat/cat_v2.blend`: working Blender 5.2 file with cleaned mesh, 24-bone rig, region-smoothed weights, `mouth_open` shape key, and 12 NLA-tracked actions.
- `assets-src/cat/cat_v2.glb` (**630,880 bytes**, ~616 KB): game-ready glTF 2.0 binary (`export_draco_mesh_compression_enable=False`, `export_optimize_animation_size=True`).
- `assets-src/cat/README.md` (48 lines): mesh, bone, anchor, clip, and preview specification.
- `assets-src/cat/preview_v2_*.png` (29 PNGs): `idle`, `sit`, `walk`, `eat`, `sleep` (curled, incl. `top`), `meow` from `front`/`side`/`rear`, `wireframe`, plus verification shots for `sit_groom`, `stretch`, `run_bound`, `run_tuck`, `lie_down`, `get_up`, `pet`.
- `assets-src/sounds-cat/` (7 Ogg Vorbis files + `README.md`, 17 lines): all CC0, mono, 22.05 kHz, 56 kbps, DC offset removed, all 8.2–30.5 KB (< 60 KB limit).

## What Changed vs PET1 (`Cat Game.glb`)

### 1. Mesh Cleanup & Triangle Budget (`8,295` -> `3,305` tris)
- Removed 42 floating Tripo shards/whisker tubes (`Comp 5..46`) and hidden internal snout fold (`Comp 2`), trimmed the unseen rear half of the internal oral pocket (`Comp 1`), and kept both green eyes (`Comp 3, 4`).
- Stripped paper-thin double-sided fins on both hind thighs, the dangling belly midline strip, protruding dark cheek blade tips, and inward-facing tail back-faces; tucked muzzle whisker spike and hanging chest-tip diamond cleanly into the body; welded the narrow belly midline seam and filled tight pinholes.
- Uniformly decimated with Blender Collapse Decimate to **3,305 triangles** (`1,767` Blender verts / `4,391` glTF verts after UV splits), keeping the silhouette, face, ears, paws, and fluffy tail intact.
- Bounds (glTF Y-up, facing +Z, feet on `y = 0`): `X: -0.105..+0.105` (`0.210 m` wide), `Y: 0.000..0.381` (`0.381 m` tall), `Z: -0.494..+0.216` (`0.709 m` overall without the deleted 1.7 cm stray whisker spike; `0.45 m` body length preserved).

### 2. Rig, Anchors & Skin Weights
- Kept the **24-bone rig** (`CatRig`, exact PET1 bone names): `root`, `spine1..3`, `neck`, `head`, `ear.L/.R`, `tail1..4`, `front_upper/lower/paw.L/.R`, `hind_upper/lower/paw.L/.R`.
- Corrected bone placement to match measured mesh geometry: `tail1..4` aligned to the true tail centerline (`z = 0.215..0.135..0.150`), `hind_*` aligned to the actual `+-0.080 m` hind stance, and `ear.L/.R` aligned to the actual ear cones.
- Region-partitioned weights + 2 edge-neighbor Laplacian smoothing passes (`max 4 influences`, `0 unweighted` vertices; eyes and mouth pocket locked 100% to `head`; tail `y > 0.210` isolated from hind legs; legs isolated from torso below `z = 0.115`).
- Added `mouth_open` Shape Key on `Cat` (smooth jaw/chin drop animated in `Meow` without adding a jaw bone).
- Kept `anchor_mouth` and `anchor_head` Empty nodes bone-parented to `head`.

### 3. Animation Clips (12 clips, 24 fps, loop-exact `frame[0] == frame[N]`)

| Clip | Type | Duration | Frames | Audited `min_y` (floor=0) | Notes |
|---|---|---|---|---|---|
| `idle` | Loop | `3.000 s` | `72` | `-0.0041 m` | Standing calm, 2 breaths, tail flick, left ear twitch, subtle head look |
| `walk` | Loop | `1.000 s` | `24` | `+0.0072 m` | Diagonal gait, hind paw ground dip fixed |
| `eat` | Loop | `2.000 s` | `48` | `+0.0008 m` | Front elbow crouch + neck/head dip, 4 chews; `anchor_mouth` at `0.081–0.083 m` (chin `~0.065 m`) |
| `pet` | Loop | `2.000 s` | `48` | — | Head tilted into hand, 6 Hz purr spine vibration, both ears twitch |
| `sleep` | Loop | `4.000 s` | `96` | `-0.0003 m` | Real curled-up sleep on belly/side, all 4 legs tucked flat, tail wrapped around flank, slow breathing |
| `Lie_Down` | One-shot | `1.250 s` | `30` | — | Transition from `idle(0)` -> `sleep(0)` |
| `Get_Up` | One-shot | `1.250 s` | `30` | — | Transition from `sleep(0)` -> `idle(0)` (head & chest lift first) |
| `Sit` | Loop | `3.000 s` | `72` | `+0.0048 m` | Hindquarters seated on floor, upright chest, alert head, tail curled beside |
| `Sit_Groom` | Loop | `3.000 s` | `72` | — | From `Sit(0)`: lifts left front paw, 3 licks, returns cleanly to `Sit(0)` |
| `Stretch` | One-shot | `2.000 s` | `48` | `-0.0017 m` | From `idle(0)`: deep front bow stretch, forearms forward, tail curved up -> `idle(0)` |
| `Meow` | One-shot | `1.000 s` | `24` | — | From `idle(0)`: head lifts, ears perk, `mouth_open` morph target opens jaw -> `idle(0)` |
| `Run` | Loop | `0.667 s` | `16` | `+0.0067 m` | Bounding feline gallop (~2.4 m stride cycle when driven at ~3.6 m/s) |

## Cat Sounds (`assets-src/sounds-cat/`, all CC0, mono 22.05 kHz Ogg Vorbis, 56 kbps)

- **One-shots**: `10 ms` fade-in, `30 ms` fade-out, peak `-4.0 dBFS`.
- **Loop (`cat-purr.ogg`)**: `0.30 s` equal-power tail-to-head cross-fade, `-20.0 dBFS` rms.

| File | Source (CC0 verified) | Author | Cut used | Size | Loudness |
|---|---|---|---|---|---|
| `cat-meow-1.ogg` | Freesound 110011 "cat meow" | tuberatanka | `0.15–1.25 s` (`1.10 s`) | `11,570 B` | peak `-4.0 dBFS`, rms `-16.1 dBFS` |
| `cat-meow-2.ogg` | Freesound 479272 "New Cat Meow 1" | steffcaffrey | `0.02–0.90 s` (`0.88 s`) | `9,280 B` | peak `-4.0 dBFS`, rms `-17.1 dBFS` |
| `cat-meow-3.ogg` | Freesound 66518 "meow9.wav" | freemaster2 | `0.18–1.08 s` (`0.90 s`) | `10,525 B` | peak `-4.0 dBFS`, rms `-17.1 dBFS` |
| `cat-meow-sad.ogg` | Freesound 500799 "Cat meow while in heat, crying or annoyed" | khenshom | `3.00–5.05 s` (`2.05 s`) | `22,970 B` | peak `-4.0 dBFS`, rms `-20.3 dBFS` |
| `cat-purr.ogg` | Freesound 126151 "Purr2a.wav" | Buskieboy | `1.20–4.70 s` (`3.20 s` loop, cv `0.217`) | `30,526 B` | rms `-20.0 dBFS`, peak `-2.1 dBFS` |
| `cat-hiss.ogg` | Freesound 485952 "Cat Hissing" | aunrea | `0.00–0.65 s` (`0.65 s`) | `8,224 B` | peak `-4.0 dBFS`, rms `-14.3 dBFS` |
| `cat-eat.ogg` | Freesound 496279 "8_Cat, eating granules.wav" | 16GPanskaZlochova_Eliska | `1.75–2.85 s` (`1.10 s`, 4–5 crunches) | `14,312 B` | peak `-4.0 dBFS`, rms `-32.5 dBFS` |

## What Could Not Be Verified
- **Audio by ear**: all 7 clips were selected and trimmed by RMS/peak/spectral-centroid/CV measurements (`numpy`) and verified by re-decoding `(22050.0, 1)` in Blender `aud`; nobody has listened to them yet (especially check `cat-meow-sad` tone and `cat-purr` loop seam by ear).
- **In-game / Three.js rendering**: `cat_v2.glb` was verified by headless Blender glTF re-import (`glbcheck`), JSON inspection (`meshes: ['Cat']`, `nodes: 28`, 12 animations, `weights` channel on `Meow`), and 29 Workbench preview PNGs; it has not yet been loaded in Three.js or `dist/`.

## Notes for PET3 (Game Wiring)
1. **Mapping clips & sounds to `dist/pets.js`**:
   - `hungerOf(pet, now).stage`:
     - `fed`: `idle` (loop), with occasional idle variety (`Sit` -> `Sit_Groom`, or `Stretch` one-shot on waking/idle).
     - `peckish`: `idle` / `Sit`, occasional `Meow` + random `cat-meow-1..3.ogg` when player approaches.
     - `hungry` / `starving` (`moodOf === 'walk'`): `walk` (or `Run` when rushing toward bowl/player), `Meow` + `cat-meow-1..3.ogg` (or `cat-meow-sad.ogg` when `warn1`/`warn2` fires).
     - `ranaway` event (`tick` / `tickPets`): play `cat-meow-sad.ogg` when lost-cat notification triggers.
   - `moodOf === 'eat'` (`EAT_MINUTES = 10`): loop `eat` and trigger `cat-eat.ogg` periodically while chewing.
   - `moodOf === 'purr'` (`PURR_MINUTES = 5`): loop `pet` + loop `cat-purr.ogg` softly while near the cat (or during pat interaction); trigger `cat-hiss.ogg` if startled/refused.
   - `moodOf === 'sleep'` (`23:00–06:00` unless hungry): play `Lie_Down` (`LoopOnce`, `clampWhenFinished = true`) -> crossfade to `sleep` (4 s loop). On waking, play `Get_Up` (`LoopOnce`, `clampWhenFinished = true`) -> crossfade to `idle` (optionally followed by `Stretch`).
   - Place `cat-v2` on bed/sofa/floor at surface Y (`y = 0` local to the resting surface); curled `sleep` sits flush on `y = 0`.
2. **Bowl height**: Fixed! `eat` crouches the front elbows so `anchor_mouth` sits at `y = 0.081–0.083 m` (chin `~0.065 m`) with all 4 paws at `y = 0`. Place a **normal 5–6 cm tall bowl** right in front of the cat (`anchor_mouth` aligns at roughly `z = +0.19 m` local forward, `y = 0.06 m`).
3. **Crossfade times**:
   - Use `0.20–0.25 s` crossfades between independent loops (`idle` <-> `walk` <-> `Run` <-> `eat` <-> `pet` <-> `Sit`).
   - Use `0.05–0.10 s` crossfades for exact-endpoint transitions (`idle` <-> `Lie_Down` <-> `sleep` <-> `Get_Up` <-> `idle`, `Sit` <-> `Sit_Groom`, `idle` <-> `Stretch`, `idle` <-> `Meow`) so there is no pop and minimal blending lag.
   - Drive `walk` at ~`0.9 m/s` (`0.45 m` body, ~2 body lengths/cycle) and `Run` at ~`3.6 m/s` (`2.4 m` per `0.667 s` cycle).
4. **Draw call, Morph Target & `frustumCulled = false`**:
   - `Cat` is **1 skinned mesh = 1 draw call** (3,305 tris, 24 bones, 1 material, 512×512 JPEG).
   - Set `mesh.frustumCulled = false` (or recompute bounding sphere after posing) because the tail extends `-0.494 m` behind origin and `sleep`/`Stretch` shift vertices relative to the rest pose bounding box.
   - `Meow` includes a glTF morph target (`mouth_open`, `weights` channel); Three.js `GLTFLoader` + `AnimationMixer` drives `mesh.morphTargetInfluences` automatically when playing the `Meow` clip.
