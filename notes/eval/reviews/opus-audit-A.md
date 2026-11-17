michadr.

# Opus audit A: game.js comment scan, gigs and needs (working copy 0.35.17)

The working dist/*.js files are byte-identical to dist/releases/0.35.17. Tests run (all PASS): needs, needs-loop, gigs, gig-parcel, load-drag, world-tick, world-state, gigs-game, starter-game. The scenario scripts are in my scratch folder; none were added to the repo.

## 1. game.js comment and name scan (nothing broken)
- **Mid-line `//` scan.** I wrote a tokeniser that skips strings, template literals and regex literals, and checked it against the broken 0.35.15 game.js: it flags line 167 (`...(enterShop)const worldPlayer=...`). On the working copy it finds 159 trailing comments in game.js. I then checked each for code-like text after the `//`: none has code swallowed (the two hits, lines 810 and 1690, are prose). The same scan over all dist/*.js finds one swallowed declaration: **dist/character.js:130** ends its comment with `...put backconst twoHandL={...},wantAlign=new T.Quaternion();`. This is harmless, because both names are already declared earlier on the same line. It is a leftover from a paste. Severity: minor. Fix: delete the text after "put back".
- **Undefined names.** A heuristic scan of game.js for identifiers used but never declared or imported found only object-method keys (false positives). worldPlayer, onGiveUp/abandonContract, canStow, STOW_TOAST/UNSTOW_TOAST, BEDS, mountError and stowKgFor are all imported or declared. Every named import across dist/ resolves to an export. The only checker hits were in ground-shader.js, and they are false positives caused by my parser and comma spacing.
- **syncParcel (game.js:909).** Every model in STOW_MODELS has a BEDS entry in cargo.js, so `BEDS[rack.spec.model].y` cannot throw. Re-parenting works: on exit, mode goes from 'stowed' to 'held' and player.add re-parents the parcel. On abandon the mode becomes '' and the parcel is hidden.

## 2. Findings, ranked

### F1. The farm pickup point is inside the farmhouse walls. Gigs that use it can never be finished. BREAKS PLAY. CONFIRMED (geometry and code; not seen in a browser)
- gigs.js:41 `FARM_ORIGIN {x:-62,z:-244}` and needs.js:27 `PLACE_POINTS['property:farm-house'] {x:-62,z:-244}` are the centre of the farmhouse landmark (map-definition.js:483 `farm-house` house-t at (-62,-244)).
- I applied the house-t colliders from props.js propInfo the same way world.js:456 does, then flood-filled from the farm road. The point is fully enclosed. The walls span x -66.5..-57, z -248.9..-238.4, so the nearest standable spot is about 5.6 m away.
- **Effect on parcel and grocery gigs.** A gig whose pickup is the farm needs E within `PICKUP_RADIUS_M=2` of (-62,-244) (gigs.js:193-194). That is impossible, so the box never leaves the origin and the gig can never be done. Only Give up clears it.
- **Effect on the story.** A measured 35% of the story's starter offers (boardFor `{starter:true}`, 3 game days at 10-minute steps) have the farm pickup. In 50 of 324 windows both offers are farm pickups. A new player can therefore get stuck at the mandatory story gig beat.
- **Effect on need gigs.** These need the player within 1.35 m of the point (gigs.js:200 `near`), which is impossible: errand "bread for Hal" (market -> farm-house), "Tend the animals" and "repair fence". All three appeared on the board in a 120-day simulation. They sit there until expiry, and then Hal loses mood.
- **Effect on the crate restock marker.** For crate restock gigs, the beacon (gig-bridge.js:19, `location` = origin while loading) points into the house. The real load prompt is at the pile (-66,-235.4).
- **Smallest fix:** move both points to the porch, which is outside the wall: `{x:-62,z:-236.5}`, the same as starter.js PLACES.farmhouse. This changes the farm gigs' parM, so re-run the gigs tests (some pin pay values).

### F2. Crate restock gigs can be finished on foot at the shop point, with no truck, and outside shop hours. WRONG BEHAVIOUR. CONFIRMED (ran it)
- tickGig (gigs.js:205) ticks a need gig's place as soon as `haul>0`. activeView then reports stage 'return', and game.js:635 offers the generic "Report back · collect $X". That calls completeContract -> completeGig -> completeNeed, which pays and fills the shelf.
- This path skips needDrop's checks (game.js:495-496: market open, truck within MARKET_REACH).
- **Scenario:** load the eggs at the farm, drive back, park anywhere, and walk to (19,-6.3) at 23:00. You are paid (script: "report back on foot: paid 3601"), and syncNeedCargo deletes the crates from the far-away truck.
- **Smallest fix:** in tickGig, skip auto-visiting for crate restock gigs (`a.type==='need-restock'&&CRATE_UNITS[a.needGood]`), so that only deliverHaul can finish them. Or have completeContract refuse `a.needId&&CRATE_UNITS[a.needGood]`.

### F3. The cafe's crate restock is handed over at the market, and the text names Noah. WRONG BEHAVIOUR. CONFIRMED (ran it)
- needCandidates and needDrop (game.js:487-498) always use STORY_PLACES.market, `shopOpen('market')` and the line "Noah: thanks...". deliverNeedCrates fills whichever need the gig holds.
- **Scenario:** accept "Eggs for the market" for Alder Coffee, load, then hand over at the MARKET door. The cafe shelf goes 1 -> 6 and the market shelf is unchanged, while the beacon points at the cafe (36,-6.3).
- The title is also wrong: needs.js:38 `TITLES['restock|eggs']='Eggs for the market'` is used for the cafe's egg need too.
- **Smallest fix:** add the drop prompt at the need's own point (`a.places[0]`), and use `shopOpen` and the keeper name from `a.client`. Key TITLES by place, or drop the fixed title.

### F4. Non-crate restock and errand gigs never need the goods. Plank runs pay about $279 for walking to a door. WRONG BEHAVIOUR (economy). CONFIRMED (ran it)
- For a non-crate need, `needsPickup` is false, so the marker goes straight to the destination (gig-bridge.js:19). fill() moves the goods from the source by itself (needs.js:123-125).
- **Scenario:** "Planks for the shop: Ridgeline Warehouse... Bring 24 planks from Sawmill" (mode 'vehicle', no truck check, because `blocked` is set only for crate goods). Walk to the warehouse door and press E: paid 27873 cents, sawmill 154 -> 130, warehouse 9 -> 33. The same happens with the errand "bread for Hal": the bread is bought from the market at completion, and the player never visits the market.
- It also does not stick (next finding).
- **Smallest fix (pick one):** keep these off the board (in needBoard and boardOnly, allow only crate goods or chores until a carry exists), or require a pickup at the origin for every restock or errand, using the existing `atPickup`/`pickedAt` path.

### F5. A plank delivery to the warehouse is wiped at the next daily tick, and the need reopens: repeatable money loop and goods destroyed. WRONG BEHAVIOUR. CONFIRMED (ran it)
- world-tick.js:30-35 `mirrorPallets` overwrites `world.stock['office:ridgeline-warehouse'].planks` with the pallet count whenever a Ridgeline company exists. Planks from a need fill vanish: they were taken from the sawmill and are gone from the world.
- needsFrom then reopens the restock after the 1-day hysteresis. The script shows: warehouse 33 -> 0 after the tick (company with empty pallets), and an open plank need again.
- **Smallest fix:** exclude PALLET_LINK.place from lowStock restocks in needsFrom (needs.js:85). Alternatively, make the fill create pallets, but that is game.js work.

### F6. A partial fill leaves the player's claim on the need, and the need disappears from the board until it expires. WRONG BEHAVIOUR. CONFIRMED (ran it), rare in play
- fill (needs.js:128) subtracts only the units delivered, so the claim survives with the rest. needBoard (gigs.js:129) hides any need with `claims[NEED_PLAYER]`, and only claim and fill ever lapse claims.
- **Scenario:** the plank need has qty 24, the sawmill holds 10, and the gig is completed within 60 game minutes. You are paid 12123 for 10 planks, the need stays open (10/24) with claim `{player:{qty:14}}`, and it is not on the board 10 hours later. It expires to a mood and prosperity hit.
- **Smallest fix:** in completeNeed, after fill, `needs=release(r.needs,need.id,NEED_PLAYER)`. Alternatively, run the lapse rule in needBoard.

### F7. The supplier and sawmill place points are inside their buildings. LATENT. CONFIRMED geometry, PLAUSIBLE impact
- needs.js:29-30: supplier (83,35.4) is inside the eastbank-supply collider (half-size 8.3 x 3.5, nearest free ground 4.1 m). Sawmill (104,-278) is inside a sawmill collider (nearest free ground 1.0 m).
- Today both are only used as origins of non-crate restocks, which are never visited, and no supplier need appeared in 120 simulated days.
- If a supplier plank restock opens, its destination is unreachable (1.35 m rule), so the gig could never be finished. F4's pickup fix would make the sawmill an origin you must reach.
- **Fix:** use door or front points, as was done for the warehouse.

### F8. A world.day ahead of the clock freezes the world. MINOR. PLAUSIBLE
- worldDue (world-tick.js:23) needs `tickTargetDay > world.day`. normalizeWorld (world-state.js:29) keeps any saved day up to 100000.
- A save whose world.day is ahead of housing.day never ticks again: no supply, no needs, no news. Possible causes are an imported or old save, or a clock that went backwards in visit/join modes; I did not trace those.
- **Fix:** in jobs.js normalizeProgress, clamp `s.world.day` to the tick target day computed there.

### F9. Small ones
- **Give up has no confirmation.** phone.js:100: one tap discards a loaded crate run. The goods go back to the farm, so nothing is lost, but the haul is wasted.
- **Hard-gig exploit.** Abandoning a hard rush gig avoids failGig's rep -2 (gigs.js:223 vs 255).
- **Loaded save with a missing need.** On a save whose active need gig points to a need that no longer exists, "Report back" pays $0 and toasts "Gig complete · $0.00 earned" (completeNeed returns `failed:true`, which game.js:638 ignores).
- **Roster-seeded restock and errand needs are always pruned.** The seeds pushed at world-tick.js:60 carry no `origin`, so needToSlot returns null. This may be intended, but those seeds are dead code.

## Not covered
- Nothing was checked in a browser (stowed parcel visuals, beacons, prompt overlap at the market).
- The Pine Ridge chore point (82,-266) is clear of landmark colliders and terrain, but I did not check it against tree trunk colliders.
- Co-op: claims by other players, host-only ticks, and visit/join clock modes against world.day.
- Whether tickContract runs while driving.
- Load-drag numbers, and the per-frame allocation leftovers from review 1.
- I did not read objective.js or the GPS auto-route for gigs.
