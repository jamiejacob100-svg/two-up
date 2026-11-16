// --- Places tab: list all places + add a new one --------------------------

import { el, money, toast, openSheet } from "./ui.js";
import { CATEGORIES, CUISINES, CUISINE_CATS, ZONES, ZONE_CATS, VIBES, SETTINGS, DAYS, DEMO_SEARCH_RESULTS } from "./data.js";
import { getPlaces, addPlace, updatePlace, deletePlace, removeSaved } from "./store.js";
import { placeCard, openDetail } from "./components.js";
import { DEMO_MODE, GOOGLE_ENABLED } from "./config.js";
import { searchPlaces } from "./places-api.js";

export async function renderPlaces(root, state) {
  const all = await getPlaces();

  root.append(el("header.page-head", {}, [
    el("h1.page-title", { text: "Our places" }),
    el("p.page-sub", { text: `${all.length} spots we know and like around Sydney.` }),
  ]));

  root.append(el("button.btn.btn-primary.btn-block.btn-lg", { text: "＋ Add a place", style: "margin-bottom:18px", onclick: () => addPlaceFlow(state) }));

  const openWithEdit = (pl) => openDetail(pl, { onEdit: (x) => editPlaceFlow(x, () => state.rerender()) });
  root.append(el("div.grid", {}, all.map(p => placeCard(p, openWithEdit))));
}

// Add-place flow: search (demo = canned results) → pick → tag it.
function addPlaceFlow(state) {
  const body = el("div");
  const close = openSheet({ title: "Add a place", body });
  // Live mode without Google → type the details in by hand. Otherwise search.
  if (!DEMO_MODE && !GOOGLE_ENABLED) manualStep(); else searchStep();

  function manualStep() {
    const form = placeForm({});
    body.replaceChildren(
      el("p.lede", { text: "Add a place with your own details." }),
      form.node,
      el("button.btn.btn-primary.btn-block.btn-lg", { text: "Save place", onclick: save }),
    );
    async function save() {
      const v = form.collect();
      if (!v.name) { toast("Give it a name first"); return; }
      await addPlace({
        google_place_id: "", name: v.name, category: v.category, area: v.area,
        est_cost_for_two: v.est_cost_for_two, vibe: v.vibe, setting: v.setting,
        lat: null, lng: null, our_notes: v.our_notes,
        photo_url: v.photo_url, hours: v.hours,
        cuisine: v.cuisine || undefined,
        zone: v.zone || undefined,
        deals: Object.keys(v.deals).length ? v.deals : undefined,
      });
      close();
      toast(`Added ${v.name} ♡`);
      state.rerender();
    }
  }

  function resultRow(r) {
    return el("button.result-row", { onclick: () => tagStep(r) }, [
      el("div.plan-ico", { text: "📍", style: "width:40px;height:40px;font-size:18px" }),
      el("div", {}, [ el("div.result-name", { text: r.name }), el("div.result-addr", { text: r.address }) ]),
    ]);
  }

  function searchStep() {
    const input = el("input.input", { placeholder: "Search a place (e.g. café, bar, lookout)…", autofocus: true });
    const list = el("div", { style: "margin-top:12px" });
    const lede = el("p.lede", { text: DEMO_MODE
      ? "Demo mode uses a few sample results. Phase 3 wires this to Google Places."
      : "Search Google for the place, then tag it as yours." });
    body.replaceChildren(lede, input, list);

    if (DEMO_MODE) {
      const render = (q) => {
        const results = DEMO_SEARCH_RESULTS.filter(r => !q || r.name.toLowerCase().includes(q.toLowerCase()));
        list.replaceChildren(...(results.length ? results.map(resultRow)
          : [el("p.page-sub", { text: "No demo results." })]));
      };
      input.addEventListener("input", (e) => render(e.target.value));
      render("");
      return;
    }

    // Live mode: debounced Google search via the Edge Function.
    let timer, seq = 0;
    const run = async (q) => {
      if (!q.trim()) { list.replaceChildren(); return; }
      const mine = ++seq;
      list.replaceChildren(el("p.page-sub", { text: "Searching…" }));
      try {
        const res = await searchPlaces(q);
        if (mine !== seq) return; // a newer keystroke superseded this
        if (res?.capped) {
          list.replaceChildren(el("p.page-sub", { text: "Search limit reached for today — try again tomorrow." }));
          return;
        }
        const results = res?.results || [];
        list.replaceChildren(...(results.length ? results.map(resultRow)
          : [el("p.page-sub", { text: "No matches." })]));
      } catch {
        if (mine !== seq) return;
        list.replaceChildren(el("p.page-sub", { text: "Search isn't available yet — the Google Edge Function needs deploying (see SETUP.md, Phase 3)." }));
      }
    };
    input.addEventListener("input", (e) => { clearTimeout(timer); const q = e.target.value; timer = setTimeout(() => run(q), 350); });
  }

  function tagStep(result) {
    let cat = "coffee", setting = "either";
    const vibes = new Set();

    const catSeg = el("div.chips", {}, Object.entries(CATEGORIES).map(([k, c]) =>
      el("button.chip" + (k === cat ? ".on" : ""), { dataset: { k }, onclick: (e) => {
        cat = k; catSeg.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      }}, [ el("span.ico", { text: c.icon }), c.label ])));

    const vibeSeg = el("div.chips", {}, Object.entries(VIBES).map(([k, v]) =>
      el("button.chip", { onclick: (e) => { e.currentTarget.classList.toggle("on"); vibes.has(k) ? vibes.delete(k) : vibes.add(k); } },
        [ el("span.ico", { text: v.icon }), v.label ])));

    const setSeg = el("div.seg", {}, Object.entries(SETTINGS).map(([k, s]) =>
      el("button" + (k === setting ? ".on" : ""), { dataset: { k }, text: `${s.icon} ${s.label}`, onclick: () => {
        setting = k; setSeg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      }})));

    const cost = el("input.input", { type: "number", min: "0", step: "5", placeholder: "e.g. 40", value: "" });
    const notes = el("textarea.input", { placeholder: "What's good about it?" });

    body.replaceChildren(
      el("button.btn.btn-ghost", { text: "‹ Back to search", style: "padding:6px 2px", onclick: searchStep }),
      el("h3", { text: result.name, style: "font-size:18px;font-weight:760;margin:6px 0" }),
      el("p.result-addr", { text: result.address, style: "margin-bottom:14px" }),
      el("div.field", {}, [ el("label", { text: "Category" }), catSeg ]),
      el("div.field", {}, [ el("label", { text: "Our cost estimate for two (AUD)" }), cost ]),
      el("div.field", {}, [ el("label", { text: "Vibe" }), vibeSeg ]),
      el("div.field", {}, [ el("label", { text: "Setting" }), setSeg ]),
      el("div.field", {}, [ el("label", { text: "Our notes" }), notes ]),
      el("button.btn.btn-primary.btn-block.btn-lg", { text: "Save place", onclick: async () => {
        await addPlace({
          google_place_id: result.google_place_id, name: result.name, category: cat,
          area: result.address.split(",").slice(-1)[0].trim() || "Sydney",
          est_cost_for_two: cost.value ? +cost.value : 0,
          vibe: [...vibes], setting, lat: result.lat, lng: result.lng,
          our_notes: notes.value.trim(),
        });
        close();
        toast(`Added ${result.name} ♡`);
        state.rerender();
      }}),
    );
  }
}

// --- Shared place form (used by manual add + edit) -------------------------
// Returns { node, collect } — `collect()` reads the current field values.
function placeForm(initial = {}) {
  let cat = initial.category || "coffee";
  let setting = initial.setting || "either";
  let cuisine = initial.cuisine || null;
  let zone = initial.zone || null;
  const vibes = new Set(initial.vibe || []);

  const name  = el("input.input", { placeholder: "Place name", value: initial.name || "" });
  const area  = el("input.input", { placeholder: "Area / suburb (e.g. Surry Hills)", value: initial.area || "" });
  const cost  = el("input.input", { type: "number", min: "0", step: "5", placeholder: "e.g. 40",
                     value: initial.est_cost_for_two != null ? String(initial.est_cost_for_two) : "" });
  const hours = el("input.input", { placeholder: "e.g. 8am – 4pm", value: initial.hours || "" });
  const photo = el("input.input", { type: "url", placeholder: "https://… image link", value: initial.photo_url || "" });
  const notes = el("textarea.input", { placeholder: "What's good about it?" }, [ initial.our_notes || "" ]);

  // Cuisine — single-select, and only meaningful for the food categories.
  const cuisineChips = el("div.chips", {}, Object.entries(CUISINES).map(([k, c]) =>
    el("button.chip" + (cuisine === k ? ".on" : ""), { dataset: { k }, onclick: () => {
      cuisine = (cuisine === k) ? null : k;
      cuisineChips.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", cuisine && x.dataset.k === cuisine));
    } }, [ el("span.ico", { text: c.icon }), c.label ])));
  const cuisineField = el("div.field", {}, [ el("label", { text: "Cuisine" }), cuisineChips ]);
  const syncCuisine = () => { cuisineField.hidden = !CUISINE_CATS.includes(cat); };

  // Exploration zone — single-select, only meaningful for Jungle exploration.
  const zoneChips = el("div.chips", {}, Object.entries(ZONES).map(([k, z]) =>
    el("button.chip" + (zone === k ? ".on" : ""), { dataset: { k }, onclick: () => {
      zone = (zone === k) ? null : k;
      zoneChips.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", zone && x.dataset.k === zone));
    } }, [ el("span.ico", { text: z.icon }), z.label ])));
  const zoneField = el("div.field", {}, [ el("label", { text: "Zone" }), zoneChips ]);
  const syncZone = () => { zoneField.hidden = !ZONE_CATS.includes(cat); };

  const catSeg = el("div.chips", {}, Object.entries(CATEGORIES).map(([k, c]) =>
    el("button.chip" + (k === cat ? ".on" : ""), { dataset: { k }, onclick: () => {
      cat = k; catSeg.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      syncCuisine(); syncZone();
    } }, [ el("span.ico", { text: c.icon }), c.label ])));
  const vibeSeg = el("div.chips", {}, Object.entries(VIBES).map(([k, v]) =>
    el("button.chip" + (vibes.has(k) ? ".on" : ""), { onclick: (e) => {
      e.currentTarget.classList.toggle("on"); vibes.has(k) ? vibes.delete(k) : vibes.add(k);
    } }, [ el("span.ico", { text: v.icon }), v.label ])));
  const setSeg = el("div.seg", {}, Object.entries(SETTINGS).map(([k, s]) =>
    el("button" + (k === setting ? ".on" : ""), { dataset: { k }, text: `${s.icon} ${s.label}`, onclick: () => {
      setting = k; setSeg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.k === k));
    } })));

  const dealInputs = DAYS.map(d => ({ key: d.key,
    input: el("input.input.deal-input", { placeholder: `${d.full} special (e.g. $10 burgers)`,
             value: (initial.deals && initial.deals[d.key]) || "" }) }));
  const hadDeals = initial.deals && Object.keys(initial.deals).length;
  const dealsField = el("details.deals-field", hadDeals ? { open: true } : {}, [
    el("summary", { text: "🏷️ Weekly specials (optional)" }),
    el("div.deals-inputs", {}, dealInputs.map((di, i) =>
      el("div.deal-input-row", {}, [ el("span.deal-input-day", { text: DAYS[i].label }), di.input ]))),
  ]);

  const node = el("div", {}, [
    el("div.field", {}, [ el("label", { text: "Name" }), name ]),
    el("div.field", {}, [ el("label", { text: "Area" }), area ]),
    el("div.field", {}, [ el("label", { text: "Category" }), catSeg ]),
    cuisineField,
    zoneField,
    el("div.field", {}, [ el("label", { text: "Our cost estimate for two (AUD)" }), cost ]),
    el("div.field", {}, [ el("label", { text: "Vibe" }), vibeSeg ]),
    el("div.field", {}, [ el("label", { text: "Setting" }), setSeg ]),
    el("div.field", {}, [ el("label", { text: "Opening hours (optional)" }), hours ]),
    el("div.field", {}, [ el("label", { text: "Photo link (optional)" }), photo ]),
    el("div.field", {}, [ el("label", { text: "Our notes" }), notes ]),
    el("div.field", {}, [ el("label", { text: "Weekly deals" }), dealsField ]),
  ]);
  syncCuisine();
  syncZone();

  function collectDeals() {
    const deals = {};
    dealInputs.forEach(di => { const v = di.input.value.trim(); if (v) deals[di.key] = v; });
    return deals;
  }
  function collect() {
    return {
      name: name.value.trim(),
      area: area.value.trim() || "Sydney",
      category: cat,
      est_cost_for_two: cost.value ? +cost.value : 0,
      vibe: [...vibes], setting,
      our_notes: notes.value.trim(),
      photo_url: photo.value.trim() || null,
      hours: hours.value.trim() || null,
      cuisine: CUISINE_CATS.includes(cat) ? cuisine : null,
      zone: ZONE_CATS.includes(cat) ? zone : null,
      deals: collectDeals(), // {} when none
    };
  }
  return { node, collect };
}

// --- Edit an existing place ------------------------------------------------
export function editPlaceFlow(place, onDone) {
  const body = el("div");
  const close = openSheet({ title: "Edit place", body });
  const form = placeForm(place);

  // Delete, behind an inline confirm (deleting a place can't be undone).
  const delArea = el("div.del-area", { style: "margin-top:10px" });
  function showDelete() {
    delArea.replaceChildren(
      el("button.btn.btn-ghost.btn-block.btn-danger", { html: "🗑 Delete place", onclick: confirmDelete }),
    );
  }
  function confirmDelete() {
    delArea.replaceChildren(
      el("p.page-sub", { text: `Delete “${place.name}”? This can't be undone.`, style: "margin:8px 0 10px;text-align:center" }),
      el("div.del-confirm", {}, [
        el("button.btn.btn-soft", { text: "Cancel", onclick: showDelete }),
        el("button.btn.btn-danger", { text: "Delete", onclick: doDelete }),
      ]),
    );
  }
  async function doDelete() {
    try {
      await deletePlace(place.id);
      try { await removeSaved(place.id); } catch {}
      close();
      toast(`Deleted ${place.name}`);
      onDone && onDone();
    } catch (err) {
      toast("Couldn't delete — try again");
    }
  }
  showDelete();

  body.replaceChildren(
    form.node,
    el("button.btn.btn-primary.btn-block.btn-lg", { text: "Save changes", style: "margin-top:4px", onclick: save }),
    delArea,
  );
  async function save() {
    const v = form.collect();
    if (!v.name) { toast("Give it a name first"); return; }
    const patch = {
      name: v.name, category: v.category, area: v.area,
      est_cost_for_two: v.est_cost_for_two, vibe: v.vibe, setting: v.setting,
      our_notes: v.our_notes, photo_url: v.photo_url, hours: v.hours,
    };
    // Only touch the optional columns when they're in play — so a basic edit
    // still works before the cuisine/deals columns exist, and clearing works
    // once they do (if the place already had one, the column must exist).
    if (v.cuisine || place.cuisine) patch.cuisine = v.cuisine || null;
    if (v.zone || place.zone) patch.zone = v.zone || null;
    const hadDeals = place.deals && Object.keys(place.deals).length;
    if (Object.keys(v.deals).length || hadDeals) patch.deals = Object.keys(v.deals).length ? v.deals : null;
    try {
      await updatePlace(place.id, patch);
      close();
      toast(`Updated ${v.name}`);
      onDone && onDone();
    } catch (err) {
      toast(err?.message?.includes("column") ? "Run the cuisine/deals DB columns first (SETUP)" : "Couldn't save — try again");
    }
  }
}
