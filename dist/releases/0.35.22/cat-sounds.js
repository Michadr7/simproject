// Cat sounds (PET3; assets-src/sounds-cat/README.md, CC0): audio.cat() one-shots, levels.
const freeze=Object.freeze,shot=(clips,level,jitter=.05)=>freeze({clips:freeze(clips),level,jitter});
export const CAT_SHOTS=freeze({meow:shot(['cat-meow-1','cat-meow-2','cat-meow-3'],.55,.06),'meow-sad':shot(['cat-meow-sad'],.5,.03),purr:shot(['cat-purr'],.5,.02),eat:shot(['cat-eat'],.75,.04),hiss:shot(['cat-hiss'],.5,.04)});
export const CAT_FILES=freeze([...new Set(Object.values(CAT_SHOTS).flatMap(s=>s.clips))]);
export const MEOW_GAP=30; // game minutes between two hungry meows (the Meow clip comes back every minute while the cat is hungry and still)
