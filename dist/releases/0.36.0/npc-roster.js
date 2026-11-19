// npc-roster.js: the named NPCs with saved state (roles, homes, work, mood lines, needs, visit rules; dormant = no body yet); notes/world-system-design.md NEW NPCS. Pure data.
// VERIFIED in the map data: hal (Hal Brennan, owner of property:farm-house, post 'farm' 390-1050), noah (flat 8 of dwelling:oak-apartments, post 'market-day' Clerk at shop:market 420-870), sophie (flat 2 of oak-apartments, no post),
//   walt (Walt Hargrove, owner of Ridgeline, post 'ridgeline-owner' at office:ridgeline-office; named but not a resident, so population.js makes him a commuter), grace (Grace Whitfield, owner of property:house-r8, no post).
// VERIFIED (map-definition.js ~l.375): Oscar Masic, Lincoln Brambly and Brentster Lewis are residents of dwelling:oak-apartments, flats 9, 10, 11.
// VERIFIED (population.js, C3 2026-11-17): Lincoln holds post 'market-evening' (Clerk, shop:market 870-1320), Brentster 'alder-store' (Shopkeeper, Ironwood Store), Elena (flat 7) 'cafe-manager' (shop:cafe 480-1080).
// ASSUMED (marked): the foreman and the Eastbank truck driver (no such person exists in the map).
// personId is the id population.js gives the person (household id + '#1'); id is the short key used in saves and by gig-clients.js (HAL_ID='hal').
export const MOOD_WORDS=Object.freeze(['miserable','low','okay','good','delighted']);
export const NEED_KINDS=Object.freeze(['restock','errand','tend','clear','repair','haul','tow']);
const L=(a,b,c,d,e)=>Object.freeze({miserable:Object.freeze(a),low:Object.freeze(b),okay:Object.freeze(c),good:Object.freeze(d),delighted:Object.freeze(e)});
// visit rule: atDoor/inside = the lowest standing tier that gets that; doorHours = [from,to) minutes the door is answered (null = whenever home and awake);
// every = days between visits TO THE PLAYER by tier (null = never). place is where they visit: friend on the porch, close inside the player's home.
const V=(atDoor,inside,doorHours,every)=>Object.freeze({atDoor,inside,doorHours,every:Object.freeze(every)});
const E=Object.freeze({friend:null,close:null});

const LINCOLN_TOPICS=Object.freeze([
 Object.freeze({id:'deer',title:'Deer season',lines:Object.freeze(['Deer first. You wait in the cold before dawn and you do not move.','The trick is the wind: it has to come to you, never from you.','Once I sat four hours for one clean shot, and it was worth every minute.'])}),
 Object.freeze({id:'rifles',title:'Rifles and scopes',lines:Object.freeze(['A good scope matters more than a good rifle, people forget that.','Zero it at a hundred yards, check it every season, write it down.','Mine is old, but it has never once let me down.'])}),
 Object.freeze({id:'tracking',title:'Reading tracks',lines:Object.freeze(['Fresh tracks have sharp edges. Old ones go soft in the rain.','Droppings tell you what they ate and how long ago, honestly.','Follow the trail slowly and the woods start talking to you.'])}),
 Object.freeze({id:'camp',title:'Hunting camp',lines:Object.freeze(['A dry camp is a happy camp: tarp first, fire second.','Hang your food away from the tent unless you want a bear visit.','Nothing beats coffee on a camp stove at first light.'])}),
 Object.freeze({id:'game-meat',title:'Game meat and the market',lines:Object.freeze(['Field dress it fast, keep it cool, hang it a few days.','Noah takes good venison if it is cleaned properly.','Fresh game on the shelf, that is real food, not boxes.'])}),
 Object.freeze({id:'gear',title:'Boots, gear and ammo',lines:Object.freeze(['Boots first: wet feet end a hunt faster than any animal.','Wool socks, a good knife, a sharp one, always more ammo than you think.','I am nearly out of both, if you ever pass the store.'])}),
 Object.freeze({id:'dogs',title:'Hunting dogs',lines:Object.freeze(['A good dog is half the hunt.','Quiet, patient, nose to the ground, you cannot teach that in a week.','I had one once. Best partner I ever had.'])})
]);
export const HUNTING_TOPICS=Object.freeze(LINCOLN_TOPICS.map(t=>t.id));

const base=(o)=>Object.freeze({rule:null,homebody:false,hash:null,dormant:false,...o}); // dormant: kept in saves, skipped by needs, sickness and talk until the map gives them a post
export const ROSTER=Object.freeze([
 base({id:'hal',personId:'farm-house#1',name:'Hal Brennan',role:'Farmer (Willow Farm)',home:'property:farm-house',work:'property:farm-house',flat:null,assumed:false,
  traits:['generous','stubborn','early riser'],baseline:65,deliveryDay:2,marketDay:null,
  needs:['restock','haul','tend','repair'],needGoods:{restock:'feed',haul:'eggs',tend:'animals',repair:'fence'},
  lines:L(['Not now. The animals are not fed.','Knee is bad and the farm is behind. Leave me be.','Nothing is going right here.'],['Long week. The farm does not pause.','Could use a hand, honestly.','Tired, but the eggs will not collect themselves.'],['Morning. Eggs are fine today.','Farm is quiet, which is how I like it.','Coffee is on if you want one.'],['Good to see you. The hens are laying well.','Come in, there is always a cup for you.','A fine day to work the fields.'],['You are a godsend, you know that?','Best week we have had in a long time.','Take a coffee, take two, the farm is doing well.']),
  visit:V('acquaintance','friend',null,{friend:9,close:5})}),
 base({id:'noah',personId:'oak-apartments/8#1',name:'Noah',role:'Clerk (Corner Market)',home:'dwelling:oak-apartments',work:'shop:market',flat:'oak-apartments/8',assumed:false,
  traits:['friendly','talkative','tidy'],baseline:60,deliveryDay:null,marketDay:0,
  needs:['restock','errand','haul'],needGoods:{restock:'groceries',errand:'groceries',haul:'eggs'},
  lines:L(['Shelves are bare and I cannot do anything about it.','Customers keep asking for things I do not have.','Rough day. Rough week.'],['Slow day at the counter.','Running low on a few things.','I will manage, I always do.'],['Welcome in. What can I get you?','Quiet morning at the market.','Prices are what they are today.'],['Good to see you. Shelves are well stocked.','Business is steady, thank you for the help.','Have you tried the fresh eggs?'],['Great day at the market!','You always turn up when I need you.','Stocked to the roof. Take your time.']),
  visit:V('acquaintance','friend',null,{friend:8,close:4})}),
 base({id:'sophie',personId:'oak-apartments/2#1',name:'Sophie',role:'Resident (gig client)',home:'dwelling:oak-apartments',work:null,flat:'oak-apartments/2',assumed:false,
  traits:['kind','busy','likes cafes'],baseline:60,deliveryDay:null,marketDay:3,
  needs:['errand','restock'],needGoods:{errand:'groceries',restock:'groceries'},
  lines:L(['I cannot cope today, sorry.','Please, not today.','Everything went wrong at once.'],['A bit overwhelmed, to be honest.','I could use a hand with errands.','Sorry, a slow, grey day.'],['Hello! Nice weather for a walk.','Just heading to the market.','Busy, but fine.'],['Lovely to see you!','The groceries made my week.','Want to stop for a coffee later?'],['You are so kind, thank you!','Best day I have had in ages.','Come by anytime, I mean it.']),
  visit:V('acquaintance','friend',null,{friend:7,close:4})}),
 base({id:'walt',personId:'commuter:ridgeline-owner',name:'Walt Hargrove',role:'Owner (Ridgeline Timber Co.)',home:null,work:'office:ridgeline-office',flat:null,assumed:false,
  traits:['gruff','fair','punctual'],baseline:55,deliveryDay:null,marketDay:null,
  needs:['restock','haul','repair','clear'],needGoods:{restock:'lumber',haul:'lumber',repair:'saw',clear:'road'},
  lines:L(['The mill is a mess. Come back later.','Do not bring me problems today.','Nothing is on schedule.'],['Slow week. Timber is not moving.','I have seen better days.','Work is work.'],['Ridgeline is open. Ask about a shift.','Morning. Lumber is in the yard.','Keep your gloves on.'],['Good work lately. People notice.','Orders are coming in nicely.','Come by if you want steady work.'],['Best month in years. Thanks to people like you.','You have earned a good word from me.','The mill has never run better.']),
  visit:V(null,null,null,E)}),
 base({id:'grace',personId:'house-r8#1',name:'Grace Whitfield',role:'Resident (8 Cedar Loop)',home:'property:house-r8',work:null,flat:null,assumed:false,
  traits:['gentle','gardener','observant'],baseline:62,deliveryDay:null,marketDay:5,
  needs:['errand','tend','restock'],needGoods:{errand:'groceries',tend:'garden',restock:'seeds'},
  lines:L(['The garden is dying and so am I, almost.','I would rather be alone today.','Nothing blooms this year.'],['A quiet, heavy sort of day.','I could use some help in the garden.','Not my best week.'],['Hello, dear. Lovely day for the garden.','The tomatoes are coming along.','Cedar Loop is quiet.'],['Good to see you. Tea?','The roses are doing well, thank goodness.','You have a kind face.'],['What a wonderful surprise!','The garden has never looked better.','Lovely to see you, dear. Pull up a chair on the porch a minute.']),
  visit:V('acquaintance','friend',null,{friend:7,close:4})}),
 base({id:'oscar',personId:'oak-apartments/9#1',name:'Oscar Masic',role:'Retired recluse (owns an old black work truck)',home:'dwelling:oak-apartments',work:null,flat:'oak-apartments/9',assumed:false,
  rule:'recluse',homebody:true,traits:['grumpy','private','proud','handy'],baseline:35,deliveryDay:null,marketDay:null,
  needs:['errand','tow','repair'],needGoods:{errand:'groceries',tow:'black-truck',repair:'black-truck'},
  lines:L(['Go away.','I told you. Leave me alone.','You again. Do not knock twice.'],['What do you want now?','Make it quick.','I did not ask for company.'],['Hm. Oh. It is you.','Keep it short.','The truck is fine. Do not touch it.'],['You are not so bad. Do not tell anyone I said that.','Hm. You listen. Good.','Thanks for the quiet help.'],['Come in. Mind the floor, it is clean.','You are all right, kid.','I should not say it, but I am glad you came.']),
  visit:V('acquaintance','close',[600,720],{friend:null,close:14})}),
 base({id:'lincoln',personId:'oak-apartments/10#1',name:'Lincoln Brambly',role:'Evening clerk (Corner Market), keen hunter',home:'dwelling:oak-apartments',work:'shop:market',flat:'oak-apartments/10',assumed:true,
  rule:'hunter',traits:['long-winded','enthusiastic','sulks easily'],baseline:55,deliveryDay:null,marketDay:4,topics:LINCOLN_TOPICS,
  needs:['restock','haul','errand'],needGoods:{restock:'ammo',haul:'game-meat',errand:'boots'},
  lines:L(['Nobody wants to hear about hunting anyway.','Fine. Ignore me. Everyone does.','Not in the mood.'],['I had a story, but never mind.','You have not asked about the woods in days.','Hm.'],['Hey. Did I tell you about the deer last week?','Out of ammo again, practically.','Morning. Cold enough for a hunt.'],['Good to see you! Ask me about tracking!','Got a great story for you.','I bagged a nice one yesterday.'],['You will not believe the day I had out there!','Best season ever, I swear!','Sit down, I have six stories.']),
  visit:V('acquaintance','friend',null,{friend:6,close:3})}),
 base({id:'brentster',personId:'oak-apartments/11#1',name:'Brentster Lewis',role:'Shopkeeper (Ironwood Store), owner of the cat Brentster Jr.',home:'dwelling:oak-apartments',work:'property:alder-store',flat:'oak-apartments/11',assumed:true,
  rule:'catowner',traits:['devoted','distracted','soft-hearted'],baseline:50,deliveryDay:null,marketDay:null,
  needs:['tend','errand','restock'],needGoods:{tend:'cat',errand:'vet',restock:'cat-food'},
  lines:L(['Junior is not okay and nothing else matters.','I cannot talk. Have you seen my cat?','I should be looking for him.'],['Junior has been off his food.','Sorry, distracted. Cat stuff.','Not a good day for Junior.'],['Hey. Junior is on the sofa again.','Can you believe he knocked a glass over?','Oh, hi. Have you met my cat?'],['Junior is purring like an engine today!','Great day. He ate everything.','Good to see you, he likes you.'],['Junior learned a new trick!','Best day. Best cat. Best everything.','You have to see him, come on!']),
  visit:V('acquaintance','friend',null,{friend:7,close:3})}),
 base({id:'foreman',personId:'commuter:ridgeline-foreman',name:'Gus Taggart',role:'Ridgeline foreman (ASSUMED name)',home:null,work:'zone:forest',flat:null,assumed:true,dormant:true,
  traits:['strict','honest','sunburnt'],baseline:55,deliveryDay:null,marketDay:null,
  needs:['clear','repair','haul','restock'],needGoods:{clear:'road',repair:'saw',haul:'lumber',restock:'fuel'},
  lines:L(['The crew is a mess. Do not talk to me.','Another accident report. Brilliant.','Out of my sight.'],['Short crew again.','Behind quota.','Do your job, we will talk later.'],['On time. Good. Gloves.','Trees will not fell themselves.','Keep clear of the blade.'],['You work clean. I like that.','Good shift today.','Tell Walt I said you are alright.'],['Best crew I have had in years.','Take a break, you have earned it.','Ridgeline is lucky to have you.']),
  visit:V(null,null,null,E)}),
 base({id:'driver',personId:'commuter:eastbank-driver',name:'Ray Okonkwo',role:'Eastbank truck driver (ASSUMED name)',home:null,work:'office:ridgeline-warehouse',flat:null,assumed:true,dormant:true,
  traits:['cheerful','always late','road-weary'],baseline:55,deliveryDay:null,marketDay:null,
  needs:['haul','tow','repair','restock'],needGoods:{haul:'crates',tow:'truck',repair:'truck',restock:'fuel'},
  lines:L(['Truck broke down, load is late, everything is late.','Do not start me today.','No.'],['Long haul, short patience.','Running behind again.','Traffic. Always traffic.'],['Morning. Another load to deliver.','Eastbank is busy today.','Gas is cheaper over the hill.'],['Smooth run today!','Good to see a friendly face on the road.','The bridge looked clear this morning.'],['Perfect delivery, perfect day!','Drinks on me, next time I am in town.','Best route I ever drove.']),
  visit:V(null,null,null,E)}),
 base({id:'elena',personId:'oak-apartments/7#1',name:'Elena',role:'Manager (Alder Coffee)',home:'dwelling:oak-apartments',work:'shop:cafe',flat:'oak-apartments/7',assumed:false,
  traits:['brisk','warm','organised','proud of her coffee'],baseline:60,deliveryDay:null,marketDay:null,
  needs:['restock','errand','haul'],needGoods:{restock:'coffee',errand:'groceries',haul:'milk'},
  lines:L(['The machine is broken and the rush is coming.','Not now, please. Nothing is going right today.','Two staff short and a line out the door.'],['Long shift. My feet know it.','The milk order came short again.','Busy and tired, but the coffee is still good.'],['The usual rush, nothing I cannot handle.','Coffee is fresh, if you want one.','Tables clean, cups stacked. A fair day.'],['Good to see you. The new beans are lovely.','Full room today and nobody waited long.','The new grinder finally behaves. I could hug it.'],['Best week the cafe has had all year!','Everyone left smiling today. That is the job.','Sit down a minute, you have earned a good cup.']),
  visit:V('acquaintance','friend',null,{friend:8,close:5})})
]);
export const ROSTER_ORDER=Object.freeze(ROSTER.map(n=>n.id));
export const ACTIVE_ORDER=Object.freeze(ROSTER.filter(n=>!n.dormant).map(n=>n.id)); // the people with a body in the map (needs, sickness, talk)
const INDEX=Object.freeze(Object.fromEntries(ROSTER.map(n=>[n.id,n])));
export const byId=id=>Object.prototype.hasOwnProperty.call(INDEX,id)?INDEX[id]:null;

// ---- W-D3 dialogue text (placeholders, varied; implements notes/world-system-design.md NEW NPCS + OWNER ANSWER 15). Greetings by standing tier; the mood line comes from `lines` above.
const G=(a,b,c,d)=>Object.freeze({stranger:Object.freeze(a),acquaintance:Object.freeze(b),friend:Object.freeze(c),close:Object.freeze(d)});
export const DEFAULT_GREETINGS=G(['Hello. Do I know you?','Hi there. Can I help you?','Oh. Hello.'],['Hello again.','Good to see you around.','Hi. We have met, I think.'],['Hey, there you are!','Good to see you, friend.','Hi! How have you been?'],['My friend! Come on, talk to me.','There you are, I was hoping you would come by.','Always glad to see you.']);
export const GREETINGS=Object.freeze({
 oscar:G(['What do you want?','Do I know you? I do not think so.','Hm. Another one.'],['You again. Be quick.','Hm. You are the one who does not shout. Fine.','Keep it short.'],['Oh. It is you. Come on then.','Hm. Sit if you want. Do not touch anything.','You can stay a minute.'],['Kid. Good. Come in, mind the floor.','Hm. You are welcome here. Do not make it a habit.','I was just thinking of you, which is strange.']),
 lincoln:G(['Hey! Do you hunt? You look like you could hunt.','New face! You into the outdoors?','Hi. Are you here about the woods?'],['Hey, you are back! Want to hear about my week?','Good to see you. I have been out at dawn again.','Hello again! Ask me anything about the woods.'],['There you are! I saved a story for you.','Friend! Sit down, I have so much to tell you.','Great timing, I just got back from the ridge.'],['My best listener! You will not believe this one.','Come on, come on, I have been waiting all day to tell you!','You and me should go out there together one day.']),
 brentster:G(['Hi. Sorry, have you seen a grey cat? No? Okay.','Oh, hello. Sorry, I am a bit distracted.','Hi. Do you like cats?'],['Hey. Brentster Jr. says hello. Well, he would, if he cared.','Oh, it is you. Have you met my cat properly yet?','Hi again. I was just talking about Junior.'],['Hey! Junior has been asking about you. Sort of.','Friend! You have to hear what Junior did today.','Good to see you. Junior is on the sofa, as always.'],['You are family now. Junior approves, and he approves of nobody.','There you are! Come say hi to Junior.','I trust you with anything, even Junior.'])
});
export const greetingsOf=id=>GREETINGS[id]||DEFAULT_GREETINGS;
// What they say at a door that stays shut (canVisit reasons). {name} is replaced by the caller.
export const KNOCK_LINES=Object.freeze({
 stranger:Object.freeze(['Who is it?','Who is it? ... (nobody opens)','A voice from inside: "Who is it?" Then nothing.']),
 asleep:Object.freeze(['No answer. The lights are off.','Nobody comes. They must be asleep.']),
 'not-home':Object.freeze(['Nobody answers. They are out.','You knock twice. Empty.']),
 'door-closed':Object.freeze(['Not now.','"Not now. Come back later." Through the door.']),
 sick:Object.freeze(['"I am ill. Not today, sorry." Through the door.','A cough from inside. "Come back when I am better."']),
 'no-home-in-town':Object.freeze(['There is no flat for them here.']),
 unknown:Object.freeze(['Nobody answers.'])
});
export const OSCAR_REFUSAL='Leave me be.';
export const OSCAR_DOOR_STRANGER='"I do not know you. Go away." Through the door.';
// Brentster steers every conversation to his cat (cat topics are the ones that please him: npc-life CAT_TOPICS).
export const CAT_STEERS=Object.freeze(['Anyway. Did you see Junior this morning? He was on the windowsill.','That reminds me, Junior knocked a mug off the table again.','Sorry. Back to Junior: do you think he looks thin?','Speaking of which, have you seen Brentster Jr. around? He gets out sometimes.','Anyway, you really should meet my cat properly.']);
export const CAT_ANSWERS=Object.freeze({cat:'Junior? He is the best cat in the world. Grey, grumpy, loves boxes.','cat-food':'He only eats the salmon one. Forty minutes after it is open, he sulks.','vet':'The vet says he is fine. I do not believe her.'});
// Topics every named NPC answers (id, button). The reply text: chat = their mood line, town = TOWN_LINES, tips = their TIPS entry.
export const COMMON_TOPICS=Object.freeze([Object.freeze({id:'chat',label:'How are you doing?'}),Object.freeze({id:'town',label:'What is new in town?'}),Object.freeze({id:'tips',label:'Any advice for me?'})]);
export const TOWN_LINES=Object.freeze(['Oak Street is quiet. The market is the place to hear things.','They say the farm had a good week.','Ridgeline is hiring, if you like the woods.','The pumps at Eastbank get a delivery once a week.','Somebody should fix that bench by the bus stop.','If you want work, check the phone, the town posts jobs when it needs something.']);
export const TIPS=Object.freeze({
 hal:'Come by when the coop is full. A truck with a bed makes an egg run worth the trip.',
 noah:'Watch the shelves. When I run low I post a job, and I pay better than the street.',
 sophie:'I am always short of time. Errands and groceries make my day.',
 walt:'Show up on time and keep your gloves on. I notice who works.',
 grace:'A little help in the garden goes a long way with me.',
 oscar:'Do not talk my ear off. Do a favour quietly and I will remember.',
 lincoln:'Ask me about hunting. Anything else and I lose interest.',
 brentster:'Be kind to my cat and you will be fine with me.',
 foreman:'Be safe and do the work clean.',
 driver:'Keep your rig fuelled and your headlights clean.',
 elena:'Shifts run eight to five: eight bucks an hour plus tips, and a bonus when you clear the tasks.'
});