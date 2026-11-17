michadr.

# Stage C-A report: pure cargo item model

## Files created
- dist/cargo-items.js (159 lines): item shape, registry, bed rules, canLoad/loadItem/unloadItem/takeKind/summarize/handsRule/massOf, conversions, parcelLocation, migrateParcel. Imports only cargo.js, carry.js, load-drag.js, gig-parcel.js (all pure). No DOM, no three, no random, no clock.
- tests/cargo-items.mjs (108 lines).
- Nothing else edited. cargo.js untouched. No forbidden file touched. No git.

## Design (short)
- Item = {kind,count,space,massKg,hand,stackable,o,gig,model,large}. Planks piece = stack 1..4 (count), o = order tag (not yours to take). Parcel = real piece with gig id + carton model; small 1 space / 3 kg, large 2 space / 6 kg (MASS_KG from load-drag.js). box = generic 1 space / 5 kg.
- Hands speedMul: log .8, planks .85 (same as carry.js), crate .6, parcel .9, box .9; always sprint:false when carryable; empty hands {carryable:false,speedMul:1,sprint:true}.
- Bed rules come from cargo.js BEDS (space, maxPieces, crates flag). canLoad also calls cargo.js fits() for timber/crates (height, cells). ATV rack: ONE piece in total, any kind (so a parcel uses the rack's single slot, same as today's RACK_BUSY). Crates refused on beds without crates:true (flatbed). Crates and timber still do not mix (MIX_CRATES=false; canLoad(...,{mixCrates:true}) switches it on for the wheel stage). Parcel and box are accepted on every bed.
- Saved bed piece (superset of cargo.js): {k:'parcel',g,m,l?} and {k:'box'}. toLegacyCargo gives only the old three kinds (lossy by design); toSavedCargo/fromLegacyCargo carry all five. Hands shape: {kind:'parcel',gig,model,large?}, {kind:'crate'}, {kind:'box'}.
- migrateParcel(progress,{vehicleUid?}): old held parcel (gigs.active, drop null, picked up, not a need gig) becomes a real item: on that vehicle's bed if the caller passes the uid and it fits, else progress.carry = parcel. gigs.active keeps drop:null (now "carried: hands or bed"), so old readers still work. Pure, input untouched, returns the SAME object when nothing to do, idempotent (second run returns the same object). Hands busy and no bed: left alone ('held'), retried next load. parcelLocation(progress) -> 'hands'|'bed'|'ground'|'waiting'|'held'|null is what the gig should use to count "carried".
- Old saves do not record which vehicle the player was riding, so without the uid the parcel lands in the hands (the wheel will let them put it back).

## Test output (real)
```
> node tests/cargo-items.mjs
PASS cargo-items: item shape, garbage rejected, bed rules per model, ATV rack, crates, take/summarize, hands rule, legacy round trips, parcel migration
> node tests/cargo.mjs
PASS cargo.mjs: three beds (the flatbed 120 units: 24 logs or 120 planks or any mix; the pickups 32), mixed loads with the last piece on first off, every piece on its bed, a load slows the vehicle, the save keeps it (and reads the first build's format), the drawn cargo follows it, owned vehicles only, and the flatbed's tailgate opens for someone behind it.
> npm run index ; node tests/brief.mjs
brief 2670 tokens (target 3000), index 30327 tokens (target 32500); 204 modules ...
brief tests passed: 204 modules listed, brief 2670 and index 30327 estimated tokens (budgets 3000 and 32500)
```
cargo-items.js and the test appear in PROJECT-INDEX.md. Cap not raised. Full npm test NOT run (no dist change that needs a release rebuild is wired in; the new file is not imported by the game yet).

Findings while testing: cargo.js hasBed('__proto__') is truthy (BEDS lookup by plain key), so bedRules uses hasOwnProperty. cargo.js capacity(atv,'planks') returns 5 but one rack piece holds a stack of 4: the test notes it.

## Could NOT verify
- Nothing is wired into the game, so no in-game behaviour, no browser check. Full npm test not run.
- Crate pile height beyond what cargo.js fits() says (tests cross-check crate counts against addCrates on worktruck, offroad, shortbed: equal).
- Real old saves from a browser; migration tested on synthetic progress only. The parcel carry shape passes normalizeProgress without throwing, but see request 1: the old normaliser drops it.

## EXACT requested edits (forbidden or out-of-scope files) for C-B / C-C
1. dist/carry.js normalizeCarry (line 33): add, after the planks case, kinds 'crate' and 'box' -> {kind}, and 'parcel' -> {kind:'parcel',gig,model,large?} (use fromLegacyCarry from cargo-items.js, or inline the same checks). Also carryEffects (line 12): replace the kind chain with handsRule(fromLegacyCarry(carry)) so speed/sprint come from one table (crate .6, no sprint). Without 1, a migrated parcel in hands is dropped on the next load.
2. dist/jobs.js normalizeProgress: after normalising vehicles and gigs, call progress=migrateParcel(progress) once (import from cargo-items.js); pass {vehicleUid} only if the save records the ridden vehicle. Also normalise vehicles[].cargo with a version of cargo.js normalizeCargo that keeps {k:'parcel'} and {k:'box'} (cargo.js normalizeCargo currently filters them out: edit cargo.js normalizeCargo filter and pieceSpace (parcel 1 or 2, box 1) and slotPositions kind mapping, or have cargo.js delegate to cargo-items.js; cargo.js is not forbidden but was out of this stage's edit list).
3. dist/cargo.js: CRATE_HANDS and unloadOne/unloadKind crate refusals (lines 38, 92, 101): remove in C-B once crates can be taken by hand; loadCarry must accept carry.kind 'crate'/'parcel'/'box' (or be replaced by cargo-items loadItem/unloadItem/takeKind). pieceSpace needs parcel/box. cargoText/cargoMassKg (load-drag.js line 11) must count parcel and box (parcel MASS_KG.parcelSmall/Medium) so the ATV load drag keeps counting a stowed parcel.
4. dist/game.js (forbidden): (a) carry slot: replace the `p.carry` log/planks special cases with handsRule(); remove CRATE_HANDS use and the story/need crate prompts that say crates stay on the bed; X puts down any carry kind (crate, parcel, box) like planks; vehicle entry refused while hands hold a crate (mountError in gig-parcel.js line 29 should use the same). (b) the Cargo panel (~l.191) and the 'Take a log/planks off the <vehicle>' prompt (~l.675): rebuild from summarize(fromLegacyCargo(cargo)) and takeKind(); prompt shows key C only when summarize is non-empty and a bed is within 2.5 m. (c) stowing a parcel: today gig stays held and STOW_MODELS draws it; replace with loadItem(model, items, parcelItem) writing {k:'parcel',...} into the vehicle cargo, and unstow with takeKind(items,'parcel'). (d) Check KeyC is unbound in game.js and the help text (not checked here).
5. dist/gig-parcel.js (allowed only as a request): parcelHeld/parcelWaiting stay; add use of parcelLocation (cargo-items.js imports gig-parcel.js, so gig-parcel.js must NOT import cargo-items.js: put the location check in gigs.js or game.js instead). STOW_MODELS/canStow/stowed/mountError/RACK_BUSY become redundant once the parcel is a bed piece; delete in C-C with their tests (carry-pose, forest, gig-parcel tests use them).
6. dist/gigs.js: delivery/fail/expire must remove the parcel piece from carry and from every vehicle's cargo ({k:'parcel',g:gigId}); "gig counts it when it is on a bed or in hands" = parcelLocation(progress) in ['hands','bed'].
7. dist/driving.js / load-drag.js: parcelMassKg(active) can read the piece (l flag) once the parcel is a bed piece.

## Confidence
- Item model, bed rules, take/load/summarize, hands rule: high (cross-checked against cargo.js capacity and addCrates counts).
- Legacy cargo/carry round trips and idempotent migration: high on synthetic data, medium on real saves.
- Wiring requests: medium (written from reading, not from editing game.js).