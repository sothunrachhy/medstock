import { AUTH_LIMITS } from '../../../shared/schemas/index.js';
import Setting from '../models/Setting.js';
import { HttpError } from '../utils/http.js';

export const AUTH_DEFAULTS = {
  sessionTimeoutHours: 12, // how long a login stays valid
  minPasswordLength: 6,
  maxFailedAttempts: 5, // 0 = never lock accounts
  lockoutMinutes: 15,
};

// allowed range for each setting (shared with the settings form)
const LIMITS = AUTH_LIMITS;

// Cached briefly: on Vercel several server instances run at once, so a change made
// through one instance must reach the others within a minute.
const CACHE_MS = 60 * 1000;
let cache = null;
let cachedAt = 0;

export async function getAuthSettings() {
  if (!cache || Date.now() - cachedAt > CACHE_MS) {
    const doc = await Setting.findOne({ key: 'auth' }).lean();
    cache = { ...AUTH_DEFAULTS, ...(doc?.value || {}) };
    cachedAt = Date.now();
  }
  return cache;
}

/** Test helper: forget the cached settings. */
export function clearAuthSettingsCache() {
  cache = null;
}

export async function updateAuthSettings(input, userId) {
  const current = await getAuthSettings();
  const next = { ...current };
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    if (input[field] === undefined) continue;
    const n = Number(input[field]);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new HttpError(400, `${field} must be a whole number between ${min} and ${max}`);
    }
    next[field] = n;
  }
  await Setting.updateOne({ key: 'auth' }, { value: next, updatedBy: userId }, { upsert: true });
  cache = next;
  cachedAt = Date.now();
  return next;
}

export async function assertPasswordPolicy(password) {
  const { minPasswordLength } = await getAuthSettings();
  if (!password || String(password).length < minPasswordLength) {
    throw new HttpError(400, `Password must be at least ${minPasswordLength} characters`);
  }
}
