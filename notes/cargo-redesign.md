# Cargo redesign (owner request 2026-11-17; requirements only, nothing built)

## What the owner wants
Every bed can carry every kind of item the game lets you carry, and a CARGO WHEEL (radial menu) is how you take things off (and put things on). It was thought to be in the notes already: it is NOT (searched notes/ and memory on 2026-11-17: only the existing "Cargo panel" is recorded, game.js ~l.191 and cargo.js l.98: one row per kind on the bed plus bulk moves; crates have no row because they cannot be taken off by hand).

## Decisions (owner answers, 2026-11-17)
1. OPEN: a separate key, for example C, pressed near the vehicle's bed when cargo or a parcel is on it. E stays for doors and seats. (Exact key and "near" rule to confirm: standing at the back, or anywhere within reach of the bed.)
2. SHOWS: everything on the bed, by type, one slice per kind with a count (logs, planks, crates, parcel, other items). Picking a slice takes one off (or all, with a modifier: to design).
3. TYPES: all types of items that can be carried by hand (the whole inventory/carry system), on every bed. Today only logs, planks, crates and (since 2026-11-17) the parcel exist as bed pieces; cargo.js BEDS has per-model rules (crates only on some beds, `maxPieces` on the ATV rack).
4. CRATES: you can take a crate off into your hands and carry it slowly (no sprint, slower walk, X puts it down like the parcel). This reverses the current rule "crates are never carried by hand" (cargo.js CRATE_HANDS, game.js story/need crate prompts, starter egg run).

## Design answers (owner, 2026-11-17, dialog)
- KEY: tap C opens the wheel and it stays open; pick with mouse or number keys; C or Esc closes. (Search of dist/*.js for KeyC found no binding; the help text and other key lookups were not checked: verify before building.)
- REACH: within about 2.5 m of the bed, nearest bed wins when two are in reach. Not required while driving.
- PARCEL: a REAL bed piece from the start (not a gig flag): it can be left in a bed and found again; the gig counts it when it is on a bed or in hands. This moves C-E (gig goods as pieces) into the first stages: C-A must model the parcel as a cargo item and migrate gigs.active (save normalisation, starter story, gig-parcel.js STOW_MODELS) in the same step, with old saves converted on load.
- CAPACITY: space units per item type, per bed model (ATV rack keeps maxPieces); hands carry one crate at a time, slow walk. Each item type needs a size in items.js or cargo.js.

## What exists today (so the redesign can start from facts)
- cargo.js: CARGO_KINDS log / planks / crate, BEDS per model (flatbed, worktruck, offroad, atv, shortbed) with space units, gate, crates flag; load/unload rules loadOne/unloadOne/takeAll/takeKind; ORDER planks (`o` tag, not yours to take off).
- gig-parcel.js: the parcel is NOT a cargo piece: it is saved in gigs.active (drop null = held) and only drawn on the bed (STOW_MODELS = atv, shortbed, worktruck, offroad, flatbed since 2026-11-17).
- Prompts: 'Take a log/planks off the <vehicle>' (game.js ~l.675), the Cargo panel rows, takeOffBed; crates are loaded by story/need code only.
- driving.js load drag (ATV only), load-drag.js masses.

## Problems this must solve
1. Two parallel systems (cargo pieces vs the parcel flag vs the hands/carry slot) with special cases (RACK_BUSY, PARCEL_HANDS, CRATE_HANDS).
2. Carry slot: `p.carry` holds one thing; crates and parcels need carry kinds and one rule for speed, sprint, vehicle entry and X.
3. Bed capacity is by space units per model; new item types need a size/weight each (items.js) and a picture on the bed (props, no per-frame cost).
4. The wheel: UI (radial, keyboard and mouse), which vehicle is meant when two are near, a prompt that shows the C key only when there is something to do, tests for the pure parts.

## Proposed stages (small, serial, game.js is shared)
- C-A pure model: one `cargo item` shape for everything carriable (kind, size, mass, carryable, stackable), conversion of logs/planks/crates/parcel to it (the parcel is a real piece: see Design answers), bed rules by model data, save conversion of old gigs.active parcels, tests (no game.js).
- C-B carry slot: crates and any carryable item in hands with the slow-walk rule and X put-down; remove CRATE_HANDS; keep the story egg run working.
- C-C the wheel UI: key C, nearest bed within reach, one slice per kind with count, take one / take all, load from hands, keyboard and mouse, closes on move; replaces the Cargo panel.
- C-D bed pictures for every kind (logs, planks, crates, cartons, loose items) with a shared layout so nothing clips.
- C-E gigs: parcels and other gig goods as ordinary bed pieces (a gig counts them when they are on the bed or in hands).

## Open questions
- Key: is C free (check key bindings in game.js and the help text)? Hold or tap?
- Mass and size for each item type; what stops a tester loading 40 items on an ATV (rack stays small: maxPieces).
- Should a held parcel stay a gig flag, or become a real piece that can be left in a bed and found again?
- Do NPC deliveries and the world (Hal's pallet, crates for needs) use the same pieces?
