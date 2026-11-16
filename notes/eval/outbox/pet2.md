michadr.

# PET2 report: pet rules (pure module)

Files (new only, no BOM): dist/pets.js (110 lines, long lines), tests/pets.mjs (61 lines), notes/eval/outbox/pet2.md. Nothing existing was edited; no release/test-suite/index/git run.

Test output (node tests/pets.mjs):
PASS pets: offer, hunger, feed, pat, tick, run-away, normalise, rehome, mood

Exports for PET3: constants DAY_MINUTES, WEEK_MINUTES, STARVE_AFTER, WARN_AT[1w,2w], PECKISH_AT, PET_COOLDOWN, AFFECTION_MAX, PAT_GAIN, EAT_MINUTES, PURR_MINUTES, SLEEP_FROM, SLEEP_TO, REOFFER_AFTER, DEFAULT_NAME, NAME_MAX, MSG {offer, warn1(n), warn2(n), ranaway}, STAGES.
Functions: fresh(), normalizePet(raw), normalizePets(raw), hasHome(progress), adoptionOffer(progress,pets,now)->bool, declineOffer(pets,now), accept(pets,homeId,now,name?), hungerOf(pet,now)->{hunger,stage,minutesLeft}, elapsedOf, feed(pet,now)->{pet,ok,reason}, pat(pet,now)->{pet,ok,reason,affection}, tick(pet,now)->{pet|null,events,lostAt,lostName}, tickPets(pets,now)->{pets,events} (records lostAt/lostName on run-away), rehome(pet,homeId), rename(pet,name), moodOf(pet,now).
Saved shape (progress.pets): {pet|null, offer:{status:'none'|'declined'|'accepted',at}, lostAt, lostName}; pet = {name,homeId,adoptedAt,fedAt,patAt,affection,warned(0-2),shared:false}.
Reasons: feed 'no-pet'|'bad-time'|'not-hungry'|'fed'; pat 'no-pet'|'cooldown'|'patted'.
Game time: use gameMinutes(p) from dist/gigs.js ((day-1)*1440 + routine minutes), passed as now.

Defaults (all one-line constants at the top of dist/pets.js): 3 weeks to starve (STARVE_AFTER), warnings at 1 and 2 weeks (WARN_AT), meal allowed from 3 game days since last meal (PECKISH_AT), pat cooldown 60 game min, +5 affection per pat, max 100, re-offer after a decline 3 days (REOFFER_AFTER), name Whiskers (max 16 chars), night sleep 23:00-06:00 (hungry cats stay awake and walk), eat anim 10 min, purr anim 5 min. Free first cat, one pet at a time, shared:false always, hunger on game time only (a saved game clock means no offline hunger, so no offline cap was needed).

Behaviour notes: tick only reads the clock (not dt), so step size never matters; a big jump fires every missed event in order (warn1, warn2, ranaway). warned is saved on the pet so reloads never repeat. A clock that goes backwards counts as 0 hunger, never feeds, never crashes, and keeps warned. After the cat runs away, adoptionOffer returns false for status 'none' with lostAt set (no automatic re-offer; the pet shop is the later path) and also false once accepted. Name cleaning strips non-letter/number/space/apostrophe/hyphen characters (so '<b>Tom</b>' becomes 'bTomb').

Could NOT verify: anything in the game (not wired): the phone call, message delivery, home id values (any [\w.:-]{1,48} string is accepted), where the cat is placed, the real value of progress.housing/properties for owned homes (hasHome uses housing.rented or non-empty properties, same as starter.js hasProgress), save integration in profile.js/state.js. Confidence: rules and tests high; wiring unknown.

Open questions for the user: cat re-offer after it ran away (never / after N days / pet shop only)? Should affection decay or unlock something? Is a 3-day minimum before feeding right, or should feeding always be allowed? Is 60 game minutes the right pat cooldown?