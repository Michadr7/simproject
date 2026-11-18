michadr.

# M-B Warehouse Timber Machine Models & Sounds Report (Hydrogen)

Created the Blender 5.2.3 LTS asset bundle (`timber_machine.glb`, `post.glb`, `beam.glb`, `dowel.glb`, `.blend` source, 256x256 atlases, 6 EEVEE preview PNGs, and node spec) in `assets-src/timber-machine/`, and 5 CC0 Ogg Vorbis audio clips (`machine-start`, `machine-idle`, `machine-cut`, `machine-stop`, `machine-switch`) in `assets-src/sounds-timber-machine/`.
No `dist/` files, `ASSETS.md`, `PROJECT-INDEX.md`, or shared game files were edited.

## Files Created

### 1. Models in `assets-src/timber-machine/`
- `timber_machine.blend` (Blender 5.2.3 LTS source containing the machine hierarchy and the 3 products)
- `machine_atlas.png` (256x256 procedural 4x4 atlas: teal-green steel, safety orange, cast iron, brushed steel, HSE yellow-black hazard stripe, guard grille, control panel, red E-stop/lever, yellow collar, wood chips, pine accent)
- `timber_atlas.png` (256x256, copied from `assets-src/timber/timber_atlas.png` so posts/beams/dowels match existing logs and boards)
- `timber_machine.glb` (168,948 bytes, **1,376 triangles** — under the 1,500-triangle cap)
- `post.glb` (68,184 bytes, **44 triangles**, `1.150 x 0.200 x 0.200 m`)
- `beam.glb` (69,828 bytes, **44 triangles**, `1.150 x 0.180 x 0.180 m`)
- `dowel.glb` (67,576 bytes, **28 triangles**, `1.150 x 0.055 x 0.055 m`)
- Previews: `preview_machine.png`, `preview_machine_rear.png`, `preview_machine_panel.png`, `preview_post.png`, `preview_beam.png`, `preview_dowel.png`
- `README.md` (31 lines, full node list, animation axes, lamp materials, anchors)

#### Machine Reference Fidelity & Separate Animated Nodes
- **Wood-Mizer MP360 + UK HSE WIS40:** Industrial steel cabinet (`Machine_Body`), 4 infeed rollers (`Roller_In_0..3`), 2 outfeed rollers (`Roller_Out_0..1`), top 4-head safety guard hood with open inspection window, HSE hazard stripes at tunnel mouths, 3 top dust-extraction ports + manifold, and red E-stop on a yellow collar.
- **Woodlandia LL-700:** Visible `Lathe_Chuck` (3-jaw, spins on local `X`), upper guide rail, tailstock, and sliding `Lathe_Carriage` (`X` travel `-0.35..+0.35`) plus `Cutter_Head_Top` (`Z` spin).
- **Posch post peeler:** Open 4-wall flared feed throat collar on the infeed mouth and rear chip chute feeding an open-top hopper with scalable `Chip_Fill` (`0.001..1.0` on local `Y`).
- **Operator Panel:** `Mode_Knob` (`-45 / 0 / +45 deg` on local `Z`), `Run_Lever` (local `X`), and 3 independent emissive lamp meshes/materials (`Lamp_Post`, `Lamp_Beam`, `Lamp_Dowel`).
- **Anchors:** `anchor_infeed`, `anchor_outfeed`, `anchor_operator`, `anchor_sound`, `anchor_chips`.

### 2. Sounds in `assets-src/sounds-timber-machine/` (96.8 KB total, all CC0 1.0)
Processed via Blender 5.2 `aud` + `numpy`: mono, 22.05 kHz, Ogg Vorbis, DC offset removed. Loops use 0.30 s equal-power tail-to-head cross-fade normalised to `-20.0 dBFS` rms; one-shots normalised to `-4.0 dBFS` peak.
- `machine-start.ogg` (2.00 s, 14.9 KB) — Freesound 411222 (`iternetcone`, CC0) electric motor spin-up
- `machine-idle.ogg` (4.20 s loop, 26.7 KB, `cv=0.076`) — Freesound 380212 (`lunchmoney`, CC0) thickness planer free-running idle
- `machine-cut.ogg` (4.20 s loop, 29.3 KB, `cv=0.051`) — Freesound 380212 (`lunchmoney`, CC0) thickness planer actively cutting wood
- `machine-stop.ogg` (3.20 s, 20.3 KB) — Freesound 380212 (`lunchmoney`, CC0) thickness planer spin-down
- `machine-switch.ogg` (0.40 s, 5.6 KB) — Freesound 556634 (`cookies+policy`, CC0) rotary selector klunk
- `README.md` (15 lines, full SND1/SND2 source/URL/cut/loudness table)

## Requested Edits for Later Stages (M-C / Audio Wiring — Not Made Here)
1. **Copy assets into `dist/`** when M-C lands:
   - `assets-src/timber-machine/{timber_machine,post,beam,dowel}.glb` -> `dist/assets/timber/` (or `dist/assets/timber-machine/`)
   - `assets-src/sounds-timber-machine/*.ogg` -> `dist/assets/sounds/`
   - Append the `M-B` model and sound entries to `ASSETS.md`.
2. **`dist/timber-sounds.js` & `dist/audio.js`** (Opus / M-C):
   - Export `TIMBER_MACHINE = freeze({start:'machine-start', idle:'machine-idle', cut:'machine-cut', stop:'machine-stop', switch:'machine-switch'})` and include in `TIMBER_FILES` / `ALL_FILES`.
   - Reuse the `sawmill` / `chainsaw` pattern in `dist/audio.js` (`machine({active, cutting, at, listener})` using `attenuate(distance(listener, at))`, playing `machine-start` on switch-on, cross-fading `machine-idle` / `machine-cut`, and playing `machine-stop` on switch-off; `machine-switch` shot on mode change).
3. **Warehouse placement (`dist/warehouse.js` / `dist/game.js`, Opus M-C):**
   - Load `timber_machine.glb` with `GLTFLoader` (same pattern as `rigged-props.js` / `timber/*.glb`), place inside the warehouse hall clear of shelving aisles and dock door (e.g. east or west floor bay), and drive the named nodes listed in `assets-src/timber-machine/README.md`.

## Verification & What Could Not Be Verified
- **Verified:**
  - Blender 5.2.3 LTS build completed cleanly (`TRI_COUNT timber_machine: 1376`, `post: 44`, `beam: 44`, `dowel: 28`).
  - GLB binary headers, exported node names, material names, and Y-up dimensions (`post: 1.15 x 0.20 x 0.20 m`, `beam: 1.15 x 0.18 x 0.18 m`, `dowel: 1.15 x 0.055 x 0.055 m`) verified directly from the `.glb` files.
  - Visual inspection of all 6 EEVEE preview PNGs (`preview_machine.png`, `preview_machine_rear.png`, `preview_machine_panel.png`, `preview_post.png`, `preview_beam.png`, `preview_dowel.png`) confirmed clean UVs, open Posch peeler feed mouth, visible lathe chuck/carriage inside the guard bay, open-top chip hopper with `Chip_Fill`, and upright selector/lamps/lever/E-stop.
  - All 5 Freesound source pages verified `Creative Commons 0` from fetched page HTML; `.ogg` files encoded and measured via `numpy` (`-20.0 dBFS` rms loops, `-4.0 dBFS` peak one-shots).
- **Could NOT verify:**
  - **Audio by ear:** Cut points and loop stability were chosen by RMS, CV, and spectral centroid measurements only; clips need an ear-check in a browser/player (especially the timbre transition from `411222` `machine-start` into `380212` `machine-idle`).
  - **In-game rendering & `npm test`:** Models and sounds are not wired into `dist/` yet (deferred to M-A/M-C).

## Confidence
- Models (`timber_machine.glb`, `post.glb`, `beam.glb`, `dowel.glb`, atlases, node pivots): **High**
- Sounds (`machine-*.ogg`, CC0 verification, levels/cross-fades): **Medium-High** (needs human ear-check for start->idle timbre match)
