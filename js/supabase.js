// --- Supabase client -------------------------------------------------------
// Loaded only when Supabase is configured (see store.js / app.js lazy imports),
// so demo mode never fetches this module or the Supabase library.
// The anon key is safe in frontend code — Row Level Security protects the data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,       // stay logged in across app launches
    autoRefreshToken: true,
    detectSessionInUrl: false,  // we use email + password, not magic links
  },
});
