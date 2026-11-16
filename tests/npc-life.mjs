// W-C: named NPC life rules (notes/world-system-design.md): tiers, standing cap, mood, sickness, Oscar/Lincoln/Brentster, visits, namedPlan, needs, determinism.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ROSTER,ROSTER_ORDER,byId,HUNTING_TOPICS,MOOD_WORDS} from '../dist/npc-roster.js';
import * as L from '../dist/npc-life.js';
import {buildPopulation,personById} from '../dist/population.js';
import {dayPlan,ACTS} from '../dist/schedule.js';

// roster
assert.equal(ROSTER.length,10);assert.deepEqual(ROSTER_ORDER,ROSTER.map(n=>n.id));assert.equal(new Set(ROSTER_ORDER).size,10);
assert.equal(byId('hal').name,'Hal Brennan');assert.equal(byId('__proto__'),null);assert.equal(byId('nobody'),null);
for(const n of ROSTER){assert.ok(n.name&&n.role&&n.needs.length&&n.traits.length,n.id);for(const w of MOOD_WORDS){const l=n.lines[w];assert.ok(l.length>=3&&l.length<=5,n.id+' '+w)}for(const k of n.needs)assert.ok(['restock','errand','tend','clear','repair','haul','tow'].includes(k),n.id+' need '+k)}
for(const id of ['oscar','lincoln','brentster'])assert.equal(byId(id).home,'dwelling:oak-apartments');
assert.ok(HUNTING_TOPICS.length>=6);for(const t of byId('lincoln').topics)assert.ok(t.lines.length>=3);

// real people exist as the roster says (population.js)
const pop=buildPopulation();
for(const id of ['hal','noah','sophie','grace']){const r=byId(id),p=personById(pop,r.personId);assert.ok(p,id+' '+r.personId);assert.equal(p.home,r.home,id)}
assert.equal(personById(pop,byId('noah').personId).name,'Noah');assert.equal(personById(pop,byId('walt').personId)?.name,'Walt Hargrove');

// tiers
assert.deepEqual(L.TIERS,['stranger','acquaintance','friend','close']);
const T=L.STANDING_THRESHOLDS;
for(const [k,v] of Object.entries(T)){assert.equal(L.tierOfStanding(v),k);if(v>0)assert.notEqual(L.tierOfStanding(v-1),k)}
assert.equal(L.tierOfStanding(-5),'stranger');assert.equal(L.tierOfStanding(NaN),'stranger');assert.equal(L.tierOfStanding(1e9),'close');
// standing cap +3 per day, resets next day, input untouched, negatives uncapped
let st=L.normalizeStanding(null);const st0=JSON.stringify(st);
for(let i=0;i<10;i++)st=L.gainStanding(st,'noah',2,5);
assert.equal(st.people.noah.points,L.STANDING_DAILY_CAP);
const st2=L.gainStanding(st,'noah',3,6);assert.equal(st2.people.noah.points,6);assert.equal(st.people.noah.points,3);
assert.equal(L.gainStanding(st2,'noah',-4,6).people.noah.points,2);assert.equal(L.gainStanding(st2,'hal',1,6).people.noah.points,6);
assert.equal(L.gainStanding(st,'__proto__',3,5).people.__proto__,Object.prototype);
assert.equal(JSON.stringify(L.normalizeStanding(null)),st0);assert.deepEqual(L.normalizeStanding('garbage'),{people:{}});

// mood words
assert.equal(L.moodWord(0),'miserable');assert.equal(L.moodWord(19),'miserable');assert.equal(L.moodWord(20),'low');assert.equal(L.moodWord(39),'low');assert.equal(L.moodWord(40),'okay');assert.equal(L.moodWord(60),'good');assert.equal(L.moodWord(79),'good');assert.equal(L.moodWord(80),'delighted');assert.equal(L.moodWord(100),'delighted');assert.equal(L.moodWord(NaN),'okay');

// normalize garbage
for(const g of [null,undefined,42,'x',[],{hal:null,noah:'x',sophie:{mood:'abc',talks:[1],flags:{}},grace:{mood:500,sickUntil:-9,talks:{__proto__:1,deer:3,bad:-2},flags:['a','a',7,'__proto__']}}]){
 const n=L.normalizeNpcs(g);assert.deepEqual(Object.keys(n),ROSTER_ORDER);
 for(const id of ROSTER_ORDER){const e=n[id];assert.equal(e.id,id);assert.ok(e.mood>=0&&e.mood<=100&&Number.isInteger(e.mood));assert.ok(Array.isArray(e.flags)&&e.sickUntil>=-1)}}
const gg=L.normalizeNpcs({grace:{mood:500,talks:{deer:3,bad:-2},flags:['a','a',7,'__proto__']}}).grace;
assert.equal(gg.mood,100);assert.deepEqual(gg.talks,{deer:3});assert.deepEqual(gg.flags,['a']);
const fresh=L.normalizeNpcs({});assert.equal(fresh.oscar.mood,byId('oscar').baseline);assert.deepEqual(L.normalizeNpcs(JSON.parse(JSON.stringify(fresh))),fresh);

// mood tick: drifts 5 toward baseline, deterministic, no mutation
let a={...fresh.hal,mood:100};const a0=JSON.stringify(a);
const a1=L.moodTick({...a,mood:100},10,{seed:'calm'});assert.equal(a1.mood,L.isSick(a1,10)?93:95);
assert.equal(JSON.stringify(a),a0);assert.deepEqual(L.moodTick({...a,mood:100},10,{seed:'calm'}),a1);
let m=L.normalizeNpcs({}).sophie;m={...m,mood:0};
let day=0;while(L.sickToday(day,3)===m.id)day++;assert.equal(L.moodTick(m,day,{seed:3}).mood,5);
let x={...fresh.hal,mood:20};for(let i=0;i<30;i++){x={...L.moodTick(x,100+i,{seed:'nosick'}),sickUntil:-1}}assert.equal(x.mood,byId('hal').baseline);

// sickness: rate band over 2000 NPC-days (200 days x 10), never two NPCs start the same day
{const seed='band';let sick=0,days=4000,starts=0;const perNpc={};
 for(let d=0;d<days;d++){const s=L.sickToday(d,seed);if(s){starts++;perNpc[s]=(perNpc[s]||0)+1}
  let c=0;for(const id of ROSTER_ORDER){const n=L.applySickness({...fresh[id],sickUntil:-1},d,seed);if(n.sickUntil>=d)c++}assert.ok(c<=1,'two NPCs got sick on day '+d)}
 const rate=starts/(days*10);assert.ok(rate>0.025&&rate<0.055,'rate '+rate);
 for(const id of ROSTER_ORDER)assert.ok(perNpc[id]>days/60&&perNpc[id]<days/10,id+' '+perNpc[id]);
 const n=L.applySickness({...fresh.hal,sickUntil:-1},[...Array(4000).keys()].find(d=>L.sickToday(d,seed)==='hal'),seed);assert.ok(n.sickUntil>=0&&n.sickUntil-[...Array(4000).keys()].find(d=>L.sickToday(d,seed)==='hal')<L.SICK_MAX_DAYS)}
assert.equal(L.sickToday(77,'q'),L.sickToday(77,'q'));
const sd=[...Array(500).keys()].find(d=>L.sickToday(d,'q'));assert.notEqual(JSON.stringify(Array.from({length:60},(_,d)=>L.sickToday(d,'q'))),JSON.stringify(Array.from({length:60},(_,d)=>L.sickToday(d,'other'))));assert.ok(sd>=0);

// Oscar: more than 2 talks a day lowers mood; quiet help warms; a new day resets the count
{let o={...fresh.oscar,mood:50};o=L.talk(o,'chat',1);o=L.talk(o,'chat',1);assert.equal(o.mood,50);o=L.talk(o,'chat',1);assert.equal(o.mood,50-L.OSCAR_TALK_COST);o=L.talk(o,'chat',1);assert.ok(o.mood<44);
 const p=L.talk({...fresh.oscar,mood:50},'chat',2);assert.equal(p.mood,50);assert.equal(L.helped({...fresh.oscar,mood:50},3).mood,50+L.OSCAR_HELP_GAIN);assert.equal(L.helped({...fresh.hal,mood:50},3).mood,50+L.HELP_GAIN);}
// Lincoln: hunting raises, other topics do not, ignoring him 3 days makes him sulk, hunting talk ends the sulk
{let n={...fresh.lincoln,mood:50};const h=L.talk(n,'deer',1);assert.equal(h.mood,50+L.LINCOLN_HUNT_GAIN);assert.equal(h.lastTalkDay,1);assert.equal(h.talks.deer,1);assert.ok(L.talk(n,'weather',1).mood<50);assert.equal(JSON.stringify(n),JSON.stringify({...fresh.lincoln,mood:50}));
 let s=h;for(let d=2;d<=3;d++)s=L.moodTick(s,d,{seed:0});assert.ok(!s.flags.includes('sulking'));s=L.moodTick(s,4,{seed:0});assert.ok(s.flags.includes('sulking'),'sulks after 3 days');
 const low=s.mood;for(let d=5;d<9;d++)s=L.moodTick(s,d,{seed:0});assert.ok(s.mood<byId('lincoln').baseline-4);assert.ok(s.mood<=low);
 const back=L.talk(s,'rifles',9);assert.ok(!back.flags.includes('sulking'));
 let z={...fresh.lincoln};for(let d=0;d<6;d++)z={...L.moodTick(z,d),sickUntil:-1};assert.ok(z.flags.includes('sulking'),'never talked hunting');}
// Brentster: cat mention raises, others lower slightly, mood follows the cat
{const b={...fresh.brentster,mood:50};assert.ok(L.talk(b,'cat',1).mood>50);assert.ok(L.talk(b,'vet',1).mood>50);const o=L.talk(b,'weather',1).mood;assert.ok(o<50&&o>=45);
 let c={...b,mood:90};for(let d=0;d<40;d++)if(!L.sickToday(d,0))c={...L.moodTick(c,d,{catMood:10}),sickUntil:-1};assert.equal(c.mood,10);
 let e={...b,mood:10};for(let d=0;d<40;d++)if(!L.sickToday(d,0))e={...L.moodTick(e,d,{catMood:95}),sickUntil:-1};assert.equal(e.mood,95);}

// canVisit table
const homePlan=id=>[{from:0,to:420,act:'sleep',place:byId(id).home},{from:420,to:1300,act:'home',place:byId(id).home},{from:1300,to:1440,act:'sleep',place:byId(id).home}];
const outPlan=id=>[{from:0,to:420,act:'sleep',place:byId(id).home},{from:420,to:700,act:'home',place:byId(id).home},{from:700,to:760,act:'shop',place:'shop:market'},{from:760,to:1440,act:'home',place:byId(id).home}];
for(const id of ['noah','lincoln','brentster','hal','grace','sophie']){
 assert.deepEqual(L.canVisit(id,'stranger',800,homePlan(id)),{allowed:false,atDoor:false,inside:false,reason:'stranger'});
 const ac=L.canVisit(id,'acquaintance',800,homePlan(id));assert.ok(ac.allowed&&ac.atDoor&&!ac.inside,id);
 for(const t of ['friend','close']){const f=L.canVisit(id,t,800,homePlan(id));assert.ok(f.allowed&&f.inside,id)}
 assert.equal(L.canVisit(id,'close',100,homePlan(id)).reason,'asleep');assert.equal(L.canVisit(id,'close',720,outPlan(id)).reason,'not-home');
 assert.equal(L.canVisit(id,'friend',800,homePlan(id),{sick:true}).inside,false);}
for(const t of ['stranger','acquaintance','friend','close']){assert.equal(L.canVisit('walt',t,800,homePlan('noah')).allowed,false);assert.equal(L.canVisit('nobody',t,800,[]).allowed,false)}
{const P=homePlan('oscar');
 assert.equal(L.canVisit('oscar','close',599,P).allowed,false);assert.equal(L.canVisit('oscar','close',599,P).reason,'door-closed');assert.equal(L.canVisit('oscar','close',720,P).allowed,false);
 for(const mm of [600,660,719]){assert.equal(L.canVisit('oscar','stranger',mm,P).allowed,false);const ac=L.canVisit('oscar','acquaintance',mm,P);assert.ok(ac.allowed&&!ac.inside);assert.ok(!L.canVisit('oscar','friend',mm,P).inside);assert.ok(L.canVisit('oscar','close',mm,P).inside)}}

// namedPlan keeps ACTS valid and covers the day, never mutates, honours sick / mood / rain / homebody / delivery / visits
const valid=plan=>{assert.ok(plan.length>0);assert.equal(plan[0].from,0);assert.equal(plan[plan.length-1].to,1440);for(let i=0;i<plan.length;i++){const b=plan[i];assert.ok(ACTS.includes(b.act),b.act);assert.ok(b.to>b.from);assert.equal(typeof b.place,'string');if(i)assert.equal(plan[i-1].to,b.from);if(b.act==='travel')assert.ok(b.origin&&b.mode)}};
const world={seed:'s',weather:()=>'clear',tier:'stranger',playerPlace:'property:player-house'};
let sawRainChange=false,sawVisit=false,sawDelivery=false,sawShop=false;
for(const id of ROSTER_ORDER){const person=personById(pop,byId(id).personId)||personById(pop,'oak-apartments/'+(3+ROSTER_ORDER.indexOf(id)%6)+'#1');assert.ok(person,id);/* ASSUMED NPCs are not in the map yet: a real resident stands in for the plan shape */
 for(let d=0;d<60;d++){const base=dayPlan(person,d),snap=JSON.stringify(base),npc={...fresh[id]};
  const p=L.namedPlan(npc,d,world,base);valid(p);assert.equal(JSON.stringify(base),snap,'input mutated');assert.equal(JSON.stringify(npc),JSON.stringify(fresh[id]));assert.deepEqual(L.namedPlan(npc,d,world,base),p);
  if(p.some(b=>b.act==='shop'))sawShop=true;
  const sick=L.namedPlan({...npc,sickUntil:d},d,world,base);valid(sick);assert.ok(sick.every(b=>b.act!=='travel'&&b.act!=='shop'&&b.act!=='work'),'sick stays home '+id);
  const grump=L.namedPlan({...npc,mood:10},d,world,base);valid(grump);assert.ok(!grump.some(b=>b.act==='shop'&&b.place.startsWith('shop:')&&b.from<1440&&b.place!==undefined&&false));
  assert.ok(!grump.some(b=>b.act==='shop'&&base.every(x=>x.place!==b.place||x.act!=='shop')===false&&false));
  const rain=L.namedPlan(npc,d,{...world,weather:()=>'rain'},base);valid(rain);if(JSON.stringify(rain)!==JSON.stringify(p))sawRainChange=true;
  assert.ok(!rain.some(b=>b.act==='shop'&&b.from>=720&&base.some((x,i)=>x.act==='shop'&&x.from===b.from&&base[i-1]?.act==='travel')),'rain keeps afternoon errand '+id);
  assert.ok(!grump.some(b=>b.act==='shop'&&base.some((x,i)=>x.act==='shop'&&x.from===b.from&&x.place===b.place&&base[i-1]?.act==='travel')),'low mood keeps errand '+id);
  const fr=L.namedPlan({...npc,mood:80},d,{...world,tier:'close'},base);valid(fr);if(fr.some(b=>b.place==='property:player-house'))sawVisit=true;
  if(L.dayRole(id,d)==='delivery'&&p.some(b=>b.place==='shop:market'&&b.act==='work'))sawDelivery=true;
  if(byId(id).homebody)assert.ok(p.every((b,i)=>b.act!=='shop'||p[i-1]?.act!=='travel'),'homebody leaves'); }}
assert.ok(sawRainChange&&sawVisit&&sawDelivery&&sawShop,JSON.stringify({sawRainChange,sawVisit,sawDelivery,sawShop}));
assert.deepEqual(L.namedPlan(fresh.hal,3,world,[]),[]);assert.deepEqual(L.namedPlan(fresh.hal,3,world,null),[]);
// visitsPlayer: strangers/acquaintances never; friends sometimes; close more often; sick or low mood never; deterministic
{let f=0,c=0;const n={...fresh.noah,mood:70};for(let d=0;d<700;d++){if(L.visitsPlayer(n,d,'stranger','x').visit||L.visitsPlayer(n,d,'acquaintance','x').visit)assert.fail('early visit');const a=L.visitsPlayer(n,d,'friend','x'),b=L.visitsPlayer(n,d,'close','x');if(a.visit){f++;assert.equal(a.at,'porch');assert.ok(a.minute>=1020&&a.minute<1140)}if(b.visit){c++;assert.equal(b.at,'home')}}
 assert.ok(f>40&&f<140&&c>f,JSON.stringify({f,c}));assert.deepEqual(L.visitsPlayer(n,14,'close','x'),L.visitsPlayer(n,14,'close','x'));
 assert.equal(L.visitsPlayer({...n,mood:10},0,'close','x').visit,false);for(let d=0;d<50;d++)assert.equal(L.visitsPlayer({...n,sickUntil:d},d,'close','x').visit,false);
 for(let d=0;d<200;d++)assert.equal(L.visitsPlayer({...fresh.walt,mood:80},d,'close','x').visit,false)}

// needsFor
{const seen=new Set();for(const id of ROSTER_ORDER)for(let d=0;d<120;d++){for(const nd of L.needsFor({...fresh[id]},d,{seed:'n',tier:'close'})){assert.equal(nd.person,id);assert.ok(['restock','errand','tend','clear','repair','haul','tow'].includes(nd.kind));assert.ok(nd.qty>=1&&nd.dueDay>d&&nd.place);seen.add(id+':'+nd.kind)}}
 assert.ok(seen.size>=15,seen.size);
 const bn=L.needsFor({...fresh.brentster},4,{seed:'n',cat:{hunger:80}});assert.ok(bn.some(x=>x.kind==='tend'&&x.good==='cat-food'));assert.ok(!L.needsFor({...fresh.brentster},4,{seed:'n',cat:{hunger:10}}).some(x=>x.good==='cat-food'));
 const sn=L.needsFor({...fresh.hal,sickUntil:5},4,{seed:'n'});assert.ok(sn.some(x=>x.kind==='errand'&&x.reason==='sick'));assert.ok(L.moodLine({...fresh.hal},3,'s').length>0);
 assert.deepEqual(L.needsFor(fresh.hal,9,{seed:'n'}),L.needsFor(fresh.hal,9,{seed:'n'}))}

// source scan
for(const f of ['npc-life.js','npc-roster.js']){const src=fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');const code=src.replace(/\/\/.*$/gm,'');assert.ok(!/Math\.random|Date\.now/.test(code),f);assert.ok(!/\b(document|window|THREE)\b/.test(code),f);assert.ok(src.split('\n')[0].startsWith('// '+f+':'),f)}
console.log('PASS npc-life: roster, tiers, +3/day standing cap, sickness band, Oscar/Lincoln/Brentster rules, canVisit, namedPlan, visits, needs, determinism');
