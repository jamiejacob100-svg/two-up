// --- Pick tab: constraints + browse grid + narrowing ----------------------

import { el, money, toast, budgetControl, distanceControl } from "./ui.js";
import { CATEGORIES, CUISINES, CUISINE_CATS, cuisineOf, DAYS, dealFor, VIBES, SETTINGS, TIME_SLOTS, CITY_CENTER, photoFor } from "./data.js";
import { getPlaces, getSavedPlaces, removeSaved } from "./store.js";
import { placeCard, openDetail } from "./components.js";
import { editPlaceFlow } from "./places.js";
import { addToDraft } from "./planner.js";
import { thisOrThat, bothPick, justDecide } from "./narrowing.js";
import { openSwipe } from "./swipe.js";
import { haversineKm } from "./geo.js";

export async function renderPick(root, state) {
  const all = await getPlaces();
  const f = state.filters;

  const head = el("header.page-head", {}, [
    el("h1.page-title", { text: "What should we do?" }),
    el("p.page-sub", { text: "Set the vibe, then browse or let the app narrow it down." }),
  ]);

  // --- Filter controls ---
  const budgetCtl = budgetControl({ value: f.budget, onChange: (v) => { f.budget = v; applyFilters(); } });

  // --- Distance (same slider + type-in control as budget) ---
  if (!f.center) f.center = { lat: CITY_CENTER.lat, lng: CITY_CENTER.lng };
  const distCtl = distanceControl({ value: f.distanceKm, onChange: (v) => { f.distanceKm = v; applyFilters(); } });
  const centerLabel = el("span.dist-center", { text: f.nearMe ? "from your location" : `from ${CITY_CENTER.label}` });
  const nearBtn = el("button.dist-near" + (f.nearMe ? ".on" : ""), { html: "📍 Near me", onclick: toggleNear });
  const distRow = el("div.dist-row", {}, [ centerLabel, nearBtn ]);

  function toggleNear() {
    if (f.nearMe) { // back to the CBD
      f.nearMe = false; f.center = { lat: CITY_CENTER.lat, lng: CITY_CENTER.lng };
      centerLabel.textContent = `from ${CITY_CENTER.label}`; nearBtn.classList.remove("on"); nearBtn.innerHTML = "📍 Near me";
      applyFilters(); return;
    }
    if (!navigator.geolocation) { toast("Location isn't available here"); return; }
    nearBtn.innerHTML = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        f.center = { lat: pos.coords.latitude, lng: pos.coords.longitude }; f.nearMe = true;
        nearBtn.innerHTML = "📍 Near me"; nearBtn.classList.add("on");
        centerLabel.textContent = "from your location"; applyFilters();
      },
      () => { nearBtn.innerHTML = "📍 Near me"; toast("Couldn't get your location — using the CBD"); },
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }

  const timeSeg = el("div.seg", {}, Object.entries(TIME_SLOTS).map(([k, t]) =>
    el("button" + (f.time === k ? ".on" : ""), { text: t.label, dataset: { k }, onclick: () => setSeg(timeSeg, "time", k) })));

  const catChips = el("div.chips", {}, Object.entries(CATEGORIES).map(([k, c]) =>
    chip(c.icon, c.label, f.cats.has(k), () => toggleSet(f.cats, k, applyFilters))));

  // --- Cuisine sub-filter (only visible when a food category is picked) ---
  const cuisineChips = el("div.chips", {}, Object.entries(CUISINES).map(([k, c]) =>
    chip(c.icon, c.label, f.cuisines.has(k), () => toggleSet(f.cuisines, k, applyFilters))));
  const cuisineWrap = el("div.cuisine-sub", { hidden: true }, [
    el("div.panel-label.cuisine-label", { text: "🍽️ Cuisine" }),
    cuisineChips,
  ]);
  function syncCuisine() {
    const show = CUISINE_CATS.some(k => f.cats.has(k));
    cuisineWrap.hidden = !show;
    if (!show && f.cuisines.size) {
      f.cuisines.clear();
      cuisineChips.querySelectorAll("button").forEach(b => b.classList.remove("on"));
    }
  }

  const vibeChips = el("div.chips", {}, Object.entries(VIBES).map(([k, v]) =>
    chip(v.icon, v.label, f.vibes.has(k), () => toggleSet(f.vibes, k, applyFilters))));

  // --- Weekly deals: day-of-week sub-filter ---
  const dayChips = el("div.chips", {}, DAYS.map(d =>
    chip("", d.label, f.days.has(d.key), () => toggleSet(f.days, d.key, applyFilters))));
  // Drinks / Restaurants type toggle (single-select; tap again for both).
  const RESTAURANT_CATS = ["food", "view"];
  const typeSeg = el("div.seg", { style: "margin-top:12px" }, [
    el("button" + (f.dealType === "drinks" ? ".on" : ""), { dataset: { k: "drinks" }, text: "🍸 Drinks", onclick: () => setDealType("drinks") }),
    el("button" + (f.dealType === "rest" ? ".on" : ""), { dataset: { k: "rest" }, text: "🍽️ Restaurants", onclick: () => setDealType("rest") }),
  ]);
  function setDealType(v) {
    f.dealType = f.dealType === v ? null : v;
    typeSeg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === f.dealType));
    applyFilters();
  }

  const dealsWrap = el("div.cuisine-sub.deals-sub", {}, [
    el("div.panel-label.cuisine-label", { text: "📅 Which day?" }),
    el("p.page-sub", { text: "Pick a day to see places running a special then.", style: "margin:-2px 0 8px" }),
    dayChips,
    typeSeg,
  ]);

  const setSeg2 = el("div.seg", {}, Object.entries(SETTINGS).map(([k, s]) =>
    el("button" + (f.setting === k ? ".on" : ""), { text: `${s.icon} ${s.label}`, dataset: { k }, onclick: () => setSeg(setSeg2, "setting", k) })));

  function setSeg(container, key, val) {
    f[key] = (f[key] === val && key !== "setting") ? null : val;
    container.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === f[key]));
    applyFilters();
  }

  const controls = el("div.panel", {}, [
    el("div.panel-label", { text: "Budget for two" }),
    budgetCtl,
    el("div.panel-label", { text: "Max distance", style: "margin-top:16px" }),
    distCtl, distRow,
    el("div.panel-label", { text: "Time", style: "margin-top:16px" }), timeSeg,
    el("div.panel-label", { text: "Category", style: "margin-top:16px" }), catChips,
    cuisineWrap,
    el("div.panel-label", { text: "Vibe", style: "margin-top:16px" }), vibeChips,
    el("div.panel-label", { text: "Setting", style: "margin-top:16px" }), setSeg2,
    el("div.panel-label", { text: "Weekly deals", style: "margin-top:16px" }), dealsWrap,
  ]);

  // --- Saved-for-later strip (from swipe right) ---
  const savedWrap = el("div.saved-wrap");
  async function refreshSaved() {
    const saved = await getSavedPlaces();
    savedWrap.replaceChildren();
    if (!saved.length) return;
    savedWrap.append(
      el("div.section-label", { text: `♡ Saved for later (${saved.length})`, style: "margin-top:4px" }),
      el("div.saved-strip", {}, saved.map(p => el("div.saved-chip", {}, [
        el("button.saved-chip-main", { onclick: () => openDetail(p) }, [
          el("img.saved-thumb", { src: p.photo || photoFor(p), alt: "" }),
          el("div.saved-chip-name", { text: p.name }),
        ]),
        el("button.saved-remove", { html: "✕", "aria-label": `Remove ${p.name}`,
          onclick: async () => { await removeSaved(p.id); refreshSaved(); } }),
      ]))),
    );
  }

  // --- Narrowing buttons ---
  const narrowBtns = el("div.panel", {}, [
    el("div.panel-label", { text: "Can't decide?" }),
    el("button.btn.btn-primary.btn-block.btn-lg", { html: "🔥 Swipe to pick", style: "margin-bottom:12px",
      onclick: () => {
        const list = filtered();
        if (!list.length) { toast("No places match — loosen your filters"); return; }
        openSwipe(list, { onDone: refreshSaved });
      } }),
    el("div.chips", { style: "gap:10px" }, [
      el("button.btn.btn-soft", { text: "⚔️ This or that", onclick: () => thisOrThat(filtered(), onNarrowed) }),
      el("button.btn.btn-soft", { text: "👥 Both pick", onclick: () => bothPick(filtered(), onNarrowed) }),
      el("button.btn.btn-soft", { text: "🎲 Just decide", onclick: () => justDecide(filtered(), onNarrowed) }),
    ]),
  ]);

  const countLabel = el("div.section-label");
  const grid = el("div.grid");
  const results = el("div", {}, [ countLabel, grid ]);

  function filtered() {
    return all.filter(p => {
      if (p.est_cost_for_two > f.budget) return false;
      if (f.center && p.lat != null && p.lng != null && haversineKm(f.center, p) > f.distanceKm) return false;
      if (f.cats.size && !f.cats.has(p.category)) return false;
      // Cuisine only narrows the food categories; everything else passes through.
      if (f.cuisines.size && CUISINE_CATS.includes(p.category) && !f.cuisines.has(cuisineOf(p))) return false;
      // Weekly deals: keep only places with a special on a selected day.
      if (f.days.size && ![...f.days].some(dk => dealFor(p, dk))) return false;
      // Drinks / Restaurants toggle (under Weekly deals).
      if (f.dealType === "drinks" && p.category !== "drinks") return false;
      if (f.dealType === "rest" && !RESTAURANT_CATS.includes(p.category)) return false;
      if (f.vibes.size && !(p.vibe || []).some(v => f.vibes.has(v))) return false;
      if (f.setting && f.setting !== "either" && p.setting !== "either" && p.setting !== f.setting) return false;
      return true;
    });
  }

  function onNarrowed(place, action) {
    if (action === "add") { addToDraft(place.id); toast(`Added ${place.name} to your day`); }
    else openDetail(place);
  }

  // When filtering by day(s), surface the matching special on the card.
  function dealBadge(p) {
    if (!f.days.size) return null;
    for (const d of DAYS) {
      if (f.days.has(d.key)) { const t = dealFor(p, d.key); if (t) return `${d.label} · ${t}`; }
    }
    return null;
  }

  function applyFilters() {
    syncCuisine();
    const list = filtered();
    countLabel.textContent = `${list.length} place${list.length === 1 ? "" : "s"} match`;
    const openP = (pl) => openDetail(pl, { onEdit: (x) => editPlaceFlow(x, () => state.rerender()) });
    grid.replaceChildren(...list.map(p => placeCard(p, openP, { deal: dealBadge(p) })));
    if (!list.length) grid.replaceChildren(el("p.page-sub", { text: "Nothing matches — try a bigger budget or fewer filters." }));
  }

  root.append(head, savedWrap, controls, narrowBtns, results);
  applyFilters();
  refreshSaved();
}

function chip(icon, label, on, onClick) {
  return el("button.chip" + (on ? ".on" : ""), { onclick(e) { e.currentTarget.classList.toggle("on"); onClick(); } }, [
    icon ? el("span.ico", { text: icon }) : null, label,
  ]);
}
function toggleSet(set, key, after) { set.has(key) ? set.delete(key) : set.add(key); after(); }
