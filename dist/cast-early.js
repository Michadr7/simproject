// Early cast (Noah, Hal, Walt, Elena, Sophie); notes/conversation-design.md stage C4.
const freezeDeep=o=>{if(!o||typeof o!=='object')return o;Object.freeze(o);for(const v of Object.values(o))freezeDeep(v);return o};

// ── 1. Noah (Corner Market clerk, Oak Street Apartments Flat 8) ──────────────────────────────────────────────────────────
export const NOAH=freezeDeep({
 id:'noah',
 name:'Noah',
 personId:'oak-apartments/8#1',
 voice:'Friendly, chatty Corner Market clerk who counts stock out loud and looks out for newcomers.',
 facts:{shop:'Corner Market',flat:'Flat 8',building:'18 Oak Street',farm:'Willow Farm'},
 bye:[
  {if:{tierMin:'friend'},t:'See you round, my friend. Mind the kerb outside.'},
  {if:{mood:['miserable','low']},t:'I had better check the crates out back. See you.'},
  {t:'Always good talking. Doors stay open until ten.'}
 ],
 nodes:[
  {id:'noah.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{period:'night',met:true},t:['Sorry, clocked off for the day. Flat eight is quiet hours now.','Catch me behind the counter from seven.']},
   {if:{period:'night',met:false},t:['Oh, hello on the landing. I am Noah from down the hall, Flat eight.','You have caught me off shift. Come by the Corner Market tomorrow.']},
   {if:{period:'morning',met:true},t:['Just locking up my flat before the counter rush.','Walk down with me if you are headed to the shop.']},
   {if:{period:'evening',met:true},t:['Still counting tomorrow’s produce order in my head.','Drop by the market before ten if you need anything.']},
   {if:{met:false},t:['Oh, hello! You must be new at Studio 2B. I am Noah.','I run the Corner Market across the street.']},
   {t:['Good to bump into you on the stairs.','Need something from the shop, or just stretching your legs?']}
  ],replies:[
   {label:'What is on the shelves today?',go:'noah.shelves'},
   {label:'Any work going at the market?',go:'noah.work'},
   {label:'How did Sophie settle her grocery order?',if:{beat:'sophie.groceries-delivered'},go:'noah.sophie'},
   {label:'Hear anything round Oak Street?',go:'noah.town'}
  ]},

  {id:'noah.counter',entry:true,when:{place:'counter'},do:[{meet:true}],say:[
   {if:{met:false,story:[0,1],storyDone:false},w:5,t:['Welcome in! I am Noah, and you look like you just moved into the studio.','We keep fresh food, tools and packs from seven until ten. Could you help me with one bag?']},
   {if:{gig:'need-restock',gigClient:'noah'},w:6,t:['Is that my restock run? Back your truck to the door and we will count crates.','The shelves could really use it.']},
   {if:{story:[2,2],storyDone:false},w:4,t:['Glad you are back before setting out.','Willow Farm is a long walk up the county road, so grab a bite and a drink first.']},
   {if:{story:[3,3],storyDone:false},w:4,t:['Hal Brennan is expecting those groceries up at Willow Farmhouse.','Follow the arrow north over the river bridge and he will sort you out.']},
   {if:{story:[4,4],storyDone:false},w:4,t:['Still counting shelf space for Hal’s four egg crates!','Bring his truck up to the front when they are loaded, and go easy over the bridge.']},
   {if:{recent:'promoted'},w:3,t:['Word travels fast on Oak Street—congrats on making the step up at Ridgeline!','Picking up supplies before your next shift?']},
   {if:{recent:'delivered:sophie'},w:3,t:['That grocery bag made Sophie’s day across the street!','Three dollars for your pocket and a grateful neighbour to boot.']},
   {if:{recent:'egg-run',tierMin:'acquaintance'},w:3,t:['Those eggs moved off the shelf faster than I could price them.','Thank you again for hauling the crates.']},
   {if:{period:'morning',mood:['good','delighted']},w:2,t:['Good morning! Bread just came up from Ironwood Bakery and I counted every loaf twice.','Need anything off the racks, or looking for a gig?']},
   {if:{period:'morning',mood:['miserable','low']},w:2,t:['Quiet morning, and two crates short on my tally.','What are you after today?']},
   {if:{period:'morning'},w:1,t:['Morning! Till is open and the shelves are swept.','Looking to shop or chasing work?']},
   {if:{period:'afternoon',mood:['good','delighted']},w:2,t:['Good afternoon! Steady trade since noon and plenty on the racks.','How can I help?']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Halfway through today’s stock list already.','What brings you up to the counter?']},
   {if:{period:'evening',tierMin:'friend'},w:2,t:['Good evening, friend. Winding down the tally before ten o’clock.','Need supplies or news?']},
   {if:{period:'evening'},w:1,t:['Evening! We stay open until ten, so take your time.','Browsing or looking for a job?']},
   {if:{period:'night'},w:1,t:['Late shop before I pull the shutters at ten.','Grab what you need and I will ring it up.']},
   {t:['Welcome back to the Corner Market.','Everything is priced by the unit today.']}
  ],replies:[
   {label:'What is on the shelves today?',go:'noah.shelves'},
   {label:'Any work going?',go:'noah.work'},
   {label:'Let me browse items for sale.',act:'openStore'},
   {label:'Did Sophie get her groceries?',if:{story:[2,10]},go:'noah.sophie'},
   {label:'Tell me about Hal’s egg crates.',if:{story:[4,10]},go:'noah.eggs'},
   {label:'What is new round town?',go:'noah.town'}
  ]},

  {id:'noah.open',entry:true,do:[{meet:true}],say:[
   {if:{met:false},t:['Hi there! I am Noah, I work the counter at the Corner Market on Oak Street.','We open seven to ten if you need groceries, coffee or an axe.']},
   {if:{period:'morning'},t:['Lovely morning for walking Oak Street before the rush starts.','Stop by the counter anytime.']},
   {if:{period:'afternoon'},t:['Stepping out for air while the afternoon stays steady.','Corner Market is open until ten if you need supplies.']},
   {if:{period:['evening','night']},t:['Heading back along Oak Street. Keep an eye on the clock if you need groceries before ten!']},
   {t:['Good to see you out of doors. Always nice not looking at clipboards for five minutes.']}
  ],replies:[
   {label:'What do you stock at the market?',go:'noah.shelves'},
   {label:'Know any work going?',go:'noah.work'},
   {label:'Heard much round town?',go:'noah.town'}
  ]},

  {id:'noah.shelves',say:[
   {if:{mood:['miserable','low']},t:['Eggs, milk, produce and Ironwood bread are all moving faster than deliveries come in.','If a shelf hits zero I post a job on the board.']},
   {if:{tierMin:'friend'},t:['Hal brings us eggs at four fifty a dozen and milk at four dollars.','Ironwood Bakery sends three-fifty loaves, plus there is an axe for twenty dollars.']},
   {t:['Food, cold drinks, backpacks, a twenty-dollar axe and a fifteen-dollar gas can.','Shelf prices swing twenty-five percent either way when stock runs thin.']}
  ],replies:[
   {label:'Read me today’s exact prices.',act:'shelves',if:{place:'counter'}},
   {label:'Open the market till.',act:'openStore',if:{place:'counter'}},
   {label:'Wait, you post restock jobs when stock drops?',go:'noah.restock-hint'},
   {label:'Any work going right now?',go:'noah.work'},
   {label:'That covers what I needed.',go:'noah.wrap'}
  ]},

  {id:'noah.restock-hint',say:[
   {t:['Every crate counts! Check the live Prices screen on your phone before you haul anything.','Short shelves pay up to a quarter over base price.']}
  ],replies:[
   {label:'Check the gig board now.',act:'gigBoard',if:{place:'counter'}},
   {label:'What deliveries are waiting?',go:'noah.work'},
   {label:'Thanks for the tip, Noah.',go:'noah.wrap'}
  ]},

  {id:'noah.work',say:[
   {if:{story:[0,1],storyDone:false,place:'counter'},t:['Sophie across at 18 Oak Street ordered a bag of groceries, three dollars on delivery.','Or if you already know the ropes, you can skip the starter errands.']},
   {if:{story:[0,1],storyDone:false},t:['Come inside to the market counter while we are open, seven to ten.','I have a bag ready for Sophie across the street at 18 Oak Street.']},
   {if:{story:[2,3],storyDone:false},t:['Next run is Hal Brennan out at Willow Farmhouse. Take his groceries up north over the bridge.','Remember to buy food and eat first so your legs hold out.']},
   {if:{gig:true},t:['Finish the gig you already accepted before taking another on the board.','Check your phone tracker if you lose the marker.']},
   {t:['Between local deliveries and town gigs there is nearly always something posted.','Egg runs for Willow Farm and timber hauls pay the best once you have a truck.']}
  ],replies:[
   {label:'Take Sophie’s grocery order ($3.00).',if:{story:[0,1],storyDone:false,place:'counter'},go:'noah.sophie-order'},
   {label:'Skip the introduction.',if:{story:[0,1],storyDone:false,place:'counter'},go:'noah.skip'},
   {label:'Check today’s delivery & gig board.',act:'gigBoard',if:{place:'counter'}},
   {label:'What is new round town?',go:'noah.town'},
   {label:'I will leave you to the tally.',go:'noah.wrap'}
  ]},

  {id:'noah.sophie-order',do:[{act:'job.pickup'}],say:[
   {t:['Thank you! Take the bag straight across to the awning at 18 Oak Street.','Check back in with me once Sophie has her groceries.']}
  ],end:true},

  {id:'noah.skip',say:[
   {t:['Wait—if you skip the introduction, there is no story and no free truck from Hal Brennan.','He will still sell you the Shortbed for $500 later if you have parking space. Skip anyway?']}
  ],replies:[
   {label:'Yes, skip the story.',act:'skipStory'},
   {label:'No, I will stick with the errands.',go:'noah.keep-story'}
  ]},

  {id:'noah.keep-story',say:[
   {t:['Good call! Take Sophie’s bag across to 18 Oak Street whenever you are ready.']}
  ],replies:[
   {label:'Take Sophie’s grocery order ($3.00).',if:{place:'counter'},act:'job.pickup'},
   {label:'I will come back to the counter in a minute.',go:'noah.wrap'}
  ]},

  {id:'noah.town',say:[
   {if:{hired:false},t:['Walt Hargrove at Ridgeline Timber in Eastbank is taking on crew, six AM to six PM.','Starts at eight dollars an hour plus three dollars per marked pine!']},
   {if:{cafe:'none'},t:['Elena next door at Alder Coffee was asking for an extra hand behind the espresso bar.','Her shifts pay twenty-four dollars for serving two regulars and wiping down.']},
   {t:['Eastbank fuel tanker rolls in once a week with four-dollar gas and four-twenty diesel.','Do not run a truck dry north of the bridge!']}
  ],replies:[
   {label:'How did Sophie find her groceries?',if:{story:[2,10]},go:'noah.sophie'},
   {label:'Tell me about Hal’s egg crates.',if:{story:[4,10]},go:'noah.eggs'},
   {label:'Catch you behind the counter later.',go:'noah.wrap'}
  ]},

  {id:'noah.sophie',say:[
   {if:{notBeat:'noah.sophie-praised'},t:['Sophie popped down earlier just to say thank you for bringing those groceries intact.','She is in Flat two across the street. Give her buzzer a ring sometime!'],do:[{beat:'noah.sophie-praised'},{standing:1},{mood:2}]},
   {t:['Sophie still mentions how fast you brought that first bag over.','She lives in Flat two, right above the buzzer if you ever fancy checking in.']}
  ],replies:[
   {label:'Tell me about Hal’s egg crates.',if:{story:[4,10]},go:'noah.eggs'},
   {label:'Good to hear she was pleased.',go:'noah.wrap'}
  ]},

  {id:'noah.eggs',say:[
   {if:{story:[4,4],storyDone:false},t:['Four crates fit neatly on Hal’s Shortbed. Watch the kerb over the bridge!','Smooth driving keeps quality at a hundred percent and pays the full forty dollars.']},
   {if:{recent:'egg-run',notBeat:'noah.eggs-checked'},t:['All sixteen dozen stacked clean on the rack! Hal knows who to trust with a full bed.','Keep your eye on the Gigs app whenever our egg basket dips.'],do:[{beat:'noah.eggs-checked'},{standing:1}]},
   {t:['Hal’s hens lay faster than he can haul with that bad knee of his.','A clean four-crate run always beats twenty-eight dollars minimum, up to forty flat.']}
  ],replies:[
   {label:'Show me the shelf prices.',act:'shelves',if:{place:'counter'}},
   {label:'I will keep the crates safe.',go:'noah.wrap'}
  ]},

  {id:'noah.wrap',say:[
   {t:['Holler if you see an empty shelf! Keeping Oak Street fed takes both of us.']}
  ],end:true}
 ]
});

// ── 2. Hal Brennan (Willow Farm, owner of the Shortbed pickup) ───────────────────────────────────────────────────────────
export const HAL=freezeDeep({
 id:'hal',
 name:'Hal Brennan',
 personId:'farm-house#1',
 voice:'Tired, gruff-warm Willow Farm owner with a bad knee, up before dawn, speaks in short plain sentences.',
 facts:{farm:'Willow Farm',truck:'Kasumuchi S70',son:'Peter'},
 bye:[
  {if:{mood:['miserable','low']},t:'Leave the gate shut behind you. Knee needs five minutes.'},
  {t:'Close the barn gate if you take the lane back. Safe driving.'}
 ],
 nodes:[
  {id:'hal.open',entry:true,do:[{meet:true}],say:[
   {if:{gig:'need-harvest',gigClient:'hal',storyDone:true},w:6,t:['You took the harvest job? Load the egg crates straight off the pallet by the barn.']},
   {if:{story:[0,2],storyDone:false},w:5,t:['Haven\'t seen you around. Noah said he might send someone out with my groceries.']},
   {if:{story:[3,3],storyDone:false},w:5,t:['You must be Noah\'s helper. My knee says thank you.','My old Shortbed has stood since spring. Take her for the day if you can drive.']},
   {if:{story:[4,4],storyDone:false,beat:'hal.loaded'},w:6,t:['The crates are on. Noah is waiting, so mind the bumps.']},
   {if:{story:[4,4],storyDone:false},w:5,t:['Four crates of eggs are on the pallet by the barn. Park the truck beside them, load up, and run them to Noah.']},
   {if:{story:[5,5],storyDone:false},w:5,t:['She is nearly dry. I left cash for gas. The pump is in Eastbank.']},
   {if:{story:[6,8],storyDone:false},w:5,t:['Walt at the Ridgeline office is expecting my note. Take a gig if you want the money.']},
   {if:{story:[9,9],storyDone:false},w:5,t:['Rent Studio 2B so she has somewhere to sleep. Then she is yours.']},
   {if:{met:false,storyDone:true},w:4,t:['Hal Brennan. Keep the farm gate latched behind you and check the yard for crates if you want hauling work.']},
   {if:{storyDone:true,notBeat:'hal.done-greet'},w:3,t:['Come by some mornings. I will have work.','Willow Farm stays busy either way.'],do:[{beat:'hal.done-greet'}]},
   {if:{period:'morning',tierMin:'friend'},w:2,t:['Morning. Coffee is fresh on the stove if you need five minutes off your feet.','Hens laid early today.']},
   {if:{period:'morning'},w:1,t:['Morning. Bad knee slowed me down, so the coop got ahead of me again.']},
   {if:{period:'afternoon',mood:['miserable','low']},w:2,t:['Long afternoon. Tractor work waits for nobody when your leg aches.']},
   {if:{period:'afternoon'},w:1,t:['Afternoon. Sun is steady on the pasture and the milk pails are racked.']},
   {if:{period:['evening','night']},w:1,t:['Long day. Even a farmer packs the tools away eventually.','Coop shuts down fine on its own till sunup.']},
   {t:['Steady work keeps Willow Farm turning. Put your boots on and check the barn pallet if you want hauling.']}
  ],replies:[
   {label:'Hand over the groceries',if:{story:[3,3],storyDone:false},go:'hal.loan',do:[{act:'hal.groceries'},{beat:'hal.met'},{standing:1}]},
   {label:'Tell me about the Shortbed.',go:'hal.truck'},
   {label:'How is the egg coop looking?',go:'hal.coop'},
   {label:'Ask about Walt Hargrove.',go:'hal.walt'},
   {label:'How is that knee holding up?',go:'hal.knee'},
   {label:'Seen your son Peter lately?',go:'hal.peter'}
  ]},

  {id:'hal.loan',say:[
   {t:['Keys are in her. Four crates of eggs are on the pallet by the barn: take them to Noah.']}
  ],end:true},

  {id:'hal.truck',say:[
   {if:{storyDone:true},t:['The Shortbed is still in my yard if you have room for her. She is $500, and she runs fine.','Takes gasoline, carries four crates or forty-four planks. Keep oil and fuel in her.']},
   {if:{story:[4,5],storyDone:false},t:['Kasumuchi S70 takes regular gasoline, twenty-gallon tank, holds four crates cleanly.','Treat the gears gently over bumps so Noah’s cartons stay intact.']},
   {t:['That little white S70 pulls up to sixty-five miles an hour and five miles to the gallon.','Damage costs twenty-five percent of her value at Eastbank Garage, minimum twenty-five dollars.']}
  ],replies:[
   {label:'Buy the truck · $500',if:{storyDone:true},act:'hal.buy'},
   {label:'What happens if I wreck it?',go:'hal.garage'},
   {label:'How is the egg coop looking?',go:'hal.coop'},
   {label:'I will take care of her.',go:'hal.wrap'}
  ]},

  {id:'hal.garage',say:[
   {t:['Eastbank Garage patches up scrapes, and a repair kit in your bag gives fifteen percent back up to forty.','Better not hitting a tree in the first place.']}
  ],replies:[
   {label:'How is the egg coop looking?',go:'hal.coop'},
   {label:'Fair enough, Hal.',go:'hal.wrap'}
  ]},

  {id:'hal.coop',do:[{topic:'haul'}],say:[
   {if:{gig:'need-harvest',gigClient:'hal'},t:['You took the harvest run? Good. Load the crates straight off the pallet by the barn.']},
   {if:{notBeat:'hal.coop-tip'},t:['Hens put out eight dozen eggs a day, plus six jugs of milk and ten bags of produce.','Wait till the shed hits ninety percent and the phone board opens an egg run for Noah.'],do:[{beat:'hal.coop-tip'}]},
   {t:['Coop lays every day whether my knee cooperates or not. Watch the board whenever stock creeps up.']}
  ],replies:[
   {label:'How much does an egg crate hold?',go:'hal.crate-math'},
   {label:'Ask about Walt Hargrove.',go:'hal.walt'},
   {label:'Keep the hens happy.',go:'hal.wrap'}
  ]},

  {id:'hal.crate-math',say:[
   {t:['Four dozen eggs per crate, six jugs for milk, five bags for produce.','One loaded Shortbed hauls sixteen dozen in a single clean run.']}
  ],replies:[
   {label:'Ask about Walt Hargrove.',go:'hal.walt'},
   {label:'Got those crate counts.',go:'hal.wrap'}
  ]},

  {id:'hal.walt',say:[
   {if:{notBeat:'hal.walt-tip'},t:['Known Walt twenty years. Show up before six PM and leave the woodpile tidier than you found it.','He will remember you when better ranks open.'],do:[{beat:'hal.walt-tip'},{standing:1}]},
   {if:{hired:'ridgeline'},t:['Good, Walt put you on the payroll. Watch the saw blade in Pine Ridge and stick to marked blocks.']},
   {if:{story:[6,8],storyDone:false},t:['Take my note over to Walt Hargrove at the Ridgeline office in Eastbank.','He sounds stiff at first, then treats steady workers fairly.']},
   {t:['Walt respects steady hands and honest timber counts. Do not slack around the yard.']}
  ],replies:[
   {label:'How is Peter getting on there?',go:'hal.peter'},
   {label:'How is that knee holding up?',go:'hal.knee'},
   {label:'I will see Walt soon.',go:'hal.wrap'}
  ]},

  {id:'hal.peter',do:[{beat:'hal.peter'}],say:[
   {if:{tierMin:'friend'},t:['Peter went off to fell pines for Ridgeline instead of milking cows at five AM.','Can’t blame the lad—eight bucks an hour beats waiting on hens, though I miss the help.']},
   {t:['My boy Peter walks into Pine Ridge most days for Walt Hargrove.','Hard-hat work suits him. Sends a quiet word back whenever I need fence rails.']}
  ],replies:[
   {label:'How is that knee holding up?',go:'hal.knee'},
   {label:'Good talking about the family.',go:'hal.wrap'}
  ]},

  {id:'hal.knee',say:[
   {if:{mood:['miserable','low'],notBeat:'hal.knee-checked'},t:['Stiff as an old gate hinge today, honestly. Even feeding the hens takes twice as long.','Check the gig board tomorrow—I may post a tending job if it keeps aching.'],do:[{beat:'hal.knee-checked'},{topic:'tend'},{mood:2}]},
   {if:{notBeat:'hal.knee-checked'},t:['Aches when the damp rolls off the river, settles once I keep moving.','Appreciate you asking, though. Not many folks stop long enough to check.'],do:[{beat:'hal.knee-checked'},{mood:2}]},
   {t:['Still creaks in damp weather, though keeping busy stops it locking up completely.']}
  ],replies:[
   {label:'Rest up, Hal. See you around.',go:'hal.wrap'}
  ]},

  {id:'hal.wrap',say:[
   {t:['Mind the bridge curve on the way out, and bring good news next trip.']}
  ],end:true}
 ]
});

// ── 3. Walt Hargrove (Ridgeline Timber Co. owner, Eastbank office) ───────────────────────────────────────────────────────
export const WALT=freezeDeep({
 id:'walt',
 name:'Walt Hargrove',
 personId:'commuter:ridgeline-owner',
 voice:'Gruff, fair, punctual Ridgeline Timber owner who speaks in rules, numbers and straight expectations.',
 facts:{company:'Ridgeline Timber Co.',office:'Eastbank',hours:'6 AM to 6 PM'},
 bye:[
  {if:{hired:'ridgeline'},t:'Gloves on, keep clear of moving blades.'},
  {t:'Office shuts at six sharp. Safe driving.'}
 ],
 nodes:[
  {id:'walt.office',entry:true,when:{place:'office'},do:[{meet:true}],say:[
   {if:{story:[6,8],storyDone:false,notBeat:'walt.note'},w:6,t:['Hal Brennan sent word you had a hand with his crates. If Hal vouches for you, my counter is open.','Come up to the desk—let us get you sorted. Can I help you with work?'],do:[{beat:'walt.note'},{standing:1}]},
   {if:{hired:'ridgeline',rankMin:5},w:4,t:['Good to see you, Sawyer. Planks are moving well through the Eastbank warehouse today.','What do you need?']},
   {if:{hired:'ridgeline',period:'morning'},w:3,t:['Good to see you on time this morning. Keep your gloves on and check the notice board.','Daylight will not wait—state what brings you to the desk.']},
   {if:{hired:'ridgeline'},w:2,t:['Good to see you. Keep your gloves on and your eyes on the work.','Office runs six AM to six PM if you need promotion papers or gear.']},
   {if:{hired:false,period:'morning'},w:1,t:['Morning. Ridgeline Timber Co. Can I help you?']},
   {if:{hired:false,period:'afternoon'},w:1,t:['Afternoon. Ridgeline Timber Co. Desk stays open until six—can I help you?']},
   {t:['Ridgeline Timber Co. Can I help you?']}
  ],replies:[
   {label:'I am looking for work.',if:{hired:false},go:'walt.offer'},
   {label:'Am I due a promotion?',if:{hired:'ridgeline'},go:'walt.promote'},
   {label:'Anything waiting for me here?',if:{hired:'ridgeline'},act:'walt.collect'},
   {label:'How does a Ridgeline shift work?',go:'walt.shift'},
   {label:'What is moving at the sawmill and warehouse?',go:'walt.mill'},
   {label:'What safety rules do I need to know?',go:'walt.safety'}
  ]},

  {id:'walt.open',entry:true,do:[{meet:true}],say:[
   {if:{hired:'ridgeline',rankMin:2,period:['evening','night']},t:['Off the clock now—office shut at six.','Feller rank suits you, by the way. Tomorrow starts at six sharp.']},
   {if:{hired:'ridgeline'},t:['Good to see you out here. Keep your axe sharp and stay inside marked blocks on shift.','Catch me at the Eastbank office between six and six.']},
   {if:{period:['evening','night']},t:['Office is shut. Come to Eastbank between six AM and six PM if you want work on the crew.']},
   {if:{beat:'walt.note'},t:['Hal put in a good word for you. Door to the Eastbank office is open whenever you want a shift.']},
   {t:['Walt Hargrove, Ridgeline Timber Co. Visit the Eastbank office between six AM and six PM if you want steady work.']}
  ],replies:[
   {label:'Tell me how a Ridgeline shift works.',go:'walt.shift'},
   {label:'What safety rules apply on site?',go:'walt.safety'},
   {label:'How is the mill running?',go:'walt.mill'}
  ]},

  {id:'walt.offer',say:[
   {if:{beat:'walt.note'},t:['Hal says you handle timber carefully. Everyone starts at the bottom here: an axe, $8.00 an hour, and piece pay per log.','Shifts run 6 AM to 6 PM—strictly daylight hours.']},
   {t:['Everyone starts at the bottom here. You get an axe, $8.00 an hour while you are on our land, and a little for every log.','Shifts run 6 AM to 6 PM, strictly daylight work.']}
  ],replies:[
   {label:'I will take it.',act:'walt.hire',go:'walt.hired-confirm'},
   {label:'Let me think about it.',go:'walt.think'}
  ]},

  {id:'walt.think',say:[
   {t:['Suit yourself. Office counter is open six AM to six PM whenever you want your boots in the woods.']}
  ],end:true},

  {id:'walt.hired-confirm',say:[
   {t:['You are on the crew. Here is your starter axe, and I buy back any old logs in your bag.','Clock in on your phone or by the office wall, and start with the marked pines in Pine Ridge.']}
  ],replies:[
   {label:'Tell me the safety rules first.',go:'walt.safety'},
   {label:'How is the plank yard set up?',go:'walt.mill'}
  ]},

  {id:'walt.promote',say:[
   {if:{rankMin:6},t:['Foreman is as high as I can put you. The chainsaw shelf in the back corner is open to you now.']},
   {if:{rankMin:2},t:['You have earned it. Feller pays $10.00 an hour, and harder ranks unlock trucks and warehouse tickets.','Want me to check your next rank papers?']},
   {t:['Not yet, or maybe you are close! To make Feller I want level 3, three shifts worked, and a reputation of 20.','Want me to stamp the promotion sheet now?']}
  ],replies:[
   {label:'Check and promote me if ready.',act:'walt.promote'},
   {label:'How does a shift work in detail?',go:'walt.shift'},
   {label:'Back to work then.',go:'walt.wrap'}
  ]},

  {id:'walt.shift',say:[
   {if:{hired:'ridgeline'},t:['Clocked-in minutes on Ridgeline land or inside a company truck earn your hourly wage.','Clear every task on the notice board for your rank bonus.']},
   {t:['Clock in between 6 AM and 5:30 PM at the wall clock or on your phone. Office shuts at six.','Marked pines pay $3.00 each; unmarked only pay seventy-five cents.']}
  ],replies:[
   {label:'How does the sawmill-to-warehouse chain pay?',go:'walt.chain'},
   {label:'What safety rules apply?',go:'walt.safety'},
   {label:'Understood, Walt.',go:'walt.wrap'}
  ]},

  {id:'walt.chain',say:[
   {t:['One felled log feeds the saw for four planks: $1.20 at the bench, twenty-five cents off the belt, then $7.30 delivered.','Full 40-plank warehouse cells pay an extra five-dollar stacking bonus.']}
  ],replies:[
   {label:'What about tools and trucks?',go:'walt.safety'},
   {label:'How is the mill running today?',go:'walt.mill'},
   {label:'Got it.',go:'walt.wrap'}
  ]},

  {id:'walt.safety',say:[
   {if:{rankMin:4},t:['Yard hands watch the forklift tail swing—never drive through shut warehouse rollers.','At Foreman and level 15, the $600 Chainsaw opens in our company store.']},
   {t:['Stand clear of a falling pine and the sawmill switch when the red beacon lights up.','Lumberjack level 5 unlocks the $8,000 Tylan Flatbed for hauling up to 120 planks.']}
  ],replies:[
   {label:'How are orders looking at the mill?',go:'walt.mill'},
   {label:'I will keep clear of the blade.',go:'walt.wrap'}
  ]},

  {id:'walt.mill',do:[{topic:'haul'}],say:[
   {if:{mood:['miserable','low']},t:['Mill runs dry without logs coming across the bridge. Six trickle planks a day will not keep Eastbank built.','Customers want steady pallets.']},
   {t:['Sawmill sits up north in Pine Ridge; only six trickle planks appear free a day—the rest needs fed logs.','Once you reach Yard hand at rank four, the warehouse order table opens up.']}
  ],replies:[
   {label:'Clear enough—back to the yard.',go:'walt.wrap'}
  ]},

  {id:'walt.wrap',say:[
   {t:['Stay sharp on the bridge and punch the clock before five-thirty if you want full pay.']}
  ],end:true}
 ]
});

// ── 4. Elena (Alder Coffee manager, Oak Street Apartments Flat 7) ────────────────────────────────────────────────────────
export const ELENA=freezeDeep({
 id:'elena',
 name:'Elena',
 personId:'oak-apartments/7#1',
 voice:'Brisk, warm, organised Alder Coffee manager who takes pride in her espresso and keeps one eye on the tables.',
 facts:{cafe:'Alder Coffee',hours:'8 AM to 6 PM',wage:'$24'},
 bye:[
  {if:{cafe:'onShift'},t:'Ticket is on your left—keep the portafilter clean!'},
  {t:'Stop by for an espresso sometime.'}
 ],
 nodes:[
  {id:'elena.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{period:'night'},t:['Quiet down here after closing! Flat seven smells faintly of roasted beans, sorry.','Cafe opens at eight tomorrow.']},
   {if:{cafe:'employed'},t:['Fancy bumping into my barista on the landing! Do not forget—shifts start at eight.']},
   {t:['Oh, hello! I am Elena, Flat seven—and manager over at Alder Coffee.','Pop over to the counter between eight and six if you want a coffee or work.']}
  ],replies:[
   {label:'How are shifts going at Alder Coffee?',go:'elena.work'},
   {label:'Tell me about Naomi and the Oak Street regulars.',go:'elena.regulars'},
   {label:'Need any stock hauled to the cafe?',go:'elena.stock'}
  ]},

  {id:'elena.cafe',entry:true,when:{place:['cafe','counter']},do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Welcome to Alder Coffee! I am Elena, I manage the counter and the machine here.','Pull up a seat for a hot meal, or ask if you want shifts behind the bar.']},
   {if:{gig:'need-restock',gigClient:'elena'},w:6,t:['Wait—are you carrying milk or egg crates for my cafe counter? Drop them in and we will square up.']},
   {if:{story:[2,2],storyDone:false},w:5,t:['Noah tell you to fuel up before walking out to Willow Farm?','Our six-dollar sandwich and coffee will set your feet straight for the hike.']},
   {if:{cafe:'onShift'},w:4,t:['Good timing! Two tables to keep happy and I have one eye on the timer.','Need your next task or ready to square up your shift?']},
   {if:{recent:'cafe-shift',cafe:'employed'},w:3,t:['Sharp shift earlier! The cups are stacked and Maya even left a tip on the saucer.']},
   {if:{cafe:'employed',period:'morning'},w:3,t:['Morning! Machine is hot and we open for shift clock-ins from eight AM until four.','Ready to step behind the counter?']},
   {if:{cafe:'employed'},w:2,t:['Good to see you back at the counter. Plenty of steady customers on Oak Street today.','Clocking in for $24, or stopping for food?']},
   {if:{mood:['miserable','low']},w:1,t:['Rush nearly had me behind two customers short, though the roast is still spot-on.','What can I brew for you?']},
   {t:['Hi there! Fresh roast is on and the tables are spotless.','What can I help you with?']}
  ],replies:[
   {label:'Let us talk about cafe work.',go:'elena.work'},
   {label:'I have your produce delivery from the market.',if:{story:[1,10]},go:'elena.delivery'},
   {label:'I would like something to eat and drink.',go:'elena.meal'},
   {label:'How are supplies holding up?',go:'elena.stock'},
   {label:'How do Oak Street regulars treat you?',go:'elena.regulars'}
  ]},

  {id:'elena.open',entry:true,do:[{meet:true}],say:[
   {if:{cafe:'employed',period:'morning'},t:['Morning! See you behind the machine at eight sharp—customers will not wait for their lattes.']},
   {if:{cafe:'employed'},t:['Good catching you outside! Remember shift clock-in closes at four PM, and I pay $24 a shift.']},
   {if:{period:['evening','night']},t:['Just locked the double glass doors after six. Nothing beats fresh air after steaming milk all day!']},
   {if:{met:false},t:['Hi! I am Elena, I manage Alder Coffee right across from Studio 2B.','Drop in between eight AM and six PM sometime.']},
   {t:['Hello there! Walking past Alder Coffee today, or headed up Oak Street?']}
  ],replies:[
   {label:'Are you hiring at the cafe?',go:'elena.work'},
   {label:'What do you serve for six dollars?',go:'elena.meal'},
   {label:'Tell me about the regulars.',go:'elena.regulars'}
  ]},

  {id:'elena.work',say:[
   {if:{cafe:'onShift'},t:['Check the order on your left: take Maya or Theo’s order, brew latte or espresso at the machine, serve, then wipe the table.','Clock back out with me once both leave to collect your $24 wages.']},
   {if:{cafe:'employed'},t:['You can clock in from 8 AM to 4 PM. Serve two customers, reset their tables, and return here for $24 pay.']},
   {t:['I need a cafe assistant to take orders, brew espresso or latte and keep the tables cleared.','A completed two-customer shift pays $24 straight away, same day.']}
  ],replies:[
   {label:'I would like the job.',if:{cafe:'none',place:['cafe','counter']},act:'cafe.hire',go:'elena.hired'},
   {label:'Clock me in for my shift.',if:{cafe:'employed',place:['cafe','counter']},act:'cafe.clockin'},
   {label:'Clock me out and pay $24.',if:{cafe:'onShift',place:['cafe','counter']},act:'cafe.clockout'},
   {label:'Walk me through what Maya and Theo order.',go:'elena.feedback'},
   {label:'Leave the counter clear for now.',go:'elena.wrap'}
  ]},

  {id:'elena.hired',say:[
   {t:['Wonderful—welcome aboard! Whenever you are ready between eight and four, talk to me here to clock in.']}
  ],replies:[
   {label:'Clock me in right now.',if:{place:['cafe','counter']},act:'cafe.clockin'},
   {label:'Walk me through Maya and Theo’s orders.',go:'elena.feedback'},
   {label:'See you behind the bar.',go:'elena.wrap'}
  ]},

  {id:'elena.feedback',say:[
   {if:{cafe:'employed'},t:['Maya always asks for a latte and Theo takes an espresso. Never mix up the roast on the machine!','Wipe the mug off the table right after each leaves.']},
   {t:['Only two tables per shift—Maya orders a latte, Theo orders an espresso.','Quick, calm work, and a clean bench keeps tips and reputation tidy.']}
  ],replies:[
   {label:'Tell me about your sandwich and coffee.',go:'elena.meal'},
   {label:'How are supplies holding up?',go:'elena.stock'},
   {label:'I can handle the machine.',go:'elena.wrap'}
  ]},

  {id:'elena.delivery',say:[
   {t:['Perfect—our fresh produce order from Noah at the Corner Market? Set it down right at the counter!']}
  ],replies:[
   {label:'Hand over the produce order ($14.00).',if:{place:['cafe','counter']},act:'job.deliver'},
   {label:'Hang on, I misplaced it.',go:'elena.wrap'}
  ]},

  {id:'elena.meal',say:[
   {if:{period:['morning','afternoon']},t:['Lunch is a fresh sandwich and hot coffee for $6. Best fuel on Oak Street!']},
   {t:['A fresh sandwich and coffee is $6 flat—fills your stomach and wakes your head right up.','Want one?']}
  ],replies:[
   {label:'Yes, please · $6.',if:{place:['cafe','counter']},act:'cafe.meal'},
   {label:'How are cafe supplies looking?',go:'elena.stock'},
   {label:'Maybe another time.',go:'elena.wrap'}
  ]},

  {id:'elena.stock',do:[{topic:'restock'}],say:[
   {if:{gig:'need-restock',gigClient:'elena'},t:['You are bringing my crates? Bring the truck up front—our milk and eggs shelf needs it badly.']},
   {t:['Ironwood Bakery sends three fresh loaves of bread a day, while farm eggs and milk go straight into our cooler.','Watch the Gigs app whenever our cafe shelf runs thin!']}
  ],replies:[
   {label:'Tell me about Oak Street regulars.',go:'elena.regulars'},
   {label:'I will keep an eye on the gig board.',go:'elena.wrap'}
  ]},

  {id:'elena.regulars',say:[
   {if:{notBeat:'elena.sophie-latte'},t:['Naomi handles the late shifts—between us, she practically keeps the grinder running smooth.','And Sophie from Flat two lives on my lattes whenever she is not rushing errands!'],do:[{beat:'elena.sophie-latte'},{mood:2}]},
   {t:['Naomi still sets the grinder up like clockwork every shift, and Sophie pops over whenever she catches her breath.']}
  ],replies:[
   {label:'Catch you behind the bar, Elena.',go:'elena.wrap'}
  ]},

  {id:'elena.wrap',say:[
   {t:['Eight to six every day—door chime always tells me when a friend walks in.']}
  ],end:true}
 ]
});

// ── 5. Sophie (18 Oak Street Flat 2 neighbour, Beat 1 grocery client) ─────────────────────────────────────────────────────
export const SOPHIE=freezeDeep({
 id:'sophie',
 name:'Sophie',
 personId:'oak-apartments/2#1',
 voice:'Kind, slightly rushed Flat 2 neighbour who apologises when busy and warms up with neighbourhood gossip.',
 facts:{flat:'Flat 2',building:'18 Oak Street',studio:'Studio 2B'},
 bye:[
  {if:{tierMin:'friend'},t:'Text if you run into Oscar—and thanks for making Oak Street feel friendlier!'},
  {t:'Sorry to dash! Catch you on the stairs later.'}
 ],
 nodes:[
  {id:'sophie.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{story:[2,10],notBeat:'sophie.thanked'},t:['Oh, you are the one who carried Noah’s bag over! I was dashing down to thank you properly.','Come round anytime, Flat two is always chaotic with parcels.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{beat:'sophie.groceries-delivered',notBeat:'sophie.thanked'},t:['Hello from upstairs! Thank you again for hauling those heavy tins over for me earlier.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{period:'night'},t:['Keeping my voice down on the landing—everyone else in 18 Oak Street is half asleep!','Fancy a quick word?']},
   {if:{story:[0,1],storyDone:false},t:['Oh, sorry—thought you were the delivery from Corner Market!','Noah promised someone might bring my bag over before long.']},
   {t:['Oh, hi! Excuse the stack of empty crates by my doormat—I am Sophie, Flat two.','What brings you up the hall?']}
  ],replies:[
   {label:'Checking in on your grocery order.',go:'sophie.groceries'},
   {label:'Who else lives here at 18 Oak Street?',go:'sophie.neighbours'},
   {label:'Do you post errand work on the phone?',go:'sophie.errands'},
   {label:'Ever get over to Alder Coffee?',go:'sophie.coffee'},
   {label:'How does Studio 2B work around here?',go:'sophie.studio'}
  ]},

  {id:'sophie.open',entry:true,do:[{meet:true}],say:[
   {if:{recent:'delivered:sophie',notBeat:'sophie.thanked'},w:6,t:['You just dropped my groceries at the awning—thank you! Noah always packs the apples like bricks.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{story:[2,10],notBeat:'sophie.thanked'},w:5,t:['Hey! You are Noah’s runner who dropped my groceries by 18 Oak Street, aren’t you? Thank you!','Saved me two trips with sore arms.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{beat:'sophie.groceries-delivered',notBeat:'sophie.thanked'},w:5,t:['Hey! Almost missed you on the pavement—thanks again for my Corner Market groceries!'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{story:[0,1],storyDone:false,met:false},w:4,t:['Oh, hello! Sorry to rush past—waiting on a Corner Market bag while I answer emails.','Sophie, Flat two across the street.']},
   {if:{period:'morning'},w:1,t:['Morning! Trying to catch Elena’s coffee counter before my errands start piling up.']},
   {if:{period:'afternoon',mood:['miserable','low']},w:2,t:['Sorry, slow afternoon and my list still reaches my elbow. Lovely seeing a friendly face though!']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Walking the length of Oak Street before the market queues form.']},
   {if:{period:'evening'},w:1,t:['Evening! Best part of Oak Street once traffic thins out. Just grabbing bread before ten.']},
   {if:{period:'night'},w:1,t:['Late one, isn’t it? Quiet on Oak Street after the shops pull their blinds.']},
   {t:['Hey! Always rushing somewhere, though never too busy for a quick word.']}
  ],replies:[
   {label:'About those market groceries...',go:'sophie.groceries'},
   {label:'Who else lives in 18 Oak Street?',go:'sophie.neighbours'},
   {label:'Need a hand with errands?',go:'sophie.errands'},
   {label:'Fancy grabbing a coffee sometime?',go:'sophie.coffee'},
   {label:'Know the story with Studio 2B?',go:'sophie.studio'}
  ]},

  {id:'sophie.groceries',say:[
   {if:{story:[0,1],storyDone:false},t:['I placed an order with Noah over at the Corner Market—just one heavy bag to bring over to the awning.']},
   {if:{story:[2,3],storyDone:false},t:['Noah told me he is sending you out to Hal Brennan’s farm next.','Wear good boots—the bridge walk up to Willow Farm takes a fair hike!'],do:[{beat:'sophie.thanked'}]},
   {t:['Everything from the market arrived unbruised, even the eggs! You are much steadier than the old carrier.'],do:[{beat:'sophie.thanked'}]}
  ],replies:[
   {label:'Who else lives in 18 Oak Street?',go:'sophie.neighbours'},
   {label:'Need a hand with other errands?',go:'sophie.errands'},
   {label:'Glad everything made it up safely.',go:'sophie.wrap'}
  ]},

  {id:'sophie.neighbours',say:[
   {t:['Let me see—Elena keeps Flat seven, Noah is in eight, and then there is Oscar in Flat nine!','Wait until you try getting Oscar to open his door.']}
  ],replies:[
   {label:'Why, what is the secret with Oscar?',go:'sophie.oscar'},
   {label:'Who lives in Flats ten and eleven?',go:'sophie.upstairs'}
  ]},

  {id:'sophie.oscar',say:[
   {if:{notBeat:'sophie.oscar-hint'},t:['Oscar only answers the buzzer between ten AM and noon, and he hates anyone ringing twice!','Knock politely once a day for a few days and the old grumpy thing actually thaws.'],do:[{beat:'sophie.oscar-hint'},{standing:1}]},
   {t:['Just one buzz between ten AM and noon, remember—Oscar notices who respects his quiet.']}
  ],replies:[
   {label:'Who lives in Flats ten and eleven?',go:'sophie.upstairs'},
   {label:'How do errands work round here?',go:'sophie.errands'},
   {label:'Good tip—I will remember that.',go:'sophie.wrap'}
  ]},

  {id:'sophie.upstairs',say:[
   {t:['Lincoln Brambly in Flat ten works the market counter evenings and talks deer tracks non-stop.','And Brentster in eleven runs Ironwood Store—ask him about his grey cat Junior.']}
  ],replies:[
   {label:'Do you post errand work on the phone?',go:'sophie.errands'},
   {label:'Fancy grabbing a coffee sometime?',go:'sophie.coffee'},
   {label:'Sounds like a lively building.',go:'sophie.wrap'}
  ]},

  {id:'sophie.errands',do:[{topic:'errand'}],say:[
   {if:{gig:'need-errand',gigClient:'sophie'},t:['Wait—did you pick up my phone errand already? Check the Gigs app marker, I will make sure it pays right!']},
   {if:{mood:['miserable','low']},t:['Could honestly use two pairs of hands today. Watch the phone board—when things pile up I post errands there.']},
   {t:['Whenever I fall behind on post or groceries, I post small runs on the town Gigs board.','Better money than standing idle, plus Noah appreciates the foot traffic.']}
  ],replies:[
   {label:'How is the coffee across the street?',go:'sophie.coffee'},
   {label:'Know the story with Studio 2B?',go:'sophie.studio'},
   {label:'I will check my phone for your runs.',go:'sophie.wrap'}
  ]},

  {id:'sophie.coffee',say:[
   {if:{tierMin:'friend',notBeat:'sophie.coffee-invite'},t:['Truthfully, I live on Elena’s lattes—we ought to grab two chairs at Alder Coffee once your truck runs steady.'],do:[{beat:'sophie.coffee-invite'},{mood:2}]},
   {if:{tierMin:'friend'},t:['My Alder Coffee invite still stands whenever you catch a quiet ten minutes between runs.']},
   {t:['Elena runs Alder Coffee across from us, open eight until six.','Six dollars gets you a fresh sandwich and coffee—lifesaver when your energy drops!']}
  ],replies:[
   {label:'Tell me about renting Studio 2B.',go:'sophie.studio'},
   {label:'Catch you there soon.',go:'sophie.wrap'}
  ]},

  {id:'sophie.studio',say:[
   {t:['Studio 2B right beside us is ninety dollars to move in—thirty deposit and sixty for your first week, plus seven dollars base utilities.','Comes with a car bay out front if Hal lets you keep his truck!']}
  ],replies:[
   {label:'Thanks for showing me the ropes, Sophie.',go:'sophie.wrap'}
  ]},

  {id:'sophie.wrap',say:[
   {t:['Anyway, must run—buzz Flat two anytime if you have five minutes!']}
  ],end:true}
 ]
});

export const EARLY_CAST=Object.freeze([NOAH,HAL,WALT,ELENA,SOPHIE]);
