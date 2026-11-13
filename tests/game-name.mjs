// The game's name is one constant (dist/game-name.js); the page, the credits and the save-file messages use it.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {GAME_NAME,pageTitle,applyGameName} from '../dist/game-name.js';
import {readSaveFile} from '../dist/save-file.js';

assert.equal(GAME_NAME,'City Life','still the placeholder');
assert.equal(pageTitle(),'City Life · First Block');

// applyGameName writes a new name into every marked element and the title (a fake page: no DOM in Node).
const node=(attr,text)=>({getAttribute:()=>attr,childNodes:[{nodeType:3,nodeValue:text},{nodeType:1}],textContent:text});
const logo=node('upper','CITY LIFE'),h1=node('text','City Life'),doc={title:'',querySelectorAll:()=>[logo,h1]};
assert.equal(applyGameName(doc,'Pine Ridge'),true);
assert.equal(doc.title,'Pine Ridge · First Block');assert.equal(logo.childNodes[0].nodeValue,'PINE RIDGE');assert.equal(logo.childNodes[1].nodeType,1,'the logo keeps its second line');assert.equal(h1.textContent,'Pine Ridge');
assert.equal(applyGameName(null),false,'no page: nothing happens, no error');

// index.html keeps the same words for the moment before the script runs, and marks where the name goes.
const html=await readFile('dist/index.html','utf8');
assert(html.includes(`<title>${pageTitle()}</title>`),'the title matches');
assert(html.includes(`data-game-name="upper">${GAME_NAME.toUpperCase()}<span>`),'the HUD logo is marked');
assert(html.includes(`<h1 data-game-name="text">${GAME_NAME}</h1>`),'the menu title is marked');
assert(html.includes(`<span data-game-name="text">${GAME_NAME}</span> is built`),'the credits note is marked');
assert.equal((html.match(new RegExp(GAME_NAME,'gi'))||[]).length,4,'no other copy of the name in the page (title, logo, menu title, credits)');

// No other module spells the name out: the constant is the only place.
const hard=[];for(const f of (await readdir('dist')).filter(f=>f.endsWith('.js')&&f!=='game-name.js')){const text=await readFile('dist/'+f,'utf8');if(/city life/i.test(text.replace(/\/\/.*$/gm,'')))hard.push(f)}
assert.deepEqual(hard,[],'the game name is only written in game-name.js');

// The save-file messages use it.
assert.match(readSaveFile('{"format":"other"}').error,new RegExp(`not a ${GAME_NAME} save`));
console.log('game-name ok');
