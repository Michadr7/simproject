// Builds dist/damage-textures.js (VD3): runs headless Blender 5.2 on scripts/make-damage-textures.py (a tileable wear texture and a windscreen crack texture, both generated, own work) and embeds the two PNGs as data URIs.
//   node scripts/build-damage-textures.mjs [path to blender.exe]
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const blender=process.argv[2]||['C:/Program Files/Blender Foundation/Blender 5.2/blender.exe','blender'].find(p=>p==='blender'||existsSync(p));
const out=mkdtempSync(join(tmpdir(),'damage-tex-'));
const r=spawnSync(blender,['--background','--python','scripts/make-damage-textures.py','--',out],{stdio:'inherit'});
if(r.status!==0){console.error('Blender failed');process.exit(1)}
const uri=name=>'data:image/png;base64,'+readFileSync(join(out,name+'.png')).toString('base64');
const wear=uri('wear'),crack=uri('crack');
writeFileSync('dist/damage-textures.js',`// WRITTEN by scripts/build-damage-textures.mjs (headless Blender 5.2, scripts/make-damage-textures.py). Do not edit by hand. Own work.\n// WEAR: 256 px, tileable, R scratches, G grime, B paint chips. CRACK: 512 px grey spider-web.\nexport const WEAR_PNG='${wear}';\nexport const CRACK_PNG='${crack}';\n`);
console.log(`wear.png ${readFileSync(join(out,'wear.png')).length} bytes, crack.png ${readFileSync(join(out,'crack.png')).length} bytes -> dist/damage-textures.js`);
rmSync(out,{recursive:true,force:true});
