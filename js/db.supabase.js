// --- Supabase backend (live mode) -----------------------------------------
// Loaded lazily by store.js only when Supabase is configured, so demo mode
// never pulls in the Supabase client. Same API shape as db.local.js.

import { supabase } from "./supabase.js";

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// --- Places ---
export async function getPlaces() {
  const { data, error } = await supabase
    .from("places").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function getPlace(id) {
  const { data, error } = await supabase.from("places").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function addPlace(place) {
  const added_by = await currentUserId();
  const row = {
    google_place_id: place.google_place_id || null,
    name: place.name,
    category: place.category,
    area: place.area || null,
    est_cost_for_two: place.est_cost_for_two ?? null,
    vibe: place.vibe || [],
    setting: place.setting || "either",
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    our_notes: place.our_notes || "",
    our_rating: place.our_rating ?? null,
    added_by,
  };
  // Only touch the newer columns when there's a value — so a basic add still
  // works before the photo_url/hours columns have been added (SETUP step).
  if (place.photo_url) row.photo_url = place.photo_url;
  if (place.hours) row.hours = place.hours;
  if (place.deals && Object.keys(place.deals).length) row.deals = place.deals;
  if (place.cuisine) row.cuisine = place.cuisine;
  if (place.zone) row.zone = place.zone;
  if (place.treat) row.treat = place.treat;
  const { data, error } = await supabase.from("places").insert(row).select().single();
  if (error) throw error;
  return data;
}
export async function updatePlace(id, patch) {
  // Only send the fields present in `patch` — so a basic edit never touches the
  // optional cuisine/deals columns unless the caller included them.
  const allowed = ["name","category","area","est_cost_for_two","vibe","setting",
                   "our_notes","our_rating","photo_url","hours","deals","cuisine","zone","treat","google_place_id"];
  const row = {};
  for (const k of allowed) if (patch[k] !== undefined) row[k] = patch[k];
  const { data, error } = await supabase.from("places").update(row).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deletePlace(id) {
  const { error } = await supabase.from("places").delete().eq("id", id);
  if (error) throw error;
}

// --- Plans ---
export async function getPlans() {
  const { data, error } = await supabase
    .from("plans").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function getPlan(id) {
  const { data, error } = await supabase.from("plans").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function savePlan(plan) {
  const row = {
    title: plan.title || null,
    date: plan.date || null,
    mode: plan.mode || "together",
    template: plan.template || null,
    stops: plan.stops || [],
    plan_hints: plan.plan_hints || null,
    budget: plan.budget ?? null,
  };
  if (plan.id) {
    const { error } = await supabase.from("plans").update(row).eq("id", plan.id);
    if (error) throw error;
    return plan.id;
  }
  row.created_by = await currentUserId();
  const { data, error } = await supabase.from("plans").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}
export async function deletePlan(id) {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}

// --- Memories (photos taken at a place) ---
export async function getMemories() {
  const { data, error } = await supabase
    .from("memories").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function addMemory({ place_id, place_name, photo_url }) {
  const created_by = await currentUserId();
  const row = { place_id: place_id || null, place_name, photo_url, created_by };
  const { data, error } = await supabase.from("memories").insert(row).select().single();
  if (error) throw error;
  return data;
}
export async function deleteMemory(id) {
  const { error } = await supabase.from("memories").delete().eq("id", id);
  if (error) throw error;
}

// --- Category photos (one shared photo per category, kept tiny & separate so
// the main places query stays light) ---
export async function getCategoryPhotos() {
  const { data, error } = await supabase.from("category_photos").select("category,photo_url");
  if (error) throw error;
  return Object.fromEntries((data || []).map(r => [r.category, r.photo_url]));
}
export async function setCategoryPhoto(category, photo_url) {
  const { error } = await supabase.from("category_photos")
    .upsert({ category, photo_url, updated_at: new Date().toISOString() }, { onConflict: "category" });
  if (error) throw error;
}
