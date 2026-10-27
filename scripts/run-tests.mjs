// Runs every tests/*.mjs file in its own Node process (works on Windows, macOS and Linux).
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir('tests')).filter(f=>f.endsWith('.mjs')).sort();
let failed=0;
for(const file of files){
 const r=spawnSync(process.execPath,[`tests/${file}`],{encoding:'utf8'});
 const out=(r.stdout+r.stderr).trim().split('\n');
 if(r.status===0)console.log(`PASS ${file}: ${out.at(-1)}`);
 else{failed++;console.log(`FAIL ${file}\n${out.join('\n')}`)}
}
console.log(failed?`${failed} of ${files.length} test files failed.`:`All ${files.length} test files passed.`);
process.exitCode=failed?1:0;
