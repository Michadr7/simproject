# Eden Ridge: Map-Build Status Audit (2026-11-18)

Read-only audit of `notes/map-master.md` section 8 (P0..P8) against `dist/`, `tests/`, `notes/eval/outbox/`, and `notes/handoff.md`. No browser was run; unit tests listed in `notes/eval/outbox/map-status.md` were run directly in Node (packaged release tests were not run because `dist/releases/0.35.22` is being modified by parallel lanes).

## 1. Phase Status Tables (P0..P8)

### P0: Unblock testers, cheap held work
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| X0 | Planks over hand limit always droppable + stuck-save rescue | DONE | `dist/carry.js:107-118`; `tests/carry.mjs` PASS | None |
| I1 | Display rename Alder Center -> Ironwood | DONE | `dist/map-definition.js:21,286-295,542`; `tests/map.mjs` PASS | None |
| I2 | Remove street tree rows & square planters, move 3 benches | DONE | `dist/map-definition.js:446-462` (`planters:[]`, no `tree:`); `tests/map.mjs` PASS | None |
| BZ1 | Move interior origins outside world; move Ridgeline office | PARTLY | `dist/map-definition.js:358-359` (origins moved to `z:1500`) | Ridgeline office still on Eastbank I5 (`map-definition.js:512`; `eastbank.mjs:37`, `careers.mjs:119`, `properties.mjs:12`) — blocks BZ3, not P1..P3 |

### P1: Frame and streaming
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| F0 | Streaming design brief (chunks, rings, time slicing) | DONE | `notes/streaming-brief.md` | None |
| F1 | Streaming on the old map (`chunks.js`, `chunks-view.js`) | DONE | `dist/chunks.js`, `dist/chunks-view.js`; `tests/chunks.mjs` PASS | Real-GPU hitch check; some old-block props/mask still global (`handoff.md:288`) |
| F2 | World rectangle `x -450..1050, z -1200..600`, bigger ground | DONE | `dist/map-definition.js:430` (`MAP.world`, `MAP.wilds`, `gates`); `tests/chunks.mjs` PASS | None |
| F3 | Pinned tests per chunk | DONE | `notes/map-master.md:148`; `handoff.md:280`; `tests/chunks.mjs` PASS | None |
| RU6 | Performance gate tests (chunk build, mesh caps, dispose) | DONE | `tests/perf-gate.mjs` PASS (44 meshes/ring, 0.86 ms median) | Real-GPU FPS gate (Node measures geometry/mesh proxy only) |

### P2: Water and road data
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| W1 | Water data contract in `map-definition.js` + `waterAt` | DONE | `dist/map-definition.js:667-735`; `tests/water-contract.mjs` PASS | None |
| W2 | `height.js` polyline valley, basins, sea slope, fords, bridges | DONE | `dist/height.js`; `tests/water-height.mjs` PASS | None |
| R1 | Road data polylines, class, chunk split, road graph | DONE | `dist/map-definition.js:768-870`; `tests/road-graph.mjs` PASS | None |
| R2 | Roads follow `heightAt`, bridge axis, `riverZAt` by distance | DONE | `dist/road-geometry.js`; `tests/road-geometry.mjs` PASS | None |
| W3 | Chunked water meshes (ribbons, lake, sea, falls), plain mat | DONE | `dist/water-chunks.js`; `tests/water-chunks.mjs` PASS (52 water chunks); `basin-walk.mjs` PASS | Shipped `MAP.water` has no lake/falls yet (B1 adds data) |
| R3 | New roads & bridges (R3a gravel/wilds, R3b bridges/exit) | DONE | `dist/map-definition.js:39-45,124-127,365`; `tests/road-r3a.mjs`, `road-r3b.mjs` PASS | Owner eye-check on bridges/grades |
| R4 | Angled T/Y patches, Kaspian Bay in `TOWNS`, wild signs | DONE | `dist/junctions.js`; `outbox/r4.md`; `tests/junctions-r4.mjs` PASS (336 checks) | Owner eye-check on 9 new patches & signs |
| RU1 | Weapon & fishing zones data + `validateMap` checks | DONE | `dist/map-definition.js:518-528,740-756`; `outbox/ru1.md`; `tests/zones-ru1.mjs` PASS | Wiring into crime/weapon/fishing gameplay (L2, B4, B5) |
| RU2 | Rescue points per region, edge scenery bands, `validateMap` | PARTLY | `dist/map-definition.js:530-539,567`; `outbox/ru2.md`; `tests/rescue-ru2.mjs` PASS | Edge bands produce 0 trees until wilds `claimed()` works; old belts still present; soft wall/fade not built |
| A1 | ATV surface profile + new `SURFACE` ids (gravel, mud, sand, ford) | PARTLY | `dist/terrain.js` (MUD/GRAVEL), `dist/surface-table.js`; `tests/surface-table.mjs` PASS | `SAND` and `FORD` surface ids deliberately deferred until beach/ford data exists |
| A2 | Slope, side slide, roll back, drift, `slip` in pure step | PARTLY | `dist/slope-rules.js`, `dist/vehicle.js`, `dist/driving.js`; `tests/slope-a2.mjs` PASS | Part 2: hand-brake drift + `slip` save/MP field (needs Space-vs-Shift decision) + "Too steep" toast |

### P3: Ironwood grows
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| I3 | Grow Ironwood zone, River St, Ironwood St N, sidewalks, Bus Plaza | NOT STARTED | `dist/map-definition.js:21` (`alder` still `-20..58, -125..-48`); `pavements` gap on Alder Ave `z -60..-80.7` (`line 470`) | Everything (also owns the Alder Ave sidewalk gap `z -60..-80.7`) |
| I4 | Converter: door anchors, unused Kenney commercial buildings/awnings | NOT STARTED | No `downtown` props in `dist/props-assets.js` | User Kenney City Kit download (I0) + `scripts/build-props.mjs` pass |
| I5 | `downtown.js` data/rules + C11..C20 properties & posts | NOT STARTED | No `dist/downtown.js`; `map-definition.js:487-496` has C1..C10 only | Everything (needs I3, I4) |
| I6 | `downtown-view.js` instanced doors/awnings/signs + `city-budget.mjs` | NOT STARTED | No `dist/downtown-view.js` or `tests/city-budget.mjs` | Everything (needs I5) |
| I7 | Hotel exterior H1 + `MAP.lobbies` & validation | NOT STARTED | No `lobbies` in `dist/map-definition.js` | User hotel model (3 pieces) + data/validation (needs I5) |
| I8 | `hotel.js` + starter beats (`arrived`, `checked-in`, vouchers) | NOT STARTED | No `dist/hotel.js` | Everything (Opus save format; needs I7) |
| I9 | Hotel lobby room, receptionist, fresh-save start inside | NOT STARTED | No `dist/hotel-lobby.js` | User reception counter + lobby + `game.js` hooks (needs I8) |
| I10 | Hotel room, lift fade, Homes app card, MP room `hotel` | NOT STARTED | `dist/relay-protocol.js:19` (`validRoom` lacks `hotel`) | Everything (needs I9) |
| I11 | Block batching (conditional if I6 > 150 draw calls) | NOT STARTED | Depends on I6 measurement | Conditional on I6 real-GPU draw-call count |

### P4: Regions: Blackstone, Kaspian Bay
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| B1 | Blackstone hill relief, lake basin, stream gully, falls, map data | NOT STARTED | `dist/map-definition.js:120-128` (no `lakes` or `falls`); `outbox/basin.md` | Lake/falls/gully data & meshes (`terrain.js` basin mask already ready) |
| B2 | Blackstone forest, rocks, trails, camps, dock, viewpoints | NOT STARTED | Only keepOut coords in `MAP.weaponZones`; no camp/dock landmarks | Everything (needs B1) |
| B3 | Eden Outdoors hall, shop stock, new items | NOT STARTED | No Eden Outdoors building/shop in `map-definition.js` | User bow/rod/tent/campfire models + hall & shop (needs B2) |
| B7 | Camping: tent, campfire, rest at camp, photo spots | NOT STARTED | No camping module in `dist/` | Everything (needs B2, B3 models) |
| A3 | Opus tuning review of A1..A2 numbers on Blackstone loop | NOT STARTED | No A3 report; B1 loop terrain not built | Needs B1 + A2 part 2 |
| A4 | ATV model import, `CLASSES.atv`, paint, price, slot | DONE | `outbox/a4.md`; `dist/vehicle.js`, `dist/props-assets.js`; `tests/atv-import.mjs` PASS | Store picture (`NO_PICTURE_YET`); handlebar merged in body |
| A5 | ATV rider pose, hand IK, steer cap `.52`, camera, jiggle | DONE | `outbox/a5.md`; `dist/driving.js`, `dist/game.js`; `tests/atv-rider.mjs` PASS | Handlebar pivot (needs model node); owner eye-check |
| A6 | ATV audio voice, tyre noise, splash, dust colour | PARTLY | `dist/vehicle-sounds.js:31,89` (TR6 tyre loops done; ATV uses `eng-s70` fallback) | Dedicated ATV engine voice, water splash, dust colour in `smoke.js` |
| A7 | ATV shop slot at Eden Outdoors, tank, MP pose fields | PARTLY | `dist/orders.js` (`VEHICLE_PRICE.atv`), `map-definition.js:349` (Riden Deals slot, 4 gal tank) | Move/add slot at Eden Outdoors (needs B3) + MP rider pose sync |
| BZ6 | Kaspian Bay businesses & posts as data and buildings | NOT STARTED | `MAP.towns` has `kaspian` bounds/roads/signs only (R4) | Buildings, zones, kerbs, posts, properties |
| BZ2 | Kiosk stock and kiosk shift gig (cashier POS reuse) | NOT STARTED | No kiosk gig/stock in `dist/` | Everything (needs BZ6) |
| BZ3 | Freight Exchange: old Ridgeline office, freight board, hauls | NOT STARTED | Ridgeline still occupies Eastbank I5 | Needs BZ1 office move + freight board & contracts |

*(Note: B6 was dropped in `map-master.md` section 8 in favor of A4..A7.)*

### P5: Eden Industries, ranch, harbor
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| E-I1 | Eden site data: rect, roads, gate, fence, car park, chunk props | NOT STARTED | Only spine/car-link/haul roads exist (R3b); no Eden landmarks | Site data & props (needs user Eden sign) |
| E-I2 | Hall kit & office merged chunk meshes, instanced yard props | NOT STARTED | No Eden halls in `dist/` | User hall kit + office models + chunk builder (needs E-I1) |
| E-I3 | Station frame + forklift job + shipping clerk | NOT STARTED | `dist/forklift.js` is Eastbank warehouse only | Eden station frame & jobs (needs E-I2) |
| WJ | Welding job (Tier 5) integrated into Eden halls | PARTLY | `dist/weld-core.js`, `weld-game.js`, `weld-lab.js`; `tests/weld-core.mjs` PASS | Standalone lab only (`/weld-lab.html`); not wired into Eden/jobs/`game.js` (needs E-I2, E-I3) |
| E-I4 | Welder, laser, CNC, assembler mini-games + skill XP | NOT STARTED | No laser/CNC/assembler modules | User laser/CNC models + mini-games (needs WJ) |
| E-I5 | Outbound trucking to Eastbank, harbor, east exit; products | NOT STARTED | No Eden product chain | Needs E-I3, R3 |
| E-I6 | Interiors (Hall A, Hall C, office + Bruce's office), NPC shifts | NOT STARTED | No Eden interiors | Needs E-I2..E-I3 |
| E-I7 | Effects and sound (flash, smoke, loops) | NOT STARTED | None | Needs E-I4..E-I6 |
| BZ4 | Husky Ranch growth west to -330, pens, instanced animals, crops | NOT STARTED | `map-definition.js:18` (`farm` still `-170..-35`); `farm-beds.js` is FV3 vehicles only | Ranch expansion, pens, animals, crop stages |
| BZ5 | Ranch jobs (relaxed tasks, skills) | NOT STARTED | No ranch jobs in `jobs.js` | Needs BZ4 |
| BZ7 | Harbor gigs (5) | NOT STARTED | No harbor gigs | Needs BZ6 |
| R6 | World map and minimap (local window, GPS, full world pan/zoom) | PARTLY | `dist/map-view.js`, `map-bake.js`, `minimap.js`, `gps.js`, `phone-gps.js`; `tests/minimap-local.mjs`, `gps.mjs` PASS | Large map (`M` / phone) still uses old-block view (`map-definition.js:553`); MM6/MM7 full-world pan/zoom not built |
| R7 | Fuel scale (8 -> ~24) and new fuel stations (lake, Kaspian) | NOT STARTED | `map-definition.js:323` (`FUEL_STATIONS` has only `eastbank-gas`); `dist/fuel.js` unchanged | Fuel burn rescale + new station data/pumps |

### P6: Life, law, and vehicle damage
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| R5 | NPC trucks and police patrols on the road graph | NOT STARTED | Only `customer-truck.js` (fixed exit path) & Oak St cars | Road-graph NPC traffic & police patrols |
| RU5 | Crowds: rigid rim people, shell cars, GPU test | PARTLY | `notes/crowd-instancing.md`, `outbox/crowd-spike.md` (spike GO) | Production instanced rim people & shell cars not built |
| B4 | Fishing: rod, cast/reel bar, catch log, fishing XP | NOT STARTED | Only `MAP.fishing` data (RU1) | Rod model, fishing module, UI, `game.js` hook |
| B5 | Wildlife & hunting, licence, bag limit, buy-back | NOT STARTED | Only `MAP.weaponZones` data (RU1) | Wildlife, hunting rules, licence, buy-back (needs B3) |
| VD1 | Pure damage rules (`damage.js`), `impact`/`hitKind`, `cond` save | DONE | `dist/damage.js`, `dist/vehicle.js`; `tests/damage.mjs` PASS | None |
| VD2 | Damage wiring (`driving.js`, panel row, stall, camera shake) | DONE | `handoff.md:283`; `tests/damage-game.mjs`, `damage-feel.mjs` exist | Packaged-game test not re-run in this audit |
| VD3 | Damage look & sound (`uWear`, `uCrack`, hood smoke, misfire) | DONE | `handoff.md:284`; `dist/paint-shader.js`, `dist/damage-textures.js` | Owner feedback noted grime/scratches done; VD3b dents dropped |
| VD4 | Repair shop (`garage.js`, Eastbank I4 bay, repair kit, tow) | DONE | `dist/garage.js`, `map-definition.js:420`; `tests/garage.mjs` PASS | None |
| VD5 | Vehicle insurance (optional) | NOT STARTED | No `insurance` in `dist/garage.js` | Optional: build only if repair bills feel harsh |
| L1 | `law.js` pure rules + `normalizeLaw` + save field | NOT STARTED | No `dist/law.js` | Everything (Opus save format) |
| L2 | Weapon zones, auto put-away warning, licence counter | NOT STARTED | Only `MAP.weaponZones` (RU1) | Needs L1, B5 |
| L3 | Witness checks + patrol NPCs inside budgets | NOT STARTED | None | Needs L2, R5, RU5 |
| L4 | Chase states, search radius HUD, pursuit AI, police vehicles | NOT STARTED | None | User 3-force police recolours + pursuit AI (needs L3) |
| L5 | Arrest flow, holding cell, toasts, Bank app debt row | NOT STARTED | None | Needs L4 |
| L6 | Standing gates on jobs and licence | NOT STARTED | None | Needs L1 |

### P7: Plots and multiplayer
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| RU3 | Plot save format (`progress.plots`, loan tenure), Housing app | NOT STARTED | `dist/ownership.js` handles houses only (no `plots` P1..P9) | Everything (Opus save format; needs P5) |
| RU4 | Plot building rules and placement | NOT STARTED | None | Needs RU3 |
| M2..M5 | Relay messages: law, plot, vehicle, animal | NOT STARTED | `dist/relay-protocol.js` (`PROTOCOL=1`, position/clock/pet only) | Needs L6, RU4, A7, B5 (Opus MP) |
| VD6 | MP `vehicleDamage` action & authority `cond` broadcast | NOT STARTED | No `vehicleDamage` in `dist/relay-protocol.js` | Build inside M2..M5 (Opus MP) |
| L7 | Multiplayer law message on relay | NOT STARTED | No law message in `dist/relay-protocol.js` | Needs M2 (Opus MP) |

### P8: Look pass and tuning
| Stage | Meaning | Status | Evidence | What is missing |
|---|---|---|---|---|
| W4 | Water shader + sky rig uniforms + Simple setting | NOT STARTED | `dist/water-chunks.js` uses plain material; `outbox/W4.md` is Workforce W4 | Water shader (note: WebGPU T5/T6 track means TSL twin needed too) |
| W5 | Ford ripples pool, splash & ambience audio, mist | NOT STARTED | None | Needs W4 |
| W6 | Real-GPU water look pass with user | NOT STARTED | None | Needs W4, real GPU |
| A8 | ATV feel pass in packaged game, final numbers | NOT STARTED | None | Needs A3, A6, A7 |
| I12 | Ironwood prices, hours & texts after play-test | NOT STARTED | None | Needs P3 play-test |
| I13 | Optional West Quarter expansion | NOT STARTED | None | Needs Opus note + user OK |
| VD3b | Vehicle dents (optional) | DONE (DROPPED) | `notes/dents-finding.md` (measured & dropped: quads too coarse) | Would need Blender damaged variants if revisited |
| VD7 | Damage tuning pass (VD7a/VD7b done; final pass optional) | PARTLY | `dist/damage.js:3` (`VD7a` block); `handoff.md:297,337` (`VD7a`/`VD7b` done) | Final packaged-game tuning if needed after more play |

## 2. Built in Code, Never Seen in Play (Owner Eye-Checks)
1. **R3a/R3b roads & bridges**: gravel roads (Blackstone Access, Lake Road), West Bank Bridge, Estuary Bridge, east exit at `x=1082`, grades and bridge deck transitions.
2. **R4 junctions & signs**: 9 angled T/Y patches (check for gaps/z-fighting with gravel at `(600,68)`, `(600,-200)`, `(520,330)`), 24-deg Coast Link sliver, 5 Kaspian Bay wild signs.
3. **RU2 rescue**: pressing `R` in the wilds snaps to nearest rescue point (edge trees still 0 until wilds `claimed()` works).
4. **A2 slope rules + A4/A5 ATV**: ATV on Riden Deals bay 4, 6-colour paint, 30-deg front wheel cap, seated rider pose/hand IK/jiggle, uphill slowdown, >25-deg rollback, >18-deg side-slide on real hills.
5. **GP1 GPS + MM3 local minimap + HUD column**: phone GPS tap-to-pin, route blue line, vehicle panel turn row, local 200x200 zoom/look-ahead minimap, right-column HUD layout.
6. **WJ welding lab**: standalone `/weld-lab.html` feel review (not wired into the game yet).

## 3. Critical Path & Next 5 Stages
- **Biggest unblocker right now**: **I3** (Ironwood zone growth + streets + sidewalks including Alder Ave `z -60..-80.7` + Bus Plaza). Both prerequisites (I2, R4) are DONE, it needs **no user Blender models**, and it unblocks the entire P3 chain (**I5 -> I6 -> I7 -> I8 -> I9 -> I10**).
- **Second biggest unblocker**: **B1** (Blackstone relief, lake basin, stream gully, falls). Prerequisites (R3, W3) are DONE and `terrain.js` already has the basin mask; B1 unblocks **B2 -> B3 -> B7, A3, A7, B5 -> L2..L5, L7**.
- **Third unblocker**: **E-I1** (Eden Industries site data) unblocks **E-I2..E-I7 + WJ**, though E-I2 needs the user's hall kit.

| Order | Stage | Builder model (per 8.5) | Why now / prerequisites |
|---|---|---|---|
| 1 | **I3** (+ Alder Ave sidewalk `z -60..-80.7`) | **Sonnet** | Unblocked (I2, R4 done), no `game.js` edit, no new models; fixes the Alder Ave sidewalk gap and starts P3 |
| 2 | **I4** (Kenney commercial kit converter) | **Sonnet** | Parallel-safe (no `game.js`/`map-definition.js`); needs user Kenney download (I0) first; unblocks I5 |
| 3 | **A2 part 2** (drift + `slip` save/MP field) | **Opus** (save format) | Closes P2 cleanly; needs owner Space-vs-Shift answer; runs after 0.36.0 `game.js` lane clears |
| 4 | **I5** (`downtown.js` + C11..C20 data) | **Sonnet** | No `game.js` edit; needs I3 + I4; unblocks I6 (look/FPS check) and I7 (hotel) |
| 5 | **B1** (Blackstone relief, lake basin, falls) | **Sonnet + Opus review** (or Fable w/ owner OK) | Unblocked (R3, W3 done); touches `map-definition.js` + `game.js` (wait for 0.36.0 `game.js` queue); unblocks all of P4 & hunting/law |

## 4. Dense-File Conflict Matrix (Unfinished Stages)
Never run two stages from the same row in parallel (nor beside the active 0.36.0 `game.js` queue R0..R7):
- **`dist/game.js`**: **0.36.0 queue (R0 WebGPU T6 .. R7 machine)**, then A2p2, I9, I10, B1, B2, B3, B4, B5, B7, A6, A7, BZ2, BZ3, BZ4, BZ5, BZ6, BZ7, E-I1..E-I7, WJ, R5, R6 (MM6/7), RU5, L2..L5, RU4, M2..M5, L7, W4, W5.
- **`dist/map-definition.js`**: **BZ1 (office move)**, **I3**, I5, I7, I13, B1, BZ4, BZ6, E-I1, R7, RU2 (old belts). *(Safe to run I3 now while R0..R7 hold `game.js`, as long as no R-stage edits `map-definition.js`.)*
- **`dist/jobs.js`**: I8, BZ3, BZ5, BZ7, E-I3, WJ, E-I4, E-I5, R5, L1, L6, RU3.
- **`dist/phone*.js`**: I10, B3, BZ3, BZ5, BZ7, E-I3, R6 (MM6/7), VD5, L5, RU3.
- **`dist/world.js`**: I6 (1 line), I11 (1 condition), RU2 (wilds `claimed()`).
- **`dist/relay-protocol.js`**: I10 (`hotel`), A7 (ATV pose), M2..M5, VD6, L7.
