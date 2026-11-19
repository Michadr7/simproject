// Early cast (Noah, Hal, Walt, Elena, Sophie); notes/conversation-design.md stage C4.
const freezeDeep=o=>{if(!o||typeof o!=='object')return o;Object.freeze(o);for(const v of Object.values(o))freezeDeep(v);return o};

// ── 1. Noah (Corner Market clerk, Oak Street Apartments Flat 8) ──────────────────────────────────────────────────────────
export const NOAH=freezeDeep({
 id:'noah',
 name:'Noah',
 personId:'oak-apartments/8#1',
 voice:'Warm, chatty Corner Market clerk who counts stock out loud and looks out for neighbours.',
 facts:{shop:'Corner Market',flat:'Flat 8',building:'18 Oak Street',farm:'Willow Farm'},
 bye:[
  {if:{weather:'rain'},t:'Keep dry out there. Mind the puddles by the kerb.'},
  {if:{weather:'snow'},t:'Watch the step outside—it gets slick in the snow.'},
  {if:{tierMin:'close'},t:'See you later, pal. Door is always open for you.'},
  {if:{tierMin:'friend'},t:'See you round, friend. Take care out there.'},
  {if:{mood:['miserable','low']},t:'Better get back to these crates. See you.'},
  {if:{period:['morning','afternoon','evening']},t:'Good talking. Doors stay open until ten.'},
  {t:'Always good talking. See you soon.'}
 ],
 nodes:[
  {id:'noah.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{period:'night',tierMin:'friend'},w:4,t:['Clocked off for the night, friend.','Catch me at the counter from seven tomorrow.']},
   {if:{period:'night',met:true},w:3,t:['Clocked off for the day. Flat eight is quiet hours now.','Come by the market from seven.']},
   {if:{period:'night',met:false},w:3,t:['Oh, hi! I am Noah, Flat eight.','You caught me off shift. Drop by Corner Market from seven.']},
   {if:{weather:'rain',met:true},w:3,t:['Quite a downpour out there.','Come by the market if you need to dry off.']},
   {if:{weather:'snow',met:true},w:3,t:['Chilly out in this snow!','I am just warming my hands before heading over.']},
   {if:{period:'morning',met:true},w:2,t:['Just heading over for the morning rush.','Walk down with me if you need supplies.']},
   {if:{period:'evening',met:true},w:2,t:['Still counting tomorrow’s order in my head.','Market stays open until ten if you need anything.']},
   {if:{met:false},w:2,t:['Hi there! You must be new on Oak Street. I am Noah.','I run Corner Market just down the block.']},
   {if:{tierMin:'close'},w:2,t:['Hey, good to see you at my door!','What is on your mind?']},
   {t:['Hey! Caught me between chores.','Need something from the shop, or just saying hi?']}
  ],replies:[
   {label:'What is on the shelves today?',go:'noah.shelves'},
   {label:'Any work going at the market?',go:'noah.work'},
   {label:'How did Sophie settle her order?',if:{story:[2,10],notBeat:'is.skipped'},go:'noah.sophie'},
   {label:'Hear anything round Oak Street?',go:'noah.town'}
  ]},

  {id:'noah.counter',entry:true,when:{place:'counter'},do:[{meet:true}],say:[
   {if:{met:false,story:[0,1],storyDone:false},w:7,t:['Welcome in! I am Noah—you look new to Oak Street.','We are open seven until ten for food, packs and tools. Ask me about work if you want a start.']},
   {if:{gig:'need-restock',gigClient:'noah'},w:7,t:['Is that my restock run? Back up to the door and we will count crates.','The shelves could really use it.']},
   {if:{story:[2,2],storyDone:false},w:6,t:['Glad you came back first.','Willow Farm is a fair walk north, so grab a bite and a drink before you head out.']},
   {if:{story:[3,3],storyDone:false},w:6,t:['Hal Brennan is expecting those groceries at Willow Farmhouse.','Head north over the river bridge and he will sort you out.']},
   {if:{story:[4,4],storyDone:false},w:6,t:['Already cleared shelf space for Hal’s four egg crates!','Bring his truck round front when they are loaded, and take the bridge easy.']},
   {if:{recent:'promoted'},w:5,t:['Heard you moved up a step at Ridgeline—good on you!','Grabbing supplies before your next shift?']},
   {if:{recent:'delivered:sophie'},w:5,t:['That grocery bag made Sophie’s day!','Twelve dollars in your pocket and a happy neighbour too.']},
   {if:{recent:'egg-run',tierMin:'acquaintance'},w:5,t:['Those eggs flew off the shelf!','Thanks again for hauling Hal’s crates so clean.']},
   {if:{hired:'ridgeline',period:'morning',tierMin:'friend'},w:4,t:['Morning! Hard to miss that Ridgeline vest—up early for the woods?','Grab coffee or a snack before you head over.']},
   {if:{hired:'ridgeline'},w:4,t:['I see that Ridgeline vest! Tough work out in Pine Ridge.','Need food or a drink to keep you going?']},
   {if:{weather:'rain'},w:4,t:['Wet day out there! Shake your coat off by the door.','Warm coffee and dry shelves in here, at least.']},
   {if:{weather:'storm'},w:4,t:['Rough storm rolling through! Glad you made it inside.','Take your time—I am not rushing anyone out in this.']},
   {if:{weather:'snow'},w:4,t:['Snow makes Oak Street look like a postcard, does it not?','Hot drinks are ready if you need to thaw out.']},
   {if:{weather:'fog'},w:4,t:['Thick fog on the street today. Take it slow if you are driving.','What can I get for you?']},
   {if:{weather:'cloudy',period:'afternoon'},w:3,t:['Grey afternoon out there, so I put extra lights on in here.','Anything I can grab off the shelves for you?']},
   {if:{tierMin:'close',period:'morning'},w:3,t:['Morning, pal! Best part of the shift is seeing a friendly face early.','What are you after today?']},
   {if:{tierMin:'close'},w:3,t:['Hey, always good to see you!','Looking to stock up, or just stopping for a chat?']},
   {if:{period:'morning',mood:['good','delighted']},w:2,t:['Good morning! Fresh bread just came in from Ironwood Bakery.','Need groceries, or chasing a gig?']},
   {if:{period:'morning',mood:['miserable','low']},w:2,t:['Slow morning, and two crates short on my count.','What can I grab for you?']},
   {if:{period:'morning'},w:1,t:['Morning! Till is open and the shelves are swept.','Shopping or looking for work?']},
   {if:{period:'afternoon',mood:['good','delighted']},w:2,t:['Good afternoon! Steady trade since noon and plenty on the racks.','How can I help?']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Halfway through today’s stock sheet.','What brings you up to the counter?']},
   {if:{period:'evening',tierMin:'friend'},w:2,t:['Good evening, friend. Winding down before ten.','Need supplies or town news?']},
   {if:{period:'evening'},w:1,t:['Evening! Open until ten, so no rush.','Browsing or looking for work?']},
   {if:{period:'night'},w:1,t:['Late shop before I pull the shutters at ten.','Grab what you need and I will ring it up.']},
   {t:['Welcome back to Corner Market.','Everything is fresh on the racks today.']}
  ],replies:[
   {label:'What is on the shelves?',go:'noah.shelves'},
   {label:'Any work going?',go:'noah.work'},
   {label:'Let me browse items.',act:'openStore'},
   {label:'Did Sophie get her groceries?',if:{story:[2,10],notBeat:'is.skipped'},go:'noah.sophie'},
   {label:'Tell me about Hal’s eggs.',if:{story:[4,10],notBeat:'is.skipped',tierMax:'stranger'},go:'noah.eggs'},
   {label:'What is new round town?',if:{met:true,storyDone:true},go:'noah.town'}
  ]},

  {id:'noah.open',entry:true,do:[{meet:true}],say:[
   {if:{met:false},w:4,t:['Hi there! I am Noah—I work the counter at Corner Market on Oak Street.','We open seven to ten if you need groceries, coffee or an axe.']},
   {if:{weather:'rain'},w:4,t:['Ducking between raindrops, same as me?','Market is dry and open till ten if you need anything.']},
   {if:{weather:'snow'},w:4,t:['Crisp snow out today!','Nothing beats a hot coffee after walking Oak Street in this.']},
   {if:{hired:'ridgeline'},w:3,t:['Spotted that Ridgeline vest a block away!','Working hard out at the yard?']},
   {if:{tierMin:'close'},w:3,t:['Hey! Fancy running into you out here.','How is your day shaping up?']},
   {if:{tierMin:'friend'},w:2,t:['Good to see you, friend! Nice taking five minutes away from the till.']},
   {if:{period:'morning'},w:1,t:['Lovely morning on Oak Street before the rush starts.','Stop by the counter anytime.']},
   {if:{period:'afternoon'},w:1,t:['Stepping out for air while the afternoon stays quiet.','Market is open till ten if you need supplies.']},
   {if:{period:['evening','night']},w:1,t:['Heading home along Oak Street. Market closes at ten sharp!']},
   {t:['Good to see you out in the fresh air.']}
  ],replies:[
   {label:'What do you stock?',go:'noah.shelves'},
   {label:'Know any work going?',go:'noah.work'},
   {label:'Heard much round town?',go:'noah.town'}
  ]},

  {id:'noah.shelves',say:[
   {if:{mood:['miserable','low']},w:2,t:['Eggs, milk, produce and bread are flying out faster than vans arrive.','When a shelf hits zero I post a restock job on the board.']},
   {if:{tierMin:'friend'},w:2,t:['Hal brings eggs at four-fifty and milk at four.','Ironwood Bakery sends three-fifty loaves, plus we carry a twenty-dollar axe.']},
   {t:['Food, cold drinks, packs, a twenty-dollar axe and a fifteen-dollar gas can.','Prices drift up or down a bit depending on what is left on the rack.']}
  ],replies:[
   {label:'Read today’s prices.',act:'shelves',if:{place:'counter'}},
   {label:'Open the market till.',act:'openStore',if:{place:'counter'}},
   {label:'You post restock jobs?',go:'noah.restock-hint'},
   {label:'Any work going?',go:'noah.work'}
  ]},

  {id:'noah.restock-hint',say:[
   {t:['Every crate helps! Check the Prices screen on your phone before you haul.','Short shelves pay up to a quarter more than base price.']},
   {t:['Soon as a rack runs thin, I put a run on the Gigs board.','Full crates pay best when shelves are nearly empty.']}
  ],replies:[
   {label:'Check the gig board.',act:'gigBoard',if:{place:'counter'}},
   {label:'What deliveries are waiting?',go:'noah.work'},
   {label:'Thanks for the tip.',go:'noah.wrap'}
  ]},

  {id:'noah.work',say:[
   {if:{story:[0,1],storyDone:false,place:'counter'},w:5,t:['Sophie in Flat two at 18 Oak Street ordered groceries—twelve dollars on delivery.','Or if you know the ropes already, you can skip the starter errands.']},
   {if:{story:[0,1],storyDone:false},w:4,t:['Come to the market counter while we are open, seven to ten.','I have a bag ready for Sophie at 18 Oak Street.']},
   {if:{story:[2,2],storyDone:false},w:4,t:['Next run is Hal Brennan at Willow Farmhouse, north over the bridge.','Eat and grab a drink first so your legs hold out.']},
   {if:{story:[3,3],storyDone:false},w:4,t:['Hal Brennan is waiting at Willow Farmhouse for his groceries.','Cross the river bridge north and follow the lane.']},
   {if:{gig:true},w:3,t:['Finish the gig you already took before grabbing another.','Check your phone tracker if you lose the marker.']},
   {t:['Between local deliveries and town gigs there is nearly always something up.','Egg runs for Willow Farm and timber hauls pay best once you have a truck.']}
  ],replies:[
   {label:'Take Sophie’s grocery order ($12.00).',if:{story:[0,1],storyDone:false,place:'counter'},go:'noah.sophie-order'},
   {label:'Skip the introduction.',if:{story:[0,1],storyDone:false,place:'counter'},go:'noah.skip'},
   {label:'Check the gig board.',act:'gigBoard',if:{place:'counter'}},
   {label:'What is new round town?',go:'noah.town'}
  ]},

  {id:'noah.sophie-order',do:[{act:'job.pickup'}],say:[
   {t:['Thanks! Take the bag straight to the awning at 18 Oak Street.','Check back with me once Sophie has her groceries.']}
  ],end:true},

  {id:'noah.skip',say:[
   {t:['Wait—if you skip the introduction, there is no story and no free truck from Hal.','He will still sell you the Shortbed for $500 later if you have parking. Skip anyway?']}
  ],replies:[
   {label:'Yes, skip the story.',act:'skipStory'},
   {label:'No, I will do the errands.',go:'noah.keep-story'}
  ]},

  {id:'noah.keep-story',say:[
   {t:['Good call! Take Sophie’s bag over to 18 Oak Street whenever you are ready.']}
  ],replies:[
   {label:'Take Sophie’s grocery order ($12.00).',if:{place:'counter'},act:'job.pickup'},
   {label:'I will be back in a minute.',go:'noah.wrap'}
  ]},

  {id:'noah.town',say:[
   {if:{hired:false},w:3,t:['Walt Hargrove at Ridgeline Timber in Eastbank is hiring, six AM to six PM.','Eight dollars an hour plus three dollars per marked pine!']},
   {if:{cafe:'none'},w:2,t:['Elena next door at Alder Coffee & Diner needs help: eight dollars an hour plus tips.','Ask her at the counter from eight.']},
   {t:['Eastbank fuel tanker rolls in weekly with four-dollar gas and four-twenty diesel.','Do not run a truck dry north of the bridge!']},
   {t:['Oak Street stays pretty peaceful, though the diner midday rush gets lively round noon.']}
  ],replies:[
   {label:'How did Sophie find her order?',if:{story:[2,10],notBeat:'is.skipped'},go:'noah.sophie'},
   {label:'Tell me about Hal’s eggs.',if:{story:[4,10]},go:'noah.eggs'},
   {label:'Catch you later, Noah.',go:'noah.wrap'}
  ]},

  {id:'noah.sophie',say:[
   {if:{notBeat:'noah.sophie-praised'},t:['Sophie popped down just to say thanks for bringing those groceries intact.','She is in Flat two, same building as me. Ring her buzzer sometime!'],do:[{beat:'noah.sophie-praised'},{standing:1},{mood:2}]},
   {t:['Sophie still mentions how quick you brought that bag over.','She lives in Flat two if you ever fancy checking in.']}
  ],replies:[
   {label:'Tell me about Hal’s eggs.',if:{story:[4,10]},go:'noah.eggs'},
   {label:'Glad she was pleased.',go:'noah.wrap'}
  ]},

  {id:'noah.eggs',say:[
   {if:{story:[4,4],storyDone:false},t:['Four crates fit neatly on Hal’s Shortbed. Watch the kerb over the bridge!','Smooth driving keeps quality high and pays the full forty dollars.']},
   {if:{recent:'egg-run',notBeat:'noah.eggs-checked'},t:['Every dozen stacked clean on the rack! Hal knows who to trust with a full bed.','Keep an eye on the Gigs app whenever our egg basket dips.'],do:[{beat:'noah.eggs-checked'},{standing:1}]},
   {t:['Hal’s hens lay faster than he can haul with that bad knee.','A clean four-crate run pays twenty-eight to forty dollars.']}
  ],replies:[
   {label:'Show me shelf prices.',act:'shelves',if:{place:'counter'}},
   {label:'I will keep them safe.',go:'noah.wrap'}
  ]},

  {id:'noah.wrap',say:[
   {if:{period:'morning'},t:['Off you go. Got a delivery to count before noon.']},
   {if:{weather:'rain'},t:['Stay dry out there! Holler if you need anything.']},
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
  {if:{weather:'rain'},t:'Mud gets deep by the gate in this rain. Watch your step.'},
  {if:{weather:'snow'},t:'Lane freezes over fast in snow. Take the bridge slow.'},
  {if:{mood:['miserable','low']},t:'Leave the gate shut behind you. Knee needs five minutes.'},
  {if:{tierMin:'friend'},t:'Drop by anytime, friend. Coffee pot is usually on.'},
  {t:'Close the barn gate on your way out. Safe driving.'}
 ],
 nodes:[
  {id:'hal.open',entry:true,do:[{meet:true}],say:[
   {if:{gig:'need-harvest',gigClient:'hal',storyDone:true},w:7,t:['You took the harvest job? Good. Shed is fuller than I can sell.']},
   {if:{gig:'need-restock',storyDone:true},w:7,t:['On the egg run? Crates are on the pallet by the barn. Back up and load.']},
   {if:{story:[0,2],storyDone:false},w:6,t:['Haven\'t seen you around. Noah said he might send someone out with my groceries.']},
   {if:{story:[3,3],storyDone:false},w:6,t:['You must be Noah\'s helper. My knee says thank you.','My old Shortbed has stood since spring. Take her for the day if you can drive.']},
   {if:{story:[4,4],storyDone:false,beat:'is.loaded'},w:7,t:['The crates are on. Noah is waiting, so mind the bumps.']},
   {if:{story:[4,4],storyDone:false},w:6,t:['Four crates of eggs are on the pallet by the barn. Load up and run them to Noah.']},
   {if:{story:[5,5],storyDone:false},w:6,t:['She is nearly dry. I left cash for gas. The pump is in Eastbank.']},
   {if:{story:[6,8],storyDone:false},w:6,t:['Walt at the Ridgeline office is expecting my note. Take a gig if you want the money.']},
   {if:{story:[9,9],storyDone:false},w:6,t:['Rent Studio 2B so she has somewhere to sleep. Then she is yours.']},
   {if:{met:false,storyDone:true},w:5,t:['Hal Brennan. Keep the farm gate latched and check the barn pallet if you want hauling work.']},
   {if:{storyDone:true,notBeat:'hal.done-greet'},w:4,t:['Come by some mornings. I will have work.','Willow Farm stays busy either way.'],do:[{beat:'hal.done-greet'}]},
   {if:{hired:'ridgeline',tierMin:'friend'},w:3,t:['Good seeing that Ridgeline vest out here.','Walt keeping you and Peter busy?']},
   {if:{hired:'ridgeline'},w:3,t:['Got the Ridgeline vest on, I see.','Tell Walt I said hello next time you are in Eastbank.']},
   {if:{weather:'rain'},w:3,t:['Rain makes my knee ache like an old hinge.','Hens stay dry in the coop, at least.']},
   {if:{weather:'snow'},w:3,t:['Snow on the pasture already.','Check the tires before you take the lane back.']},
   {if:{weather:'fog'},w:3,t:['Thick fog rolling off the river.','Take the bridge slow if you are hauling.']},
   {if:{tierMin:'close',period:'morning'},w:3,t:['Morning. Poured you a mug—coffee is on the stove.','Good to have someone I trust around the place.']},
   {if:{tierMin:'close'},w:3,t:['Good to see you. Pull up a crate if you want to rest five minutes.']},
   {if:{period:'morning',tierMin:'friend'},w:2,t:['Morning. Coffee is fresh on the stove if you need five minutes.','Hens laid early today.']},
   {if:{period:'morning'},w:1,t:['Morning. Bad knee slowed me down, so the coop got ahead of me again.']},
   {if:{period:'afternoon',mood:['miserable','low']},w:2,t:['Long afternoon. Farm work waits for nobody when your leg aches.']},
   {if:{period:'afternoon'},w:1,t:['Afternoon. Sun is steady on the pasture and the milk pails are racked.']},
   {if:{period:['evening','night']},w:1,t:['Long day. Even a farmer packs the tools away eventually.','Coop shuts down fine on its own till sunup.']},
   {t:['Steady work keeps Willow Farm turning. Check the barn pallet if you want hauling.']}
  ],replies:[
   {label:'Hand over the groceries',if:{story:[3,3],storyDone:false},go:'hal.loan',do:[{act:'hal.groceries'},{beat:'hal.met'},{standing:1}]},
   {label:'How is the Shortbed?',go:'hal.truck'},
   {label:'How is the coop looking?',go:'hal.coop'},
   {label:'How is Walt to work for?',if:{story:[6,10]},go:'hal.walt'},
   {label:'How is that knee holding up?',if:{met:true,storyDone:true},go:'hal.knee'},
   {label:'Seen Peter lately?',if:{tierMin:'acquaintance'},go:'hal.peter'}
  ]},

  {id:'hal.loan',say:[
   {t:['Keys are in her. Four crates of eggs are on the pallet by the barn: take them to Noah.']}
  ],end:true},

  {id:'hal.truck',say:[
   {if:{beat:'is.ownsShortbed'},t:['She is yours now. Keep oil and gas in her and she will outlast us both.']},
   {if:{storyDone:true,notBeat:'is.ownsShortbed'},t:['The Shortbed is still in my yard if you have room. She is $500, and she runs fine.','Takes gasoline, carries four crates or forty-four planks.']},
   {if:{story:[4,5],storyDone:false},t:['Kasumuchi S70 takes regular gas and holds four crates cleanly.','Take the bumps easy so Noah’s eggs stay whole.']},
   {t:['That little S70 pulls sixty-five on the road and five miles to the gallon.','Eastbank repair shop fixes scrapes, though it costs at least twenty-five dollars.']}
  ],replies:[
   {label:'Buy the truck · $500',if:{storyDone:true,notBeat:'is.ownsShortbed'},act:'hal.buy'},
   {label:'What if I wreck it?',go:'hal.garage'},
   {label:'How is the coop looking?',go:'hal.coop'},
   {label:'I will take care of her.',go:'hal.wrap'}
  ]},

  {id:'hal.garage',say:[
   {t:['Eastbank repair shop patches up scrapes, and a repair kit in your bag gives a little back.','Better not hitting a tree in the first place.']}
  ],replies:[
   {label:'How is the coop looking?',go:'hal.coop'},
   {label:'Fair enough, Hal.',go:'hal.wrap'}
  ]},

  {id:'hal.coop',do:[{topic:'haul'}],say:[
   {if:{gig:'need-harvest',gigClient:'hal'},t:['The harvest run, eh? Good. Take what the shed holds; it is fuller than I can sell.']},
   {if:{notBeat:'hal.coop-tip'},t:['Hens put out eight dozen eggs a day, plus milk and produce.','When the shed hits ninety percent, the board opens an egg run for Noah.'],do:[{beat:'hal.coop-tip'}]},
   {t:['Coop lays every day whether my knee likes it or not. Watch the board when stock creeps up.']}
  ],replies:[
   {label:'How much fits in a crate?',go:'hal.crate-math'},
   {label:'How is Walt to work for?',go:'hal.walt'},
   {label:'Keep the hens happy.',go:'hal.wrap'}
  ]},

  {id:'hal.crate-math',say:[
   {t:['Four dozen eggs per crate, six jugs for milk, five bags for produce.','One loaded Shortbed hauls sixteen dozen in a single clean run.']}
  ],replies:[
   {label:'How is Walt to work for?',go:'hal.walt'},
   {label:'Got it, thanks.',go:'hal.wrap'}
  ]},

  {id:'hal.walt',say:[
   {if:{notBeat:'hal.walt-tip'},t:['Known Walt twenty years. Show up before six PM and leave the yard tidy.','He remembers who works steady when better ranks open.'],do:[{beat:'hal.walt-tip'},{standing:1}]},
   {if:{hired:'ridgeline'},t:['Good, Walt put you on the payroll. Watch the saw blade in Pine Ridge and stick to marked trees.']},
   {if:{story:[6,8],storyDone:false},t:['Take my note to Walt Hargrove at the Ridgeline office in Eastbank.','He sounds stiff at first, then treats steady workers fairly.']},
   {t:['Walt respects steady hands and honest timber counts. Do not slack around the yard.']}
  ],replies:[
   {label:'How is Peter doing there?',go:'hal.peter'},
   {label:'How is that knee holding up?',go:'hal.knee'},
   {label:'I will see Walt soon.',go:'hal.wrap'}
  ]},

  {id:'hal.peter',say:[
   {if:{tierMin:'friend'},t:['Peter went off to fell pines for Ridgeline instead of milking cows at five AM.','Can’t blame the lad—ten dollars an hour beats waiting on hens, though I miss the help.']},
   {t:['My boy Peter walks into Pine Ridge most days for Walt.','Hard-hat work suits him. Still mends my fence rails when he gets home.']}
  ],replies:[
   {label:'How is that knee holding up?',go:'hal.knee'},
   {label:'Good talking, Hal.',go:'hal.wrap'}
  ]},

  {id:'hal.knee',say:[
   {if:{mood:['miserable','low'],notBeat:'hal.knee-checked'},t:['Stiff as an old gate hinge today. Even feeding the hens takes twice as long.','Check the gig board tomorrow—I may post a tending job if it keeps aching.'],do:[{beat:'hal.knee-checked'},{topic:'tend'},{mood:2}]},
   {if:{notBeat:'hal.knee-checked'},t:['Aches when the damp rolls off the river, settles once I keep moving.','Appreciate you asking. Not many folks stop to check.'],do:[{beat:'hal.knee-checked'},{mood:2}]},
   {t:['Still creaks in damp weather, though keeping busy stops it locking up.']}
  ],replies:[
   {label:'Rest up, Hal.',go:'hal.wrap'}
  ]},

  {id:'hal.wrap',say:[
   {if:{mood:['miserable','low']},t:['Go on. I will sit a minute.']},
   {if:{weather:'rain'},t:['Mind the mud on the lane back.']},
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
  {if:{weather:'rain'},t:'Wet timber slips easy. Watch your footing.'},
  {if:{weather:'snow'},t:'Clear the steps before you haul in this snow.'},
  {if:{hired:'ridgeline'},t:'Gloves on, keep clear of moving blades.'},
  {t:'Office shuts at six sharp. Safe driving.'}
 ],
 nodes:[
  {id:'walt.office',entry:true,when:{place:'office'},do:[{meet:true}],say:[
   {if:{story:[6,8],storyDone:false,hired:false,notBeat:'walt.note'},w:7,t:['Hal Brennan sent word you helped with his crates. If Hal vouches for you, my desk is open.','Step up—let us get you sorted. Can I help you with work?'],do:[{beat:'walt.note'},{standing:1}]},
   {if:{hired:'ridgeline',rankMin:6},w:6,t:['Good to see you, Foreman. The crew sets its pace by you now.','What do you need?']},
   {if:{hired:'ridgeline',rankMin:5},w:5,t:['Good to see you. Planks are moving steady through the Eastbank warehouse.','What brings you in?']},
   {if:{hired:'ridgeline',weather:'rain'},w:4,t:['Wet out in the yard today. Keep your vest zipped and your boots planted.','What can I do for you?']},
   {if:{hired:'ridgeline',weather:'snow'},w:4,t:['Snow slows the trucks down, not the saw. Watch the ice by the rollers.','Speak up—what can I sort out for you?']},
   {if:{hired:'ridgeline',hour:[5,8]},w:4,t:['Good to see you on time this morning. Check the notice board and keep your gloves on.','Daylight will not wait—what brings you to the desk?']},
   {if:{hired:'ridgeline',tierMin:'close'},w:4,t:['There is my best hand. Pull up a chair a second if you need papers or gear.']},
   {if:{hired:'ridgeline',tierMin:'friend'},w:3,t:['Good to see you. You have earned your keep round this yard.','Need gear, papers, or shift info?']},
   {if:{hired:'ridgeline'},w:2,t:['Good to see you. Vest on, eyes on the work.','Office runs six to six for gear or promotion papers.']},
   {if:{hired:false,period:'morning'},w:1,t:['Morning. Ridgeline Timber Co. Can I help you?']},
   {if:{hired:false,period:'afternoon'},w:1,t:['Afternoon. Ridgeline Timber Co. Desk is open till six—can I help you?']},
   {t:['Ridgeline Timber Co. Can I help you?']}
  ],replies:[
   {label:'I am looking for work.',if:{hired:false},go:'walt.offer'},
   {label:'Am I due a promotion?',if:{hired:'ridgeline'},go:'walt.promote'},
   {label:'Anything waiting for me?',if:{hired:'ridgeline'},act:'walt.collect'},
   {label:'How does a shift work?',go:'walt.shift'},
   {label:'How is the mill running?',if:{met:true,hired:false},go:'walt.mill'},
   {label:'What safety rules apply?',if:{hired:'ridgeline'},go:'walt.safety'}
  ]},

  {id:'walt.open',entry:true,do:[{meet:true}],say:[
   {if:{hired:'ridgeline',rankMin:2,period:['evening','night']},w:4,t:['Off the clock now. Office shut at six.','New rank suits you. Doors open at six sharp.']},
   {if:{hired:'ridgeline',weather:'rain'},w:4,t:['Wet shift today, eh? Hang that vest up to dry when you clock off.','Eastbank office is open six to six if you need anything.']},
   {if:{hired:'ridgeline',tierMin:'close'},w:3,t:['Good seeing you off the yard. You are holding Ridgeline together lately.']},
   {if:{hired:'ridgeline'},w:2,t:['Good to see you out here. Keep your axe sharp and stay inside marked blocks.','Catch me at the Eastbank office between six and six.']},
   {if:{period:['evening','night']},w:2,t:['Office is shut. Come to Eastbank between six AM and six PM if you want crew work.']},
   {if:{beat:'walt.note'},w:2,t:['Hal put in a good word for you. Eastbank office is open whenever you want a shift.']},
   {if:{hired:false,period:['morning','afternoon']},w:1,t:['Walt Hargrove. Ridgeline always needs steady hands.','Come by the Eastbank office and ask about a shift.']},
   {t:['Walt Hargrove, Ridgeline Timber Co. Visit Eastbank between six AM and six PM for work.']}
  ],replies:[
   {label:'How does a shift work?',go:'walt.shift'},
   {label:'What safety rules apply?',go:'walt.safety'},
   {label:'How is the mill running?',go:'walt.mill'}
  ]},

  {id:'walt.offer',say:[
   {if:{beat:'walt.note'},t:['Hal says you handle timber carefully. Everyone starts at the bottom here: an axe, $8.00 an hour, and piece pay per log.','Shifts run 6 AM to 6 PM—daylight hours only.']},
   {t:['Everyone starts at the bottom here. You get an axe, $8.00 an hour on our land, and piece pay per log.','Shifts run 6 AM to 6 PM, strictly daylight work.']}
  ],replies:[
   {label:'I will take it.',act:'walt.hire',go:'walt.hired-confirm'},
   {label:'Let me think about it.',go:'walt.think'}
  ]},

  {id:'walt.think',say:[
   {t:['Suit yourself. Office counter is open six AM to six PM whenever you want boots in the woods.']}
  ],end:true},

  {id:'walt.hired-confirm',say:[
   {t:['Welcome to the crew. Start with the marked pines in Pine Ridge.','Clock in on your phone or at the wall clock.']}
  ],replies:[
   {label:'Tell me the safety rules.',go:'walt.safety'},
   {label:'How is the mill running?',go:'walt.mill'}
  ]},

  {id:'walt.promote',say:[
   {if:{rankMin:6},t:['Foreman is as high as I can put you. The chainsaw shelf in the back corner is open now.']},
   {if:{rankMin:2},t:['Promotions go by the sheet: your level, shifts worked and reputation. Nothing else.','Want me to check it now?']},
   {t:['Feller needs level 3, three shifts worked and a reputation of 20.','Not yet met all three? Then come back. Want me to check the sheet?']}
  ],replies:[
   {label:'Check and promote me.',act:'walt.promote'},
   {label:'How does a shift work?',go:'walt.shift'},
   {label:'Back to work then.',go:'walt.wrap'}
  ]},

  {id:'walt.shift',say:[
   {if:{hired:'ridgeline'},t:['Clocked-in minutes on Ridgeline land or in a company truck earn your hourly wage.','Clear every task on the notice board for your rank bonus.']},
   {t:['Clock in between 6 AM and 5:30 PM at the wall clock or on your phone. Office shuts at six.','Marked pines pay $3.00 each; unmarked pay seventy-five cents.']}
  ],replies:[
   {label:'How does the sawmill pay?',go:'walt.chain'},
   {label:'What safety rules apply?',go:'walt.safety'},
   {label:'Understood, Walt.',go:'walt.wrap'}
  ]},

  {id:'walt.chain',say:[
   {t:['One felled log feeds the saw for four planks: $1.20 at the bench, twenty-five cents off the belt, $7.30 delivered.','Full 40-plank cells pay a five-dollar bonus.']}
  ],replies:[
   {label:'What safety rules apply?',go:'walt.safety'},
   {label:'How is the mill running?',go:'walt.mill'},
   {label:'Got it.',go:'walt.wrap'}
  ]},

  {id:'walt.safety',say:[
   {if:{rankMin:4},t:['Watch the forklift tail swing—never drive through shut warehouse rollers.','At Hauler and level 5, the $350 Chainsaw opens in our company store.']},
   {t:['Stand clear when a pine starts to go, and never reach past the blade.','Red beacon means the belt is full. Clear planks before feeding another log.']}
  ],replies:[
   {label:'How is the mill running?',go:'walt.mill'},
   {label:'I will keep clear.',go:'walt.wrap'}
  ]},

  {id:'walt.mill',do:[{topic:'haul'}],say:[
   {if:{mood:['miserable','low']},t:['Mill runs dry without logs coming over the bridge. Six trickle planks a day will not build Eastbank.','Buyers want steady pallets.']},
   {t:['Sawmill sits up north in Pine Ridge; only six trickle planks appear free a day—the rest needs fed logs.','At Yard hand rank four, the warehouse order table opens up.']}
  ],replies:[
   {label:'Back to the yard.',go:'walt.wrap'}
  ]},

  {id:'walt.wrap',say:[
   {if:{hired:'ridgeline'},t:['Stay sharp on the bridge. Last clock-in is half past five.']},
   {t:['Office shuts at six sharp. Mind the bridge on the way back.']}
  ],end:true}
 ]
});

// ── 4. Elena (Alder Coffee manager, Oak Street Apartments Flat 7) ────────────────────────────────────────────────────────
export const ELENA=freezeDeep({
 id:'elena',
 name:'Elena',
 personId:'oak-apartments/7#1',
 voice:'Brisk, warm, organised Alder Coffee manager who takes pride in her espresso and keeps one eye on the tables.',
 facts:{cafe:'Alder Coffee & Diner',hours:'8 AM to 6 PM',wage:'$8 an hour plus tips'},
 bye:[
  {if:{weather:'rain'},t:'Mind the puddles outside—and come back for a hot cup anytime!'},
  {if:{cafe:'onShift'},t:'Tables are waiting—keep those orders moving!'},
  {if:{tierMin:'close'},t:'See you soon! Kettle is always on for you.'},
  {t:'Stop by for an espresso sometime.'}
 ],
 nodes:[
  {id:'elena.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{period:'night'},w:3,t:['Quiet down here after closing! Flat seven smells of roasted beans, sorry.','Cafe opens again at eight.']},
   {if:{cafe:'employed'},w:3,t:['Fancy bumping into my waiter! Do not forget—shifts start at eight.']},
   {if:{hired:'ridgeline'},w:2,t:['Hard day in that Ridgeline vest?','Drop by the diner tomorrow if you want hot coffee.']},
   {if:{tierMin:'friend'},w:2,t:['Oh, hi! Always nice seeing a friendly face in the hall.','Need anything, or just saying hello?']},
   {t:['Oh, hello! I am Elena, Flat seven—and manager at Alder Coffee.','Pop over between eight and six for coffee or work.']}
  ],replies:[
   {label:'How are shifts at the cafe?',go:'elena.work'},
   {label:'Tell me about the regulars.',go:'elena.regulars'},
   {label:'Need stock hauled to the cafe?',go:'elena.stock'}
  ]},

  {id:'elena.cafe',entry:true,when:{place:['cafe','counter']},do:[{meet:true}],say:[
   {if:{met:false},w:6,t:['Welcome to Alder Coffee! I am Elena—I run the counter and the machine.','Pull up a seat for a hot meal, or ask about shifts behind the bar.']},
   {if:{gig:'need-restock',gigClient:'elena'},w:7,t:['Are you carrying milk or egg crates for my counter? Drop them in and we will square up.']},
   {if:{story:[2,2],storyDone:false},w:6,t:['Noah tell you to fuel up before walking out to Willow Farm?','Our six-dollar sandwich and coffee will set you straight for the hike.']},
   {if:{cafe:'onShift'},w:5,t:['Good timing! Tables are filling up and I have one eye on the clock.','Your tickets are on the left, or clock out when you are done.']},
   {if:{recent:'cafe-shift',cafe:'employed'},w:4,t:['Sharp shift earlier! Tables looked great and the tips were generous.']},
   {if:{hired:'ridgeline',weather:'rain'},w:4,t:['Came in out of the rain in that Ridgeline vest?','Let me pour you something warm.']},
   {if:{hired:'ridgeline'},w:3,t:['Saw that Ridgeline vest from the window!','Rough shift in the woods, or stopping for a bite?']},
   {if:{weather:'rain'},w:3,t:['Nothing beats hot espresso when it pours on Oak Street.','Shake your coat off and take a seat!']},
   {if:{weather:'snow'},w:3,t:['Snowy out there! Best day of the year for hot coffee.','What can I get started for you?']},
   {if:{weather:'fog'},w:3,t:['Fog rolled right up to the glass today.','Warm cup will clear your head.']},
   {if:{cafe:'employed',period:'morning'},w:3,t:['Morning! Machine is hot and clock-ins run eight until five.','Ready to step behind the counter?']},
   {if:{cafe:'employed'},w:2,t:['Good to see you back at the counter. Plenty of steady faces today.','Clocking in, or stopping for food?']},
   {if:{tierMin:'close'},w:3,t:['Hey, my favourite customer! Fresh pot just finished.','What can I get you?']},
   {if:{tierMin:'friend'},w:2,t:['Good to see you, friend! Pull up a stool.','Coffee, work, or just catching up?']},
   {if:{mood:['miserable','low']},w:1,t:['Rush nearly had me behind, though the roast is still spot-on.','What can I brew for you?']},
   {t:['Hi there! Fresh roast is on and the counter is clear.','What can I help you with?']}
  ],replies:[
   {label:'Let us talk cafe work.',go:'elena.work'},
   {label:'Got your produce delivery.',if:{beat:'is.carryingCafe'},go:'elena.delivery'},
   {label:'I would like to eat and drink.',go:'elena.meal'},
   {label:'How are supplies holding up?',if:{beat:'is.carryingCafe',tierMax:'stranger'},go:'elena.stock'},
   {label:'How are the regulars today?',if:{met:true,notBeat:'is.carryingCafe'},go:'elena.regulars'}
  ]},

  {id:'elena.open',entry:true,do:[{meet:true}],say:[
   {if:{cafe:'employed',hour:[5,8]},w:4,t:['Morning! See you at the counter at eight sharp—first tables fill fast.']},
   {if:{cafe:'employed'},w:3,t:['Good catching you outside! Last clock-in is five PM, eight dollars an hour plus tips.']},
   {if:{period:['evening','night']},w:3,t:['Just locked the glass doors after six. Nothing beats fresh air after steaming milk all day!']},
   {if:{weather:'rain'},w:3,t:['Caught in the rain too? Makes me miss the warm espresso machine.']},
   {if:{hired:'ridgeline'},w:3,t:['Look at that Ridgeline vest! Taking a break from hauling logs?']},
   {if:{tierMin:'friend'},w:2,t:['Hey, friend! Walking Oak Street or headed to the cafe?']},
   {if:{met:false},w:2,t:['Hi! I am Elena, I run Alder Coffee a few doors down from 18 Oak Street.','Drop in between eight and six sometime.']},
   {t:['Hello there! Walking past Alder Coffee today?']}
  ],replies:[
   {label:'Are you hiring at the cafe?',go:'elena.work'},
   {label:'What do you serve for $6?',go:'elena.meal'},
   {label:'Tell me about the regulars.',go:'elena.regulars'}
  ]},

  {id:'elena.work',say:[
   {if:{cafe:'onShift'},t:['Tables first: take the order, grab it at the pass, serve it and clear the table.','Clock out here or on your phone when you finish, and I will pay your wage and tips.']},
   {if:{cafe:'employed'},t:['Clock in from 8 AM to 5 PM. Take orders, serve tables and clear them for your wage and tips.']},
   {t:['I need waiters to take orders, run plates and keep tables clear.','Eight dollars an hour plus tips, and a bonus when you finish your tasks. Do well and you move up to the bar and kitchen.']}
  ],replies:[
   {label:'I would like the job.',if:{cafe:'none',place:['cafe','counter']},act:'cafe.hire',go:'elena.hired'},
   {label:'Clock me in for my shift.',if:{cafe:'employed',place:['cafe','counter']},act:'cafe.clockin'},
   {label:'Clock me out and pay me.',if:{cafe:'onShift',place:['cafe','counter']},act:'cafe.clockout'},
   {label:'Am I due a promotion?',if:{cafe:'employed',place:['cafe','counter']},act:'cafe.promote'},
   {label:'How does a shift work?',if:{cafe:['none','employed']},go:'elena.feedback'},
   {label:'Maybe another time.',if:{cafe:'none'},go:'elena.wrap'}
  ]},

  {id:'elena.hired',say:[
   {t:['Wonderful—welcome aboard! Talk to me here between eight and five to clock in.']}
  ],replies:[
   {label:'Clock me in right now.',if:{place:['cafe','counter']},act:'cafe.clockin'},
   {label:'How does a shift work?',go:'elena.feedback'},
   {label:'See you behind the bar.',go:'elena.wrap'}
  ]},

  {id:'elena.feedback',say:[
   {if:{cafe:'employed'},t:['Up to four tables. Take the order, grab it at the pass, serve it and clear up after.','Quick service earns the best tips; slow plates cost you tips and reputation.']},
   {t:['Two to four tables at a time: take the order, grab it at the pass, serve and clear.','Wages are hourly, tips on top, plus a bonus when you clear the day’s tasks.']}
  ],replies:[
   {label:'Tell me about the $6 meal.',go:'elena.meal'},
   {label:'How are supplies holding up?',go:'elena.stock'},
   {label:'Got it, thanks.',go:'elena.wrap'}
  ]},

  {id:'elena.delivery',say:[
   {t:['Perfect—our fresh produce order from Noah? Set it right here at the counter!']}
  ],replies:[
   {label:'Hand over produce ($14.00).',if:{place:['cafe','counter']},act:'job.deliver'},
   {label:'Hang on, I misplaced it.',go:'elena.wrap'}
  ]},

  {id:'elena.meal',say:[
   {if:{period:['morning','afternoon']},t:['Lunch is a fresh sandwich and hot coffee for $6. Best fuel on Oak Street!']},
   {t:['A fresh sandwich and coffee is $6 flat—fills you up and wakes you right up.','Want one?']}
  ],replies:[
   {label:'Yes, please · $6.',if:{place:['cafe','counter']},act:'cafe.meal'},
   {label:'How are cafe supplies?',go:'elena.stock'},
   {label:'Maybe another time.',go:'elena.wrap'}
  ]},

  {id:'elena.stock',do:[{topic:'restock'}],say:[
   {if:{gig:'need-restock',gigClient:'elena'},t:['Bringing my crates? Pull up out front—our milk and eggs shelf needs it badly.']},
   {t:['Ironwood Bakery sends three fresh loaves a day; farm eggs and milk go straight in our cooler.','Watch the Gigs app whenever our cafe shelf runs thin!']}
  ],replies:[
   {label:'Tell me about the regulars.',go:'elena.regulars'},
   {label:'I will watch the gig board.',go:'elena.wrap'}
  ]},

  {id:'elena.regulars',say:[
   {if:{notBeat:'elena.sophie-latte'},t:['Naomi works the bar with me most days—she keeps the grinder running smooth.','And Sophie from Flat two lives on my lattes whenever she catches her breath!'],do:[{beat:'elena.sophie-latte'},{mood:2}]},
   {t:['Naomi sets the grinder up like clockwork every shift, and Sophie pops in whenever she can.']}
  ],replies:[
   {label:'Catch you later, Elena.',go:'elena.wrap'}
  ]},

  {id:'elena.wrap',say:[
   {if:{cafe:'employed'},t:['See you behind the bar.']},
   {t:['Eight to six, every day. The door chime always tells me you are here.']}
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
  {if:{weather:'rain'},t:'Don’t forget a hood in this rain! See you soon.'},
  {if:{tierMin:'close'},t:'Always love our chats. Knock anytime!'},
  {if:{tierMin:'friend'},t:'Thanks for making Oak Street feel friendlier!'},
  {t:'Sorry to dash! Catch you on the stairs later.'}
 ],
 nodes:[
  {id:'sophie.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{story:[2,10],notBeat:['sophie.thanked','is.skipped']},w:6,t:['Oh, you carried Noah’s bag over! I was just coming down to thank you.','Flat two is always chaotic with parcels, sorry!'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{beat:'sophie.groceries-delivered',notBeat:['sophie.thanked','is.skipped']},w:6,t:['Hi from upstairs! Thank you again for hauling those heavy tins over earlier.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{period:'night'},w:4,t:['Keeping my voice down on the intercom—half the building is asleep!','Fancy a quick word?']},
   {if:{story:[0,1],storyDone:false},w:4,t:['Oh, sorry—thought you were my Corner Market delivery!','Noah promised someone might bring my bag over soon.']},
   {if:{hired:'ridgeline',tierMin:'friend'},w:3,t:['Look at you in that Ridgeline vest! Hard day out in Pine Ridge?']},
   {if:{tierMin:'close'},w:3,t:['Hey! Come up—well, talk right here a second. How have you been?']},
   {t:['Oh, hi! Excuse the empty crates by my mat—I am Sophie, Flat two.','What brings you to my buzzer?']}
  ],replies:[
   {label:'About your grocery order.',go:'sophie.groceries'},
   {label:'Who lives at 18 Oak Street?',go:'sophie.neighbours'},
   {label:'Got any errands posted?',go:'sophie.errands'},
   {label:'How is Alder Coffee?',if:{tierMin:'acquaintance'},go:'sophie.coffee'},
   {label:'Tell me about Studio 2B.',if:{notBeat:'is.rented',tierMax:'stranger'},go:'sophie.studio'}
  ]},

  {id:'sophie.open',entry:true,do:[{meet:true}],say:[
   {if:{recent:'delivered:sophie',notBeat:'sophie.thanked'},w:7,t:['You just dropped my groceries at the awning—thank you! Noah packs apples like bricks.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{story:[2,10],notBeat:['sophie.thanked','is.skipped']},w:6,t:['Hey! You are Noah’s runner who dropped my groceries at 18 Oak Street! Thank you!','Saved me two trips with sore arms.'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{beat:'sophie.groceries-delivered',notBeat:['sophie.thanked','is.skipped']},w:6,t:['Hey! Almost missed you—thanks again for my Corner Market groceries!'],do:[{beat:'sophie.thanked'},{standing:1},{mood:2}]},
   {if:{story:[0,1],storyDone:false,met:false},w:5,t:['Oh, hello! Sorry to rush—waiting on a Corner Market bag.','I am Sophie, Flat two at 18 Oak Street.']},
   {if:{weather:'rain'},w:4,t:['Of course it rains the minute I step out without a hood!','How are you holding up?']},
   {if:{weather:'snow'},w:4,t:['Snow on Oak Street! Makes me want to stay inside with a hot mug.']},
   {if:{weather:'fog'},w:4,t:['Can barely see the diner sign in this fog!','Careful crossing the street.']},
   {if:{hired:'ridgeline'},w:3,t:['Loving the Ridgeline vest! Looks like you are keeping busy out east.']},
   {if:{tierMin:'close'},w:3,t:['Hey, my favourite neighbour! Got two minutes to catch up?']},
   {if:{tierMin:'friend'},w:2,t:['Hey, friend! Always brightens my walk running into you.']},
   {if:{period:'morning'},w:1,t:['Morning! Trying to catch Elena’s coffee counter before my list piles up.']},
   {if:{period:'afternoon',mood:['miserable','low']},w:2,t:['Slow afternoon and my list still reaches my elbow. Lovely seeing a friendly face though!']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Walking Oak Street before the market gets busy.']},
   {if:{period:'evening'},w:1,t:['Evening! Best part of Oak Street once traffic thins out. Grabbing bread before ten.']},
   {if:{period:'night'},w:1,t:['Late one, isn’t it? Quiet out here once the shops shut.']},
   {t:['Hey! Always rushing somewhere, though never too busy for a quick word.']}
  ],replies:[
   {label:'About those market groceries.',go:'sophie.groceries'},
   {label:'Who lives in 18 Oak Street?',go:'sophie.neighbours'},
   {label:'Need a hand with errands?',go:'sophie.errands'},
   {label:'How is Alder Coffee?',if:{tierMin:'acquaintance'},go:'sophie.coffee'},
   {label:'Know about Studio 2B?',if:{notBeat:'is.rented',tierMax:'stranger'},go:'sophie.studio'}
  ]},

  {id:'sophie.groceries',say:[
   {if:{story:[0,1],storyDone:false},t:['I placed an order with Noah at Corner Market—just one heavy bag to bring to the awning.']},
   {if:{story:[2,3],storyDone:false},t:['Noah said he is sending you out to Hal Brennan’s farm next.','Wear good boots—the bridge walk to Willow Farm is a fair hike!'],do:[{beat:'sophie.thanked'}]},
   {if:{beat:'is.skipped'},t:['Noah sends my orders over now and then. Bigger runs go up on the Gigs board.']},
   {t:['Everything from the market arrived unbruised, even the eggs! You are much steadier than the old carrier.'],do:[{beat:'sophie.thanked'}]}
  ],replies:[
   {label:'Who lives in 18 Oak Street?',go:'sophie.neighbours'},
   {label:'Need a hand with errands?',go:'sophie.errands'},
   {label:'Glad it made it safely.',go:'sophie.wrap'}
  ]},

  {id:'sophie.neighbours',say:[
   {t:['Elena keeps Flat seven, Noah is in eight, and Oscar is in Flat nine!','Wait until you try getting Oscar to open his door.']}
  ],replies:[
   {label:'What is the secret with Oscar?',go:'sophie.oscar'},
   {label:'Who is in Flats ten and eleven?',go:'sophie.upstairs'}
  ]},

  {id:'sophie.oscar',say:[
   {if:{notBeat:'sophie.oscar-hint'},t:['Oscar only answers between ten AM and noon, and he hates anyone ringing twice!','Knock politely once a day for a few days and he actually thaws.'],do:[{beat:'sophie.oscar-hint'},{standing:1}]},
   {t:['Just one buzz between ten AM and noon—Oscar notices who respects his quiet.']}
  ],replies:[
   {label:'Who is in Flats ten and eleven?',go:'sophie.upstairs'},
   {label:'How do errands work?',go:'sophie.errands'},
   {label:'Good tip, thanks.',go:'sophie.wrap'}
  ]},

  {id:'sophie.upstairs',say:[
   {t:['Lincoln Brambly in ten works market evenings and talks deer tracks non-stop.','And Brentster in eleven runs Ironwood Store—ask him about his grey cat Junior.']}
  ],replies:[
   {label:'Got any errands posted?',go:'sophie.errands'},
   {label:'How is Alder Coffee?',go:'sophie.coffee'},
   {label:'Sounds like a lively building.',go:'sophie.wrap'}
  ]},

  {id:'sophie.errands',do:[{topic:'errand'}],say:[
   {if:{gig:'need-errand',gigClient:'sophie'},t:['Did you pick up my phone errand already? Check the Gigs app marker, I will pay right!']},
   {if:{mood:['miserable','low']},t:['Could use two pairs of hands today. Watch the phone board—when things pile up I post errands.']},
   {t:['Whenever I fall behind on post or groceries, I post small runs on the town Gigs board.','Better money than standing idle, plus Noah likes the foot traffic.']}
  ],replies:[
   {label:'How is Alder Coffee?',go:'sophie.coffee'},
   {label:'Know about Studio 2B?',go:'sophie.studio'},
   {label:'I will check the Gigs board.',go:'sophie.wrap'}
  ]},

  {id:'sophie.coffee',say:[
   {if:{tierMin:'friend',notBeat:'sophie.coffee-invite'},t:['Truthfully, I live on Elena’s lattes—come grab a cup at Alder Coffee sometime.'],do:[{beat:'sophie.coffee-invite'},{mood:2}]},
   {if:{tierMin:'friend'},t:['Alder Coffee is still my favourite spot between errands.']},
   {t:['Elena runs Alder Coffee just down the street, open eight until six.','Six dollars gets a fresh sandwich and coffee—lifesaver when your energy drops!']}
  ],replies:[
   {label:'Tell me about Studio 2B.',go:'sophie.studio'},
   {label:'Catch you there soon.',go:'sophie.wrap'}
  ]},

  {id:'sophie.studio',say:[
   {if:{beat:'is.rented'},t:['How is the studio treating you? The radiator knocks, but you get used to it.']},
   {t:['Studio 2B beside us is ninety dollars to move in—thirty deposit, sixty first week, plus seven utilities.','Comes with a car bay out front if Hal lets you keep his truck!']}
  ],replies:[
   {label:'Thanks for the tip, Sophie.',go:'sophie.wrap'}
  ]},

  {id:'sophie.wrap',say:[
   {if:{tierMin:'friend'},t:['Off I go! Buzz Flat two anytime, you know that.']},
   {t:['Better run—buzz Flat two anytime if you have five minutes!']}
  ],end:true}
 ]
});

export const EARLY_CAST=Object.freeze([NOAH,HAL,WALT,ELENA,SOPHIE]);
