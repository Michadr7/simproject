# City Life: Welding Job Full Design and Agent Brief

Saved from the owner's pasted brief on 2026-11-14, unchanged except for this line. Related: notes/welding-reconcile.md (where this brief meets the master map) and notes/welding-tier5-plan.md (vehicle-scale products). The welding job is built AFTER Eden Industries exists (owner's decision, 2026-11-14).

Audience: the coding agent (and Opus for the design phase).
Project: City Life, a buildless Three.js browser city sim (plain ES modules, Three.js vendored locally).
Status of this file: compiled from the owner's confirmed decisions and the earlier assistant work. It is NOT merged into the project's DESIGN.md. Inspect the actual project before assuming anything here is current (the last supplied context listed version 0.32.0; verify it).

## 0. Standing rules (apply to every task)

- Name the Claude model for each agent task: Opus 5.5 for design, save formats and multiplayer; Sonnet 5.5 for implementation and refactoring against tests; Haiku 5.5 for tiny edits and data tuning. Fable 5.2 (`claude-fable-5-2`) is a candidate only if the owner says yes; do not switch models without that.
- Flag performance risks BEFORE building, with a numerical budget and a cheaper alternative. Low triangle counts do not mean zero cost: materials, draw calls, shadows and transparency matter.
- Run `npm test` after game-code changes. If `dist/` changes, follow context.md's release/build instructions before the tests.
- Data first. Pure transactions. Money in integer cents.
- Change existing town and map files minimally and additively.
- State plainly what is not verified. Never claim Blender or browser testing when only pure Python was run.
- The owner commits by hand.
- Opus answers ALL open gameplay, economy and design questions in its design phase. Do not ask the owner to decide pay, promotions, deadlines, stock rules and similar.
- For anything about products, the rule is: **Use the previous company rules for products.** Do not invent replacements.
- Do not add schema migration numbers blindly. Inspect the current save code first.

## 1. Concept

A Metal Shop job. While clocked in, the player takes welding tasks from a task board, enters a first-person welding mini game at a steel table, and welds seams on supplied parts. Pay is settled at shift end. Higher tiers unlock harder, better-paid work. Finished output feeds company inventory, which also fills customer orders.

## 2. Confirmed player decisions

- Press E at the task board to enter first-person welding.
- Mouse moves the torch tip. Left mouse button strikes the arc.
- Score line accuracy, travel speed and excessive dwell.
- Poor welds lower the score. They do not automatically block completion.
- Leaving mid-task forfeits that task or unit.
- The player may do as many tasks as desired, then clock out.
- Pay is settled at shift end.
- The ground clamp attaches to the steel table's ground tab.
- Promotion unlocks harder, better-paid work.
- All ten initial parts are Tier 1. Tiers 1 to 3 have flat seams. Vertical work begins in Tier 4.
- Tier 4 assembles supplied pieces into company products. Flow: supplied parts, weld, the camera automatically changes angle, weld, repeat until finished.
- Product scoring is forgiving: most welds correct earns the full price.
- Products belong to the company. Use the previous company rules for products.

## 3. Game flow

1. Clock in at the time clock. Eligible rank required (see Opus decisions).
2. Walk to the task board. Stock work and any accepted customer ticket are offered. Press E to take or print a ticket.
3. The player picks up the torch and walks to the welding table (third person), then E starts the task.
4. Camera switches to first person. The clamp is attached to the ground tab. The part is on the table.
5. Weld the seams (mini game, section 4). Tier 4 products repeat this per stage with automatic camera changes.
6. Task ends. Score is recorded. Finished item goes to company inventory (shown on the finished-parts rack).
7. Repeat, or clock out. Pay is settled at shift end.

## 4. Mini game mechanics

Confirmed:
- Input: mouse moves the tip, left button holds the arc.
- Scored factors: line accuracy, travel speed, excessive dwell.
- Bad welds lower the score, they do not force a redo.
- Product scoring is forgiving.

Implementation proposals (NOT approved; Opus decides final numbers):
- Sample the tip against the seam path while the arc is on, in short segments, and score each segment.
- Accuracy = distance from the seam centreline against a per-part tolerance.
- Speed = distance travelled per second against a target band.
- Dwell = time spent in one spot beyond a limit.
- Dynamic bead geometry and spark counts must be bounded.
- Use an emissive arc material, not a shadow-casting dynamic light by default.

Previous suggested values, NOT user-approved, do not treat as requirements: full product pay at 70% good welds; tier multipliers 1.0, 1.6, 2.5; promotion around 15 tasks at 70% average; product tolerance 8 mm; camera transition 1.2 s.

## 5. Tiers and parts

Parts are Blender-built GLBs exported as `part-<id>.glb`. A manifest lists seams, anchors and metadata.

### Tier 1 (difficulty 1 to 3, straight seams)
plate-butt (Plate Join), bracket-l (Bracket Weld), t-frame (T-Frame), lap-joint (Lap Joint), long-seam (Long Seam), stitch-plate (Stitch Weld), u-channel (U-Channel), tray-box (Tray Box), frame-butt (Frame Assembly), post-mount (Post Mount).
Manifest: welding_parts_manifest.json. Tier 1 originally has seam start and end only, and may still need `tier: 1` added.

### Tier 2 (difficulty 4 to 6), collection WeldingTier2, welding_tier2.py
corner-run (Corner Run), diagonal-join (Diagonal Join), flange-collar (Flange Collar), corner-frame (Corner Frame), serpentine-pad (Serpentine Pad). The owner reviewed a screenshot and said Tier 2 looks good.

### Tier 3 (difficulty 7 to 9), collection WeldingTier3, welding_tier3.py
- groove-plate: root, fill and cap passes.
- blind-plate: no visible guide, tack hints.
- cross-plate: preferred weld order.
- tank-lid: long circle, tighter tolerance (largest, 680 triangles).
- skip-plate: order 1, 3, 5, 2, 4.
Manifest fields: widthM, toleranceM, showGuide, passes, weldOrder, orderRule. These rules are METADATA for future implementation, not implemented gameplay.

### Tier 4 products (difficulty 10 to 12), collection WeldingTier4, welding_tier4.py
| ID | Name | Stages | Seams |
|---|---|---|---|
| fan-housing | Fan Housing | 4 | 12 |
| table-legs | Table Legs | 3 | 6 |
| frame-picture | Picture Frame | 2 | 8 |
| frame-window | Window Frame | 2 | 12 |
| frame-gate | Gate Frame | 3 | 10 |
| steel-drum | Steel Drum | 3 | 3 (largest, 1,092 triangles) |
| mailbox-stand | Mailbox Stand | 2 | 2 (flat-only introductory product) |

Exports `product-<id>.glb` plus welding_tier4_manifest.json. Parts are tagged with the stage they are supplied in; stage 0 means initially present. Each stage carries camera, target, work plane, supplied nodes, seam paths and normals. Products are displayed fully assembled in Blender. Stage assembly and camera transitions are NOT implemented in Blender or the game.

Visual status: no visual approval has been received for Tier 3 or Tier 4.

## 6. Parts data and coordinates

- Blender: Z up, front -Y, metres. Game point = (x, z, -y). Convert NORMALS as well as positions.
- Normalise all tiers to 3D seam paths. Tier 1 originally has start and end only.
- Use explicit work planes and per-seam normals. Some Tier 4 stages have seams on different parallel planes: never use one averaged stage plane to place every tip.
- Blender auto-suffixes duplicate object names. Manifests must match the actual exported node names. Verify names in the real GLBs.
- Verify exports, anchors, names and stage visibility in actual GLBs, not just the manifests.
- Do not assume pointing a camera target at a seam avoids occlusion or clipping. Test every stage view and transition.

## 7. Assets

### Welder (welder.glb), from welding_full_build.py v5
Cart welder v3, 3,372 triangles, one regulator, MIG gun, raised holsters. Anchors: anchor_torch_outlet, anchor_ground_outlet, anchor_torch_rest, anchor_clamp_rest, anchor_use, anchor_use_torch, anchor_power, anchor_torch_tip, anchor_torch_hose, anchor_clamp_hose.

### Weld table (weld-table.glb)
1.5 x 0.8 m, top 0.90 m, all steel. Anchors: anchor_ground_tab, anchor_part_slot, anchor_player_stand.

### Third-person animation
A person picks up the gun, walks to the table and welds Plate Join. v5 torch clipping fix: CARRY_Z 1.20 (was 1.08), LEAD_UP 0.14 m above the seam, ROT_DELAY 8. A pure simulation found the old settings clipped in 8 frames and the new ones in 0. That was vertex sampling, not a full swept-mesh or interpolated-animation test. It is not confirmed visually in Blender.

### Shop props (welding_props.py, polished replacement)
Collection WeldingProps. Exports prop-<id>.glb plus welding_props_manifest.json. Every prop has `anchor_interact` (where the player stands) and `anchor_prompt` (where the E prompt floats). READ the manifest for the full anchor list.
- prop-task-board: ticket printer, cabinet, board with tier-coloured tickets, order lamp. Anchors include anchor_ticket_out, anchor_board_look, anchor_order_lamp.
- prop-time-clock: pedestal clock, green and red buttons, card pockets. Anchor anchor_card_slot.
- prop-parts-rack: finished-parts rack, company stock display, anchors anchor_slot_01 to anchor_slot_09 and anchor_drop.
- prop-steel-rack: raw steel rack (anchor_pickup).
- prop-welding-helmet: nodes Welding_Helmet, Helmet_Headband, Helmet_Stand (origin at the middle of the head; anchor_wear).
- prop-wire-spool: anchor_pickup.
- prop-extinguisher: with wall bracket; anchor_pickup.
- fp-torch-glove: separate FP_Torch, FP_Glove, FP_Cable nodes. Origin is the hand. Forward is -Y. anchor_hand (0,0,0), anchor_tip approx (0,-0.309,-0.124), anchor_camera_hint (0,0.62,0.16), anchor_arc = tip. The camera looks toward the tool from +Y.
Not visually verified. The first-person gun and glove and the third-person animation are distinct assets.

### Add-on props (welding_props_extra.py)
Collection WeldingPropsExtra: prop-gas-cylinder (Gas_Cylinder, Cylinder_Chain), prop-supply-cart (Supply_Cart, Cart_Load; anchor_load, anchor_handle), prop-scrap-bin (Scrap_Bin, Scrap_Pile; anchor_drop). Manifest welding_props_extra_manifest.json. Their use and placement are proposals.

Tile and tier colours (for the task board): Tier 1 green, Tier 2 amber, Tier 3 red, Tier 4 blue. No text is modelled; the game draws its own labels.

## 8. Orders, stock and the task board

Reuse the logging job pattern:
- While clocked in at an eligible rank, deterministic counters generate orders, not random rolls.
- One or two active offers, not a flood.
- A phone notification and the Jobs app / Shift tab show the ticket: customer, quantity, deadline, pickup or delivery.
- Accept physically at the task board by pressing E to take or print the ticket.
- The tracker guides steps. Company stock feeds orders.
- Missed deadlines cost order pay and some reputation, following the existing company and logging rules.
- Owner orders later reuse the ticket interface.
- Stock work stays available at the task board with tier-appropriate parts and products.
- Finished output goes into company inventory. The finished-parts rack represents it.
- Customer orders coexist with stock work.

Known ambiguity: the logging description lists a deadline in the notification while acceptance supposedly starts the clock. Opus must explicitly separate offer expiry from the accepted-order deadline.

Treat any detail beyond the owner's explicit choices as a proposal until Opus designs it.

## 9. Open decisions: Opus owns ALL of these

Shop location; pay rates, tier multipliers and prices; promotion requirements and lower-tier availability; product good-weld threshold and partial payout; consumables and raw materials; order flow, grade requirements, deadlines, acceptance timing, quantities and inventory; stock reservation and avoiding double pay; clock-out behaviour; raw steel sourcing; save schema changes (after inspecting the actual current save); camera transition and supply animations; whether the gas cylinder, supply cart and scrap bin are interactive; multiplayer visibility.

## 10. Performance budgets (proposed, state final numbers before building)

- Static shop props: at most 2,500 triangles and 30 material primitives (draw calls) each. The task board is currently over on primitives (32).
- First-person viewmodel: at most 1,500 triangles and 10 primitives. Currently 1,448 triangles and 9 primitives (measured in pure Python, not in a browser).
- Arc: emissive material, no shadow-casting light by default.
- Sparks: bounded pool. Bead geometry: bounded and reused.
- Instance repeated props. Mind shadow casters.
- Cheaper alternative for the task board: merge card and printer materials or use one atlas texture.

## 11. Suggested work split

1. Opus 5.5: design phase. Answer all section 9 questions, define score maths, order flow, save shape, camera transitions.
2. Sonnet 5.5 (or Fable 5.2 if the owner approves): implement against tests. Suggested order: data loading and manifest normalisation, then the Tier 1 mini game (flat seams), then scoring and pay, then orders and the task board, then Tier 2 to 4 (vertical work and stage transitions last).
3. Haiku 5.5: tune data values afterwards.

## 12. What is verified and what is not

Verified in pure Python only: geometry, manifests, triangle counts, anchor values, the torch clipping simulation (vertex sampling).
NOT verified: Blender execution of the polished and add-on scripts, GLB exports of those scripts, any browser or in-game rendering, visual quality of the first-person glove and torch, helmet, Tier 3 and Tier 4 parts, stage transitions, and every proposal above. The owner will send screenshots; revise from them.

Do not claim these documents are merged into DESIGN.md. WELDING_DESIGN_NOTES.md, WELDING_AGENT_BRIEF.md and WELDING_ORDERS_ADDITION.md exist separately and may be out of sync with this file.
