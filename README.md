# Two Up — date planner

A private date-planning app for two people in Sydney. It narrows down
"what should we do?" and can plan a whole day out. Plain HTML/CSS/JS,
no build step, deploys straight to GitHub Pages.

> **Status: Phase 1 — demo mode.** The whole UI runs on local sample data.
> No accounts, no backend, nothing to set up. Supabase + Google come later.

## Run it locally (right now)

Because the app loads JavaScript as ES modules, you can't just double-click
`index.html` — browsers block modules on `file://`. Serve the folder over a
tiny local web server instead. From inside this `date-planner/` folder:

```bash
python -m http.server 5173
```

Then open **http://localhost:5173** in your browser. (Any static server works —
e.g. `npx serve` if you have Node.)

On an iPhone, open that address in Safari on the same Wi-Fi (use your
computer's local IP instead of `localhost`), then **Share → Add to Home Screen**
to try it full-screen.

## What works in Phase 1

- **Pick** — set budget / time / category / vibe / indoor-outdoor, browse the
  filtered grid, tap any place for a detail sheet (photo, rating, reviews,
  price, hours, our notes, Directions, Add to day).
- **Narrowing** — *This or that* bracket, *Both pick* (pass the phone; coin flip
  on a tie), *Just decide* (one re-roll).
- **Plan** — pick a template (quick / evening / half / full day), it chains
  stops by what's nearby, shows travel estimates and a live budget meter, lets
  you swap any stop for 3 nearby alternatives, and flags stops outside opening
  hours. Save the plan.
- **Plans** — saved days, open to view/share (iOS share sheet), Surprise mode
  with time-based reveals, preview, delete.
- **Places** — all known places + an Add-place flow (search → tag with category,
  cost, vibe, setting, notes). Added places are stored in your browser.
- **PWA** — manifest, service worker (offline app shell), iPhone install hint.

Everything a place/plan you add is saved in your browser's local storage, so it
survives refreshes but lives only on that device until Phase 2 adds Supabase.

## Project layout

```
date-planner/
├─ index.html              app shell + bottom nav
├─ app.css                 all styles (light + dark)
├─ manifest.webmanifest    PWA manifest
├─ sw.js                   service worker (offline cache)
├─ icons/icon.svg          app icon
└─ js/
   ├─ app.js               router + init
   ├─ config.js            Supabase config (empty = demo mode)
   ├─ data.js              sample places, categories, placeholder images
   ├─ store.js             data layer (local now, Supabase later)
   ├─ geo.js               distance / travel estimates / Maps links
   ├─ ui.js                DOM helpers, bottom sheet, toast
   ├─ components.js        place card + detail sheet
   ├─ pick.js              Pick tab
   ├─ narrowing.js         this-or-that / both-pick / just-decide
   ├─ planner.js           Plan tab + day-building engine
   ├─ plans.js             Plans tab + plan view/share
   └─ places.js            Places tab + add-place flow
```

## Next phases

See **SETUP.md** for the click-by-click backend/hosting steps. Phases:

1. ✅ Demo-mode UI (this)
2. Supabase + email/password auth + saving to the cloud
3. Supabase Edge Function + Google Places (photos, reviews, hours)
4. Sharing + surprise mode across both accounts
5. PWA polish (real PNG icons, offline refinements)
