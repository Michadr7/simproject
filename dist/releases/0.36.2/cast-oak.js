// Oak Street & Cedar Loop cast (Oscar, Lincoln, Brentster, Grace); notes/conversation-design.md stage C8.
const freezeDeep=o=>{if(!o||typeof o!=='object')return o;Object.freeze(o);for(const v of Object.values(o))freezeDeep(v);return o};

// ── 1. Oscar Masic (Oak Street Apartments Flat 9, retired recluse) ───────────────────────────────────────────────────────
export const OSCAR=freezeDeep({
 id:'oscar',
 name:'Oscar Masic',
 personId:'oak-apartments/9#1',
 voice:'Blunt, private, handy retired recluse who speaks in short sentences and warms up slowly to quiet help.',
 facts:{flat:'Flat 9',building:'18 Oak Street',truck:'old black work truck'},
 bye:[
  {if:{weather:'rain'},t:'Stay dry. Watch the steps.'},
  {if:{weather:'snow'},t:'Mind the ice outside.'},
  {if:{tierMin:'close'},t:'Take care, kid. Door is open ten to noon.'},
  {if:{tierMin:'friend'},t:'Alright. See you round.'},
  {if:{mood:['miserable','low']},t:'Shut the door behind you.'},
  {t:'Off you go then.'}
 ],
 nodes:[
  {id:'oscar.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{met:false,hour:[10,12]},w:6,t:['I do not know you.','State your business or move along.']},
   {if:{met:false},w:6,t:['Ten to noon. Not now.']},
   {if:{gig:'need-repair',gigClient:'oscar',hour:[10,12]},w:6,t:['You about the truck?','Tools are by the wheel. Do not lose my wrench.']},
   {if:{gig:'need-tow',gigClient:'oscar',hour:[10,12]},w:6,t:['Black truck stalled out on the ridge road.','Need a tow, not a lecture.']},
   {if:{hour:[12,24],tierMin:'friend'},w:5,t:['Not between ten and noon, kid.','Come back tomorrow morning if it is urgent.']},
   {if:{hour:[0,10],tierMin:'friend'},w:5,t:['Too early. Ten to noon, you know the rule.']},
   {if:{hour:[12,24]},w:5,t:['Door stays shut after noon.','Come back tomorrow between ten and noon.']},
   {if:{hour:[0,10]},w:5,t:['Too early. Ten to noon.']},
   {if:{hired:'ridgeline',tierMin:'friend'},w:4,t:['Ridgeline vest. Good.','At least you work for a living.']},
   {if:{hired:'ridgeline'},w:4,t:['Saw that Ridgeline vest on the stairs.','Keep your gloves on out there.']},
   {if:{weather:'rain'},w:4,t:['Wet out. Wipe your boots before you stand on my mat.']},
   {if:{weather:'storm'},w:4,t:['Rough storm. Roof still holds, mostly.','Do not linger on the landing.']},
   {if:{weather:'snow'},w:4,t:['Cold enough to freeze the pipes.','Keep it brief.']},
   {if:{weather:'fog'},w:3,t:['Thick fog on Oak Street.','Drive slow if you have wheels.']},
   {if:{tierMin:'close'},w:3,t:['Kid. Good. Come to the porch a minute.','I put the kettle on, though do not make a habit of it.']},
   {if:{tierMin:'friend'},w:2,t:['Oh. It is you.','You do not shout, which puts you ahead of most.']},
   {if:{mood:['miserable','low']},w:2,t:['Bad knee, bad day. Make it quick.']},
   {if:{period:'morning'},w:1,t:['You caught me between ten and noon.','Speak quick.']},
   {t:['Hm. You again. Keep it short.']}
  ],replies:[
   {label:'Just checking in on you.',go:'oscar.check'},
   {label:'How is the old black truck?',go:'oscar.truck'},
   {label:'Anything I can help with?',go:'oscar.help'},
   {label:'Hear anything on Oak Street?',if:{tierMin:'acquaintance'},go:'oscar.street'}
  ]},

  {id:'oscar.open',entry:true,do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Do I know you?','I do not talk on the street.']},
   {if:{hired:'ridgeline',tierMin:'acquaintance'},w:4,t:['Wearing the Ridgeline vest.','Do not stand around chatting on company time.']},
   {if:{weather:'rain'},w:4,t:['Rain gets into every joint.','Heading back inside.']},
   {if:{weather:'snow'},w:4,t:['Icy pavement. Watch your footing.']},
   {if:{tierMin:'close'},w:3,t:['Rare to catch me outside Flat nine, kid.','Everything holding steady?']},
   {if:{tierMin:'friend'},w:2,t:['Just fetching post. Do not keep me long.']},
   {if:{period:'morning'},w:1,t:['Morning air is decent, at least.']},
   {if:{period:'afternoon'},w:1,t:['Too much noise out here in the afternoon.']},
   {if:{period:['evening','night']},w:1,t:['Heading back in for the night.']},
   {t:['Keep it brief. I have things to mend.']}
  ],replies:[
   {label:'Just checking in on you.',go:'oscar.check'},
   {label:'How is the old black truck?',go:'oscar.truck'},
   {label:'Anything I can help with?',go:'oscar.help'}
  ]},

  {id:'oscar.check',say:[
   {if:{tierMin:'close'},w:3,t:['Better than I let on.','You are all right, kid. Just do not tell anyone I said it.'],do:[{standing:1}]},
   {if:{tierMin:'friend'},w:2,t:['Still upright. Still mending my own things.','Thanks for not talking my ear off.'],do:[{standing:1}]},
   {if:{mood:['miserable','low']},w:2,t:['Creaking joints and a quiet flat.','That is all you need to know.']},
   {t:['I manage fine on my own.','Do not fuss over me.']}
  ],replies:[
   {label:'How is the old black truck?',go:'oscar.truck'},
   {label:'Anything I can help with?',go:'oscar.help'}
  ]},

  {id:'oscar.truck',say:[
   {if:{beat:'oscar.truckFixed',tierMin:'friend'},w:4,t:['Runs clean since you sorted the plugs.','Best old black work truck on Oak Street.']},
   {if:{gig:'need-repair',gigClient:'oscar'},w:4,t:['Alternator belt is frayed and she will not turn over.','Fix it quiet and I will pay fair.']},
   {if:{gig:'need-tow',gigClient:'oscar'},w:4,t:['Stalled past the bend. Need a proper tow back to the kerb.']},
   {if:{tierMin:'friend'},w:3,t:['Old black work truck still starts on the second crank.','Built to last, unlike half the junk on the road.'],do:[{beat:'oscar.truckFixed'}]},
   {t:['The truck is fine.','Do not lean on the bumper.']}
  ],replies:[
   {label:'Anything I can help with?',go:'oscar.help'},
   {label:'What is new on Oak Street?',if:{tierMin:'acquaintance'},go:'oscar.street'}
  ]},

  {id:'oscar.help',say:[
   {if:{gig:['need-errand','need-repair','need-tow'],gigClient:'oscar'},w:4,t:['Posted what I need on the board.','Do a favour quietly and I remember it.']},
   {if:{tierMin:'close'},w:3,t:['Watch the phone board if my knee acts up or the truck stalls.','No need to hover around the door.']},
   {t:['Do not talk my ear off.','If I need groceries or a wrench, I post it on the board.']}
  ],end:true},

  {id:'oscar.street',say:[
   {if:{hired:'ridgeline'},w:3,t:['Sawmill runs steady when Walt has good hands.','Keep your head down and your boots laced.']},
   {if:{tierMin:'friend'},w:2,t:['Sophie in Flat two rushes too much.','Lincoln in ten talks too much. You are the quiet one.']},
   {t:['Oak Street is loud enough without me adding to it.','Market stays open until ten if you need supplies.']}
  ],end:true}
 ]
});

// ── 2. Lincoln Brambly (Oak Street Apartments Flat 10, evening Corner Market clerk & keen hunter) ─────────────────────────
export const LINCOLN=freezeDeep({
 id:'lincoln',
 name:'Lincoln Brambly',
 personId:'oak-apartments/10#1',
 voice:'Enthusiastic, long-winded evening Corner Market clerk who would rather be out in the woods hunting deer.',
 facts:{shop:'Corner Market',flat:'Flat 10',building:'18 Oak Street'},
 bye:[
  {if:{weather:'rain'},t:'Keep dry! Fresh tracks wash out fast in rain like this.'},
  {if:{weather:'snow'},t:'Watch the steps! Snow is great for tracking, terrible for tyres.'},
  {if:{tierMin:'close'},t:'Catch you later, pal! Save a story for me next time.'},
  {if:{tierMin:'friend'},t:'See you round, friend! Keep your eyes on the treeline.'},
  {if:{mood:['miserable','low']},t:'Alright, see you. Guess I will just count tins.'},
  {t:'See you soon! Come back if you want another trail story.'}
 ],
 nodes:[
  {id:'lincoln.counter',entry:true,when:{place:'counter'},do:[{meet:true}],say:[
   {if:{met:false},w:6,t:['Hey! New face at the till—I am Lincoln, Flat ten.','I ring things up here after two-thirty, though my heart is up on the ridge.']},
   {if:{gig:'need-restock',gigClient:'lincoln'},w:6,t:['Glad you stopped by the counter!','I posted a restock run on the board—shelves and gear are running thin.']},
   {if:{hired:'ridgeline',period:'evening'},w:5,t:['Evening! Spot that Ridgeline vest straight away.','Long shift out in the timber? Tell me if you saw any deer by the cut.']},
   {if:{hired:'ridgeline'},w:4,t:['Ridgeline vest! You work the same woods I hike on my days off.','Need food or supplies?']},
   {if:{weather:'rain'},w:4,t:['Rain on the awning makes the shop feel cosy, though it ruins a trail.','What can I ring up for you?']},
   {if:{weather:'storm'},w:4,t:['Wild storm outside!','Even I would not camp in weather like this. Come in and dry off.']},
   {if:{weather:'snow'},w:4,t:['Fresh snow! Best tracking weather of the year, honestly.','Grabbing warm supplies?']},
   {if:{weather:'fog'},w:4,t:['Thick fog out there. Zero visibility past fifty yards.','Market is bright and warm, at least.']},
   {if:{weather:'cloudy',period:'afternoon'},w:3,t:['Overcast afternoon—deer love moving under cloud cover.','Just took over the till from Noah.']},
   {if:{mood:['miserable','low']},w:3,t:['Stuck behind the register while the woods sit empty.','Sorry. What can I get you?']},
   {if:{tierMin:'close',period:'evening'},w:3,t:['My best listener! Evening rush is quiet, so pull up by the counter.','Supplies or a story?']},
   {if:{tierMin:'friend',period:'evening'},w:2,t:['Good evening, friend! Just wiping down the counter before the late crowd.']},
   {if:{period:'evening'},w:1,t:['Evening! Corner Market is open until ten.','Need groceries, or want to talk woods?']},
   {if:{period:'night'},w:1,t:['Last hour before ten o’clock shutters!','Grab what you need and I will ring it through.']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Just clocked onto the late shift at Corner Market.']},
   {t:['Welcome to Corner Market!','I am on the till whenever Noah clocks off.']}
  ],replies:[
   {label:'Tell me a hunting story.',go:'lincoln.hunt'},
   {label:'Let me browse items.',act:'openStore'},
   {label:'Read today’s prices.',act:'shelves'},
   {label:'How is the evening shift?',go:'lincoln.shift'}
  ]},

  {id:'lincoln.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Oh, hey! I am Lincoln from Flat ten.','Do you hunt, or just settling into Oak Street?']},
   {if:{period:'morning'},w:3,t:['Morning! Up early checking my boots and pack before my shift.']},
   {if:{period:'night'},w:3,t:['Just got back from closing the market at ten.','My feet know every tile on that floor.']},
   {if:{weather:'rain'},w:3,t:['Caught me wiping down my gear out of the rain.','Come on, what is up?']},
   {if:{tierMin:'close'},w:3,t:['There you are! Come chat a minute before I head out.']},
   {t:['Hey! Caught me at Flat ten.','Got a minute to talk woods or market?']}
  ],replies:[
   {label:'Tell me a hunting story.',go:'lincoln.hunt'},
   {label:'Where do you hunt?',go:'lincoln.ridge'},
   {label:'Need any gear or ammo?',go:'lincoln.gear'}
  ]},

  {id:'lincoln.open',entry:true,do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Hey! New face on Oak Street!','I am Lincoln—late-shift clerk at Corner Market, keen hunter the rest of the time.']},
   {if:{hired:'ridgeline'},w:4,t:['I see that Ridgeline vest!','Tell me—are the deer still crossing near the upper ridge?']},
   {if:{weather:'rain'},w:4,t:['Wet walk today! Rain softens old tracks right into mud.']},
   {if:{weather:'snow'},w:4,t:['Crisp snow out there. You can read every fox and deer trail in town.']},
   {if:{tierMin:'close'},w:3,t:['My favourite neighbour! I saved a story for you.']},
   {if:{tierMin:'friend'},w:2,t:['Good to see you out here, friend!']},
   {if:{period:'morning'},w:1,t:['Morning! Getting some air before my Corner Market shift starts at two-thirty.']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Heading toward Corner Market to relieve Noah.']},
   {if:{period:['evening','night']},w:1,t:['Late air smells like pine smoke out here.']},
   {t:['Hey! Always good to bump into someone who actually listens.']}
  ],replies:[
   {label:'Tell me a hunting story.',go:'lincoln.hunt'},
   {label:'Where do you hunt?',go:'lincoln.ridge'},
   {label:'Need any gear or ammo?',go:'lincoln.gear'},
   {label:'How is the evening shift?',go:'lincoln.shift'}
  ]},

  {id:'lincoln.hunt',say:[
   {if:{mood:['miserable','low']},w:3,t:['I had a story, honestly, but my head is stuck on stock counts today.','Ask me tomorrow when I am off shift.']},
   {if:{tierMin:'friend'},w:3,t:['Once I sat four hours in the cold for one clean deer shot.','Wind has to come to you, never from you—that is the whole trick.'],do:[{standing:1},{topic:'deer'}]},
   {w:2,t:['Fresh tracks have sharp edges, while old ones go soft in the rain.','Follow a trail slowly and the ridge starts talking to you.'],do:[{standing:1},{topic:'tracking'}]},
   {t:['A dry camp is a happy camp: tarp first, fire second, coffee on the stove at first light.','Hang your food high unless you want a bear visit.'],do:[{standing:1},{topic:'camp'}]}
  ],replies:[
   {label:'Where do you hunt?',go:'lincoln.ridge'},
   {label:'What rifle or scope do you use?',go:'lincoln.rifles'},
   {label:'Need any gear or ammo?',go:'lincoln.gear'}
  ]},

  {id:'lincoln.ridge',say:[
   {if:{hired:'ridgeline'},w:3,t:['Up past the Pine Ridge timber line, well clear of your felling plots.','I give the saws plenty of room.'],do:[{topic:'deer'}]},
   {t:['Up along the quiet edge of Pine Ridge, past the old trail markers.','Good scope, zeroed at a hundred yards, and patience.'],do:[{topic:'tracking'}]}
  ],replies:[
   {label:'What rifle or scope do you use?',go:'lincoln.rifles'},
   {label:'Ever bring a dog along?',go:'lincoln.dogs'},
   {label:'Need any gear or ammo?',go:'lincoln.gear'}
  ]},

  {id:'lincoln.rifles',say:[
   {t:['A good scope matters more than a good rifle—people always forget that.','Mine is old, but I zero it every season and write it down.'],do:[{topic:'rifles'}]}
  ],replies:[
   {label:'Ever bring a dog along?',go:'lincoln.dogs'},
   {label:'What do you do with the meat?',go:'lincoln.meat'}
  ]},

  {id:'lincoln.dogs',say:[
   {t:['A good hunting dog is half the hunt—quiet, patient, nose to the ground.','I had one years back. Best partner I ever had.'],do:[{topic:'dogs'}]}
  ],replies:[
   {label:'What do you do with the meat?',go:'lincoln.meat'},
   {label:'Need any gear or ammo?',go:'lincoln.gear'}
  ]},

  {id:'lincoln.meat',say:[
   {t:['Field dress it fast, keep it cool, hang it a few days.','Noah takes clean venison when I bring some in—real food, not boxes.'],do:[{topic:'game-meat'}]}
  ],end:true},

  {id:'lincoln.gear',say:[
   {if:{gig:'need-restock',gigClient:'lincoln'},w:4,t:['Actually, yes—I posted a restock run on the board.','Running low on ammo and wool socks both.']},
   {t:['Boots first: wet feet end a trip faster than any deer.','Good knife, wool socks, and I am always nearly out of ammo—watch the board if I post a run.'],do:[{topic:'gear'}]}
  ],end:true},

  {id:'lincoln.shift',say:[
   {if:{mood:['miserable','low']},w:3,t:['Noah runs a tidy counter, I just get itchy feet after six.','No hard feelings—I am just built for the woods.']},
   {t:['Two-thirty till ten at Corner Market.','Noah handles the early bread and egg crates; I lock up the shutters at ten.']}
  ],replies:[
   {label:'Tell me a hunting story.',go:'lincoln.hunt'},
   {label:'Need any gear or ammo?',go:'lincoln.gear'}
  ]}
 ]
});

// ── 3. Brentster Lewis (Oak Street Apartments Flat 11, Ironwood Store keeper & Junior's owner) ────────────────────────────
export const BRENTSTER=freezeDeep({
 id:'brentster',
 name:'Brentster Lewis',
 personId:'oak-apartments/11#1',
 voice:'Soft-hearted, distracted Ironwood Store keeper who steers every conversation back to his grey cat, Brentster Jr.',
 facts:{shop:'Ironwood Store',flat:'Flat 11',building:'18 Oak Street',cat:'Brentster Jr.'},
 bye:[
  {if:{weather:'rain'},t:'Keep dry! Junior hates wet paws on the windowsill.'},
  {if:{weather:'snow'},t:'Watch the ice! Junior will not set one paw outside in snow.'},
  {if:{tierMin:'close'},t:'See you soon! Tell nobody, but Junior likes you best.'},
  {if:{tierMin:'friend'},t:'Take care, friend! I will tell Junior you asked after him.'},
  {if:{mood:['miserable','low']},t:'Sorry to rush—better go check on Junior.'},
  {t:'See you! Give a wave if you spot a grey cat in the window.'}
 ],
 nodes:[
  {id:'brentster.counter',entry:true,when:{place:'counter'},do:[{meet:true}],say:[
   {if:{met:false},w:6,t:['Oh, hello! Welcome into Ironwood Store—I am Brentster.','Sorry if I look distracted; my cat Junior knocked my keys behind the counter.']},
   {if:{gig:'need-tend',gigClient:'brentster'},w:6,t:['Oh, thank goodness! I posted a job to check on Junior.','He has been sulking by the radiator all day.']},
   {if:{gig:'need-restock',gigClient:'brentster'},w:6,t:['Running low on Junior’s salmon tins!','I put a restock note on the board if you have a spare minute.']},
   {if:{hired:'ridgeline'},w:4,t:['I like that Ridgeline vest—bright enough that Junior would spot you from Flat eleven!','Busy shift at the mill?']},
   {if:{weather:'rain'},w:4,t:['Rain keeps folks indoors, though Junior just glares at the glass.','Good to see a friendly face in the shop.']},
   {if:{weather:'storm'},w:4,t:['Storm rattled the Ironwood sign!','Junior hid under the sofa cushion the whole time.']},
   {if:{weather:'snow'},w:4,t:['Snow on Oak Street!','I brought an extra blanket for Junior’s basket behind the till.']},
   {if:{weather:'fog'},w:3,t:['Fogged right in outside.','Do not worry, Junior stays indoors on days like this.']},
   {if:{mood:['miserable','low']},w:3,t:['Sorry, Junior has been off his food and I cannot focus on stock.','Need anything from the shelves?']},
   {if:{tierMin:'close'},w:3,t:['There you are! Junior actually perked his ears up when I said your name.','How is your day going?']},
   {if:{tierMin:'friend'},w:2,t:['Good to see you, friend!','Shop is steady, and Junior only tipped one pencil cup over.']},
   {if:{period:'morning'},w:1,t:['Morning! Just swept the Ironwood doorway and opened up.']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Quiet hour in the store—perfect time to talk cat stories.']},
   {if:{period:['evening','night']},w:1,t:['Just tallying the Ironwood till before heading back to Flat eleven.']},
   {t:['Hello! Welcome to Ironwood Store.','Excuse the cat hair on my sleeve.']}
  ],replies:[
   {label:'How is Brentster Jr.?',go:'brentster.junior'},
   {label:'What does Junior eat?',go:'brentster.food'},
   {label:'Has Junior seen the vet?',go:'brentster.vet'},
   {label:'How is Ironwood Store?',go:'brentster.store'}
  ]},

  {id:'brentster.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Hi! Sorry—have you seen a grey cat? No, wait, he is behind me.','I am Brentster, Flat eleven.']},
   {if:{gig:'need-tend',gigClient:'brentster'},w:5,t:['Oh, you came by Flat eleven!','Junior needs company while I sort the store ledger—check the job board if you can help.']},
   {if:{tierMin:'close'},w:4,t:['You are family now. Junior approves, and he approves of nobody!','Come chat on the landing a second.']},
   {if:{weather:'rain'},w:3,t:['Careful of the wet stairs!','Junior tried to catch raindrops through the screen and got grumpy.']},
   {if:{period:'morning'},w:2,t:['Morning! Just feeding Junior before I walk over to Ironwood Store.']},
   {if:{period:'night'},w:2,t:['Junior is curled up on the sofa at last.','Did you need something at Flat eleven?']},
   {t:['Hey! Junior is right inside on the cushions.','How are you doing?']}
  ],replies:[
   {label:'How is Brentster Jr.?',go:'brentster.junior'},
   {label:'What does Junior eat?',go:'brentster.food'},
   {label:'Has Junior seen the vet?',go:'brentster.vet'},
   {label:'Any work or errands?',go:'brentster.store'}
  ]},

  {id:'brentster.open',entry:true,do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Oh, hello! Have you seen a grey cat—oh, never mind, he is asleep at home.','I am Brentster. I keep Ironwood Store.']},
   {if:{hired:'ridgeline'},w:4,t:['Sharp Ridgeline vest!','I swear Junior recognises the orange stripe from the window.']},
   {if:{weather:'rain'},w:4,t:['Damp walk today. Junior refuses to leave the radiator when it rains.']},
   {if:{weather:'snow'},w:4,t:['Chilly in this snow!','I should buy Junior a little wool mat.']},
   {if:{tierMin:'close'},w:3,t:['There you are! I trust you with anything, even Junior.']},
   {if:{tierMin:'friend'},w:2,t:['Hey, friend! Junior was staring down Oak Street like he expected you.']},
   {if:{period:'morning'},w:1,t:['Morning! Walking over to open Ironwood Store.']},
   {if:{period:'afternoon'},w:1,t:['Afternoon! Stepping out for two minutes of fresh air.']},
   {if:{period:['evening','night']},w:1,t:['Heading back to Flat eleven to feed Junior his salmon tin.']},
   {t:['Hi! Always nice to stop and chat for a minute.']}
  ],replies:[
   {label:'How is Brentster Jr.?',go:'brentster.junior'},
   {label:'What does Junior eat?',go:'brentster.food'},
   {label:'Has Junior seen the vet?',go:'brentster.vet'},
   {label:'How is Ironwood Store?',go:'brentster.store'}
  ]},

  {id:'brentster.junior',say:[
   {if:{beat:'junior.vet'},w:3,t:['Junior? Grey, grumpy, loves cardboard boxes, and still pretending he was never at the vet.'],do:[{standing:1},{topic:'cat'}]},
   {if:{mood:['miserable','low']},w:3,t:['He has been hiding under the bed all day and it has me worried sick.'],do:[{topic:'cat'}]},
   {t:['Junior is the best cat in the world—grey, grumpy, and obsessed with empty boxes.','Speaking of which, you should see how he sits in my boot box.'],do:[{standing:1},{topic:'cat'},{beat:'junior.met'}]}
  ],replies:[
   {label:'What does Junior eat?',go:'brentster.food'},
   {label:'Has Junior seen the vet?',go:'brentster.vet'}
  ]},

  {id:'brentster.food',say:[
   {if:{gig:'need-restock',gigClient:'brentster'},w:3,t:['Only the salmon tins—and we are nearly out!','Check the board if you can run a restock for me.'],do:[{topic:'cat-food'}]},
   {t:['He only eats the salmon tins.','Forty minutes after a tin is opened, he turns his nose up and sulks.'],do:[{standing:1},{topic:'cat-food'}]}
  ],replies:[
   {label:'Has Junior seen the vet?',go:'brentster.vet'},
   {label:'How is Ironwood Store?',go:'brentster.store'}
  ]},

  {id:'brentster.vet',say:[
   {if:{gig:'need-errand',gigClient:'brentster'},w:3,t:['I posted a vet errand on the board—he needs his checkup and I cannot leave the shop.'],do:[{topic:'vet'}]},
   {t:['The vet says he is completely fine, just dramatic.','I do not entirely believe her, though Junior did eat two treats on the way out.'],do:[{standing:1},{topic:'vet'},{beat:'junior.vet'}]}
  ],end:true},

  {id:'brentster.store',say:[
   {if:{tierMin:'friend'},w:2,t:['Ironwood Store ticks along nicely, even with Junior napping on the ledger.','If I ever need cat food, vet runs or someone to look in on him, I post on the board.']},
   {t:['Ironwood Store keeps me busy most of the day.','Anyway, did I tell you Junior knocked a mug off the table again?']}
  ],end:true}
 ]
});

// ── 4. Grace Whitfield (8 Cedar Loop, resident & gardener) ────────────────────────────────────────────────────────────────
export const GRACE=freezeDeep({
 id:'grace',
 name:'Grace Whitfield',
 personId:'house-r8#1',
 voice:'Gentle, observant gardener at 8 Cedar Loop who tends her tomatoes and roses and notices how neighbours carry themselves.',
 facts:{home:'8 Cedar Loop'},
 bye:[
  {if:{weather:'rain'},t:'Take care in the rain, dear. The garden loves it even if my boots do not.'},
  {if:{weather:'snow'},t:'Watch the path in this snow, dear. Keep warm.'},
  {if:{tierMin:'close'},t:'Always lovely seeing you, dear. Do not be a stranger on Cedar Loop.'},
  {if:{tierMin:'friend'},t:'Bye for now, dear. Come by the porch anytime.'},
  {if:{mood:['miserable','low']},t:'Off you go then, dear. I will rest a little.'},
  {t:'Goodbye, dear. Mind how you go.'}
 ],
 nodes:[
  {id:'grace.door',entry:true,when:{place:['door','doorway']},do:[{meet:true}],say:[
   {if:{met:false},w:6,t:['Oh, hello! You have a kind face—I am Grace Whitfield, here at eight Cedar Loop.','Stop by the porch anytime you pass.']},
   {if:{gig:'need-tend',gigClient:'grace'},w:6,t:['Just who I hoped to see!','The tomato stakes and weeds got ahead of me—there is a garden job on the board if you have time.']},
   {if:{gig:'need-restock',gigClient:'grace'},w:5,t:['Out of flower seeds again!','I posted a seed run on the board if you are heading past the shops.']},
   {if:{hired:'ridgeline'},w:4,t:['I see that bright Ridgeline vest from the porch!','Hard work up in the timber, I expect.']},
   {if:{weather:'rain'},w:4,t:['Lovely steady rain for the garden, though I am glad of the porch roof!','Come stand under the eaves a moment.']},
   {if:{weather:'storm'},w:4,t:['Mercy, what a storm!','I tied the rose canes down just in time.']},
   {if:{weather:'snow'},w:4,t:['Snow on Cedar Loop!','I covered the tender bulbs last week, thank goodness.']},
   {if:{weather:'fog'},w:3,t:['Soft fog rolling up from the river today.','Makes Cedar Loop feel miles from anywhere.']},
   {if:{mood:['miserable','low']},w:3,t:['A quiet, heavy sort of day, dear.','Forgive me if I am not much company.']},
   {if:{tierMin:'close'},w:3,t:['What a wonderful surprise!','Pull up a chair on the porch a minute and catch your breath.']},
   {if:{tierMin:'friend',period:'morning'},w:2,t:['Good morning, dear! Deadheading the roses while the air is cool.']},
   {if:{period:'morning'},w:1,t:['Morning, dear. Cedar Loop is peaceful at this hour.']},
   {if:{period:'afternoon'},w:1,t:['Good afternoon! Just watering the porch pots.']},
   {if:{period:['evening','night']},w:1,t:['Quiet out on Cedar Loop.','Always nice to see a friendly face on the doorstep.']},
   {t:['Hello, dear. Lovely to see you at the porch.']}
  ],replies:[
   {label:'How is the garden growing?',go:'grace.garden'},
   {label:'Need a hand with anything?',go:'grace.help'},
   {label:'How are things on Cedar Loop?',go:'grace.neighbours'}
  ]},

  {id:'grace.open',entry:true,do:[{meet:true}],say:[
   {if:{met:false},w:5,t:['Hello there! I am Grace Whitfield—I live just up at eight Cedar Loop.','Nice to meet a new neighbour.']},
   {if:{hired:'ridgeline'},w:4,t:['Hard to miss that Ridgeline vest!','Good honest work out in the pines, even if it wears your boots out.']},
   {if:{weather:'rain'},w:4,t:['Good rain for the tomatoes today!','Though I expect you would rather be dry.']},
   {if:{weather:'snow'},w:4,t:['Bundle up in this snow, dear!','The cold creeps up quick off the river.']},
   {if:{weather:'fog'},w:3,t:['Careful in this fog, dear—visibility drops fast past the bend.']},
   {if:{tierMin:'close'},w:3,t:['There you are, dear! I was just thinking how quiet the lane has been.']},
   {if:{tierMin:'friend'},w:2,t:['Good to see you, friend! Taking a stroll?']},
   {if:{period:'morning'},w:1,t:['Lovely morning for a walk round Cedar Loop.']},
   {if:{period:'afternoon'},w:1,t:['Good afternoon! Just back from checking the post.']},
   {if:{period:['evening','night']},w:1,t:['Heading home to eight Cedar Loop before it gets too late.']},
   {t:['Hello, dear. Always nice to pause for a word.']}
  ],replies:[
   {label:'How is the garden growing?',go:'grace.garden'},
   {label:'Need a hand with anything?',go:'grace.help'},
   {label:'How are things on Cedar Loop?',go:'grace.neighbours'}
  ]},

  {id:'grace.garden',say:[
   {if:{weather:'rain'},w:3,t:['The tomatoes are drinking up this rain nicely.','Roses look a bit droopy, though they will perk right up tomorrow.'],do:[{standing:1}]},
   {if:{mood:['miserable','low']},w:3,t:['Weeds grow twice as fast as anything I actually plant, this week.']},
   {if:{tierMin:'friend'},w:2,t:['The roses are doing well, thank goodness, and the tomatoes are coming along.','A little help in the garden always goes a long way with me.'],do:[{standing:1}]},
   {t:['Tomatoes by the fence, roses by the porch.','Keeps my hands busy and my head clear.'],do:[{standing:1}]}
  ],replies:[
   {label:'Need a hand with anything?',go:'grace.help'},
   {label:'How are things on Cedar Loop?',go:'grace.neighbours'}
  ]},

  {id:'grace.help',say:[
   {if:{gig:['need-tend','need-restock','need-errand'],gigClient:'grace'},w:4,t:['I posted a little job on the board—garden weeding, seeds or a market errand.','I would be very grateful if you have the time.']},
   {t:['When my knees ache or the seed tin runs dry, I post a job on the town board.','Never any pressure, dear.']}
  ],end:true},

  {id:'grace.neighbours',say:[
   {if:{tierMin:'friend'},w:2,t:['Hal up at Willow Farm works harder than any man his age ought to.','And down on Oak Street, Noah keeps everyone fed and watered.']},
   {t:['Cedar Loop stays quiet, which suits me fine.','Oak Street has all the bustle if you are looking for company or work.']}
  ],end:true}
 ]
});

export const OAK_CAST=Object.freeze([OSCAR,LINCOLN,BRENTSTER,GRACE]);
