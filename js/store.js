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
export async function getPlans()       { return (await db()).getPlans(); }
export async function getPlan(id)      { return (await db()).getPlan(id); }
export async function savePlan(p)      { return (await db()).savePlan(p); }
export async function deletePlan(id)   { return (await db()).deletePlan(id); }

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
