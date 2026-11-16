michadr.

# LZ1: farm props moved to a lazy module

## Sizes
- dist/props-assets.js: 13,295,747 bytes (12.68 MB) before, 4,890,864 bytes (4.66 MB) after (86 props).
- dist/props-assets-farm.js (new, lazy): 8,405,172 bytes (8.02 MB), 63 farm.* props. The startup module is now about 4.7 MB, below the 5.5 MB target.
- The packaged release (dist/releases/0.35.9) was rebuilt with --force and contains the new file. The release script copies every dist/*.js, so it needed no change.

## What changed
- scripts/build-props.mjs: rebuilds now write dist/props-assets.js (PROPS, no farm ids) and dist/props-assets-farm.js (FARM_PROPS, ids starting 'farm.'). The `--only` mode keeps the old records of both files.
- dist/props.js (now 70 lines):
  - New exports: `ensureFarmProps()` (async, dynamic import, one shared load, retries after a failure), `farmPropsLoaded()`, `isFarmProp(id)`.
  - `propInfo` looks in PROPS, then the loaded farm records.
  - Before loading, `propInfo('farm.x')` throws "Farm prop farm.x is not loaded yet: await ensureFarmProps() first".
  - `createProp` returns an empty Group (`userData.pending`) and `createPropInstances` returns a zero-count InstancedMesh, so nothing crashes.
- No dist code outside props.js reads farm ids, and no landmark in the map uses one. So game.js, world.js and the other forbidden files were NOT touched. The only future caller needed is `await ensureFarmProps()` before the first farm placement.
- hub/assets-load.mjs and hub/assets.js: the asset browser now also loads props-assets-farm and merges it, and farm ids report module 'props-assets-farm.js'.
- Tests:
  - New tests/farm-lazy.mjs: no farm ids in props-assets.js, the clear error and the no-crash paths before loading, one shared load, real meshes after.
  - tests/farm-props.mjs, tests/sr90-props.mjs and tests/credits.mjs now call ensureFarmProps() and/or merge FARM_PROPS with PROPS.
- ASSETS.md (2 lines) and assets-register.json (2 notes) now name props-assets-farm.js.
- Line counts: tests/farm-lazy.mjs 19, tests/farm-props.mjs 50, tests/sr90-props.mjs 63 (these two grew by 3 lines each), tests/credits.mjs 22, hub/assets-load.mjs about 60 (+3), hub/assets.js (+1 edit), scripts/build-props.mjs 298.

## Results
- `npm run index`: brief 2996 tokens (target 3000), index 30305 tokens (target 31500), 206 tests. The new file is indexed.
- `npm run release -- --force`: Packaged release 0.35.9: 175 files.
- `npm test`: "All 206 test files passed." Last lines were PASS for world.mjs and worker-relay.mjs, exit code 0.
- `node tests/farm-lazy.mjs`: "Lazy farm props: PASS (63 farm.* ids load on demand; nothing crashes before)".
- farm-props, sr90-props, credits and props also pass on their own.

## Could not verify
- Nothing was seen in a browser. The real dynamic import() over HTTP and the startup size were not measured live. Only file sizes were measured, and the Node tests import the module.
- I did not run scripts/build-props.mjs itself. The assets-src originals and TOOL_DIR are not available, and the existing data was split with a one-off node script that gives the same layout. The build script edit was checked by reading it only.
- Confidence: high for the split, props.js and the tests; medium for the build-script edit, since it was not run.

Not edited: notes/handoff.md, and none of the forbidden files.