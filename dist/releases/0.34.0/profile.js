import {loadProgress, normalizeProgress} from './jobs.js';
import {loadAppearance} from './appearance.js';
const PROFILE_KEY = 'citylife.profile.v1';
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
