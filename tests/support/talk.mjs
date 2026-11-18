// Test helper for the docked talk panel (#talk, dist/talk-panel.js): read the transcript and pick a reply by its label, never by position (conversation-design C6).
// ids is the game's id -> element map (boot-game.mjs or startup.mjs); press(code) sends one keydown with that code.
const find=(el,cls)=>{for(const c of el?.children||[]){if(String(c.className||'').split(' ').includes(cls))return c;const f=find(c,cls);if(f)return f}return null};
const labelOf=b=>String(find(b,'talk-label')?.textContent??'');
export const talkOpen=ids=>ids.get('talk').hidden===false;
export const talkName=ids=>String(find(ids.get('talk'),'talk-name')?.textContent??'');
export const talkLines=ids=>(find(ids.get('talk'),'talk-log')?.children||[]).map(c=>String(c.textContent??''));
export const talkText=ids=>talkLines(ids).join(' ');
export const talkReplies=ids=>(find(ids.get('talk'),'talk-replies')?.children||[]).map(labelOf);
// clicks the first reply whose label matches re (throws with the offered labels when none does)
export function reply(ids,re){
 const b=(find(ids.get('talk'),'talk-replies')?.children||[]).find(x=>re.test(labelOf(x)));
 if(!b)throw new Error('no reply '+re+' among: '+talkReplies(ids).join(' | ')+' · transcript: '+talkText(ids));
 b.dispatchEvent(new Event('click'));return labelOf(b);
}
// Esc until the panel is closed ("See you", then Continue); true when it closed
export function closeTalk(ids,press){for(let i=0;i<3&&talkOpen(ids);i++)press('Escape');return !talkOpen(ids)}
