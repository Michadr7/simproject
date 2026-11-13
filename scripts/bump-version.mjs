// Mikkadr Hub 2.7.5: raise the version number (the first step of the "Bump version" job; the hub then makes the release and runs the tests).
// Started only from the Deploy page. The hub writes .hub/bump-request.json ({level, from, to, at}); this script checks it again by itself and changes package.json (and the two version lines at the top of package-lock.json) only when
// the current version is the one you saw, the new number is the right next one, and that version is already live. Output lines: `REFUSED <why>` (nothing changed) or `BUMPED {json}`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readLive} from '../hub/deploy-facts.mjs';
import {nextVersion,cmpVersion,LEVELS,CONFIRM_FRESH_MS} from '../hub/web/deploy-rules.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),reqFile=path.join(root,'.hub','bump-request.json');
const refuse=why=>{console.log('REFUSED '+why);process.exit(2)};
let req=null;try{req=JSON.parse(fs.readFileSync(reqFile,'utf8').replace(/^\uFEFF/,''))}catch{}
try{fs.unlinkSync(reqFile)}catch{} // one press, one bump
if(!req||!LEVELS.includes(req.level)||typeof req.from!=='string'||typeof req.to!=='string'||!Number.isFinite(req.at))refuse('The hub did not ask for a version change.');
if(Date.now()-req.at>CONFIRM_FRESH_MS)refuse('The request is more than 5 minutes old. Press Bump again.');
const pkgFile=path.join(root,'package.json'),text=fs.readFileSync(pkgFile,'utf8'),m=/"version"\s*:\s*"(\d+\.\d+\.\d+)"/.exec(text);
if(!m)refuse('package.json has no plain version number.');
if(m[1]!==req.from)refuse(`You saw ${req.from}, but package.json says ${m[1]}. Press Check again.`);
if(nextVersion(m[1],req.level)!==req.to)refuse(`${req.to} is not the next ${req.level} version after ${m[1]}.`);
const live=(await readLive()).live;
if(!live||!live.version)refuse('The live version could not be read, so the hub cannot tell whether '+m[1]+' was published.');
const c=cmpVersion(m[1],live.version);
if(c===1)refuse(`${m[1]} is not live yet (the live site has ${live.version}). Publish it first.`);
if(c===-1)refuse(`The live site (${live.version}) is newer than ${m[1]}.`);
if(fs.existsSync(path.join(root,'dist','releases',req.to)))refuse(`dist/releases/${req.to} already exists.`);
const sub=(t,from,to,at=0)=>{const i=t.indexOf(`"version": "${from}"`,at);return i<0?null:t.slice(0,i)+`"version": "${to}"`+t.slice(i+`"version": "${from}"`.length)};
const newPkg=sub(text,m[1],req.to);if(newPkg===null)refuse('Could not find the version line in package.json.');
fs.writeFileSync(pkgFile,newPkg);
const lockFile=path.join(root,'package-lock.json');
if(fs.existsSync(lockFile)){let l=fs.readFileSync(lockFile,'utf8'),a=sub(l,m[1],req.to);if(a!==null){const p=a.indexOf('"packages"'),b=p<0?null:sub(a,m[1],req.to,p);fs.writeFileSync(lockFile,b!==null?b:a)}}
console.log('BUMPED '+JSON.stringify({from:m[1],to:req.to,level:req.level}));