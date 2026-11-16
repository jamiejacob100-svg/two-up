// ============================================================
// Two Up — "places" Edge Function (Phase 3)
// The ONLY place the Google Places API key is ever used. The browser calls
// this function with the logged-in user's JWT; the function calls Google and
// enforces daily caps so the two of you stay within the free tier ($0).
//
// Deploy from the Supabase dashboard (Edge Functions → create "places"), then
// add the secret:  GOOGLE_PLACES_KEY = <your restricted key>
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by Supabase — you don't set those.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Daily caps ≈ monthly free allowance ÷ 31, kept conservative to stay at $0.
const CAPS: Record<string, number> = { search: 150, photo: 30, details: 30 };

// Sydney, for biasing search results.
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // 1) Require a logged-in user (their JWT comes in the Authorization header).
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    const { action, query, placeId } = await req.json();
    if (!(action in CAPS)) return json({ error: "Unknown action" }, 400);

    // 2) Enforce the daily cap for this call type (service role bypasses RLS).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    if (await overCap(admin, action, CAPS[action])) return json({ capped: true });

    // 3) Call Google.
    if (action === "search")  return json(await googleSearch(query));
    if (action === "photo")   return json(await googlePhoto(placeId));
    if (action === "details") return json(await googleDetails(placeId));
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// --- Daily cap bookkeeping (api_usage table) ---
async function overCap(admin: ReturnType<typeof createClient>, kind: string, cap: number) {
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("api_usage").select("count").eq("day", day).eq("kind", kind).maybeSingle();
  const current = (data?.count as number) ?? 0;
  if (current >= cap) return true;
  await admin.from("api_usage").upsert({ day, kind, count: current + 1 });
  return false;
}

// --- Google Places API (New) ---
const GP = "https://places.googleapis.com/v1";

async function googleSearch(query: string) {
  const r = await fetch(`${GP}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 8,
      regionCode: "AU",
      locationBias: { circle: { center: SYDNEY, radius: 40000 } },
    }),
  });
  const d = await r.json();
  if (!r.ok) return { error: d.error?.message || "Search failed", results: [] };
  return {
    results: (d.places || []).map((p: any) => ({
      google_place_id: p.id,
      name: p.displayName?.text || "",
      address: p.formattedAddress || "",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    })),
  };
}

async function googlePhoto(placeId: string) {
  // One small photo per place. Ask only for the photos field, then the media.
  const det = await fetch(`${GP}/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": "photos" },
  });
  const dd = await det.json();
  const photoName = dd.photos?.[0]?.name;
  if (!photoName) return { photoUri: null };
  // skipHttpRedirect returns JSON with a temporary googleusercontent URL that
  // needs no API key — the browser can load it directly.
  const ph = await fetch(`${GP}/${photoName}/media?maxWidthPx=400&skipHttpRedirect=true`, {
    headers: { "X-Goog-Api-Key": GOOGLE_KEY },
  });
  const pd = await ph.json();
  return { photoUri: pd.photoUri || null };
}

async function googleDetails(placeId: string) {
  const r = await fetch(`${GP}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask":
        "rating,userRatingCount,priceLevel,currentOpeningHours.openNow,currentOpeningHours.weekdayDescriptions,googleMapsUri,reviews",
    },
  });
  const d = await r.json();
  if (!r.ok) return { error: d.error?.message || "Details failed" };
  return {
    rating: d.rating ?? null,
    userRatingCount: d.userRatingCount ?? null,
    priceLevel: d.priceLevel ?? null,
    googleMapsUri: d.googleMapsUri ?? null,
    openingHours: d.currentOpeningHours
      ? { openNow: d.currentOpeningHours.openNow, week: d.currentOpeningHours.weekdayDescriptions || [] }
      : null,
    reviews: (d.reviews || []).slice(0, 3).map((rv: any) => ({
      author: rv.authorAttribution?.displayName || "Google user",
      authorUri: rv.authorAttribution?.uri || null,
      rating: rv.rating ?? null,
      text: rv.text?.text || rv.originalText?.text || "",
      when: rv.relativePublishingTimeDescription || "",
    })),
  };
}
