// The save file envelope's name and version, shared by the game (save-file.js) and the Worker (worker/accounts.js), which must not import the game.
export const SAVE_FORMAT='edenridge-save',SAVE_FORMAT_VERSION=1,LEGACY_SAVE_FORMATS=['citylife-save']; // files exported before the Eden Ridge rename say citylife-save: still accepted
export const isSaveFormat=f=>f===SAVE_FORMAT||LEGACY_SAVE_FORMATS.includes(f);
