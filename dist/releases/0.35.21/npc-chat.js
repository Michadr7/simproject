// NPC chat (notes/npc-movement-design.md N3, NPC-NAMES): a short, deterministic greeting for any named person of the crowd who has no roster dialogue (name, where they live, what they do, the time of day). Pure: no DOM, no globals, no Math.random/Date.now (choice is an integer hash of the person, the day and the hour).
import {MAP} from './map-definition.js';

export const GREETINGS=Object.freeze({morning:['Good morning.','Morning!','Early start today.'],afternoon:['Afternoon.','Hello there.','Hi.'],evening:['Evening.','Good evening.','Hello again.'],night:['Late one, isn\'t it?','Quiet out here tonight.','Evening, if you can call it that.']});
export const WEATHER_REMARKS=Object.freeze({rain:['Wet one today.','I forgot my umbrella.'],fog:['Hard to see the road in this fog.'],snow:['Mind the ice.'],clear:['Nice weather for it.','Not a bad day.']});
const hash=(...parts)=>{let h=2166136261;for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return h>>>0};
export const periodOf=minute=>{const h=Math.floor((((Number(minute)||0)%1440)+1440)%1440/60);return h>=5&&h<12?'morning':h>=12&&h<18?'afternoon':h>=18&&h<22?'evening':'night'};
const pick=(list,...seed)=>list[hash(...seed)%list.length];
// Where a person lives, as the map names it ('8 Cedar Loop'), or '' when the home is not a named property.
export function homeName(person){const id=String(person?.home||'').replace(/^property:/,'');const p=(MAP.properties||[]).find(x=>x.id===id);return p?.name||''}
// What they do: a short phrase, or '' (retired or at home).
export function workPhrase(person){const w=person?.role||person?.post;if(!w)return '';const at=person.employer||person.work;return at?`I work as ${w} at ${String(at).replace(/^[a-z]+:/,'').replace(/-/g,' ')}.`:`I work as ${w}.`}
// {name, text}: what the person says. day and minute from the game clock; weather is the weather id.
export function chatLine(person,{day=1,minute=0,weather='clear'}={}){
 const name=typeof person?.name==='string'&&person.name?person.name:'A neighbour',id=String(person?.id||name),period=periodOf(minute);
 const parts=[pick(GREETINGS[period],id,day,'g'),`I'm ${name}.`],home=homeName(person),work=workPhrase(person);
 const extras=[];if(home)extras.push(`I live at ${home}.`);if(work)extras.push(work);extras.push(pick(WEATHER_REMARKS[weather]||WEATHER_REMARKS.clear,id,day,Math.floor((Number(minute)||0)/60),'w'));
 parts.push(extras[hash(id,day,'x')%extras.length]);
 return {name,text:parts.join(' ')};
}