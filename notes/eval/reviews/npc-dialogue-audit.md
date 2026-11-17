michadr.

# Read-Only Audit: Every NPC Conversation in Eden Ridge (`0.35.17`)

**Scope & Method:** 100% read-only audit of all NPC definitions, dialogue rules, menus, crowd templates, and UI wiring across `dist/npc-roster.js`, `dist/npc-dialogue.js`, `dist/npc-life.js`, `dist/npc-chat.js`, `dist/npc-crowd.js`, `dist/population.js`, `dist/starter.js`, `dist/hal.js`, `dist/cafe-job.js`, `dist/neighborhood.js`, `dist/gig-bridge.js`, `dist/gigs.js`, `dist/map-definition.js`, `dist/game.js`, `dist/index.html`, and dialogue tests in `tests/`. No game files were modified.

---

## 1. Inventory of Every Talkable NPC

There are **32 defined NPC identities** in `dist/` (`28` generated into `townPopulation().people` by `population.js:72-127`, `2` unreachable roster commuters missing from `MAP.posts`, and `2` cafe-shift customers `Maya`/`Theo`). Conversations enter through **6 code paths**: `talkNamed` (`game.js:494`), `talkHal` (`game.js:485`), shop/office counter menus (`marketMenu` `:614`, `ownerMenu` `:580`, `managerMenu` `:599`), cafe customer orders (`showCafe` `:622`), Oak Street pedestrian handler (`:665`), and `talkCrowd` (`:666, 895`), plus a 7-client parcel delivery door prompt (`gigDoor`, `:657`).

| Group / Name | ID / Role | Where They Stand / Spawn | Talkable Mechanism (`file:line`) | Reachable? |
|---|---|---|---|---|
| **Hal Brennan** | `hal` / `farm-house#1`, Farmer (Willow Farm) | Porch at `(-59.4, -235.8)` 06:30–17:30 or story steps 3–9 (`starter.js:7, 89`; `hal.js:10-22`) | Custom `talkHal` -> `halTalk` (`game.js:485`, `starter.js:115`) + `recordTalk('hal')` (`game.js:520`) | **Yes** (`ROSTER` `lines`/`TIPS` unused) |
| **Noah** | `noah` / `oak-apartments/8#1`, Market Clerk | Market counter (`shops.js:21`, 07:00–22:00); Flat 8 buzzer (`game.js:495`) | Counter `marketMenu` + `recordTalk('noah')` (`game.js:614, 646`); Flat 8 buzzer -> `talkNamed` (`game.js:497`) | **Yes** |
| **Sophie** | `sophie` / `oak-apartments/2#1`, Gig client | Oak St / scheduled errands (`pedestrians[1]`, `npcCrowd`); Flat 2 buzzer | `pedRoster` -> `talkNamed('sophie')` (`game.js:135, 665`); Flat 2 buzzer -> `talkNamed` (`game.js:497`) | **Yes** (`neighborhood.js:6` line dead) |
| **Walt Hargrove** | `walt` / `commuter:ridgeline-owner`, Ridgeline Owner | Office counter `ridgeline-office` (06:00–18:00, `game.js:641`); commutes on street (`npcCrowd`) | Counter `ownerMenu` (`game.js:580, 641`); street walker -> `talkNamed('walt')` (`game.js:666`) | **Yes** (`ownerMenu` skips `recordTalk`) |
| **Grace Whitfield** | `grace` / `house-r8#1`, 8 Cedar Loop resident | Scheduled walks/errands in `npcCrowd` (`population.js:94`) | Street walker -> `talkNamed('grace')` (`game.js:666`) (also a parcel gig door client) | **Yes** (no house buzzer/door talk) |
| **Oscar Masic** | `oscar` / `oak-apartments/9#1`, Retired recluse | Stays inside Flat 9 (`homebody: true`, `npc-life.js:178`) | Flat 9 buzzer ONLY, 10:00–12:00 after 5 stranger knocks (`npc-roster.js:57`, `npc-dialogue.js:84-97`, `game.js:496`) | **Yes** (buzzer only) |
| **Lincoln Brambly** | `lincoln` / `oak-apartments/10#1`, Hunter (assigned `market-evening` Clerk by `population.js:116`) | Street walks/work commute (`npcCrowd`); Flat 10 buzzer | Street walker -> `talkNamed('lincoln')` (`game.js:666`); Flat 10 buzzer -> `talkNamed` (`game.js:497`) | **Yes** |
| **Brentster Lewis** | `brentster` / `oak-apartments/11#1`, Cat owner (assigned `alder-store` Shopkeeper by `population.js:116`) | Street walks/work commute (`npcCrowd`); Flat 11 buzzer | Street walker -> `talkNamed('brentster')` (`game.js:666`); Flat 11 buzzer -> `talkNamed` (`game.js:497`) | **Yes** |
| **Gus Taggart** (`ASSUMED`) | `foreman` / `commuter:ridgeline-foreman`, Foreman | None (`map-definition.js:383-404` has `ridgeline-fellers`, no foreman post) | `ROSTER` entry exists (`npc-roster.js:68`), never spawned in `population.js` | **No** (dead roster entry) |
| **Ray Okonkwo** (`ASSUMED`) | `driver` / `commuter:eastbank-driver`, Truck driver | None (`map-definition.js:383-404` has `ridgeline-yard`, no driver post) | `ROSTER` entry exists (`npc-roster.js:73`), never spawned in `population.js` | **No** (dead roster entry) |
| **Elena** | `oak-apartments/7#1`, Cafe Manager | Alder Coffee counter (`shops.js:21`, 08:00–18:00); also in `npcCrowd` outdoors | Counter `managerMenu` (`game.js:599, 646`); street -> `talkCrowd` (`game.js:666, 895`) | **Yes** (2 unconnected systems) |
| **Maya & Theo** | Cafe shift customers (`cafe-job.js:3`) | Seated at Alder Coffee during player shift (`c.stage === 'order'`) | `showCafe` (`game.js:622`) | **Yes** (1 order line each) |
| **Alex, Robert, Julia, Carlos, Megan** | Oak St pedestrians (`neighborhood.js:6`) & residents (`oak-apartments` flats 1, 3, 4, 5, 6) | Scheduled walks via `npcCrowd` (`pedestrians` avatars) | **Dual prompt:** `person-<Name>` (`1.5 m`, `game.js:665`) AND `npc-<id>` -> `talkCrowd` (`1.6 m`, `game.js:666`) | **Yes** (overlapping prompts) |
| **14 Crowd Residents & Commuters** | `Marta`, `Anton`, `Tom`, `Hannah`, `Priya`, `Peter`, `Jonas Carver`, `Tessa`, `Jonas Hale`, `Naomi`, `Malik`, `Ruth`, `Bruno`, `Henry` | Cedar Heights, Willow Farm yard/woods, Alder Center, Eastbank Works (`npcCrowd` pool of `9`, `npc-crowd.js:14`) | `talkCrowd` -> `chatLine` (`game.js:666, 895`, `npc-chat.js:14-19`) | **Yes** (7 house owners also have `gigDoor`) |

---

## 2. Complete Catalogue of Lines & Conditions (`file:line`)

### 2.1 Named Roster Greeting Templates (`dist/npc-roster.js:84-90`, `dist/npc-dialogue.js:39-45`)
Picked by `hash(seed, id, 'greet', day, talksToday) % 3` inside each standing tier (`stranger` 0–4, `acquaintance` 5–19, `friend` 20–49, `close` 50+; `npc-life.js:6`). Open greeting in `openTalk` is always `greet + ' ' + moodLine(npc, day, seed)` (`npc-dialogue.js:44`), unless Oscar is wary (`talksToday >= 2`: `'Leave me be.'`, `:43, :102`).
- **Default greetings (`noah`, `sophie`, `walt`, `grace`, `hal`*, `foreman`*, `driver`*, `npc-roster.js:85`):**
  - `stranger`: `'Hello. Do I know you?'`, `'Hi there. Can I help you?'`, `'Oh. Hello.'`
  - `acquaintance`: `'Hello again.'`, `'Good to see you around.'`, `'Hi. We have met, I think.'`
  - `friend`: `'Hey, there you are!'`, `'Good to see you, friend.'`, `'Hi! How have you been?'`
  - `close`: `'My friend! Come on, talk to me.'`, `'There you are, I was hoping you would come by.'`, `'Always glad to see you.'`
- **Oscar (`oscar`, `npc-roster.js:87`):**
  - `stranger`: `'What do you want?'`, `'Do I know you? I do not think so.'`, `'Hm. Another one.'`
  - `acquaintance`: `'You again. Be quick.'`, `'Hm. You are the one who does not shout. Fine.'`, `'Keep it short.'`
  - `friend`: `'Oh. It is you. Come on then.'`, `'Hm. Sit if you want. Do not touch anything.'`, `'You can stay a minute.'`
  - `close`: `'Kid. Good. Come in, mind the floor.'`, `'Hm. You are welcome here. Do not make it a habit.'`, `'I was just thinking of you, which is strange.'`
- **Lincoln (`lincoln`, `npc-roster.js:88`):**
  - `stranger`: `'Hey! Do you hunt? You look like you could hunt.'`, `'New face! You into the outdoors?'`, `'Hi. Are you here about the woods?'`
  - `acquaintance`: `'Hey, you are back! Want to hear about my week?'`, `'Good to see you. I have been out at dawn again.'`, `'Hello again! Ask me anything about the woods.'`
  - `friend`: `'There you are! I saved a story for you.'`, `'Friend! Sit down, I have so much to tell you.'`, `'Great timing, I just got back from the ridge.'`
  - `close`: `'My best listener! You will not believe this one.'`, `'Come on, come on, I have been waiting all day to tell you!'`, `'You and me should go out there together one day.'`
- **Brentster (`brentster`, `npc-roster.js:89`):**
  - `stranger`: `'Hi. Sorry, have you seen a grey cat? No? Okay.'`, `'Oh, hello. Sorry, I am a bit distracted.'`, `'Hi. Do you like cats?'`
  - `acquaintance`: `'Hey. Brentster Jr. says hello. Well, he would, if he cared.'`, `'Oh, it is you. Have you met my cat properly yet?'`, `'Hi again. I was just talking about Junior.'`
  - `friend`: `'Hey! Junior has been asking about you. Sort of.'`, `'Friend! You have to hear what Junior did today.'`, `'Good to see you. Junior is on the sofa, as always.'`
  - `close`: `'You are family now. Junior approves, and he approves of nobody.'`, `'There you are! Come say hi to Junior.'`, `'I trust you with anything, even Junior.'`

### 2.2 Named Roster Mood Lines (`dist/npc-roster.js:28-78`, `dist/npc-life.js:10, 67-69`)
Condition: mood band (`miserable` 0–19, `low` 20–39, `okay` 40–59, `good` 60–79, `delighted` 80–100) picked by `hash(seed, id, 'line', day) % 3` (**note:** `talksToday` is omitted, so greeting and `'How are you doing?'` return the identical line all day).
- **Hal (`npc-roster.js:31`, only used if `talkNamed('hal')` were called — unreachable in live game):**
  - `miserable`: `'Not now. The animals are not fed.'`, `'Knee is bad and the farm is behind. Leave me be.'`, `'Nothing is going right here.'`
  - `low`: `'Long week. The farm does not pause.'`, `'Could use a hand, honestly.'`, `'Tired, but the eggs will not collect themselves.'`
  - `okay`: `'Morning. Eggs are fine today.'`, `'Farm is quiet, which is how I like it.'`, `'Coffee is on if you want one.'`
  - `good`: `'Good to see you. The hens are laying well.'`, `'Come in, there is always a cup for you.'`, `'A fine day to work the fields.'`
  - `delighted`: `'You are a godsend, you know that?'`, `'Best week we have had in a long time.'`, `'Take a coffee, take two, the farm is doing well.'`
- **Noah (`npc-roster.js:36`, used as `hi` in `marketMenu` at `game.js:614` & Flat 8 buzzer):**
  - `miserable`: `'Shelves are bare and I cannot do anything about it.'`, `'Customers keep asking for things I do not have.'`, `'Rough day. Rough week.'`
  - `low`: `'Slow day at the counter.'`, `'Running low on a few things.'`, `'I will manage, I always do.'`
  - `okay`: `'Welcome in. What can I get you?'`, `'Quiet morning at the market.'`, `'Prices are what they are today.'`
  - `good`: `'Good to see you. Shelves are well stocked.'`, `'Business is steady, thank you for the help.'`, `'Have you tried the fresh eggs?'`
  - `delighted`: `'Great day at the market!'`, `'You always turn up when I need you.'`, `'Stocked to the roof. Take your time.'`
- **Sophie (`npc-roster.js:41`):**
  - `miserable`: `'I cannot cope today, sorry.'`, `'Please, not today.'`, `'Everything went wrong at once.'`
  - `low`: `'A bit overwhelmed, to be honest.'`, `'I could use a hand with errands.'`, `'Sorry, a slow, grey day.'`
  - `okay`: `'Hello! Nice weather for a walk.'`, `'Just heading to the market.'`, `'Busy, but fine.'`
  - `good`: `'Lovely to see you!'`, `'The groceries made my week.'`, `'Want to stop for a coffee later?'`
  - `delighted`: `'You are so kind, thank you!'`, `'Best day I have had in ages.'`, `'Come by anytime, I mean it.'`
- **Walt (`npc-roster.js:46`):**
  - `miserable`: `'The mill is a mess. Come back later.'`, `'Do not bring me problems today.'`, `'Nothing is on schedule.'`
  - `low`: `'Slow week. Timber is not moving.'`, `'I have seen better days.'`, `'Work is work.'`
  - `okay`: `'Ridgeline is open. Ask about a shift.'`, `'Morning. Lumber is in the yard.'`, `'Keep your gloves on.'`
  - `good`: `'Good work lately. People notice.'`, `'Orders are coming in nicely.'`, `'Come by if you want steady work.'`
  - `delighted`: `'Best month in years. Thanks to people like you.'`, `'You have earned a good word from me.'`, `'The mill has never run better.'`
- **Grace (`npc-roster.js:51`):**
  - `miserable`: `'The garden is dying and so am I, almost.'`, `'I would rather be alone today.'`, `'Nothing blooms this year.'`
  - `low`: `'A quiet, heavy sort of day.'`, `'I could use some help in the garden.'`, `'Not my best week.'`
  - `okay`: `'Hello, dear. Lovely day for the garden.'`, `'The tomatoes are coming along.'`, `'Cedar Loop is quiet.'`
  - `good`: `'Good to see you. Tea?'`, `'The roses are doing well, thank goodness.'`, `'You have a kind face.'`
  - `delighted`: `'What a wonderful surprise!'`, `'The garden has never looked better.'`, `'Come in, come in, stay for supper.'`
- **Oscar (`npc-roster.js:56`):**
  - `miserable`: `'Go away.'`, `'I told you. Leave me alone.'`, `'You again. Do not knock twice.'`
  - `low`: `'What do you want now?'`, `'Make it quick.'`, `'I did not ask for company.'`
  - `okay`: `'Hm. Oh. It is you.'`, `'Keep it short.'`, `'The truck is fine. Do not touch it.'`
  - `good`: `'You are not so bad. Do not tell anyone I said that.'`, `'Hm. You listen. Good.'`, `'Thanks for the quiet help.'`
  - `delighted`: `'Come in. Mind the floor, it is clean.'`, `'You are all right, kid.'`, `'I should not say it, but I am glad you came.'`
- **Lincoln (`npc-roster.js:61`):**
  - `miserable`: `'Nobody wants to hear about hunting anyway.'`, `'Fine. Ignore me. Everyone does.'`, `'Not in the mood.'`
  - `low`: `'I had a story, but never mind.'`, `'You have not asked about the woods in days.'`, `'Hm.'`
  - `okay`: `'Hey. Did I tell you about the deer last week?'`, `'Out of ammo again, practically.'`, `'Morning. Cold enough for a hunt.'`
  - `good`: `'Good to see you! Ask me about tracking!'`, `'Got a great story for you.'`, `'I bagged a nice one yesterday.'`
  - `delighted`: `'You will not believe the day I had out there!'`, `'Best season ever, I swear!'`, `'Sit down, I have six stories.'`
- **Brentster (`npc-roster.js:66`):**
  - `miserable`: `'Junior is not okay and nothing else matters.'`, `'I cannot talk. Have you seen my cat?'`, `'I should be looking for him.'`
  - `low`: `'Junior has been off his food.'`, `'Sorry, distracted. Cat stuff.'`, `'Not a good day for Junior.'`
  - `okay`: `'Hey. Junior is on the sofa again.'`, `'Can you believe he knocked a glass over?'`, `'Oh, hi. Have you met my cat?'`
  - `good`: `'Junior is purring like an engine today!'`, `'Great day. He ate everything.'`, `'Good to see you, he likes you.'`
  - `delighted`: `'Junior learned a new trick!'`, `'Best day. Best cat. Best everything.'`, `'You have to see him, come on!'`
- **Gus Taggart (`foreman`, `npc-roster.js:71`, unreachable):** `'The crew is a mess. Do not talk to me.'` / `'Another accident report. Brilliant.'` / `'Out of my sight.'` / `'Short crew again.'` / `'Behind quota.'` / `'Do your job, we will talk later.'` / `'On time. Good. Gloves.'` / `'Trees will not fell themselves.'` / `'Keep clear of the blade.'` / `'You work clean. I like that.'` / `'Good shift today.'` / `'Tell Walt I said you are alright.'` / `'Best crew I have had in years.'` / `'Take a break, you have earned it.'` / `'Ridgeline is lucky to have you.'`
- **Ray Okonkwo (`driver`, `npc-roster.js:76`, unreachable):** `'Truck broke down, load is late, everything is late.'` / `'Do not start me today.'` / `'No.'` / `'Long haul, short patience.'` / `'Running behind again.'` / `'Traffic. Always traffic.'` / `'Morning. Another load to deliver.'` / `'Eastbank is busy today.'` / `'Gas is cheaper over the hill.'` / `'Smooth run today!'` / `'Good to see a friendly face.'` / `'You want a lift to the yard?'` / `'Perfect delivery, perfect day!'` / `'Drinks on me, next time I am in town.'` / `'Best route I ever drove.'`

### 2.3 Roster Topics, Shared Lines & Door Buzzer Lines (`dist/npc-roster.js:15-24, 93-120`, `dist/npc-dialogue.js:23-98`)
- **Common topics (`noah`, `sophie`, `walt`, `grace`, `hal`, `foreman`, `driver`, `npc-roster.js:108-109`):**
  - `[How are you doing?]` (`chat`) -> `moodLine(npc, day, seed)`
  - `[What is new in town?]` (`town`) -> picks 1 of 6 shared `TOWN_LINES`:
    1. `'Oak Street is quiet. The market is the place to hear things.'`
    2. `'They say the farm had a good week.'`
    3. `'Ridgeline is hiring, if you like the woods.'`
    4. `'The pumps at Eastbank get a delivery once a week.'`
    5. `'Somebody should fix that bench by the bus stop.'`
    6. `'If you want work, check the phone, the town posts jobs when it needs something.'`
  - `[Any advice for me?]` (`tips`) -> `TIPS[id]` (`npc-roster.js:110-120`):
    - `hal`: `'Come by when the coop is full. A truck with a bed makes an egg run worth the trip.'`
    - `noah`: `'Watch the shelves. When I run low I post a job, and I pay better than the street.'`
    - `sophie`: `'I am always short of time. Errands and groceries make my day.'`
    - `walt`: `'Show up on time and keep your gloves on. I notice who works.'`
    - `grace`: `'A little help in the garden goes a long way with me.'`
    - `oscar`: `'Do not talk my ear off. Do a favour quietly and I will remember.'`
    - `lincoln`: `'Ask me about hunting. Anything else and I lose interest.'`
    - `brentster`: `'Be kind to my cat and you will be fine with me.'`
    - `foreman`: `'Be safe and do the work clean.'`
    - `driver`: `'Be on time and I will give you a lift to the yard.'`
- **Oscar's topics (`recluse`, `npc-dialogue.js:27`):** `[Just checking in.]` (`chat`), `[Anything I can do for you?]` (`tips`). If `talksToday >= 2` (`OSCAR_TALKS_FREE`), replies `'Leave me be.'` (`npc-roster.js:102`).
- **Lincoln's topics (`hunter`, `npc-roster.js:15-23`, `npc-dialogue.js:25, 58, 60`):**
  - 7 hunting topics (3 sequential pages each, `+6` mood first time / `+1` repeat, clears `sulking`):
    - `[Deer season]`: `'Deer first. You wait in the cold before dawn and you do not move.'` -> `'The trick is the wind: it has to come to you, never from you.'` -> `'Once I sat four hours for one clean shot, and it was worth every minute.'`
    - `[Rifles and scopes]`: `'A good scope matters more than a good rifle, people forget that.'` -> `'Zero it at a hundred yards, check it every season, write it down.'` -> `'Mine is old, but it has never once let me down.'`
    - `[Reading tracks]`: `'Fresh tracks have sharp edges. Old ones go soft in the rain.'` -> `'Droppings tell you what they ate and how long ago, honestly.'` -> `'Follow the trail slowly and the woods start talking to you.'`
    - `[Hunting camp]`: `'A dry camp is a happy camp: tarp first, fire second.'` -> `'Hang your food away from the tent unless you want a bear visit.'` -> `'Nothing beats coffee on a camp stove at first light.'`
    - `[Game meat and the market]`: `'Field dress it fast, keep it cool, hang it a few days.'` -> `'Noah takes good venison if it is cleaned properly.'` -> `'Fresh game on the shelf, that is real food, not boxes.'`
    - `[Boots, gear and ammo]`: `'Boots first: wet feet end a hunt faster than any animal.'` -> `'Wool socks, a good knife, a sharp one, always more ammo than you think.'` -> `'I am nearly out of both, if you ever pass the store.'`
    - `[Hunting dogs]`: `'A good dog is half the hunt.'` -> `'Quiet, patient, nose to the ground, you cannot teach that in a week.'` -> `'I had one once. Best partner I ever had.'`
  - `[Something else]` (`chat`): `moodLine(...)` then page 2: `'Which reminds me: ' + pickedTopic.lines[0]` (`-1` mood).
- **Brentster's topics (`catowner`, `npc-roster.js:105-106`, `npc-dialogue.js:26, 59`):**
  - `[How is Brentster Jr.?]` (`cat`): `'Junior? He is the best cat in the world. Grey, grumpy, loves boxes.'` (`+6` mood)
  - `[What does Junior eat?]` (`cat-food`): `'He only eats the salmon one. Forty minutes after it is open, he sulks.'` (`+6` mood)
  - `[Has Junior seen the vet?]` (`vet`): `'The vet says he is fine. I do not believe her.'` (`+6` mood)
  - `[How are you doing?]` (`chat`, `-2` mood): `moodLine(...)` followed by 1 of 5 `CAT_STEERS`: `'Anyway. Did you see Junior this morning? He was on the windowsill.'` / `'That reminds me, Junior knocked a mug off the table again.'` / `'Sorry. Back to Junior: do you think he looks thin?'` / `'Speaking of which, have you seen Brentster Jr. around? He gets out sometimes.'` / `'Anyway, you really should meet my cat properly.'`
- **Oak Street Apartments Buzzer & Door Knocks (`npc-roster.js:93-103`, `npc-dialogue.js:84-97`, `game.js:495-497`):**
  - Menu: `'Oak Street Apartments'` — `'Flat doors. Knock on one.'` -> `[Knock · Flat 2/8/9/10/11]` / `[More flats]`.
  - Refusals: `stranger` (`'Who is it?'` / `'Who is it? ... (nobody opens)'` / `'A voice from inside: "Who is it?" Then nothing.'`), Oscar stranger inside `10:00–12:00` (`'"I do not know you. Go away." Through the door.'`), `asleep` (`'No answer. The lights are off.'` / `'Nobody comes. They must be asleep.'`), `not-home` (`'Nobody answers. They are out.'` / `'You knock twice. Empty.'`), `door-closed` (`'Not now.'` / `'"Not now. Come back later." Through the door.'`), `sick` (`'"I am ill. Not today, sorry." Through the door.'` / `'A cough from inside. "Come back when I am better."'`).
  - Allowed open: acquaintance (`'The door opens a crack.'`) or friend/close (`'The door opens wide. "Come in, come in." You talk in the doorway.'`) + `openTalk` text glued on.
- **Topic loop & Goodbye (`game.js:493, 573`):** `[Next]` / `[Skip]` -> `[Ask something else]` (sets body to `'Anything else?'`); dialog close button is `'See you'` (when `actor` is passed) or `'Close'`.

### 2.4 Custom Functional NPCs (`starter.js`, `cafe-job.js`, `game.js`)
- **Hal Brennan (`starter.js:115-126`, `game.js:484-485`):**
  - `step < 3`: `'Haven\'t seen you around. Noah said he might send someone out with my groceries.'`
  - `step === 3`: `'You must be Noah\'s helper. My knee says thank you. My old flatbed has stood since spring. Take her for the day if you can drive.'` + `[Hand over the groceries]` -> `'Keys are in her. Four crates of eggs are on the pallet by the barn: take them to Noah.'`
  - `step === 4`: `'Four crates of eggs are on the pallet by the barn. Park the truck beside them, load up, and run them to Noah.'` (or if `loaded`: `'The crates are on. Noah is waiting, so mind the bumps.'`).
  - `step === 5`: `'She is nearly dry. I left cash for gas. The pump is in Eastbank.'`
  - `step 6–8`: `'Walt at the Ridgeline office is expecting my note. Take a gig if you want the money.'`
  - `step === 9`: `'Rent Studio 2B so she has somewhere to sleep. Then she is yours.'`
  - Post-story/skipped without `shortbed`: `'The flatbed is still in my yard if you have room for her. She is $500, and she runs fine.'` / `'No story for you, then. But I will sell you the truck for $500. She runs fine.'` + `[Buy the truck · $500]` -> `'She is in the yard. Keep her running.'`
  - Otherwise: `'Come by some mornings. I will have work.'`
- **Noah Counter (`game.js:526, 607-619`):**
  - Greeting: `moodLine(noah, world.day, MAP.seed)` or `'Welcome to the Corner Market. What can I do for you?'`
  - Buttons: `[What is on the shelves?]` (`stockAt`/`priceOf` list), `[View items for sale]` (opens store UI), `[View jobs]` -> `'You’ve already collected an order for ...'` / `'Could you take this grocery order to <route>? They’ll pay you <pay>.'` / `'Here is what the board has for today.'` / `NO_WORK_POSTED` + optional `[Skip the introduction]` (`step <= 1`).
- **Walt Hargrove Counter (`game.js:580-592`):**
  - Greeting: `c.hired ? 'Good to see you, ' + (GameState.me.name || 'friend') + '.' : 'Morning. ' + company + '. Can I help you?'`
  - Unhired: `[I’m looking for work.]` -> pitch (`$8/hr`, `6 AM to 6 PM`) -> `[I’ll take it.]` (`'You’re on the crew...'`) / `[Let me think about it.]`.
  - Hired: `[Am I due a promotion?]` (`'You’re as high...'` / `'Not yet...'` / `'You’ve earned it...'`), `[Anything waiting for me?]` (if `c.owed.length`), `[How does a shift work?]` (`'Clock in on your phone...'`).
- **Elena (`game.js:599-606`) & Maya / Theo (`game.js:622`, `cafe-job.js:3`):**
  - Elena greeting: `'Hi there. What can I help you with?'` with dynamic choices: `[I have your delivery.]`, `[I’m ready to clock out.]`, `[I’m here for my shift.]` / `[Are you hiring?]` / `[What’s my next task?]`, `[I’d like lunch.]` (`'$6'`).
  - Maya / Theo (`c.stage === 'order'`): `'Could I have one <espresso|latte>, please?'` -> `[Of course. Coming right up.]`.

### 2.5 Oak Street Pedestrians, Crowd `chatLine` & Gig Door (`neighborhood.js`, `npc-chat.js`, `gigs.js`)
- **Oak Street Pedestrians (`neighborhood.js:6`, `game.js:665`, `Sophie` overridden by `pedRoster`):**
  - Greeting: `'Hey! How’s your day going?'` -> `[Any advice for someone new?]` -> 1 static line (`Alex`: Elena hiring; `Robert`: studio $90; `Julia`: quieter side; `Carlos`: weekly rent; `Megan`: café closes 6 / market 10), or `[Nice to meet you.]` -> `'You too. See you around the neighborhood!'`.
- **Crowd Walkers (`npc-chat.js:4-20`, `game.js:895`, `20` non-roster population people):**
  - Condition: `day`, `minute` -> `periodOf(minute)` (`morning` 5–11, `afternoon` 12–17, `evening` 18–21, `night` 22–4). Weather NOT passed by `game.js:895`, defaults `'clear'`.
  - Format: `pick(GREETINGS[period]) + " I'm " + name + ". " + pick([home, work, weather])` -> single button `[Nice to meet you]`.
  - `GREETINGS`: `'Good morning.'`/`'Morning!'`/`'Early start today.'` | `'Afternoon.'`/`'Hello there.'`/`'Hi.'` | `'Evening.'`/`'Good evening.'`/`'Hello again.'` | `'Late one, isn\'t it?'`/`'Quiet out here tonight.'`/`'Evening, if you can call it that.'`
  - `WEATHER_REMARKS.clear` (all `talkCrowd` calls hit only this): `'Nice weather for it.'` / `'Not a bad day.'`
- **Parcel Delivery Door Prompt (`gig-bridge.js:63`, `gigs.js:216`, `game.js:657`):**
  - `'You are at the door. How do you greet <client>?'` -> `[Knock quietly]` / `[Ring the bell]` / `[Leave it on the step]` (direct payout toast).

---

## 3. Quality Audit Against Rules (a)–(g)

| NPC / Group | Verdict | Rule Failures | One-Line Assessment |
|---|---|---|---|
| **Hal Brennan** | **WEAK** | (a)(c)(e)(g) | Reacts cleanly to story step (`starter.js:115-123`), **but** no post-story conversation, calls his `shortbed` `'flatbed'` (`:119, 124`), and leaves all 15 `ROSTER` lines (`npc-roster.js:31`) dead. |
| **Noah** | **WEAK** | (a)(b)(d)(e) | Good functional store/gig menus (`game.js:607-619`), **but** prepends timeless `'Quiet morning at the market.'` / `'Welcome in'` even when knocked at his flat door (`npc-roster.js:36`), and `'How are you doing?'` repeats his opening line verbatim (`npc-dialogue.js:67`). |
| **Walt Hargrove** | **BAD** | (a)(c)(d)(e)(f) | Says `'Morning.'` at any hour (`game.js:584`, `npc-roster.js:46`), and **outside in `npcCrowd` asks `'Hello. Do I know you?'` after hiring you** because `ownerMenu` never calls `registerTalk('walt')` (`:580`). |
| **Elena** | **WEAK** | (b)(c)(f) | Counter cafe shift menu (`game.js:599-605`) works well, **but** outside on the street her `talkCrowd` clone says `"Hi. I'm Elena. Nice weather for it."` with zero memory of employing you (`:895`). |
| **Oscar Masic** | **BAD** | (b)(d)(e) | Distinct grumpy voice (`npc-roster.js:56, 87`), **but** only reachable inside `10:00–12:00` via Flat 9 buzzer after 5 days of stranger knocks (`tests/npc-dialogue.mjs:108`), glues 3 fragments (`'The door opens a crack. What do you want? ...'`), and `'Just checking in.'` repeats the greeting mood line (`npc-dialogue.js:67`). |
| **Lincoln Brambly** | **BAD** | (a)(b)(c)(d)(e)(g) | **Worst example:** `'Morning. Cold enough for a hunt.'` at night (`npc-roster.js:61`), glues greet + mood, `'Something else'` loops into `-1` mood (`:60`), ignores active `market-evening` clerk post (`population.js:116`), while `peopleRows` says `'No regular job'` (`npc-dialogue.js:129`). |
| **Brentster Lewis** | **BAD** | (b)(c)(d)(e)(g) | Cat-centric voice (`npc-roster.js:89, 105-106`), **but** 3 of 4 topics are 1-line dead ends (`npc-dialogue.js:59`), `'How are you doing?'` repeats the greeting line, never updates cat state, and `peopleRows` says `'No regular job'` while he works at `alder-store`. |
| **Sophie & Grace Whitfield** | **BAD** | (a)(b)(c)(d)(e)(f) | Generic `DEFAULT_GREETINGS` + shared `TOWN_LINES` (`npc-roster.js:85, 109`); Grace invites `'Come in, come in, stay for supper.'` (`:51`) while standing on a public street; Sophie's `neighborhood.js:6` line is dead code. |
| **Gus Taggart & Ray Okonkwo** | **BAD** | (a)(c)(d)(g) | **Dead code / contradictions:** neither exists in `MAP.posts` (`map-definition.js:383-404`) or `townPopulation()`, yet Ray carries `'Morning.'` (`npc-roster.js:76`). |
| **Maya & Theo** | **OK (Stub)** | (e)(f) | Single transactional coffee order (`game.js:622`) with no idle dialogue (acceptable as shift prop customers). |
| **Alex, Robert, Julia, Carlos, Megan** | **BAD** | (b)(c)(d)(e)(f) | **Duplicate competing prompts** (`person-<Name>` at `1.5 m` vs `npc-<id>` at `1.6 m`, `game.js:665-666`); hardcoded static 1-liners never notice time/state. |
| **14 Crowd Walkers** | **BAD** | (b)(c)(d)(e)(f)(g) | `talkCrowd` (`game.js:895`) fails to pass `weather` (always `'Nice weather for it.'` / `'Not a bad day.'` even in rain), and `workPhrase` (`npc-chat.js:12`) prints `"I work as Yard hand at ridgeline."` (missing articles, lowercase unmapped place ids). |

---

## 4. Exact Counts & Top 5 Early-Game NPCs

| Metric | Count | Breakdown / Proof (`file:line`) |
|---|---|---|
| **Defined NPCs** | **32** (`30` reachable) | `28` in `townPopulation().people` + `2` unreachable `ROSTER` (`foreman`, `driver`) + `2` cafe customers (`Maya`, `Theo`) |
| **Distinct Dialogue Lines / Templates** | **~300** (`258` in `npc-roster.js`) | `npc-roster.js`: `150` mood + `48` greet + `15` knock + `21` Lincoln topics + `8` cat + `6` town + `10` tips = `258`. `npc-chat.js`: `18` (`12` greet + `6` weather) + `3` string templates. `starter.js`: `9`. `neighborhood.js`: `6` + `2` in `game.js:665`. Counters (`game.js` market/office/cafe) + `gigDoor`: `~25`. |
| **Generic / Interchangeable Filler** | **~56 lines + 20 crowd templates** | `12` `DEFAULT_GREETINGS`, `6` `TOWN_LINES`, `12` `KNOCK_LINES`, `18` `npc-chat.js` greet/weather strings (actually only `14` active since non-`clear` weather is never passed), `8` pedestrian lines, plus every `chat` self-repeat (`npc-dialogue.js:67`). |
| **Dead-End Topics** | **21 / 21 social topics** (`100%`) | `6` `noah`/`sophie`/`walt`/`grace` (`COMMON_TOPICS`), `2` `oscar`, `8` `lincoln`, `4` `brentster`, `2` pedestrian choices = `22` authored branches (`game.js:493, 665, 895`) all end at `'Anything else?'` or close the box with zero follow-up choices or world consequences beyond `+mood`/`+standing`. (Only `marketMenu`, `ownerMenu`, `managerMenu`, `talkHal`, and `gigDoor` trigger state actions.) |

### Top 5 NPCs That Matter Most in the Early Game
1. **Noah** (`noah` — Corner Market): First story contact (`starter.js:14`), grocery job/gig giver (`game.js:607`), market storekeeper (`:615`), primary buyer/sink for eggs (`needLoad`/`needDrop`).
2. **Hal Brennan** (`hal` — Willow Farm): Central anchor of the entire 10-step starter story (`starter.js:13-24`), supplier of the free loaner/starter `shortbed` and egg crates.
3. **Walt Hargrove** (`walt` — Ridgeline Timber Co.): First major career boss (`game.js:580-592`), receives Hal's note (`step 6`), hires player for logging/sawmill/warehouse shifts and promotions.
4. **Elena** (Alder Coffee Manager): Early town wage option (`$24`/shift + `$6` meal at the café, `game.js:599-605`, `cafe-job.js`) right across from the starter Studio 2B.
5. **Sophie** (`sophie` — Oak Street Apartments Flat 2 / First Story Delivery): Recipient of Beat 1 `'Sophie\'s groceries'` (`starter.js:15`) and resident right across the street from Studio 2B — currently has **zero** dialogue acknowledging she ordered those groceries.

---

## 5. Architecture, UI Limits & Redesign Constraints

### How the Talk System Works Today
All conversations pass through `dist/game.js` (`candidates()` lines `627-666`), which picks the single closest prompt via `chooseInteraction` (`:898`) and invokes one of six disconnected handlers (`talkHal` `:485`, `talkNamed` `:494`, `ownerMenu` `:580`, `managerMenu` `:599`, `marketMenu` `:614`, or `talkCrowd` `:895`); each handler calls `speak(...)` / `station(...)` -> `showWorld(...)` -> `showDialog(...)` (`:531-578`), which drives the single shared `#dialog` DOM element in `dist/index.html:12`. Pure state transitions live in `dist/npc-dialogue.js` and `dist/npc-life.js` (roster mood/standing/met state), `dist/npc-chat.js` (crowd one-liners), and `dist/starter.js` / `dist/cafe-job.js` (story and café job state).

### UI & Structural Limits
- **3-button ceiling (`index.html:12`, `game.js:534-575`):** Only `#jobAction`, `#extraAction`, and `#thirdAction` exist alongside `#closeDialog` (`'See you'` / `'Close'`), forcing `CHOICES_PER_PAGE = 2` (`npc-dialogue.js:8`) whenever an NPC has `>3` topics (`More topics` eats button 3).
- **No history or back-and-forth (`game.js:535`):** Every reply overwrites `#dialogText.textContent`; there is no transcript log, player dialogue choice preview, NPC portrait/mood badge, or world-space ambient speech bubble.
- **Disconnected clocks & identities (`game.js:487, 614, 895`):** Roster `openTalk` receives `(day, seed)` with **no `minute`, `room`, `weather`, or player `progress`**, while `talkCrowd` forgets `weather` and overlaps `pedestrians` (`:665-666`).

### Hard Constraints Any Redesign Must Respect
1. **Save Compatibility (`edenridge.progress.v1` in `dist/jobs.js:33-56`, `dist/npc-life.js:33-66`):**
   - `progress.npcs[id]` stores `{id, mood, sickUntil, lastTalkDay, talks, flags, talkDay, talksToday, metDay}` where `normalizeNpcs` caps `talks` at `40` keys and `flags` at `12` (`npc-life.js:60-63`), and falls back `metDay` to `lastTalkDay` on legacy saves (`:63`).
   - `progress.standing.people[id]` stores `{points, gainDay, gainToday}` (`daily cap 3`, `STANDING_THRESHOLDS` `0/5/20/50`).
   - `progress.starter` tracks `{epoch: STARTER_EPOCH, step, done, skipped, quality, fuelGiven, loanUid, loaded, noteGiven, gigDone}` (`starter.js:30-36`). Any new conversation flags/topics/state must normalize additively in `jobs.js` and `npc-life.js`.
2. **Co-op & Determinism:** Pure dialogue rules (`npc-dialogue.js`, `npc-chat.js`) must remain free of DOM, Three.js, `Date.now`, and `Math.random`, taking injected `(day, minute, seed)` (and using `hudDay()`/`hudMinutes()` in `game.js` during co-op visits).
3. **Existing Tests That Pin Exports & Strings:**
   - `tests/npc-dialogue.mjs`: Pins `GREETINGS.oscar` (12 unique), `DEFAULT_GREETINGS` (>=3/tier), `openTalk` returning `metDay` with `talksToday: 0` and returning `OSCAR_REFUSAL` (`'Leave me be.'`) when wary, `talkOutcome` `pages` lengths (Lincoln 3 pages for hunting topics, 2 pages matching `/^Which reminds me: /` for `'chat'`), `CAT_ANSWERS`/`CAT_STEERS`, `pagedChoices` (`<=3` buttons with `More`), `OSCAR_DOOR_STRANGER`, `KNOCK_LINES` reasons, `flatDoors` format (`Flat 9 · Oscar`), `peopleRows` (no `ASSUMED` or `:` leaks), and `createRosterPlanner`.
   - `tests/npc-chat.mjs`: Pins `chatLine(p, {day, minute})` determinism, starting with `GREETINGS.morning` at `minute: 600`, containing `p.name`, `periodOf`, `homeName`, and `workPhrase` matching `/^I work as/`.
   - `tests/starter-game.mjs`: Pins `halTalk(p)` returning `'groceries'` / `'buy'` choices, `/Four crates/`, `/waiting|Noah/`, `/Come by some mornings/`, and `$500`.
   - `tests/office-game.mjs:25` & `tests/jobs-game.mjs:20`: Pin `'Walt Hargrove'` in `'Talk to Walt Hargrove'` and Employers phone tab.
   - `tests/npc-life.mjs`: Pins Noah, Walt, Oscar, Lincoln, Brentster state/mood rules.

---

## Verification & Honest Confidence
- **Verified directly:** All line counts, `townPopulation` runtime output (`node -e` listing all `28` population entries and sample `chatLine` outputs), string/template counts in `npc-roster.js`, `npc-chat.js`, `gigs.js`, and every cited `file:line` across `game.js`, `index.html`, and the `npc-*` / `starter.js` / `cafe-job.js` modules.
- **Could NOT verify:** Live visual rendering/truncation inside `#dialog` in a browser (`npm test` was not run since this audit is read-only and made zero code edits; cafe runtime transitions in `tests/cafe-game.mjs` were not executed).
- **Confidence:** **High (95%+)** on all NPC reachability, text inventory, bugs/contradictions, and test/save constraints.
