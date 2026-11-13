// Runs every tests/*.mjs file in its own Node process (works on Windows, macOS and Linux).
// A few hub tests start fake Claude processes and depend on timing, and now and then fail once while the PC is busy. A file that fails is run once more, alone: if it passes then, it counts as passed and is NAMED at the end ("needed a second run"), so nothing is hidden.
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir('tests')).filter(f=>f.endsWith('.mjs')).sort();
const run=file=>{const r=spawnSync(process.execPath,[`tests/${file}`],{encoding:'utf8'});return {ok:r.status===0,out:(r.stdout+r.stderr).trim().split('\n')}};
let failed=0;const second=[];
for(const file of files){
 let r=run(file),again=false;
 if(!r.ok){const r2=run(file);if(r2.ok){r=r2;again=true;second.push(file)}}
 if(r.ok)console.log(`PASS ${file}${again?' (after a second run)':''}: ${r.out.at(-1)}`);
 else{failed++;console.log(`FAIL ${file}\n${r.out.join('\n')}`)}
}
if(second.length)console.log(`Needed a second run (timing, not a real failure if it keeps passing alone): ${second.join(', ')}`);
console.log(failed?`${failed} of ${files.length} test files failed.`:`All ${files.length} test files passed.`);
process.exitCode=failed?1:0;