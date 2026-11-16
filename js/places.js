// --- Places tab: list all places + add a new one --------------------------

import { el, money, toast, openSheet } from "./ui.js";
import { CATEGORIES, VIBES, SETTINGS, DAYS, DEMO_SEARCH_RESULTS } from "./data.js";
import { getPlaces, addPlace } from "./store.js";
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

  root.append(el("div.grid", {}, all.map(p => placeCard(p, openDetail))));
}

// Add-place flow: search (demo = canned results) → pick → tag it.
function addPlaceFlow(state) {
  const body = el("div");
  const close = openSheet({ title: "Add a place", body });
  // Live mode without Google → type the details in by hand. Otherwise search.
  if (!DEMO_MODE && !GOOGLE_ENABLED) manualStep(); else searchStep();

  function manualStep() {
    let cat = "coffee", setting = "either";
    const vibes = new Set();
    const name = el("input.input", { placeholder: "Place name", autofocus: true });
    const area = el("input.input", { placeholder: "Area / suburb (e.g. Surry Hills)" });
    const cost = el("input.input", { type: "number", min: "0", step: "5", placeholder: "e.g. 40" });
    const hours = el("input.input", { placeholder: "e.g. 8am – 4pm" });
    const photo = el("input.input", { type: "url", placeholder: "https://… image link" });
    const notes = el("textarea.input", { placeholder: "What's good about it?" });

    // Weekly specials — one optional line per day (feeds the Weekly deals filter).
    const dealInputs = DAYS.map(d => ({ key: d.key,
      input: el("input.input.deal-input", { placeholder: `${d.full} special (e.g. $10 burgers)` }) }));
    const dealsField = el("details.deals-field", {}, [
      el("summary", { text: "🏷️ Weekly specials (optional)" }),
      el("div.deals-inputs", {}, dealInputs.map((di, i) =>
        el("div.deal-input-row", {}, [ el("span.deal-input-day", { text: DAYS[i].label }), di.input ]))),
    ]);

    const catSeg = el("div.chips", {}, Object.entries(CATEGORIES).map(([k, c]) =>
      el("button.chip" + (k === cat ? ".on" : ""), { dataset: { k }, onclick: () => {
        cat = k; catSeg.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      } }, [ el("span.ico", { text: c.icon }), c.label ])));
    const vibeSeg = el("div.chips", {}, Object.entries(VIBES).map(([k, v]) =>
      el("button.chip", { onclick: (e) => { e.currentTarget.classList.toggle("on"); vibes.has(k) ? vibes.delete(k) : vibes.add(k); } },
        [ el("span.ico", { text: v.icon }), v.label ])));
    const setSeg = el("div.seg", {}, Object.entries(SETTINGS).map(([k, s]) =>
      el("button" + (k === setting ? ".on" : ""), { dataset: { k }, text: `${s.icon} ${s.label}`, onclick: () => {
        setting = k; setSeg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.k === k));
      } })));

    body.replaceChildren(
      el("p.lede", { text: "Add a place with your own details." }),
      el("div.field", {}, [ el("label", { text: "Name" }), name ]),
      el("div.field", {}, [ el("label", { text: "Area" }), area ]),
      el("div.field", {}, [ el("label", { text: "Category" }), catSeg ]),
      el("div.field", {}, [ el("label", { text: "Our cost estimate for two (AUD)" }), cost ]),
      el("div.field", {}, [ el("label", { text: "Vibe" }), vibeSeg ]),
      el("div.field", {}, [ el("label", { text: "Setting" }), setSeg ]),
      el("div.field", {}, [ el("label", { text: "Opening hours (optional)" }), hours ]),
      el("div.field", {}, [ el("label", { text: "Photo link (optional)" }), photo ]),
      el("div.field", {}, [ el("label", { text: "Our notes" }), notes ]),
      el("div.field", {}, [ el("label", { text: "Weekly deals" }), dealsField ]),
      el("button.btn.btn-primary.btn-block.btn-lg", { text: "Save place", onclick: save }),
    );

    async function save() {
      if (!name.value.trim()) { toast("Give it a name first"); return; }
      const deals = {};
      dealInputs.forEach(di => { const v = di.input.value.trim(); if (v) deals[di.key] = v; });
      await addPlace({
        google_place_id: "", name: name.value.trim(), category: cat,
        area: area.value.trim() || "Sydney",
        est_cost_for_two: cost.value ? +cost.value : 0,
        vibe: [...vibes], setting, lat: null, lng: null,
        our_notes: notes.value.trim(),
        photo_url: photo.value.trim() || null,
        hours: hours.value.trim() || null,
        deals: Object.keys(deals).length ? deals : undefined,
      });
      close();
      toast(`Added ${name.value.trim()} ♡`);
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
