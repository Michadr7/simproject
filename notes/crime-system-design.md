# Crime and law: design note (proposal, 2026-11-14)
Design only. The user's decisions are in map-master.md "Decisions: crime and law"; everything here is a proposal to correct.
Tags: (m) measured in the code, (e) estimated. Money is integer cents. All rules are pure functions in a new `dist/law.js`.

## 1. Data model
- Save field `progress.law`, normalised in `normalizeProgress` (dist/jobs.js:31) like `orders`/`coolers`: `s.law=normalizeLaw(a.law)`.
  A new optional field, no schema bump (same as `vehicles` in 0.33).
- `{standing:0, debt:0, weeklyDue:0, nextDueDay:null, missed:0, licence:null, record:[], nextCaseId:1}`
  - `standing` integer -100..100, clamped. `debt`, `weeklyDue` cents, 0..1e10. `licence` `{kind:'hunting', untilDay}` or null.
  - `record[]` last 20 cases `{id, crime, day, fine, paid, force}`; bad entries dropped on load.
- Chase state is NOT saved: loading during a chase starts unseen (a save mid-chase is not an escape route: see Q6).
- Pure API: `commitCrime(law,crime,day)`, `witnessCheck(event,witnesses,world)`, `chaseStep(chase,dt,seen)`, `arrest(law,progress,crime)`,
  `payWeekly(law,cash,day)`, `dailyStanding(law,day)`, `canHold(law,gate)` (gates: 'police-job','eden-job','licence').

## 2. Crimes (fines are placeholders)
| Crime | Severity | Fine | Standing | Witnessed by |
|---|---|---|---|---|
| Weapon out after the no-weapon warning (ignored 10 s) | 1 | $50 (5000) | -3 | police, rangers |
| Hunting without a licence (a shot fired or animal taken) | 2 | $250 (25000) | -8 | rangers, wardens, police in range |
| Shot within 100 m of road/camp/plot (map-master hunting rule) | 2 | $150 (15000) | -5 | anyone on patrol |
| Over the daily bag limit | 2 | $200 per animal | -5 | rangers, wardens |
| Hunting outside the pass rectangle / out of zone | 2 | $200 (20000) | -6 | rangers, wardens |
| Evading (chase started, player did not stop) | 3 | +$300 (30000) | -10 | the chasing force |
| Missed weekly debt payment | - | none | -5 each | automatic |
Repeat offence inside 7 game days: fine x1.5 (e). No crimes against people (no damage system); arrows hit animals only.

## 3. Witness rule
- Event-driven only: checks run when a crime event fires (shot, kill, weapon-warning timeout, zone entry with weapon out), never per frame.
- During a chase, one check per 0.5 s (e) for the chasing force only.
- A witness sees the event if: on duty, within radius (police 40 m, warden 60 m, ranger 80 m (e)), and one ray to the player
  is not blocked by buildings (reuse the existing building collision boxes; terrain and trees ignored to stay cheap).
- Gunshots: heard within 150 m (e) by any patrol: the patrol walks/drives to the spot (a "spotted" without line of sight).
- No witness = no crime recorded. The kill still counts toward the bag limit, so a later licence check can find it (Q3).

## 4. Chase
States: `unseen -> spotted (5 s to comply: stop, put weapon away) -> chase -> lost -> unseen`, or `-> caught`.
- Spotted: complying = a ticket on the spot (fine, no holding, no evading charge). Running = chase.
- Search radius centred on the last seen position: Ironwood 120 m, Kaspian Bay 160 m, Blackstone Rangers 250 m (e).
- Lost: outside the radius and not seen for 30 s -> unseen, case closed (the crime stays unrecorded).
  Seen again inside the radius -> back to chase, the circle moves to the new position.
- Caught: on foot, a pursuer within 2 m for 2 s; in a vehicle, speed under 1 m/s for 3 s with a pursuer within 6 m (boxed in or stopped).
- Budgets: 10 cars, 15 skinned characters. Max pursuers: 2 cars per force, 3 in total; officers ride in cars (1 skinned each).
  Patrols per region: Ironwood 2 officers 07-19 (m, map-definition.js:328) of which 1 drives; Blackstone 1 ranger car; Kaspian 1 officer.
  When the player is over 400 m (e) away, patrols freeze as idle props in their town (no AI cost).
- Pursuit AI: follow the road graph to the player's nearest road node; if the player is ahead on the same road, aim at
  the node 2 ahead (intercept). Off road: straight line, slowed by the surface factor. No physics rams, no damage.

## 5. Police vehicles
Reuse the `police-car` prop (map-definition.js:423, decor today) and the Pevrolet pickup as recolours, driven by the same
`vehicle.js` physics (dist/vehicle.js:26-28). Numbers in m/s, rMin in m, aLat in m/s^2:
| Force | Body | top | rough | rMin | aLat | Feel |
|---|---|---|---|---|---|---|
| reference worktruck | - | 17.9 (m) | 0 (m) | 7 (m) | 10 (m) | |
| reference off-road pickup | - | 26.8 (m) | .35 (m) | 6.5 (m) | 14 (m) | |
| Ironwood Police | police-car | 24 (e) | 0 (e) | 6 (e) | 14 (e) | fast on asphalt, bogs down off road |
| Kaspian Bay Police | police-car / pickup | 25 (e) | .2 (e) | 6.5 (e) | 13 (e) | the mix |
| Blackstone Rangers | pickup, green | 23 (e) | .45 (e) | 6.5 (e) | 12 (e) | slower on road, keeps speed on dirt |
Pursuers stay just under the player's best car on roads so escape is possible. The police-car needs a drivable class (hx/hz to measure).

## 6. Arrest flow
1. Caught -> input locked, screen fades to dark (1 s).
2. Player moved to the holding cell at the Ironwood Police Station (C8, x -13.25 z -103.35 (m)); vehicle stays where it was (keys kept).
3. Holding costs game time: 2 h per severity point (e); stats drain as normal while held.
4. Confiscated: the weapon used and all game taken illegally; the licence is revoked if the crime was a hunting crime.
5. Fine taken from cash; what cash cannot cover becomes `debt`, `weeklyDue = max(2500, ceil(debt/8))` (e: 8 weeks).
6. Fade in outside the station door. Toasts:
   - "You were arrested for hunting without a licence. You were fined $250."
   - "You could not pay $180 of it. It is now a debt to the Police: $25 a week, in the Bank app."
   - On-the-spot ticket: "Ranger ticket: weapon out in a no-weapon zone. Fined $50."
- Bank app (phone): a "Police debt" row with balance, next due day and a Pay week / Pay all button.
  Weekly due is auto-taken at 08:00 on the due day if cash allows; if not, `missed+1`, Standing -5, toast "Missed police payment: Standing -5."

## 7. Standing
- Scale -100..100, start 0, separate from job reputation (0..100 per employer, DESIGN.md "Reputation 0-100"). Never mixed.
- Recovery: +1 per game day with no new case and no missed payment, up to 0 only; above 0 only from good deeds later (Q5).
- Thresholds (e): below -10 no hunting licence; below -25 no Eden jobs; below 0 no Police job (needs >= 20 to apply);
  below -50 patrols treat the player as "known": spotted state skipped (straight to chase if seen with a weapon out).
- Every gate is checked by `canHold(law,gate)` with a reason text for the counter NPC.

## 8. Multiplayer
- Crime, witnesses and chase run on each player's own client for that player only. No PvP; crime is per player.
- The relay carries positions today. Add one small optional message `{type:'law', state:'chase'|'none', force}` so other
  clients can show lights on a following patrol car and a marker. Pursuers are spawned locally per client (others see only
  the marker, or a remote car if the vehicle relay exists). Witness NPCs are decided by each client for its own player: no agreement needed.
- Shared patrol positions are not synced (each client runs its own idle patrol); acceptable until NPC sync exists (Q7).

## 9. Tests
New: `tests/law.mjs`
- law-normalise: `normalizeProgress({}).law` equals the fresh law; junk fields dropped; normalising twice changes nothing.
- law-fine-to-debt: a fine larger than cash leaves cash 0 and the rest as debt with the weekly due.
- law-weekly-missed: a due day with no cash adds missed+1 and Standing -5.
- law-standing-clamp-recover: Standing clamps at -100/100 and recovers +1 per clean day, never above 0.
- law-gates: licence / Eden / Police gates at each threshold.
- law-witness: radius, blocked ray and off-duty cases (pure, with a fake world).
- law-chase: spotted->chase->lost after 30 s outside the radius; caught after 3 s boxed in; radius per force.
At risk (verified): `tests/ownership.mjs:18` (normalising twice must equal the input: normalizeLaw must be idempotent);
`tests/orders.mjs:52`, `tests/survival.mjs:20` (normalizeProgress({}) shape, safe if law is only added). Tests run the packaged release.

## 10. Open questions (for the user)
1. Fines and Standing numbers above: the right scale against wages ($25 shift bonus)?
2. Should complying when spotted give a ticket only (no holding), as proposed?
3. Can a ranger licence check catch a kill nobody saw (game in the bag, no licence)?
4. Holding time: 2 h per severity point, or a fixed time?
5. How does Standing rise above 0: Police volunteer gigs, paid debt, nothing yet?
6. Saving or quitting during a chase: arrest on load, or allow it?
7. Co-op: should the friend see your chase (lights, marker), or nothing?
8. Ironwood vs Alder Center: the code names the station's zone 'alder' (map-definition.js:414). Same place?

## Build outline (one agent per stage)
| Stage | Work | Model | Touches |
|---|---|---|---|
| L1 | `law.js` pure rules + `normalizeLaw` + save field + tests | Opus (save format) | jobs.js |
| L2 | Weapon zones, auto put-away warning, licence counter at Eden Outdoors | Sonnet | game.js |
| L3 | Witness checks + patrol NPCs inside the budgets | Sonnet | game.js |
| L4 | Chase states, search radius HUD, pursuit AI on the road graph, police vehicle classes | Fable | game.js, vehicle.js |
| L5 | Arrest flow, holding cell, toasts, Bank app debt row | Sonnet | game.js, phone*.js |
| L6 | Standing gates on jobs and the licence | Sonnet | jobs.js |
| L7 | Multiplayer law message on the relay | Opus (multiplayer) | relay, game.js |


## Decisions (user, 2026-11-14)
- Q1: certain crimes get bigger fines (steeper scale by severity). Q2: complying when spotted gives a ticket only; how complying works is explained in chat (stop prompt, 5 s). Q7: in co-op friends see everything (chase lights and markers): the relay "law" message is required, not optional. Q8: yes, the Alder police station is the Ironwood station (id alder, shown as Ironwood).
- Speeding becomes a crime, enforced by patrols once they exist (signs from map-master section 6). Q3 to Q6: Claude's leanings stand (ranger bag check yes, short fixed holding time, volunteer gigs later, continue as lost on load).