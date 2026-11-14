# Welding Tier 5: vehicle-scale products (design plan for the Blender render agent)

2026-11-14. Written for: the render (Blender) agent that builds the welding parts, in the same pipeline as Tier 1 to 4 (welding_tier4.py and its manifest). Read first: notes/welding-job-brief.md (the job and the Tier 1 to 4 rules). Everything here is a PROPOSAL until the owner approves it; scoring, pay and tier numbers are decided later by Opus. No game code is involved in this step: only Blender scripts, GLBs and one manifest.

## 1. What Tier 5 is
- Tier 5 = the vehicle-scale products Eden builds: an ATV frame, a utility trailer and a flatbed bed (difficulty 13 to 15). Tier 4 (difficulty 10 to 12) stays the seven small products.
- Unlock rule (proposal, Opus decides): after Tier 4 and with Eden reputation. The products are bare welded steel, no paint (painting is the separate Hall D job). Their parts come from the laser and CNC jobs (Hall B and C), so each stage lists "supplied parts" as cut tube, plate and machined brackets.
- Same mini-game as Tier 4: supplied parts, weld, the camera changes angle automatically, weld, repeat. Product scoring is forgiving (most welds correct earns the full price).
- New for Tier 5 (proposals, flagged for Opus): more stages (4 to 5) and more seams (18 to 30), seams on different parallel planes, underside and overhead seams, round tube joints (saddle/fish-mouth), (no weld-order rules: the owner decided they only matter if they "build" something).

## 2. AXES AND UNITS (read twice)
- Blender: **Z up, front is -Y, X to the right, metres**. Apply all transforms (location 0 where noted, rotation 0, scale 1) before export.
- Game point = **(x, z, -y)**: game X = Blender X, game up (Y) = Blender Z, game Z = -Blender Y. **Normals convert the same way as positions.** Seam paths, work-plane normals and camera/target points in the manifest are written in BLENDER coordinates (as in the Tier 4 manifest) and the game converts them.
- glTF export: Y up, apply modifiers, export the nodes with their names. The Blender front (-Y) becomes the game's +Z. The product's front (the ATV's nose, the trailer's tongue, the flatbed's headboard end) faces **Blender -Y**.
- Pivot: centre of the base, on the floor plane (Z = 0 at the lowest point of the frame when it stands on its jig or wheels). Origin at (0, 0, 0).
- Blender auto-suffixes duplicate object names (.001). The manifest must match the exported node names exactly: check the real GLB, not the script.

## 3. Products (all names proposed; confirm against the matching vehicle models)

### 3.1 `atv-frame` (ATV Frame)
- Purpose: the chassis of the ATVs Eden Outdoors sells. The owner is modelling several ATV models; this frame must fit their chassis anchors. Before modelling, ask the owner for the ATV GLB(s) and measure wheelbase, track width and the nodes (wheels, suspension, handlebar, exhaust, seat) from the ATV contract in notes/atv-handling-design.md. Until then use a placeholder frame about 1.9 m long, 0.8 m wide, 0.5 m tall (tube frame), and say which numbers are guesses.
- Stages 5, seams about 24 (proposal): 1 lower rails and floor plate (flat), 2 main side tubes (flat and round tube), 3 front suspension towers and steering head (vertical), 4 engine cradle and rear swingarm mount (underside and overhead), 5 racks, footpeg brackets and the seat rail (flat, small).
- Triangle cap 2,500, at most 12 materials (primitives). Tubes as 8-sided cylinders, brackets as simple boxes.

### 3.2 `utility-trailer` (Utility Trailer)
- Purpose: Eden trailer for Eastbank/Ridgeline and later for players to buy. Bed frame about 2.4 m long x 1.4 m wide, one axle, tongue about 1.0 m, overall about 3.4 m long, deck 0.6 m high.
- Stages 4, seams about 18: 1 outer frame rectangle (flat), 2 crossmembers and the deck angle (flat), 3 tongue, coupler and jack stand (vertical), 4 axle brackets, fender mounts and side rail posts (underside and vertical).
- Triangle cap 2,000, at most 10 materials.

### 3.3 `flatbed-bed` (Flatbed Bed): ON HOLD (the flatbed model is not ready; the agent that made it ran out of tokens). Build the other two first.
- Purpose: the truck body Eden builds for the Eastbank truck yard and for export. It must match the game's flatbed (the Logging Truck folder under assets-src: Veichles/Logging Truck, see FLATBED_SPEC_UPDATE_2.md). Measure the bed length, width and the mounting rails from that GLB; do not invent a size.
- Stages 5, seams about 30 (the longest product): 1 subframe rails (flat, long seams), 2 crossmembers (flat), 3 deck plate stitch welds (flat, long, many short seams), 4 headboard and side rails with stake pockets (vertical), 5 tie-down rings and the rear bumper (underside, small).
- Triangle cap 2,500, at most 12 materials.

## 4. Manifest and files
- Exports: `product-atv-frame.glb`, `product-utility-trailer.glb`, `product-flatbed-bed.glb` plus `welding_tier5_manifest.json`. Collection `WeldingTier5`, script `welding_tier5.py`.
- Copy the structure of `welding_tier4_manifest.json` exactly (read it first): per product id, name, tier 5, difficulty, stage count and seam count; per stage: stage index, camera position, camera target, work plane (point and normal), supplied nodes, seam paths (3D point lists) and per-seam normals; stage 0 = present at the start. Add `tier: 5` and, where an order rule exists, `weldOrder` and `orderRule` like Tier 3.
- Never use one averaged plane for a stage that has seams on different parallel planes: give each seam its own plane and normal.
- Anchors on every product: `anchor_jig` (the base centre on the jig), `anchor_display` (for the yard display), `anchor_grab` (where a forklift or tow would take it).
- The product is also displayed fully assembled in the yard and warehouse, so the same GLB must look finished when every stage is visible.

## 5. The jig (new prop, needed)
The weld table (1.5 x 0.8 m) is too small. Add `prop-weld-jig`: a steel bench/jig about 3.6 x 1.8 m, top 0.90 m, with a ground tab, clamp points and a removable cradle. Anchors: `anchor_ground_tab`, `anchor_part_slot`, `anchor_player_stand_long` and `anchor_player_stand_end`. Triangle cap 1,500, at most 10 materials. Same Blender axes as above.

## 6. Budgets and checks
- Per product: triangles and materials within the caps above; report both. The game budget for static props is 2,500 triangles and 30 primitives (the owner's brief, section 10).
- Check in pure Python or Blender and say which: names match, stage visibility, anchors present, seams lie on the geometry. Do NOT claim browser or in-game testing. The owner sends screenshots and revises.
- Test every stage camera and every transition for occlusion and clipping, as the brief says for Tier 4.

## 7. Open questions for the owner
1. Are three products enough, or add a fourth (for example a pickup bed or a tool trailer)?
2. Can the render agent have the ATV and flatbed GLBs to measure?
3. Should Tier 5 include overhead welding, or stop at vertical and underside?
4. (Answered: no weld-order rules unless they build something.)

## Decisions (owner, 2026-11-14)
- Flatbed bed waits for the flatbed model. No weld-order rules. ATV frame needs a real ATV model to measure: a candidate search was started.
