// The game's name, in ONE place. It is a placeholder for now ('City Life'): change GAME_NAME here and the title, the menu, the HUD logo, the credits and the
// save-file messages all follow. index.html keeps the same words as its no-script fallback (tests/game-name.mjs checks they match).
export const GAME_NAME='City Life',GAME_SUBTITLE='First Block';
export const pageTitle=(name=GAME_NAME)=>`${name} · ${GAME_SUBTITLE}`;
// Writes the name into the page: <title>, and every element marked data-game-name="text" (the words) or "upper" (the logo's first text, in capitals; its <span> stays).
export function applyGameName(doc=typeof document!=='undefined'?document:null,name=GAME_NAME){
 if(!doc||typeof doc.querySelectorAll!=='function')return false;
 try{
  doc.title=pageTitle(name);
  for(const el of doc.querySelectorAll('[data-game-name]')){
   const upper=el.getAttribute('data-game-name')==='upper';
   if(upper){const text=[...el.childNodes].find(n=>n.nodeType===3);if(text)text.nodeValue=name.toUpperCase()}else el.textContent=name;
  }
  return true;
 }catch{return false}
}
// Runs when the page loads this module (main-menu.js imports it); the elements already exist because the scripts load after the markup.
if(typeof document!=='undefined'&&typeof document.querySelectorAll==='function'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>applyGameName(),{once:true});else applyGameName();
}
