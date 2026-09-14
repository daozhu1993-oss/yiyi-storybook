import {readingStore} from "./reading-store.js";
/* Profiles: up to three children on one device, each with a name, a birth date and a favourite
   hero for an avatar, and each with their own reading progress, page stars, pins, quiz answers
   and points. The list lives in localStorage under `storylight-profiles`; a child's progress
   and souvenirs live under `storylight-progress:<id>` and `storylight-souvenirs:<id>`. A device
   that read before profiles existed keeps everything it had: the first profile takes it over. */

export const MAX_PROFILES = 3;
const KEY = "storylight-profiles";
const LEGACY = { progress: "storylight-progress", souvenirs: "storylight-souvenirs" };
const validId = value => typeof value === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(value)
  && !["constructor", "prototype"].includes(value);
const safeName = value => typeof value === "string" ? value.trim().slice(0, 24) : "";
const safeAvatar = value => typeof value === "string" && /^[a-z0-9-]{1,64}$/.test(value) ? value : "otto-shy-moon";
function safeBirthday(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

// Synced JSON is writable by its owning parent. Treat nested values as untrusted
// before using IDs in markup, storage keys, or progress lookups.
export function normalizeProfiles(value) {
  const list = [], seen = new Set();
  for (const profile of Array.isArray(value?.list) ? value.list : []) {
    if (!profile || !validId(profile.id) || seen.has(profile.id)) continue;
    seen.add(profile.id);
    list.push({id:profile.id, name:safeName(profile.name), birthday:safeBirthday(profile.birthday),
      avatar:safeAvatar(profile.avatar), created:Number.isFinite(profile.created) && profile.created >= 0 ? profile.created : 0});
    if (list.length === MAX_PROFILES) break;
  }
  return {active:list.some(profile => profile.id === value?.active) ? value.active : list[0]?.id || null, list};
}

function read(key, fallback) {
  try { return JSON.parse(readingStore.getItem(key) || "null") ?? fallback; } catch (error) { return fallback; }
}

/** Years and months since a birthday ("YYYY-MM-DD"); null when there is none. */
export function ageOf(birthday) {
  if (!birthday) return null;
  const b = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) return null;
  return { years: Math.floor(months / 12), months };
}

export class Profiles {
  constructor() {
    this.data = normalizeProfiles(read(KEY, null));
    if (!this.data.list.length) this.adopt();
    if (!this.get(this.data.active)) this.data.active = this.data.list[0].id;
  }

  save() {
    try { readingStore.setItem(KEY, JSON.stringify(this.data)); } catch (error) { /* private mode */ }
  }

  get list() { return this.data.list; }
  get active() { return this.get(this.data.active) || this.data.list[0]; }
  get(id) { return this.data.list.find((p) => p.id === id) || null; }

  /** Storage keys of one child's progress and souvenirs. */
  keys(id) { return { progress: `${LEGACY.progress}:${id}`, souvenirs: `${LEGACY.souvenirs}:${id}` }; }

  /** The first profile: takes over whatever this device had read before there were profiles. */
  adopt() {
    const p = this.add({ name: "", birthday: "", avatar: "otto-shy-moon" });
    try {
      for (const [kind, legacy] of Object.entries(LEGACY)) {
        const value = readingStore.getItem(legacy);
        if (value != null) { readingStore.setItem(this.keys(p.id)[kind], value); readingStore.removeItem(legacy); }
      }
    } catch (error) { /* private mode */ }
    this.data.active = p.id;
    this.save();
  }

  add({ name = "", birthday = "", avatar = "otto-shy-moon" } = {}) {
    if (this.data.list.length >= MAX_PROFILES) return null;
    const id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
    const profile = { id, name: safeName(name), birthday: safeBirthday(birthday), avatar: safeAvatar(avatar), created: Date.now() };
    this.data.list.push(profile);
    if (!this.data.active) this.data.active = id;
    this.save();
    return profile;
  }

  update(id, patch) {
    const p = this.get(id);
    if (!p) return null;
    if (patch.name != null) p.name = safeName(patch.name);
    if (patch.birthday != null) p.birthday = safeBirthday(patch.birthday);
    if (patch.avatar) p.avatar = safeAvatar(patch.avatar);
    this.save();
    return p;
  }

  /** Forget a child and everything they read. The last profile cannot go. */
  remove(id) {
    if (this.data.list.length <= 1 || !this.get(id)) return false;
    this.data.list = this.data.list.filter((p) => p.id !== id);
    try { for (const key of Object.values(this.keys(id))) readingStore.removeItem(key); } catch (error) { /* private mode */ }
    if (this.data.active === id) this.data.active = this.data.list[0].id;
    this.save();
    return true;
  }

  setActive(id) {
    if (!this.get(id) || this.data.active === id) return false;
    this.data.active = id;
    this.save();
    return true;
  }
}
