// --- Local backend (demo mode) --------------------------------------------
// Places = DEMO_PLACES + anything added, in localStorage. Plans in localStorage.
// Same async shape as db.supabase.js so store.js can swap between them.

import { DEMO_PLACES } from "./data.js";

const LS_PLACES    = "twoup.places.v1";    // user-added places
const LS_OVERRIDES = "twoup.place.ovr.v1"; // edits to any place (incl. demo seed)
const LS_DELETED   = "twoup.place.del.v1"; // ids of demo/seed places hidden by delete
const LS_PLANS     = "twoup.plans.v1";     // saved plans
const LS_MEMORIES  = "twoup.memories.v1";  // photos taken at places

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ }
}

export function uid(prefix = "x") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

export async function currentUserId() { return "me"; }

// --- Places ---
export async function getPlaces() {
  const ov = read(LS_OVERRIDES, {});
  const del = new Set(read(LS_DELETED, []));
  return [...DEMO_PLACES, ...read(LS_PLACES, [])]
    .filter(p => !del.has(p.id))
    .map(p => ov[p.id] ? { ...p, ...ov[p.id] } : p);
}
export async function getPlace(id) {
  return (await getPlaces()).find(p => p.id === id) || null;
}
export async function addPlace(place) {
  const added = read(LS_PLACES, []);
  const rec = { id: uid("p"), our_rating: null, our_notes: "", added_by: "me",
                created_at: new Date().toISOString(), ...place };
  added.push(rec);
  write(LS_PLACES, added);
  return rec;
}
export async function updatePlace(id, patch) {
  // Added places get patched in place; demo/seed places get an override layer
  // (so edits to them persist without mutating the hard-coded sample data).
  const added = read(LS_PLACES, []);
  const i = added.findIndex(p => p.id === id);
  if (i >= 0) { added[i] = { ...added[i], ...patch }; write(LS_PLACES, added); return added[i]; }
  const ov = read(LS_OVERRIDES, {});
  ov[id] = { ...(ov[id] || {}), ...patch };
  write(LS_OVERRIDES, ov);
  return { id, ...ov[id] };
}
export async function deletePlace(id) {
  // Added place: drop it outright. Demo/seed place: remember it as deleted.
  const added = read(LS_PLACES, []);
  const i = added.findIndex(p => p.id === id);
  if (i >= 0) { added.splice(i, 1); write(LS_PLACES, added); }
  else {
    const del = read(LS_DELETED, []);
    if (!del.includes(id)) { del.push(id); write(LS_DELETED, del); }
  }
  const ov = read(LS_OVERRIDES, {});
  if (ov[id]) { delete ov[id]; write(LS_OVERRIDES, ov); }
}

// --- Plans ---
export async function getPlans() {
  return read(LS_PLANS, []).sort((a, b) =>
    (b.updated_at || "").localeCompare(a.updated_at || ""));
}
export async function getPlan(id) {
  return read(LS_PLANS, []).find(p => p.id === id) || null;
}
export async function savePlan(plan) {
  const plans = read(LS_PLANS, []);
  const now = new Date().toISOString();
  const i = plans.findIndex(p => p.id === plan.id);
  if (i >= 0) {
    plans[i] = { ...plans[i], ...plan, updated_at: now };
  } else {
    plan.id = plan.id || uid("plan");
    plan.created_at = now;
    plan.updated_at = now;
    plans.push(plan);
  }
  write(LS_PLANS, plans);
  return plan.id;
}
export async function deletePlan(id) {
  write(LS_PLANS, read(LS_PLANS, []).filter(p => p.id !== id));
}

// --- Memories (photos taken at a place) ---
export async function getMemories() {
  return read(LS_MEMORIES, []).sort((a, b) =>
    (b.created_at || "").localeCompare(a.created_at || ""));
}
export async function addMemory({ place_id, place_name, photo_url }) {
  const mems = read(LS_MEMORIES, []);
  const rec = { id: uid("m"), place_id: place_id || null, place_name,
                photo_url, created_at: new Date().toISOString() };
  mems.push(rec);
  write(LS_MEMORIES, mems);
  return rec;
}
export async function deleteMemory(id) {
  write(LS_MEMORIES, read(LS_MEMORIES, []).filter(m => m.id !== id));
}

// --- Category photos (demo: localStorage) ---
const LS_CATPHOTOS = "twoup.catphotos.v1";
export async function getCategoryPhotos() { return read(LS_CATPHOTOS, {}); }
export async function setCategoryPhoto(category, photo_url) {
  const m = read(LS_CATPHOTOS, {});
  m[category] = photo_url;
  write(LS_CATPHOTOS, m);
}
