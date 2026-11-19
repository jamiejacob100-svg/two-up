// --- Config ----------------------------------------------------------------
// Phase 1 ships in DEMO MODE: both fields below are left empty, so the app
// runs entirely on local sample data with no backend.
//
// In Phase 2 (Supabase + auth), paste your project URL and the *anon* key here.
// The anon key is safe in frontend code — Row Level Security protects the data.
// NEVER put the Google key or the Supabase service-role key in this file.

export const SUPABASE_URL = "https://kpvjngbrwcoylfhsjgds.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_QXYc7TPJrZ_UKC1ed1G64A_6VKHyMXG";

// Demo mode is on whenever Supabase isn't configured yet.
export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// Google place data (photos, reviews, live hours, search) comes from the
// Edge Function. Leave this false to run fully without Google — add places
// by hand. Flip to true once you've deployed the `places` function with a
// GOOGLE_PLACES_KEY (SETUP.md, Phase 3).
export const GOOGLE_ENABLED = false;

// App meta
export const APP_NAME = "M❤️J";
export const CITY = "Sydney";

// Web-push public (VAPID) key — safe in frontend. The matching private key lives
// only as a secret in your Supabase Edge Function. Empty = notifications off.
export const VAPID_PUBLIC = "BKnnKjWuR5qmfQwEEF9hxujmKwtHDML80vzDnX8BQweeG9JULHAgnNIsa3MerpUCH7gJnlvXe5pGxLuBRzCHgRo";
