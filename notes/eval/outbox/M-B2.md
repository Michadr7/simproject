michadr.

# M-B2 Warehouse Timber Machine Pass 2 Report (Hydrogen)

Upgraded `assets-src/timber-machine/timber_machine.blend` and re-exported `timber_machine.glb` per `notes/eval/prompts/hydrogen-machine-pass2.md` (touchscreen control panel, stack light, calmed paint, industrial details).
No `dist/` files, `ASSETS.md`, `PROJECT-INDEX.md`, or shared game files were edited. Product models (`post.glb`, `beam.glb`, `dowel.glb`) and sounds (`assets-src/sounds-timber-machine/`) from Pass 1 are unchanged.

## What Changed
1. **Touchscreen Control Panel on Swing Arm (`Screen`, `Screen_Glow`):**
   - Removed `Mode_Knob`, `Run_Lever`, and the 3 cube lamps (`Lamp_Post`, `Lamp_Beam`, `Lamp_Dowel`).
   - Added a standing-height pedestal and short swing arm beside the infeed (`anchor_operator` at `(-0.62, 0, 1.25)` in glTF), holding a slim bezel tilted `-20 deg` (`-0.35 rad`) upward toward a 1.8 m operator.
   - `Screen` is its own 2-triangle flat 16:10 quad (`0.42 x 0.26 m`) with its own plain dark material `Screen_Mat` (no baked texture), local normal `(0, 0, 1)`, and clean `0..1` glTF UVs (`(0,0)` BL -> `(1,1)` TR) ready for `THREE.CanvasTexture`.
   - `Screen_Glow` is a separate emissive bezel strip (`Screen_Glow_Mat`) below the screen.
   - Physical button strip under the bezel keeps ONE red E-stop mushroom button on a yellow collar, plus small green Start and red Stop buttons.
2. **Three-Colour Stack Light (`Lamp_Green`, `Lamp_Amber`, `Lamp_Red`):**
   - Added a vertical andon stack light mast on top of the hood (`y = 1.56..1.83` m) with 3 independent emissive cylindrical lenses (`Lamp_Green`, `Lamp_Amber`, `Lamp_Red`, each with its own same-named material) so machine state reads from across the warehouse hall.
3. **Paint, Bevels & Industrial Detail:**
   - Calmed paint to muted industrial grey-green cabinet + sage hood with **one** safety-orange accent on the Posch peeler feed throat collar.
   - Added `"EDEN RIDGE TIMBER"` printed nameplate on the front upper hood fascia (512x512 `machine_atlas.png`).
   - Placed HSE hazard stripes only on the infeed and outfeed throat mouths.
   - Opened the front inspection bay so `Lathe_Chuck`, `Lathe_Carriage`, and `Cutter_Head_Top` are clearly visible; added an angled steel outfeed product chute, bevels on the main cabinet/hood/bezel, side conduit pipe, armoured flex cable into the pedestal, and bolted floor anchor plates.

## Triangle Count & Node List (`timber_machine.glb`)
- **Triangles:** **1,790** (under the 1,800 budget; 363,220 bytes).
- **Materials (6):** `MachineAtlasMat`, `Screen_Mat`, `Screen_Glow_Mat`, `Lamp_Green`, `Lamp_Amber`, `Lamp_Red`.
- **Nodes (22 including root + empties):**
  - Root: `TimberMachine`
  - Static merged body: `Machine_Body`
  - Touchscreen & stack light: `Screen`, `Screen_Glow`, `Lamp_Green`, `Lamp_Amber`, `Lamp_Red`
  - Existing animated nodes (preserved): `Roller_In_0..3`, `Roller_Out_0..1`, `Cutter_Head_Top`, `Lathe_Chuck`, `Lathe_Carriage`, `Chip_Fill`
  - Empties (preserved): `anchor_infeed`, `anchor_outfeed`, `anchor_operator`, `anchor_sound`, `anchor_chips`

## Preview Paths (`assets-src/timber-machine/`)
- `preview_machine.png` (front 3/4 view)
- `preview_machine_rear.png` (rear 3/4 view: dust manifold, chute, open chip hopper)
- `preview_machine_panel.png` (close-up of touchscreen, `Screen_Glow`, buttons, and `"EDEN RIDGE TIMBER"` plate)
- `preview_machine_scale.png` (next to a 1.8 m person-height reference box at `anchor_operator`)
- Updated spec: `assets-src/timber-machine/README.md` (31 lines)

## Verification & What Could Not Be Verified
- **Verified:**
  - Blender 5.2.3 LTS build + export completed (`TRI_COUNT_PASS2 timber_machine: 1790`).
  - GLB binary inspection confirmed all 22 nodes, 6 materials, and `Screen` quad `POSITION`, `NORMAL (0,0,1)`, `TEXCOORD_0 (0,0)->(1,1)`, and `-20 deg` upward tilt.
  - Visual inspection of all 4 new EEVEE previews (`preview_machine*.png`) confirmed zero mesh poke-through on `Screen`, upright `"EDEN RIDGE TIMBER"` text, clean silhouette/paint, and 1.8 m operator standing ergonomics.
- **Could NOT verify:**
  - Live `THREE.CanvasTexture` projection in Three.js / browser (`dist/` untouched; deferred to M-C).
  - `npm test` (not run as `dist/` was not modified).
