// NPC chat (notes/npc-movement-design.md N3, NPC-NAMES, stage C9): a short, deterministic greeting for any named person of the crowd (name, where they live, what they do, time of day, weather, and place). Pure: no DOM, no globals, no Math.random/Date.now (choice is an integer hash of the person, day, hour and place).
import {MAP} from './map-definition.js';

export const GREETINGS=Object.freeze({
 morning:Object.freeze(['Good morning!','Morning, neighbour.','Early start today, eh?','Bright and early out here!','Morning—hope your day starts smooth.']),
 afternoon:Object.freeze(['Afternoon!','Hey there, neighbour.','Hope your afternoon is treating you well.','Good afternoon!','Busy afternoon out on the street.']),
 evening:Object.freeze(['Evening!','Good evening, neighbour.','Winding down for the evening?','Quiet evening out here.','Evening—nice time for a stroll.']),
 night:Object.freeze(['Late one tonight, isn\'t it?','Quiet out on the street tonight.','Still up and about?','Heading in soon?','Peaceful out here after dark.'])
});
export const WEATHER_REMARKS=Object.freeze({
 rain:Object.freeze(['Wet one today—watch the kerbs.','Left my umbrella by the door again.','Good rain for the gardens, at least.']),
 cloudy:Object.freeze(['Grey sky today, though it feels mild enough.','Looks like it might hold off for a bit.','Nice cool shade under these clouds.']),
 storm:Object.freeze(['Rough storm blowing through—stay safe out there.','Not the day to be caught far from shelter.','Listen to that wind rattling the signs.']),
 fog:Object.freeze(['Thick fog on the road today.','Hard to see past the corner in this fog.','Take the crossings slow in mist like this.']),
 snow:Object.freeze(['Mind the ice on the steps.','Cold enough to freeze your ears off!','Fresh snow always hushes the whole street.']),
 clear:Object.freeze(['Nice weather for a walk.','Not a bad day at all.','Clear skies make the walk fly by.'])
});
export const PLACE_REMARKS=Object.freeze({
 bench:Object.freeze(['Just resting my feet on the bench for five minutes.','Best bench in town for watching folks pass by.','Taking a breather here before I head on.']),
 shop:Object.freeze(['Just popping in by the shop door for a few things.','Checking what is on the shelves before it gets busy.','Hard to walk past a shop door without peeking in.']),
 diner:Object.freeze(['Smell of fresh coffee by the diner gets me every time.','Stopping outside the diner—always a friendly crowd here.','Alder Coffee keeps half the street going.']),
 road:Object.freeze(['Just stretching my legs along the road.','Passing through on my way down the block.','Nothing like a quick walk down the street.'])
});
const hash=(...parts)=>{let h=2166136261;for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return h>>>0};
export const periodOf=minute=>{const h=Math.floor((((Number(minute)||0)%1440)+1440)%1440/60);return h>=5&&h<12?'morning':h>=12&&h<18?'afternoon':h>=18&&h<22?'evening':'night'};
const pick=(list,...seed)=>list[hash(...seed)%list.length];
// Where a person lives, as the map names it ('8 Cedar Loop'), or '' when the home is not a named property.
export function homeName(person){const id=String(person?.home||'').replace(/^property:/,'');const p=(MAP.properties||[]).find(x=>x.id===id);return p?.name||''}
// What they do: a short phrase, or '' (retired or at home).
export function workPhrase(person){const w=person?.role||person?.post;if(!w)return '';const at=person.employer||person.work;return at?`I work as ${w} at ${String(at).replace(/^[a-z]+:/,'').replace(/-/g,' ')}.`:`I work as ${w}.`}
// {name, text}: what the person says. day and minute from the game clock; weather is the weather id; place is 'bench'|'shop'|'diner'|'road'.
export function chatLine(person,{day=1,minute=0,weather='clear',place=''}={}){
 const name=typeof person?.name==='string'&&person.name?person.name:'A neighbour',id=String(person?.id||name),period=periodOf(minute),hour=Math.floor((Number(minute)||0)/60);
 const parts=[pick(GREETINGS[period],id,day,'g'),`I'm ${name}.`],home=homeName(person),work=workPhrase(person);
 if(place&&PLACE_REMARKS[place]){parts.push(pick(PLACE_REMARKS[place],id,day,hour,place));return {name,text:parts.join(' ')}}
 const extras=[];if(home)extras.push(`I live at ${home}.`);if(work)extras.push(work);extras.push(pick(WEATHER_REMARKS[weather]||WEATHER_REMARKS.clear,id,day,hour,'w'));extras.push(pick(PLACE_REMARKS.road,id,day,hour,'road'));
 parts.push(extras[hash(id,day,'x')%extras.length]);
 return {name,text:parts.join(' ')};
}
