// Mikkadr Hub v2.5: the prompt-cache rules. Pure (no file, no clock, no model call), so tests can import it.
// A usage record is {input, output, cacheRead, cacheWrite} (token counts from a reply's `usage`; numbers only, never text). An observation is one reply measured against the one before it.
// The hub never shows a countdown the data does not support: until at least 3 hits and 1 miss agree, the cache state is "unknown" and only the minutes since the last reply are shown.

const n=v=>Number.isFinite(v)&&v>0?Math.floor(v):0;
export const MIN=60000;
// Warn before a costly send: a cold cache on a conversation this big (tokens), and the point where a new chat is the cheaper choice (share of a known window).
export const COLD_WARN_TOKENS=40000,NEW_CHAT_SHARE=0.6;

// Turn the raw `usage` of the Claude CLI into the four numbers.
export const usageOf=u=>({input:n(u&&u.input_tokens),output:n(u&&u.output_tokens),cacheRead:n(u&&u.cache_read_input_tokens),cacheWrite:n(u&&u.cache_creation_input_tokens)});
// How long the cache that a reply WROTE lives, as the API itself reports it: usage.cache_creation splits the written tokens into a 5-minute and a 1-hour part. null when the reply wrote nothing (its reads kept the earlier TTL).
export function ttlOf(u){const c=u&&u.cache_creation;if(!c||typeof c!=='object')return null;if(n(c.ephemeral_1h_input_tokens)>0)return 60*MIN;if(n(c.ephemeral_5m_input_tokens)>0)return 5*MIN;return null}
export const addUsage=(a,b)=>({input:n(a&&a.input)+n(b&&b.input),output:n(a&&a.output)+n(b&&b.output),cacheRead:n(a&&a.cacheRead)+n(b&&b.cacheRead),cacheWrite:n(a&&a.cacheWrite)+n(b&&b.cacheWrite)});
// How big the conversation was when the reply was made: everything sent, whether re-used or written.
export const contextOf=u=>n(u&&u.input)+n(u&&u.cacheRead)+n(u&&u.cacheWrite);
// How the last message split: re-used from the cache (cheap) and written new (the full price). Output is counted apart.
export const splitOf=u=>{const reused=n(u&&u.cacheRead),written=n(u&&u.input)+n(u&&u.cacheWrite),all=reused+written;return {reused,written,output:n(u&&u.output),reusedShare:all?reused/all:0}};

// prev, cur: {at (ms), model, input, cacheRead, cacheWrite}. A hit means the reply re-used at least half of what the previous reply had sent.
export function observe(prev,cur){
 if(!prev||!cur||!Number.isFinite(prev.at)||!Number.isFinite(cur.at)||cur.at<prev.at)return null;
 return {gapMs:cur.at-prev.at,hit:n(cur.cacheRead)>=0.5*contextOf(prev),modelSwitch:!!(prev.model&&cur.model&&prev.model!==cur.model),model:cur.model||null,context:contextOf(cur)}}

// observations: [{gapMs, hit, modelSwitch}]. A miss caused by a model switch says nothing about the lifetime, so it is left out.
export function lifetime(observations){
 const obs=(Array.isArray(observations)?observations:[]).filter(o=>o&&Number.isFinite(o.gapMs)),hits=obs.filter(o=>o.hit),misses=obs.filter(o=>!o.hit&&!o.modelSwitch);
 const longestHitMs=hits.length?Math.max(...hits.map(o=>o.gapMs)):null,shortestMissMs=misses.length?Math.min(...misses.map(o=>o.gapMs)):null;
 // sure: enough of both, and they agree (the longest hit is shorter than the shortest miss)
 const sure=hits.length>=3&&misses.length>=1&&longestHitMs<shortestMissMs;
 return {longestHitMs,shortestMissMs,hits:hits.length,misses:misses.length,sure}}

// {state:'warm'|'cold'|'unknown', ageMs, countdownMs?}. A countdown only when the lifetime is sure and the reply is inside the longest hit. Between the longest hit and the shortest miss nobody knows.
export function stateOf({lastReplyAt,now,lifetime:lt,ttlMs=null}){
 if(!Number.isFinite(lastReplyAt)||!Number.isFinite(now))return {state:'unknown',ageMs:null};
 const ageMs=Math.max(0,now-lastReplyAt);
 // the API said how long the cache it wrote lives (ttlMs): that is a fact, not a guess, so the countdown can show from the first reply. Every read renews it, so it runs from the last reply.
 if(Number.isFinite(ttlMs)&&ttlMs>0){return ageMs<=ttlMs?{state:'warm',ageMs,countdownMs:ttlMs-ageMs}:{state:'cold',ageMs}}
 if(lt&&lt.sure){
  if(ageMs<=lt.longestHitMs)return {state:'warm',ageMs,countdownMs:lt.longestHitMs-ageMs};
  if(ageMs>=lt.shortestMissMs)return {state:'cold',ageMs}}
 return {state:'unknown',ageMs}}

// What sending the whole conversation again costs, for the warnings.
export const rewriteCost=context=>{const tokens=n(context);return {tokens,text:tokens?`about ${tokens.toLocaleString('en-US')} tokens written new`:'nothing yet'}};

// Plain words for the strip. fmt: a number formatter (the page passes its own).
export const minutesText=ms=>!Number.isFinite(ms)?'':ms<MIN?'under a minute':`${Math.round(ms/MIN)} min`;
export function stripText(st){
 if(!st||st.ageMs==null)return 'No reply yet';
 const ago=`last reply ${st.ageMs<MIN?'just now':minutesText(st.ageMs)+' ago'}`;
 if(st.state==='warm')return `Cache warm · ${ago} · about ${minutesText(st.countdownMs)} left`;
 if(st.state==='cold')return `Cache probably cold · ${ago}`;
 return ago[0].toUpperCase()+ago.slice(1)}
// The warnings. Each returns null or a plain sentence.
export const coldSendWarning=(st,context)=>st&&st.state==='cold'&&n(context)>COLD_WARN_TOKENS?`The cache is probably cold, so this send writes the whole conversation again (${rewriteCost(context).text}).`:null;
export const modelSwitchWarning=context=>n(context)>0?`Switching model sends the whole conversation again: ${rewriteCost(context).text}.`:null;
export const newChatHint=(context,window)=>Number.isFinite(window)&&window>0&&n(context)>=NEW_CHAT_SHARE*window?'The conversation fills more than 60% of the window. A new chat is cheaper.':null;
