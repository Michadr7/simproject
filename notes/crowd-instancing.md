# Crowd Instancing Plan (VAT on WebGL2 -> WebGPU/TSL)

**Recommendation: `GO` (hybrid: skinned hero pool near player + VAT instanced far crowd).**
On the RTX 4070 Ti, each current `createCharacter()` draws **10 `SkinnedMesh`es** (62 bones, ~6,000 tris) = **20 draw calls/character** (main + shadow). At Oak Street (20:00), 6 characters cost **120 draw calls** out of 996. Scaling to 100–1,000 skinned people collapses to **23.4–5.7 FPS** (2,001–20,001 calls, 8–71 ms CPU IK/skinning). Baked Vertex Animation Textures (VAT) render **100, 300, and 1,000** `Casual_2` characters at **165 FPS (6.06 ms)** in **3 draw calls** total (ground + 1 main + 1 shadow) with **0.00 ms** CPU animation cost.

---

## 1. Current Cost vs VAT Spike (RTX 4070 Ti, 1400×800)

| Spot / Benchmark | Chars | Calls (Main / Shadow / Total) | Char Tris | Frame Mean (ms) | FPS | CPU Update (ms) |
|---|---:|---|---:|---:|---:|---:|
| Oak Street 12:00 (live) | 5 | 627 / 314 / 941 (chars: 100) | 29,974 | 6.19 | 161.5 | — |
| Oak Street 20:00 (live) | 6 | 640 / 356 / 996 (chars: 120) | 36,456 | 6.06 | 165.0 | — |
| Corner Market 20:00 (live) | 6 | 505 / 328 / 833 (chars: 120) | 36,456 | 6.06 | 165.0 | — |
| Sawmill Yard 10:00 (live) | 7 | 185 / 87 / 272 (chars+mill: 142) | 34,954 | 6.06 | 165.0 | — |
| Spike Skinned N=100 (shadows on) | 100 | 1001 / 1000 / 2001 | 577,600 | 42.81 | 23.4 | 8.0 |
| Spike Skinned N=300 (shadows on) | 300 | 3001 / 3000 / 6001 | 1,732,800 | 68.90 | 14.5 | 20.5 |
| Spike Skinned N=1000 (shadows on) | 1000 | 10001 / 10000 / 20001 | 5,776,000 | 176.78 | 5.7 | 71.1 |
| **Spike VAT N=100 (shadows on)** | **100** | **2 / 1 / 3** | **577,600** | **6.06** | **165.0** | **0.00** |
| **Spike VAT N=300 (shadows on)** | **300** | **2 / 1 / 3** | **1,732,800** | **6.06** | **165.0** | **0.00** |
| **Spike VAT N=1000 (shadows on)** | **1000** | **2 / 1 / 3** | **5,776,000** | **6.06** | **165.0** | **0.00** |

*Note: Chrome on Win11 is DWM-capped at 165 Hz (6.06 ms).*

---

## 2. VAT Memory, Quality & What Is Lost

- **Texture & Memory:** Merged non-indexed `Casual_2` has `17,328` verts (`5,776` tris). At `2048` px wide, 1 frame = `9` rows. Baking `Idle_Neutral` (24 f) + `Walk` (24 f) = `48` frames (`432` rows -> `2048×512` `RGBA16F` = **16 MB** total for pos+norm, **8 MB/clip**). A `2048×2048` texture holds **227 frames (~9.4 clips)**, or **~40+ clips** if vertices are deduplicated/indexed (~4k verts, 2 rows/frame).
- **Quality & Shadows:** Linear interpolation between baked frames in GLSL + `mix(idle, walk, walkWeight)` gives smooth transitions. Because `bakeVAT` samples `createCharacter()` after `solveLeg` + `applyArmSwing`, the VAT preserves the game's leg-IK fix. `customDepthMaterial` with the same vertex patch casts animated shadows in **1 draw call**.
- **What Is Lost & How to Keep It:**
  - *Per-bone attachments (axes, logs, planks) & IK (`solveArm`, `workPose`):* Keep characters within **15 m** OR with an active `p.phase` (sawmill/forest workers) on the existing skinned `POOL` (9–15 slots).
  - *Hair/outfit swaps (`appearance.js`):* Bake 2–4 base archetypes (`male/Casual_2`, `male/Casual_Hoodie`, `female/Casual`, `female/Formal`) and vary skin, hair, top, and legs via per-instance attributes (`aSkin`, `aHair`, `aTop`, `aLegs`). Stay under WebGL2's **16 vertex-attribute limit** (spike uses 14 slots after dropping `skinIndex`/`skinWeight`).

---

## 3. Phased Plan & Oak Street Budget

- **Phase 1 (C9 Crowd Strangers, WebGL2):**
  1. Add `dist/crowd-vat.js` (pure geometry merger, VAT baker, `InstancedMesh` manager for 2 archetypes: male + female casual) + `dist/crowd-vat-rules.js` (pure LOD split & texel packing math).
  2. Keep `POOL = 9` skinned slots for `< 15 m` + `p.phase` workers; route `15–120 m` non-worker strangers to `crowd-vat.js`.
  3. **Oak Street 20:00 budget:** Adding 100–200 background strangers costs **+2 main / +2 shadow = +4 draw calls** (~`642` main / `1,000` total calls, still at `6.06 ms` / 165 FPS), vs `+2,000` calls skinned.
- **Phase 2 (Variety & Clips):** Deduplicate vertices on merge (~2 rows/frame), add `Run` clip + 2 more outfit archetypes (4–6 draw calls total for 300+ people).
- **Phase 3 (WebGPU / TSL Port):**
  - `onBeforeCompile` does not run on `MeshStandardNodeMaterial`.
  - Replace `patchVatVertex` with a TSL `positionNode` + `normalNode` using `textureLoad(uVatPos, ivec2(col, row))` (or `StorageBufferAttribute` in compute) and `attribute('aAnim', 'vec3')`, `attribute('aSkin', 'vec3')`, etc.
  - Shadows use `MeshStandardNodeMaterial`'s built-in `positionNode` (no separate `customDepthMaterial` patch needed). Toon shading switches from `toonGLSL` to `toonTSL`.

---

## 4. Exact Integration Points & Tests

- **`dist/npc-crowd.js` (`createNpcCrowd`, `update`):** Partition visible entries by `d < 15 || p.phase` -> skinned `slots`; `15 <= d < radius` -> `vatCrowd.push(e, px, pz, e.yaw, walkWeight, phase)`.
- **`dist/neighborhood.js` (`createPedestrians`):** No change needed; the 6 named Oak Street pedestrians remain skinned for close-up dialogue/IK.
- **`dist/game.js` (init ~L137, `frame()` ~L1748):** Create `vatCrowd` after `loadCharacterAssets()`, pass to `createNpcCrowd`, call `vatCrowd.update(view)` in `frame()`, and `vatCrowd.hideAll()` in `hideAll()`.
- **`dist/shadows.js` (`createShadows`):** On Low quality, feed `vatCrowd` positions into `people()` for blob shadows.
- **Tests to pin it:** `tests/crowd-vat-rules.mjs` (pure: texel/row packing math, 16-attrib budget check, `15 m` LOD hysteresis + `p.phase` skinned override).
