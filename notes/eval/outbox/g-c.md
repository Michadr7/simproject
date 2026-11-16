michadr.

# G-C report: gig-clients

Files created: dist/gig-clients.js (72 lines), tests/gig-clients.mjs (55 lines). No existing file edited. Only ran: node tests/gig-clients.mjs.

Test output (real):
PASS gig-clients: profile, complications, regulars, tiers, save normalizing

Exports: clientProfile(clientId,seed), complicationFor(gigId,day,type,seed,isStarter), normalizeStats, isRegular, regularState, nextRequestDue(stat,now), recordGig(stats,clientId,quality,now), regularRequests(stats,now,{starterDone,halId}), regularPayMul(stats,clientId,opts), tierOfRep, allowedTypes, constants (COMPLICATION_RATE, NOT_HOME_PAY_MUL, SIGNATURE_MINUTE, REGULAR_AFTER, REGULAR_QUALITY, REQUEST_EVERY_DAYS, REGULAR_PAY_MUL, DAY_MINUTES, HAL_ID, MAX_CLIENTS, TIERS, type lists).

G-E needs to call:
- Board card: complicationFor(slotId, day, type, worldSeed, isStarter) -> show .text before accept; apply payMul to pay; extraStop adds a neighbour stop; returnToPickup sends the player back; earliestMinute (absolute game minute) blocks completion until then.
- Tip: clientProfile(clientId, seed).generosity into gig-pay payFor generosity.
- On gig finish: gigs.stats = recordGig(gigs.stats, client, quality, now). Save/load via normalizeStats (saved as gigs.stats, which G-E must add to normalizeGigs).
- Phone: regularRequests(stats, now, {starterDone}) returns client ids due for a phone request; multiply pay by regularPayMul(...) (1.15).
- Board filter: allowedTypes(tierOfRep(rep)) holds gig type ids.

Assumptions to check: HAL_ID=hal is a guess (real population id unknown; pass halId). Type ids cafe, laundry, farm-crates are planned names not yet in gigs.js. regularPayMul gives Hal +15% once the starter is done even before 3 good gigs (design says he is the first regular). Signature earliestMinute is absolute (day*1440+960). Rate checked as 20-30% over 2000 ids.

Confidence: high on pure logic (tested); medium on integration names.