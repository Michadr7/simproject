// Runs every tests/*.mjs file in its own Node process (works on Windows, macOS and Linux).
// TEST1: a file that fails is run once more, alone, and BOTH results are printed. A file that passes the second time still counts as passed but is NAMED ("PASSED ON RETRY ... (flaky)", in the log and in the summary), so a flake is never hidden. A file that fails twice fails the run (exit code 1).
// The last lines of every run are the summary: "FAILED FILES: a.mjs, b.mjs" (or "ALL n PASSED"), then the flaky list. Grep the whole output for "FAILED FILES" / "PASSED ON RETRY"; do not rely on the last lines of a log alone.
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir('tests')).filter(f=>f.endsWith('.mjs')).sort();
const run=file=>{const t=Date.now(),r=spawnSync(process.execPath,[`tests/${file}`],{encoding:'utf8',maxBuffer:64*1024*1024});return {ok:r.status===0,out:((r.stdout||'')+(r.stderr||'')+(r.error?'\n'+r.error.message:'')).trim().split('\n'),ms:Date.now()-t}};
const brief=r=>r.out.filter(l=>l&&!l.startsWith('[map-bake]')).slice(-14).join('\n'); // the end of a failed output, without the bake noise
const failed=[],flaky=[];
for(const file of files){
 const r1=run(file);
 if(r1.ok){console.log(`PASS ${file}: ${r1.out.at(-1)}`);continue}
 console.log(`FIRST RUN FAILED ${file} (${r1.ms} ms), retrying once:\n${brief(r1)}`);
 const r2=run(file);
 if(r2.ok){flaky.push(file);console.log(`PASSED ON RETRY: ${file} (flaky): ${r2.out.at(-1)}`)}
 else{failed.push(file);console.log(`FAIL ${file}\nfailed twice. Second run:\n${brief(r2)}`)}
}
console.log('');
console.log(failed.length?`FAILED FILES: ${failed.join(', ')}`:`ALL ${files.length} PASSED`+(flaky.length?' (some only on retry)':''));
if(flaky.length)console.log(`PASSED ON RETRY (flaky, still counted as passed): ${flaky.join(', ')}`);
// the two lines below keep the exact wording the hub (hub/jobs.js summarise) and the version bump parse
console.log(failed.length?`${failed.length} of ${files.length} test files failed.`:`All ${files.length} test files passed.`);
process.exitCode=failed.length?1:0;
