// --- Google place data via the Edge Function ------------------------------
// Never calls Google directly — always through the Supabase "places" function
// (which holds the key and enforces caps). Everything degrades gracefully:
// in demo mode, before the function is deployed, or when the daily cap is hit,
// callers just fall back to placeholders. Results are cached to avoid repeat
// calls (photos ~12 h, details for the session).

import { DEMO_MODE, GOOGLE_ENABLED } from "./config.js";

const OFF = DEMO_MODE || !GOOGLE_ENABLED; // Google not in use → every call no-ops

async function fn() { return (await import("./supabase.js")).supabase; }

async function invoke(body) {
  const supabase = await fn();
  const { data, error } = await supabase.functions.invoke("places", { body });
  if (error) throw error;
  if (data && data.error) throw new Error(data.error);
  return data; // may be { capped: true }
}

// --- Search (Add-place flow) ---
export async function searchPlaces(query) {
  if (OFF) return null;                  // caller uses demo/manual flow instead
  const d = await invoke({ action: "search", query });
  if (d.capped) return { capped: true };
  return { results: d.results || [] };
}

// --- Photo (browse cards) — cached ~12 h in localStorage ---
const PHOTO_TTL = 12 * 60 * 60 * 1000;
export async function placePhoto(placeId) {
  if (OFF || !placeId) return null;
  const key = "twoup.photo." + placeId;
  try {
    const hit = JSON.parse(localStorage.getItem(key) || "null");
    if (hit && Date.now() - hit.t < PHOTO_TTL) return hit.uri; // may be null (= "no photo", still cached)
  } catch {}
  try {
    const d = await invoke({ action: "photo", placeId });
    const uri = d.capped ? null : (d.photoUri || null);
    if (!d.capped) { try { localStorage.setItem(key, JSON.stringify({ uri, t: Date.now() })); } catch {} }
    return uri;
  } catch { return null; } // function not deployed yet, offline, etc.
}

// --- Details (on tap) — cached for the session ---
const _details = new Map();
export async function placeDetails(placeId) {
  if (OFF || !placeId) return null;
  if (_details.has(placeId)) return _details.get(placeId);
  try {
    const d = await invoke({ action: "details", placeId });
    if (d.capped) return { capped: true };      // don't cache a capped response
    _details.set(placeId, d);
    return d;
  } catch { return null; }
}

// Map Google's priceLevel enum to $ signs.
export function priceLevelSigns(level) {
  return ({
    PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "$", PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$", PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  })[level] || null;
}
