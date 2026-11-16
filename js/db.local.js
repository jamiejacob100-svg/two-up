// --- Local backend (demo mode) --------------------------------------------
// Places = DEMO_PLACES + anything added, in localStorage. Plans in localStorage.
// Same async shape as db.supabase.js so store.js can swap between them.

import { DEMO_PLACES } from "./data.js";

const LS_PLACES = "twoup.places.v1"; // user-added places
const LS_PLANS  = "twoup.plans.v1";  // saved plans

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

// --- Places ---
export async function getPlaces() {
  return [...DEMO_PLACES, ...read(LS_PLACES, [])];
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
