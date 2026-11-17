// W-A: world goods + state (notes/world-system-design.md): determinism, run-out and price cap, delivery, conservation, catch-up cap, normalize, prosperity floor, price band, no clock/chance, tick cost.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GOODS,PLACES,PLACE_IDS,REGIONS,TRUCK}from '../dist/world-goods.js';
import {normalizeWorld,worldTick,catchUp,stockAt,priceOf,deliver,buy,lowStock,visitCounts,totalOf,
 CATCH_UP_MAX,PRICE_BAND_PCT,PROSPERITY_FLOOR,PROSPERITY_STEP,HISTORY_DAYS}from '../dist/world-state.js';
import {townPopulation}from '../dist/population.js';
import {dayPlan}from '../dist/schedule.js';

const M='shop:market',C='shop:cafe',F='property:farm-house',K='property:eastbank-gas-kiosk';
const demand=(p,d)=>p===M?6:p===C?3:0; // a fixed errand count: 6 visits to the market, 3 to the cafe
const ctx={demand};
const fresh=(seed=7,day=100)=>normalizeWorld(null,seed,day);
const run=(w,from,to,c=ctx)=>{for(let d=from;d<=to;d++)w=worldTick(w,d,c);return w};

// data sanity: every place good is a known good, every place is in a region, prices are integer cents
for(const id of PLACE_IDS){const p=PLACES[id];assert.ok(REGIONS[p.region],id);for(const [g,d] of Object.entries(p.goods)){assert.ok(GOODS[g],g);assert.ok(d.start<=d.max&&d.target<=d.max,id+g)}}
for(const g of Object.values(GOODS))assert.ok(Number.isSafeInteger(g.baseCents)&&g.baseCents>0);
assert.ok(TRUCK.place in PLACES&&Object.keys(TRUCK.load).every(g=>g in PLACES[TRUCK.place].goods));

// determinism: the same seed + days -> byte-identical worlds; another seed differs; the input is never mutated
{const a=run(fresh(7),101,110),b=run(fresh(7),101,110),c=run(fresh(8),101,110);
 assert.equal(JSON.stringify(a),JSON.stringify(b));assert.notEqual(JSON.stringify(a.stock),JSON.stringify(c.stock));
 const w0=fresh(7),snap=JSON.stringify(w0);worldTick(w0,101,ctx);deliver(w0,M,'eggs',3,F);buy(w0,M,'eggs',2);catchUp(w0,100,130,ctx);assert.equal(JSON.stringify(w0),snap,'input mutated')}

// 7 untouched days: the market's eggs run out and the price sits at the +25% cap
{let w=run(fresh(7),101,107);
 assert.equal(w.stock[M].eggs,0,'eggs left '+w.stock[M].eggs);
 assert.equal(priceOf(w,M,'eggs'),Math.round(GOODS.eggs.baseCents*(1+PRICE_BAND_PCT/100)));
 assert.equal(stockAt(w,M,'eggs',1000),0);assert.ok(lowStock(w).some(x=>x.place===M&&x.good==='eggs'))}

// the farm piles up what the market lacks, and Hal's health scales output
{const healthy=run(fresh(7),101,103,{demand,farmHealth:()=>1}),sick=run(fresh(7),101,103,{demand,farmHealth:()=>0});
 assert.ok(healthy.stock[F].eggs>sick.stock[F].eggs&&healthy.last.produced.eggs>0);assert.equal(sick.last.produced.eggs||0,0)}

// delivery cannot exceed the source stock or the destination cap, and never creates goods
{const w=fresh(7),src=w.stock[F].eggs,before=totalOf(w,'eggs');
 const big=deliver(w,M,'eggs',9999,F);assert.equal(big.moved,Math.min(src,PLACES[M].goods.eggs.max-w.stock[M].eggs));assert.ok(big.world.stock[F].eggs>=0);assert.equal(totalOf(big.world,'eggs'),before);
 assert.equal(deliver(w,M,'eggs',5,K).moved,0,'wrong source');assert.equal(deliver(w,M,'eggs',5,M).moved,0,'same place');assert.equal(deliver(w,M,'eggs',-3,F).moved,0);assert.equal(deliver(w,M,'eggs',1.5,F).moved,0);
 assert.equal(deliver(w,M,'planks',5,F).moved,0,'good the place does not hold');
 const empty={...w,stock:{...w.stock,[F]:{...w.stock[F],eggs:0}}};assert.equal(deliver(empty,M,'eggs',5,F).moved,0);
 const carried=deliver(w,M,'eggs',5);assert.equal(carried.moved,5);assert.equal(carried.world.stock[M].eggs,w.stock[M].eggs+5)}

// buy: never below 0, pays at the current price
{const w=fresh(7),have=w.stock[M].milk,r=buy(w,M,'milk',have+50);assert.equal(r.sold,have);assert.equal(r.world.stock[M].milk,0);assert.equal(r.cents,have*priceOf(w,M,'milk'));assert.equal(buy(r.world,M,'milk',3).sold,0)}

// conservation: over every tick, total goods change = produced + imported - consumed, for every good, also with deliveries in between
{let w=fresh(9),days=0;for(let d=101;d<=140;d++){const before=Object.fromEntries(Object.keys(GOODS).map(g=>[g,totalOf(w,g)]));
  w=worldTick(w,d,ctx);if(d%5===0)w=deliver(w,M,'eggs',4,F).world;days++;
  for(const g of Object.keys(GOODS))assert.equal(totalOf(w,g),before[g]+(w.last.produced[g]||0)+(w.last.imported[g]||0)-(w.last.consumed[g]||0),`${g} day ${d}`)}
 for(const id of PLACE_IDS)for(const [g,dd] of Object.entries(PLACES[id].goods))assert.ok(w.stock[id][g]>=0&&w.stock[id][g]<=dd.max)}

// the supply truck refills fuel weekly, and a storm delays it
{const noEv=run(fresh(3),101,115),storm=run(fresh(3),101,115,{demand,events:()=>[{kind:'storm'}]});
 assert.ok(totalOf(noEv,'gas')>totalOf(storm,'gas')||totalOf(storm,'diesel')<totalOf(noEv,'diesel'));
 let w=fresh(3),trucks=0;for(let d=101;d<=130;d++){w=worldTick(w,d,ctx);if(w.last.trucked)trucks++}assert.ok(trucks>=3&&trucks<=5,'trucks '+trucks);
 assert.equal(run(fresh(3),101,130,{demand,events:()=>[{kind:'storm'}]}).last.trucked,false)}

// catch-up: 20 missed days run only 14 ticks (the newest), the day lands on toDay; a short gap runs exactly its days; nothing to do runs none
{const a=catchUp(fresh(7,100),100,120,ctx);assert.equal(a.ticks,CATCH_UP_MAX);assert.equal(a.world.day,120);
 const b=catchUp(fresh(7,100),100,103,ctx);assert.equal(b.ticks,3);assert.equal(b.world.day,103);
 assert.equal(catchUp(fresh(7,100),100,100,ctx).ticks,0);assert.equal(catchUp(fresh(7,100),'x',5,ctx).ticks,0);
 assert.equal(worldTick(fresh(7,100),100,ctx).day,100,'same day is a no-op')}

// normalize: garbage and old saves are safe, unknown places/goods are dropped, numbers clamped
{for(const junk of [undefined,null,0,'x',[],[1,2],{stock:5},{stock:{[M]:'eggs'}},{town:[]},{day:-4,truck:7}]){const w=normalizeWorld(junk,5,50);
  assert.equal(w.day,junk&&junk.day>=0?junk.day:50);assert.deepEqual(Object.keys(w.stock),PLACE_IDS);assert.ok(w.stock[M].eggs>=0)}
 const w=normalizeWorld({day:12,stock:{[M]:{eggs:-4,milk:99999,apples:3,bread:2.5},'shop:nowhere':{eggs:1}},town:{town:{prosperity:5,history:[1,'a',2,3,4,5,6,7,8,9]},mars:{prosperity:99}}},1,0);
 assert.equal(w.stock[M].eggs,0);assert.equal(w.stock[M].milk,PLACES[M].goods.milk.max);assert.ok(!('apples' in w.stock[M])&&!('shop:nowhere' in w.stock));assert.ok(Number.isInteger(w.stock[M].bread));
 assert.equal(w.town.town.prosperity,PROSPERITY_FLOOR);assert.equal(w.town.town.history.length,HISTORY_DAYS);assert.ok(!('mars' in w.town));assert.equal(w.day,12);
 assert.equal(JSON.stringify(normalizeWorld(JSON.parse(JSON.stringify(w)),1)),JSON.stringify(w),'round trip is stable')}

// prosperity: moves at most 2 a day, never below the floor, falls by itself when stock stays low (nobody delivers), 7-day history
{let w=fresh(7),prev=w.town.town.prosperity,hit=false;for(let d=101;d<=160;d++){w=worldTick(w,d,{demand:(p,dd)=>p===M?12:p===C?6:0,farmHealth:()=>0});const now=w.town.town.prosperity;
  assert.ok(Math.abs(now-prev)<=PROSPERITY_STEP&&now>=PROSPERITY_FLOOR);if(now<prev)hit=true;prev=now}
 assert.ok(hit,'never fell');assert.equal(w.town.town.prosperity,PROSPERITY_FLOOR);assert.ok(w.town.town.history.length<=HISTORY_DAYS);
 // and it can recover when stocked
 let r=w;for(let d=161;d<=200;d++){r=deliver(r,M,'eggs',99,F).world;for(const g of ['milk','produce','bread'])r=deliver(r,M,g,99).world;for(const g of ['eggs','milk','bread'])r=deliver(r,C,g,99).world;r=worldTick(r,d,{demand:()=>0})}
 assert.ok(r.town.town.prosperity>PROSPERITY_FLOOR)}

// price band: every price, at any stock/prosperity, stays within +-25% of base; more stock is cheaper; a richer town is cheaper
{for(const id of PLACE_IDS)for(const [g,d] of Object.entries(PLACES[id].goods))for(const stock of [0,1,Math.floor(d.target/2),d.target,d.max])for(const pros of [30,50,100]){
  const w=fresh(1);w.stock[id][g]=stock;w.town[PLACES[id].region].prosperity=pros;const p=priceOf(w,id,g),b=GOODS[g].baseCents;assert.ok(Number.isInteger(p)&&p>=Math.round(b*.75)&&p<=Math.round(b*1.25),`${id} ${g} ${stock} ${pros} ${p}`)}
 const w=fresh(1);w.stock[M].eggs=PLACES[M].goods.eggs.target;const a=priceOf(w,M,'eggs');w.stock[M].eggs=60;assert.ok(priceOf(w,M,'eggs')<a);w.stock[M].eggs=PLACES[M].goods.eggs.target;w.town.town.prosperity=100;assert.ok(priceOf(w,M,'eggs')<a);
 assert.equal(priceOf(w,M,'planks'),null)}

// stockAt: full at opening, runs down through the day to start minus use, never negative, derived from saved fields
{const w=worldTick(fresh(7),101,ctx),s=w.stock[M].eggs,u=w.use[M].eggs;assert.ok(u>0);
 assert.equal(stockAt(w,M,'eggs',0),s);assert.equal(stockAt(w,M,'eggs',PLACES[M].hours[0]),s);assert.equal(stockAt(w,M,'eggs',1440),s-u);
 let last=s;for(let m=0;m<=1440;m+=30){const v=stockAt(w,M,'eggs',m);assert.ok(v<=last&&v>=0);last=v}
 assert.equal(priceOf(w,M,'eggs',1440),priceOf({...w,stock:{...w.stock,[M]:{...w.stock[M],eggs:s-u}}},M,'eggs'))}

// source scan: no clock, no chance
for(const f of ['world-goods.js','world-state.js']){const src=fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8');assert.ok(!src.includes('Math.random')&&!src.includes('Date.now'),f);assert.ok(/^\/\/ world-goods\.js:|^\/\/ world-state\.js:/.test(src),'header '+f)}

// real demand from the real town: visitCounts over the 28 people's day plans, then tick cost
{const pop=townPopulation(),t0=performance.now();let w=fresh(7,100),visitsMs=0,ticks=0;
 for(let d=101;d<=164;d++){const a=performance.now(),v=visitCounts(pop.people,d,dayPlan);visitsMs+=performance.now()-a;w=worldTick(w,d,{demand:p=>v[p]||0});ticks++}
 const total=performance.now()-t0;assert.ok(w.day===164&&Object.keys(w.stock).length===PLACE_IDS.length);assert.ok(total/ticks<20);
 const t1=performance.now();for(let i=0;i<1000;i++)worldTick(w,165+i,{demand:()=>5});const pure=(performance.now()-t1)/1000;
 console.log(`people ${pop.people.length}; day-plan scan ${(visitsMs/ticks).toFixed(2)} ms/day; whole tick incl. scan ${(total/ticks).toFixed(2)} ms; pure worldTick ${pure.toFixed(3)} ms`)}
// audit C8: a saved supply-truck day far in the future is capped (the truck would never come); audit C/F8 (jobs.js): a world day ahead of the clock is pulled back so the world ticks again
{const w=normalizeWorld({v:1,seed:1,day:10,truck:{nextDay:9e15}},1,10);assert.ok(w.truck.nextDay<=10+TRUCK.everyDays,'truck day capped: '+w.truck.nextDay);const w2=normalizeWorld({day:9e15},1,10);assert.ok(w2.day<=100000,'huge world day clamped')}
console.log('PASS world-state: determinism, run-out + price cap, delivery, conservation, truck, catch-up 14, normalize, prosperity floor, price band, stockAt, no clock/chance');
