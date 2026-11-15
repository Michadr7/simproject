# Farm job and owning the farm: design (Husky Ranch)

Design only, nothing built. Opus 5.5, 2026-11-17. (m) = measured in code or notes, (e) = estimate or proposal.
Read: notes/map-master.md 1.3, 3.1 to 3.8, 7.2, Decisions blocks; notes/crime-system-design.md section 7; notes/ground-detail-design.md
section 7 (GD10); dist/jobs.js, careers.js, shift.js, skills.js, grid.js, forest.js, orders.js, ownership.js, items.js, cargo.js,
phone-jobs.js, map-definition.js (fields, employers). notes/farm-vehicles-design.md (FV) appeared at the end of this work: its
cell codes, implement widths, work speeds and vehicle prices are adopted here; where the two disagree on money and growth time,
section 2b lists it and asks.

## 0. What exists today (m)
- Clock: 1 real s = 30 game s. Game hour = 2 real min, game day (1440 game min) = 48 real min, game week (WEEK 7) = 5.6 real h.
  The clock only runs while someone plays, so every "per game day" rule below is per 48 minutes of play.
- Jobs: careers.js (hire, ranks, rep 0..100 per employer, promotions, tools granted, company store, owner and coOwners) and shift.js
  (clock in/out, 2 to 4 daily tasks picked by counters, never random, wage per game hour on site, PIECE_PAY, bonus 2500 x rank,
  REP allTasks +5 / fullShift +2 / unfinishedTask -2, 60 min off-site limit). Employers are data in map-definition.js; only
  Ridgeline exists: wages 800/1000/1200/1400/1600/1800 cents per game hour (Trainee to Foreman), needs level 1/3/5/7/10/15,
  shifts 0/3/6/10/15/25, rep 0/20/35/50/60/75. A Trainee shift (12 game h = 24 real min) pays about $96 + pieces + $25 = ~$140;
  a Foreman about $400. So wages run about $350 to $1,000 per real hour.
- Skills: skills.js has only `lumberjack` (xpForNext = 40 + 20 x (level-1), MAX_LEVEL 20; level 5 = 280 XP, 10 = 1,080, 15 = 2,380).
- Prices (m): worktruck $4,500, flatbed $8,000, off-road $11,000, S70 $500; houses $11,000 to $15,000 (rent $140 to $190/week);
  ATV about $4,000 (user); plots (placeholder) $20k to $70k. No bank, loan or mortgage exists in code (RU3 proposes a 'loan' tenure).
- Farm today: zone 'farm' (Willow Fields) with grid cells {type:'farm', crop, tilled} in grid.js (dormant), three fields
  field-wheat 75 x 38 m (0.285 ha), field-plowed 50 x 36 (0.18 ha), field-green 56 x 36 (0.20 ha) = 0.67 ha; farmstead props;
  Hal Brennan owns the Willow Farmhouse. No crop growth, no ranch employer, no Freight Exchange yet (BZ3).
- Assets in: Quaternius barns, silo, coop, windmill, fences, 7 static animals (cow, horse, llama, pig, pug, sheep, zebra);
  JUFF and KidBi tractors and the KidBi tank conformed. Missing models: combine, grain cart (being sourced), plow, seeder,
  mower/baler, hay bale, crate, hens.

## 1. The job ladder (Hal Brennan's Husky Ranch, employer id `husky-ranch`)
How it differs from the other jobs (all defaults, named in data):
- RELAXED: employer flag `relaxed:true` makes shift.js use REP.unfinishedTask 0 (no rep loss), no late penalties, no timers on any
  task; an unfinished task just pays nothing. Light energy drain: `RANCH_DRAIN` .8 x while clocked in at the ranch. A porch bench
  restores energy 2 x (sit with E).
- Hours `{from:390, to:1050, lastIn:1020}` (06:30 to 17:30 = 11 game h = 22 real min), matching map-master 3.1.
- Wages about 7% under Ridgeline (the price of no pressure), same needs ladder so both careers feel equal in length.
- Skills: `farming` gates the ranks; `animals` (animal care) gives perks and the owner herd cap.

| Rank | Wage c/h | Needs (farming lvl, shifts, rep) | Grants | New tasks |
|------|---------|-----------------------------------|--------|-----------|
| Ranch hand | 750 | 1, 0, 0 | feed-bucket | feed, water, eggs, fence |
| Field hand | 900 | 3, 3, 20 | shears | milk, shear, bales, pick |
| Tractor driver | 1100 | 5, 6, 35 | ranch keys (JUFF) | plow, seed |
| Operator | 1300 | 7, 10, 50 | - (KidBi + tank) | spray, water-field |
| Harvest operator | 1500 | 10, 15, 60 | - (combine, cart) | harvest, cart, deliver |
| Foreman | 1700 | 15, 25, 75 | barn-office key | none new (4 tasks a day); lease and purchase offers open |

Tasks, each a small loop (piece pay in cents goes into shift.js PIECE_PAY; XP into skills.js XP; real times at default speed):
| Task kind | Loop | Real time | Piece pay | XP | Tools / vehicle |
|-----------|------|-----------|-----------|----|-----------------|
| feed | take feed from the barn bin (E), carry to a pen trough (E) | ~40 s per pen | 100 per pen | 4 animals | feed-bucket |
| water | hand pump (hold E 3 s) at a pen trough | ~15 s | 50 | 2 animals | none |
| eggs | coop door (E), basket into the farmhouse fridge crate | ~60 s | 100 per basket (12) | 3 animals | none |
| fence | a broken panel shows a red tag; hold E 4 s | ~30 s | 150 per panel | 5 farming | fence-tools (granted with the bucket) |
| milk | cow in the milking stall, hold E 5 s, can to the cooler | ~45 s | 100 per cow | 4 animals | none |
| shear | sheep or llama ready (every 7 game days), hold E 6 s | ~40 s | 200 | 6 animals | shears |
| bales | carry a bale (carry.js new kind) barn to pen or to a trailer | ~20 s | 25 per bale | 2 farming | hands or tractor front |
| pick | market garden: hold E on a ripe row cell, crate fills at 20 kg | ~2 min per crate | 100 per crate | 3 farming | none |
| plow / cultivate | JUFF + plow (2.4 m) or cultivator (3.0 m, stubble only) | 1 ha ~33 / ~20 min (FV rates +30% turns) | 50 per 100 m2 | 1 per 100 m2 | JUFF tractor, plow or cultivator |
| seed | tractor + 3.0 m seeder over plowed/cultivated cells | 1 ha in ~23 min | 40 per 100 m2 | 1 per 150 m2 | tractor, seeder |
| spray / water-field | KidBi + tank, 6 m boom over seeded or growing cells | 1 ha in ~8 min | 10 per 100 m2 | 1 per 400 m2 | KidBi, tank (FV fill points) |
| harvest | combine with the 6 m header over ripe cells | 1 ha in ~13 min + unloading | 60 per 100 m2 | 1 per 100 m2 | combine |
| cart | drive the grain cart beside the combine, unload into the silo | ~3 min per load | 300 per load | 5 | tractor + grain cart |
| deliver | grain or produce to a buyer (section 3) | 3 to 6 min | 1500 | 10 | worktruck, flatbed, cart |
Also relaxed side loops with no pay, a little XP: brush the horse (+1 ranch rep a day, cap), walk the pug (energy +5, the ranch dog).
Task targets (amounts lists): feed [4,6], water [4,6], eggs [1,2], fence [2,3], milk [2,3], shear [1,3], bales [8,12], pick [2,3],
plow/seed/spray/harvest in 100 m2 units [20,30,40], cart [1,2], deliver [1]. A rank 1 shift earns about 60 XP (level 3 by shift 2,
level 5 near shift 5), a rank 3 to 4 shift about 100 XP: same pace as the Ridgeline ladder.
Pay check: rank 1 shift = 11 h x $7.50 + ~$15 pieces + $25 bonus = ~$122 per 22 real min (~$330/h). Tractor driver plowing
0.65 ha in a shift: $121 + $33 + $75 = ~$229 (~$620/h). Foreman ~$187 + pieces + $150 = ~$370 (~$1,000/h). In line with Ridgeline.
Casual board: a "Day work" board by the barn offers 3 rank-1 tasks to anyone not hired (paid per piece x 1.5, no wage, max 3 a
game day): the drop-in way in, and the first-hour hook.

## 2. Crops, field cells and animals
Fields (data in map-definition.js `fields` gains `crop` and `kind:'crop'|'garden'|'pasture'`): the three existing (0.67 ha) plus
West 1 100 x 100 m (1.0 ha) and West 2 100 x 75 m (0.75 ha) in the growth rectangle, a 20 x 20 m market garden by the farmhouse,
and a 120 x 80 m pasture around north-west-hill (keeps the hill: answers map-master Q5). Cropland 2.42 ha = 24,200 cells.

Cell states (crop-rules.js, one nibble per 1 m cell; GD10 adopts these codes instead of its own 0..6):
`0 BARE` (fallow grass) -> plow -> `1 PLOWED` -> seed -> `2 SEEDED` -> `3 GROW1` -> `4 GROW2` -> `5 GROW3` -> `6 RIPE` -> header ->
`7 SWATH` (hay only, until baled) or `8 STUBBLE` (grain: chaff out the back) -> plow -> `1`. Stubble left alone stays stubble (GD10).
Hay cells regrow without plowing: `8 -> 3` after one stage. Cutting 3..5 gives stubble and no yield (GD10 rule kept).
Growth: a field-wide tick at fixed clock times, `STAGE_MIN` 360 game min (00:00, 06:00, 12:00, 18:00): every cell in 2..5 steps one
stage. Seeded to ripe = 4 ticks = 1 game day = 48 real min (plant in the morning, harvest the next morning). Watered or rained-on
fields that day: `WET_STAGE_MIN` 270 (36 real min). Catch-up on load or after sleep: advance by the ticks passed, max 4. Ripe holds
`RIPE_HOLD_DAYS` 3, then yields `OVERRIPE` .75 (never lost). Deterministic, no per-frame cost: 24,200 cells x 4 ticks a day.
Seasons: one game week each, cycling spring, summer, autumn, winter (a year = 28 game days = 22 real h). Growth x1 / x1.1 / x1 / x.5;
autumn sale prices +10%; winter animals eat 1.5 x hay. Weather by day number (never random): `WEATHER` sunny 50%, cloudy 30%,
rain 20% (rain = wet day: faster growth, uGdWet 1 from GD3, mud). Yield roll per field per cycle from the day number: .85..1.15.

Yields and prices (real-world sized, metric; bushels shown in the phone for flavour, 1 t wheat = 36.7 bu):
| Crop | Yield | Price | Per ha | Seed + spray cost/ha | Notes |
|------|-------|-------|--------|----------------------|-------|
| wheat | 4.0 t/ha (0.4 kg/cell) | $250/t ($6.80/bu) | $1,000 | $60 + $50 | first crop, exists as a surface |
| hay | 5.0 t/ha as 20 kg bales (250/ha) | $4/bale | $1,000 | $0 (regrows) | animals eat it first |
| corn (later) | 6.0 t/ha | $200/t | $1,200 | $90 + $50 | slower: STAGE_MIN 450 |
| potatoes (garden) | 25 t/ha (2.5 kg/cell) | $0.40/kg (crate $8) | 0.04 ha = $400 | $40 | hand-picked |
Field worth (land value): $8,000/ha, so West 1 = $8,000, field-wheat = $2,280; one wheat cycle on West 1 nets about $800.
Machines: combine grain tank `GRAIN_TANK` 3,000 kg (0.75 ha), grain cart `CART_KG` 8,000, unload 150 kg/s, silo `SILO_KG` 60,000.

Animals (map-master: 6 to 10; no killing, no slaughter, no pelts from the farm: pelts stay a hunting product at Eden Outdoors):
- Hal's herd 10: 3 cows, 3 sheep, 2 pigs, 1 horse, 1 llama; plus the pug as ranch dog (not counted) and 12 hens kept inside the
  coop (no model, never drawn). Zebra not at the ranch. Drawn instanced, static now, 1 draw call per species (6), clips later.
- Needs per game day: feed once, water once (a trough holds one day for its pen). Missed: a hungry icon and no product next morning.
  Never sick, never dying, never sold for meat; an owner may sell an animal only to another farm (P7 or Hal) at its buy price.
- Products at 06:00 if fed and watered yesterday: cow 20 L milk ($0.80/L), hens 24 eggs ($4/dozen), sheep 4 kg wool and llama 3 kg
  fibre every 7 game days ($5/kg), pig 1 compost load every 2 days ($10, or +20% yield on the market garden), horse nothing
  (rides later). Feed: cow and horse 1 bale/day, sheep, llama, pig 0.5 bale/day, hens 2 kg grain/day. Buy prices: cow $1,200,
  sheep $300, pig $400, llama $600, horse $2,000, hens $15 each.
- Who tends them: the hired player on shift, an owner, or an NPC hand (section 4) who does feed and water off-screen at 07:00.

## 3. Economy
Buyers (prices drift .9..1.1 by day number, like forest.js marked blocks): ranch silo gate pays 85% at once (no driving);
Eastbank grain dock pays 100% (a Freight Exchange haul, BZ3); Alder Bakery buys wheat at 120% up to 1 t a game week; Corner Market,
diner and seafood shack buy milk, eggs and potatoes at 100%; Eden canteen contract (Bruce Hughes) takes up to 2 t wheat and 200 L milk
a week at a fixed 105%, 10% fee to Bruce on the haul like every Eden haul. Hal's 40% share in the renter stage comes off first.
Running costs: seed and spray as the table; fuel about $35/ha for all passes (TR8 fuel and wear sets the truth); machine wear
about $40/ha through garage.js repair; feed bought only when the hay runs out; property upkeep `RANCH_UPKEEP` $250/week; NPC hand
`HAND_WAGE` $120/game day.

Per-season (one game week, 5.6 real h) sheet for the owned ranch, owner doing about 3 real hours of field work, one NPC hand:
| Line | Amount |
|------|--------|
| Wheat: 4 ha-harvests x 4 t x $250 | $4,000 |
| Hay: 2 cuts of 0.7 ha = 350 bales, 49 fed (7 a day), 301 sold x $4 | $1,204 |
| Animals: milk 420 L $336, eggs 14 dozen $56, wool 12 kg + fibre 3 kg $75 | $467 |
| Revenue | $5,671 |
| Seed $240, spray $200, fuel $160, wear and repairs $160, bought feed (hens) $60 | -$820 |
| NPC hand 7 days x $120, upkeep $250 | -$1,090 |
| Profit before the purchase note | $3,761 (~$1,250 per real hour worked) |
| Hal's note (section 4) | -$3,000 |
| Profit while paying the ranch off | $761; after 12 weeks the full $3,761 |
For scale: a Foreman earns about $1,000/real h; so owning pays a little more per hour, the land builds equity, and the hand and
the animals keep earning while the owner drives a Freight Exchange haul. A renter on a 60/40 share of field-wheat: 1.14 t x $250 x
.6 = $171 per cycle for ~12 real min of work (~$850/h, no costs: Hal supplies seed, fuel and machines).

## 4. Owning the farm: hand -> renter -> owner
1. Hired hand: careers.js as today (hire at the farmhouse door, Hal's interview).
2. Renter (ranch rep 50, Operator rank, Standing >= -10): Hal offers a SHARE lease on field-wheat (later any field): the player
   works it off-shift with Hal's machines, Hal supplies seed and fuel and keeps 40% of the sale. No rent, no risk. At ranch rep 60
   a CASH lease opens: $400/week for the three old fields, keep 100%, pay own seed and fuel; missing rent only ends the lease.
3. Owner (Foreman, ranch rep 75, Standing >= 0, a game week as a cash renter): Hal retires to the porch and sells Husky Ranch:
   list $60,000, `FAMILY_PRICE` $45,000 to his foreman: all fields, barns, silo and its stock, the 10 animals, the JUFF tractor and
   the KidBi + tank. Payment: Hal carries the note: 20% down ($9,000), 12 weekly payments of $3,000 taken at 08:00 on the bill day
   (ownership.js loop: WEEK 7, GRACE 2). Pay off early any time. Missed payments never repossess: after GRACE Hal takes 50% of
   every sale until the missed amount is paid (soft, no hard fail). A bank mortgage (RU3) can replace the note later.
- The ranch is a company (careers.js companies['husky-ranch'].owner = {kind:'player'}), not a plot: it does not use the one-plot
  slot; there is one ranch per world, so in co-op only one player can own it (map-master: nobody buys everything). P7 hobby farm
  stays a plot: if you own the ranch, P7 is a plain plot to you.
- Ownership gives: the fields and their cell state, barns, silo (sell when prices are up), the animals (cap 10, +1 per 2 animal-care
  levels above 10, max 16), the farm phone app, hiring NPC hands (max 2: hand = animals at 07:00; field hand = one field op a day,
  works off-screen, $150/day), the casual board, rename (renameCompany exists), co-owners (setCoOwner exists).
- Co-op roles (multiplayer later): owner (all), co-owner (all but co-owner list and selling the ranch), worker (clocks in on the
  owner's ranch as an employer, paid from ranch cash at the rank wage).
- Soft risks only: a low yield roll (.85), an overripe field (.75), a damaged machine (VD bands: Limping still drives, repair at
  Eastbank or a repair kit), a hungry animal (no product), winter. Never death, theft or loss of the ranch.
- Bruce Hughes: buys through the Eden canteen contract; Eden Outdoors buys wool at 90%; he offers to buy the ranch's grain futures
  at a fixed price once a season (optional, safe, 5% under the average). He never owns or forecloses the ranch.

## 5. Skills, reputation, Standing
- skills.js gains `farming` and `animals` (freshSkills, normalizeSkills, stats grainHarvested, animalsFed). Perks: farming level
  3 / 8 / 12: plow and seed +10% speed each; animals level 3 / 8: chores 20% faster, level 10+: herd cap rises; level 5: wool +1 kg.
- Ranch rep (careers.js rep for husky-ranch): 20 barn key (free hay for an own horse later), 35 may buy animals for P7, 50 share lease,
  60 cash lease, 75 purchase offer.
- Standing (crime note, -100..100, never mixed with rep): hired hand has NO gate (the redemption job); lease needs >= -10; purchase
  >= 0. Hook for crime Q5 (Standing above 0): the autumn Harvest Day volunteer gig, +2 Standing, once a season, cap +10.
- Other regions: Eden canteen contract needs Eden rep 20 (when Eden exists); Freight Exchange grain hauls need driving rep later.

## 6. Save format and multiplayer
Farm state lives on the company so an owner inherits it (like forest.js stock): progress.companies['husky-ranch'].farm, normalised
by `normalizeFarm` in new dist/farm.js, called from careers.js normalizeCompanies (one line). Optional field: no schema bump.
```
farm: {v:1, tick:<abs game min of the last stage tick>,
 fields:{'field-wheat':{crop:'wheat', cells:'L…', roll:85..115, wetDay:n, ripeAt:n}, ...},
 animals:[{id:'cow-1', sp:'cow', name:'Daisy', fed:day, water:day, shorn:day}],   // max 16
 coop:{eggs:0..48, fed:day}, fences:['f12','f40'], bales:0..400,
 silo:{wheat:kg, corn:kg}, stock:{milkL, eggs, woolG, compost, potatoesKg},
 leases:[{player:'me', kind:'share'|'cash', fields:[ids], since, nextBillDay, missed}],
 note:{left:cents, weekly:cents, nextBillDay, missed, share:0|50}, staff:[{role:'hand'|'field', since}],
 books:[{week, rev:{wheat,hay,milk,eggs,wool,other}, cost:{seed,spray,fuel,wear,feed,wages,upkeep,note}}] /* last 4 */}
```
Cells: row-major nibble codes, run-length: `'L'` + base64 of [code byte, LEB128 run] pairs; if that is longer than raw, `'R'` + base64
of packed nibbles (2 cells a byte). A uniform field = 4 bytes; field-wheat half-cut in 6 m strips ~ 300 bytes; worst case raw
12.1 KB for all 24,200 cells. Unknown field ids dropped, bad strings reset the field to BARE, counts clamped.
Multiplayer (note only, M-stages): the host owns the farm; clients send ops `{t:'farm-op', field, op:'plow'|'seed'|'spray'|'cut',
a, b, width}` (segments, like cutSwath input, never cell arrays); growth ticks are deterministic so nobody sends them; a join gets
the cells strings; animal chores `{t:'farm-chore', animal, kind}`. Keep each message under the 4096-byte relay cap.

## 7. UI
- Phone Jobs app: Husky Ranch appears from data (employers list); task lines read "Feed 4 pens (relaxed: no penalty)".
- New phone app "Farm" (renter and owner; hands see only Fields read-only): Fields (each field drawn as a small cell map in state
  colours, % ripe, "ripe in 14 min", crop, yield roll hidden), Animals (fed / water / product icons per animal, names), Silo (stock,
  today's price at each buyer, Sell at gate), Books (this season vs last, the sheet of section 3), Staff (hire, wages), Lease/Note.
- Vehicle HUD rows (vehicle-hud.js, under the damage row): implement "Plow: down (Q)" / "Header: lowered (Q)", work "0.32 ha done
  of 1.0", rate "11 m2/s", grain tank "2,140 / 3,000 kg", cart "5,600 / 8,000 kg", tank water "1,800 L", boom "12 m".
- Ranch job board by the barn (world board like the gig board): Day work (3 casual tasks), a "Hal is hiring" line, today's prices.
- First hour (tutorial hooks, starter story already ends at Hal's): beat 1 feed the cows (bucket, bin, trough arrows), beat 2 water
  at the pump, beat 3 eggs from the coop, beat 4 Hal offers the job ("No rush here. The animals don't own a watch."), beat 5 first
  shift; the first tractor lesson at Tractor driver rank (a 20 x 20 m practice strip of field-plowed, plow down/up, turn at the end).

## 8. Build plan (Sonnet each unless noted; one stage per agent run; tests are node tests or packaged-game browser-lab tests)
| Stage | Work | Files | Tests | Conflicts | User eye-check |
|-------|------|-------|-------|-----------|----------------|
| FJ1 | crop-rules.js pure: codes, ticks, catch-up, seasons, weather by day, yield, workSwath(grid, field, a, b, width, from, to), cutSwath (GD10), RLE encode/decode | new dist/crop-rules.js | new tests/crop-rules.mjs | none (new file); GD10 must import it | nothing to see; read the numbers table |
| FJ2 | farming + animals skills, stats, phone Skills lines | skills.js, phone Skills section | skills, careers re-run | skills.js beside nothing else | Skills screen shows 3 skills |
| FJ3 | husky-ranch employer data, relaxed flag, farm TASKS and PIECE_PAY, casual board rules | map-definition.js, shift.js, careers.js | new tests/ranch-careers.mjs, careers.mjs, map.mjs | not beside R3/RU1/BZ3 or any map-definition or shift.js stage (BZ3, L6) | hire at the farmhouse, clock in, task list |
| FJ4 | farm.js normalizeFarm + save; animals data, pens, instanced statics, feed/water/eggs/milk/shear chores with E prompts | new dist/farm.js, careers.js 1 line, map-definition.js (pens), game.js hooks, world.js placement | new tests/farm-save.mjs, ranch-chores-game.mjs | game.js and world.js: never beside GD5, R3 data, visual overhaul | animals in pens, prompts, products next morning |
| FJ5 | fences, bales (carry.js kind), market garden pick | carry.js, game.js, farm.js | carry.mjs, new ranch-garden.mjs | carry.js: after the "planks cannot drop" bug fix | bale carry, broken fence tags |
| FJ6 | field cells on screen: R8 DataTexture per field in the ground shader, crop cover by stage (this is GD10 part a) | ground-shader.js, world.js, ground-cover rules | ground-shader.mjs, new field-look.mjs | world.js stages; GD5 cover must exist first | each state colour, growth over a game day |
| FJ7 | tractor field work: implement hitch, plow and seed, HUD rows, piece pay per m2 | driving.js, vehicle-hud.js, farm.js, game.js | new field-work-game.mjs | needs FV tractor import and hitch stage; not beside TR8/TR9 | plowed strip behind the plow, HUD numbers |
| FJ8 | KidBi tank: fill at the windmill pump, spray/water a field, troughs from the tank | farm.js, driving.js, cargo.js bed | field-work-game.mjs | FV tank stage; cargo.js | boom width, wet look |
| FJ9 | harvest: combine header cut, grain tank, cart transfer, silo unload; chaff and sound (GD10 part b) | driving.js, debris.js, audio.js, vehicle-sounds.js, farm.js | new harvest-game.mjs | FV combine/cart import; never beside an audio.js stage | 6 m clean cut, stubble, chaff, tank fills |
| FJ10 | buyers and prices, silo gate sale, deliveries; Freight Exchange grain hauls | farm.js, game.js, (BZ3 files) | new farm-market.mjs | after BZ3 | prices change by day, sale toast |
| FJ11 | phone Farm app (Fields, Animals, Silo) + share and cash leases | new phone-farm.js, phone.js, index.html, style.css | new phone-farm.mjs | phone*.js: not beside GP1 | app screens, lease offer from Hal |
| FJ12 | buying the ranch: Hal's note, books, upkeep, soft risks; companies owner flip | farm.js, careers.js, phone-farm.js | new farm-ownership.mjs | Opus check of money rules first (short) | purchase flow, weekly bill, missed-payment share |
| FJ13 | NPC hands, co-op roles (owner, co-owner, worker) | farm.js, careers.js, shift.js | farm-ownership.mjs | shift.js stages | staff screen, chores done at 07:00 |
| FJ14 | first-hour tutorial beats and the ranch board | starter.js, game.js, world.js (board) | starter tests, new ranch-intro-game.mjs | starter/gigs stages | the five beats in a fresh save |
| FJ15 | seasons and weather on screen (sky/wet hook), growth multipliers live | farm.js, sky.js one uniform, game.js | crop-rules.mjs | visual overhaul owns sky.js: coordinate | rain day, winter look |
Order: FJ1, FJ2, FJ3 can start now (pure or data). FJ4 to FJ5 after the farm props are placed. FJ6 after GD5. FJ7 to FJ9 after the
FV stages (tractor import, hitch, combine and cart). GD10 in ground-detail-design.md becomes FJ6 + FJ9 (update that note when built).
Performance (flag): animals 6 draw calls; field DataTextures 6 small R8 textures (24 KB); crop cover follows GD5 budgets; growth
ticks 4 a game day over 24,200 bytes (well under 1 ms).

## 9. Open questions for the user (recommendation first)
1. Growth: seeded to ripe in (a) 1 game day = 48 real min [rec], (b) 24 real min, (c) 2 game days per stage (GD10 note, ~6.4 h)?
2. Seasons: (a) 4 seasons of one game week, winter half growth [rec], (b) no seasons, (c) winter stops crops?
3. Paying for the ranch: (a) Hal's note, 20% down + 12 weekly payments [rec], (b) bank mortgage (RU3), (c) cash only, (d) Bruce backs it for a share?
4. Does the ranch use the player's one plot? (a) no, it is a business, one owner per world, co-owners allowed [rec], (b) yes.
5. Ranch price: (a) list $60k, $45k to Hal's foreman [rec], (b) $30k, (c) $90k?
6. Herd: (a) 3 cows, 3 sheep, 2 pigs, horse, llama + pug dog + unseen hens [rec], (b) add the zebra as a novelty, (c) 6 animals only?
7. Hay without mower and baler models: (a) Hal bales off-screen, the player moves bales [rec], (b) source mower and baler now, (c) no hay?
8. Plow and seeder have no models: (a) source or make simple implement models in the FV stages [rec], (b) invisible implement mode on the tractor first, (c) only the KidBi tank works fields at first?

## User decisions (answered in the dialog, new chat)
1. Growth: 2 game days per stage (about 6.4 h), the GD10 pacing (NOT 1 game day = 48 min). 2. Seasons: 4 seasons, but each lasts MUCH longer than the proposed game week; winter is the shortest (season lengths to set in FJ15 / crop-rules). 3. Ranch payment: the player chooses, either the full price up front or 20% down plus payments. 4. The ranch does NOT use the player's one plot: it is a business; owner plots will be expanded so a player can also start a business from scratch on an empty plot; co-owners allowed. 5. Price: list $60k, $45k to Hal's foreman. 6. Herd: 3 cows, 3 sheep, 2 pigs, horse, llama, pug dog plus unseen hens (no zebra). 7. Hay: the user WANTS bales; mower and baler models must be sourced (FJ5 bale carry waits for models). 8. Plow and seeder: source or make simple implement models in the FV stages.