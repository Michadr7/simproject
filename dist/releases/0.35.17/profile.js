import './legacy-keys.js';
import {loadProgress, normalizeProgress} from './jobs.js';
import {loadAppearance} from './appearance.js';
export const PROFILE_KEY = 'edenridge.profile.v1';
// PB1 (Dev "Wipe player"): the browser keys that hold ONE player (profile + progress + character), under the current prefix and the old citylife. one (legacy-keys.js copies an old key back when the new one is empty, so both must go). Settings, audio, server address, sky tuning, the dev unlock, backups and cloud sync state are NOT player data and stay.
export const PLAYER_KEY_NAMES = ['profile.v1', 'progress.v1', 'character.v1'];
export const PLAYER_KEY_PREFIXES = ['edenridge.', 'citylife.'];
export function wipePlayerKeys(storage) {
  const removed = [];
  if (!storage || typeof storage.removeItem !== 'function') return removed;
  for (const prefix of PLAYER_KEY_PREFIXES) for (const name of PLAYER_KEY_NAMES) {
    try { if (storage.getItem(prefix + name) != null) removed.push(prefix + name); storage.removeItem(prefix + name); } catch { /* blocked storage: skip */ }
  }
  return removed;
}
let sessionProfile;
const storage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
};
function normalize(profile) {
  return {
    playerId: typeof profile.playerId === 'string' && profile.playerId ? profile.playerId : crypto.randomUUID(),
    name: typeof profile.name === 'string' ? profile.name.slice(0, 24) : '',
    progress: normalizeProgress(profile.progress)
  };
}
export function saveProfile(profileData) {
  sessionProfile = normalize(profileData);
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify({version: 1, ...sessionProfile}));
    return true;
  } catch { return false; }
}
export function loadProfile() {
  if (sessionProfile) return normalize(sessionProfile);
  try {
    const saved = JSON.parse(storage.getItem(PROFILE_KEY));
    if (saved?.version === 1) {
      sessionProfile = normalize(saved);
      return normalize(sessionProfile);
    }
  } catch { /* Missing or unavailable storage: migrate or keep a session profile. */ }
  const profile = normalize({
    progress: loadProgress(storage),
    name: loadAppearance(storage)?.name || ''
  });
  saveProfile(profile); // Persist the generated ID immediately.
  return normalize(profile);
}
