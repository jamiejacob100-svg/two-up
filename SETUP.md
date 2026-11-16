# SETUP — Two Up

Plain-language, click-by-click setup for the parts that come after Phase 1.
**You don't need any of this yet** — the app already runs in demo mode. Come
back here phase by phase. No prior experience with Supabase, Google Cloud or
GitHub is assumed.

- **Phase 2:** Supabase (database + login + saving) and GitHub Pages (public URL).
- **Phase 3:** Google Cloud (Places API) + the Supabase Edge Function.
- A golden rule: the **Google key** and the Supabase **service-role key** must
  NEVER go into the website code or the GitHub repo. The Supabase **anon key**
  is fine in the code (the database's Row Level Security protects your data).

---

## Phase 2a — Supabase (database, login, saving)

### 1. Create the project
1. Go to <https://supabase.com> and sign in (GitHub login is easiest).
2. Click **New project**. Give it a name (e.g. `two-up`), pick a strong
   database password (save it in your password manager), choose the **Sydney**
   region, and create it. Wait ~2 minutes for it to spin up.

### 2. Make the tables
1. In the left sidebar open **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this project, copy **all** of it, paste it
   into the query, and click **Run**. It creates the `places`, `plans` and
   `api_usage` tables and turns on Row Level Security so only logged-in users
   can read/write. (It's safe to re-run if you ever change it.)

### 3. Create your two accounts
1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter your email + a password, tick **Auto Confirm User**, create.
3. Repeat for the second account.

### 4. Turn OFF public sign-ups
1. Sidebar → **Authentication** → **Providers** → **Email**.
2. Make sure **Email** is enabled, but turn **"Allow new users to sign up"**
   **OFF**. (Only the two of you should ever have accounts.)
3. Leave **"Confirm email"** on; your two users are already auto-confirmed.

> We use **email + password**, not magic links. On iPhone a magic link opens
> Safari instead of the home-screen app, which breaks the login.

### 5. Copy your keys into the app
1. Sidebar → **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key.
3. Paste them into `js/config.js`:
   ```js
   export const SUPABASE_URL = "https://xxxx.supabase.co";
   export const SUPABASE_ANON_KEY = "eyJ...";   // the ANON key, not service_role
   ```
4. Save. The demo banner disappears and the app now talks to Supabase.
   **Never** paste the `service_role` key here.

---

## Phase 2b — GitHub Pages (your public URL)

1. Create a free account at <https://github.com> if you don't have one.
2. Click **New repository**. Name it (e.g. `two-up`), set it to **Public**
   (Pages needs this on the free plan — your *data* stays private in Supabase),
   create it.
3. Upload the files: on the repo page click **Add file → Upload files**, drag in
   everything from this `date-planner/` folder, and **Commit changes**.
4. Go to **Settings → Pages**. Under **Build and deployment → Source** choose
   **Deploy from a branch**, pick `main` and `/ (root)`, click **Save**.
5. Wait a minute, refresh; the page shows your live URL, like
   `https://yourname.github.io/two-up/`.
6. **Tell Supabase about that URL:** back in Supabase → **Authentication → URL
   Configuration**, set the **Site URL** to your Pages URL and add it under
   **Redirect URLs** too. (This lets login work on the live site.)

---

## Phase 3a — Google Cloud (Places API)

Goal: live photos, reviews, ratings and opening hours — while staying at **$0**.

### 1. Project + billing
1. Go to <https://console.cloud.google.com>, sign in, and create a **New Project**
   (top bar → project dropdown → **New Project**), name it `two-up`.
2. Google requires a billing account even for the free tier. Open **Billing**,
   add a card. You'll set a budget alert in step 4 so you never get surprised.

### 2. Enable the API
1. **APIs & Services → Library**, search **"Places API (New)"**, open it,
   click **Enable**. (Make sure it's the *New* one, not the legacy Places API.)

### 3. Make a restricted key
1. **APIs & Services → Credentials → Create credentials → API key**.
2. Click the new key → **Edit**.
3. Under **API restrictions** choose **Restrict key** and tick **Places API (New)**
   only.
4. Save. Copy the key — it goes into Supabase (next), **never** into this repo.

### 4. A $1 budget alert (safety net)
1. **Billing → Budgets & alerts → Create budget**.
2. Scope it to the `two-up` project, set the amount to **$1**, and set alert
   thresholds (e.g. 50% / 90% / 100%). You'll get an email if anything ever bills.

### Why we're careful about Google cost
Google bills each request at the **highest tier of any field** you ask for, and
the free allowance is per SKU per month (~1,000 free for Enterprise /
Enterprise + Atmosphere / Photos, ~5,000 for Pro). The app is built to stay free:
- Browse cards request **only the `photos` field**, then load one small photo.
- Reviews / rating / price / hours are fetched **only when a place is tapped**.
- Results are **cached** in the browser (cards ~12 h) to avoid repeat calls.
- The Edge Function enforces **daily caps** (≈ monthly free allowance ÷ 31) and
  returns a "capped" response the UI handles gracefully.

---

## Phase 3b — The Supabase Edge Function

This is the only thing that ever sees the Google key. The browser calls the
function (with the logged-in user's token); the function calls Google.

1. Supabase sidebar → **Edge Functions** → **Create a function**, name it
   exactly `places`. Open `supabase/functions/places/index.ts` from this
   project, copy **all** of it into the dashboard editor, and **Deploy**.
   (The name must be `places` — the app calls the function by that name.)
2. Add the Google key as a secret: **Edge Functions → Secrets** (or **Project
   Settings → Edge Functions**), add
   ```
   GOOGLE_PLACES_KEY = <the restricted key from Google>
   ```
3. The key lives only in Supabase, never in the website or on GitHub.
4. Finally, in `js/config.js` set **`GOOGLE_ENABLED = true`** and reload. (Left
   `false`, the app runs fully without Google — you add places by hand, which
   is the default.)

---

## Handy checklist

- [ ] Supabase project created (Sydney region)
- [ ] Tables + RLS created via SQL
- [ ] Two users created, **public sign-ups OFF**
- [ ] `SUPABASE_URL` + **anon** key in `js/config.js`
- [ ] Repo on GitHub, **Pages** enabled, URL added to Supabase auth settings
- [ ] Google Cloud project + billing + **$1 budget alert**
- [ ] **Places API (New)** enabled, key **restricted** to it
- [ ] Edge Function deployed with `GOOGLE_PLACES_KEY` secret
- [ ] Google key / service-role key are **NOT** in the repo
