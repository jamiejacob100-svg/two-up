// --- Store (facade) --------------------------------------------------------
// Picks the local backend (demo mode) or the Supabase backend (when
// configured) for places + plans. The Supabase module is imported lazily so
// demo mode never loads the Supabase library. The "saved for later" shortlist
// and the day draft stay in localStorage in both modes (personal, ephemeral).

import { DEMO_MODE } from "./config.js";
import * as localDb from "./db.local.js";

export const uid = localDb.uid;

let supaDb = null;
async function db() {
  if (DEMO_MODE) return localDb;
  if (!supaDb) supaDb = await import("./db.supabase.js");
  return supaDb;
}

// --- Places + plans (backend-dependent) ---
export async function getPlaces()      { return (await db()).getPlaces(); }
export async function getPlace(id)     { return (await db()).getPlace(id); }
export async function addPlace(p)      { return (await db()).addPlace(p); }
export async function updatePlace(id, p){ return (await db()).updatePlace(id, p); }
export async function deletePlace(id)  { return (await db()).deletePlace(id); }
export async function getPlans()       { return (await db()).getPlans(); }
export async function getPlan(id)      { return (await db()).getPlan(id); }
export async function savePlan(p)      { return (await db()).savePlan(p); }
export async function deletePlan(id)   { return (await db()).deletePlan(id); }

// --- Memories (photos taken at places) ---
export async function getMemories()    { return (await db()).getMemories(); }
export async function addMemory(m)     { return (await db()).addMemory(m); }
export async function deleteMemory(id) { return (await db()).deleteMemory(id); }

// --- Category photos ---------------------------------------------------------
// One shared photo per category. Kept out of the big places query so loading the
// app stays fast. Cached in memory for the session and in localStorage so the
// second open is instant (fetched fresh in the background).
const LS_CATPHOTO_CACHE = "twoup.catphoto.cache.v1";
let _catPhotos = null;

export async function loadCategoryPhotos() {
  if (_catPhotos) return _catPhotos;
  try { _catPhotos = JSON.parse(localStorage.getItem(LS_CATPHOTO_CACHE)) || null; } catch {}
  const refresh = (async () => {
    try {
      const fresh = await (await db()).getCategoryPhotos();
      _catPhotos = fresh;
      try { localStorage.setItem(LS_CATPHOTO_CACHE, JSON.stringify(fresh)); } catch {}
    } catch { /* offline / table missing — keep whatever we have */ }
  })();
  if (!_catPhotos) await refresh;        // first ever load: wait; otherwise refresh in background
  return _catPhotos || {};
}
export function categoryPhoto(cat) { return (_catPhotos && _catPhotos[cat]) || null; }
export async function setCategoryPhoto(category, photo_url) {
  await (await db()).setCategoryPhoto(category, photo_url);
  _catPhotos = _catPhotos || {};
  _catPhotos[category] = photo_url;
  try { localStorage.setItem(LS_CATPHOTO_CACHE, JSON.stringify(_catPhotos)); } catch {}
}

// --- Saved for later (always local) ---
const LS_SAVED = "twoup.saved.v1";
function readSaved()  { try { return JSON.parse(localStorage.getItem(LS_SAVED)) ?? []; } catch { return []; } }
function writeSaved(v) { try { localStorage.setItem(LS_SAVED, JSON.stringify(v)); } catch {} }

export function getSavedIds() { return readSaved(); }
export async function getSavedPlaces() {
  const ids = readSaved();
  const all = await getPlaces();
  return ids.map(id => all.find(p => p.id === id)).filter(Boolean).reverse();
}
export async function addSaved(id) {
  const s = readSaved();
  if (!s.includes(id)) { s.push(id); writeSaved(s); }
}
export async function removeSaved(id) {
  writeSaved(readSaved().filter(x => x !== id));
}
export function isSaved(id) { return readSaved().includes(id); }
