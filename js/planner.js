// --- Day planner: templates, proximity chaining, travel, budget -----------

import { el, money, toast, openSheet, budgetControl } from "./ui.js";
import { CATEGORIES, TIME_SLOTS, photoFor } from "./data.js";
import { travelEstimate, fmtTravel, directionsUrl } from "./geo.js";
import { getPlaces, savePlan } from "./store.js";

const DRAFT_KEY = "twoup.draft.v1";

// Each template is a list of slots: { cats: [...accepted], time: "9:30" }.
export const TEMPLATES = {
  full: { label: "Full day", slots: [
    { cats: ["coffee"], time: "9:30" },
    { cats: ["activity"], time: "11:00" },
    { cats: ["food"], time: "13:00" },
    { cats: ["activity", "view"], time: "15:30" },
    { cats: ["food"], time: "18:30" },
    { cats: ["drinks"], time: "20:30" },
  ]},
  half: { label: "Half day", slots: [
    { cats: ["coffee"], time: "10:00" },
    { cats: ["activity"], time: "11:30" },
    { cats: ["food"], time: "13:30" },
    { cats: ["dessert", "view"], time: "15:00" },
  ]},
  evening: { label: "Evening", slots: [
    { cats: ["food"], time: "18:30" },
    { cats: ["dessert", "drinks"], time: "20:00" },
    { cats: ["view", "drinks"], time: "21:15" },
  ]},
  quick: { label: "Quick date", slots: [
    { cats: ["coffee"], time: "11:00" },
    { cats: ["activity", "dessert"], time: "12:15" },
  ]},
};

// Numeric open/close (24h decimal) per category, for the hours check.
export function hoursFor(cat) {
  const map = {
    coffee: { open: 7, close: 15 }, food: { open: 11.5, close: 22 },
    activity: { open: 9, close: 17 }, view: { open: 0, close: 24 },
    drinks: { open: 16, close: 25 }, dessert: { open: 12, close: 23 },
  };
  return map[cat] || { open: 9, close: 18 };
}
function timeToDec(t) { const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; }
export function outsideHours(place, time) {
  const h = hoursFor(place.category);
  const t = timeToDec(time);
  return t < h.open || t > h.close;
}

// --- Draft (shared with "Add to day") ---
function readDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { return null; }
}
function writeDraft(d) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
}
export function getDraft() {
  return readDraft() || { template: null, budget: 150, date: "", mode: "together", stops: [] };
}
export function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }

export async function addToDraft(placeId) {
  const d = getDraft();
  if (d.stops.find(s => s.placeId === placeId)) { toast("Already in your day"); return; }
  const nextHour = 10 + d.stops.length * 2;
  d.stops.push({ placeId, time: `${nextHour}:00` });
  writeDraft(d);
}

// --- Plan generation ------------------------------------------------------
// Each call produces a *fresh, varied* day: candidates are scored on
// proximity, rating and budget-fit, then chosen by weighted-random so that
// pressing "New idea" keeps surfacing different plans — while trying to keep
// the running total within the chosen budget. Scales naturally as more places
// are added (more candidates = more variety, same budget discipline).

function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return items[Math.random() * items.length | 0];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}

export async function buildDayPlan({ template, budget, vibe, setting }) {
  const all = await getPlaces();
  const tpl = TEMPLATES[template];
  const used = new Set();
  const stops = [];
  const totalSlots = tpl.slots.length;

  const matches = (p, cats) => cats.includes(p.category)
    && (!vibe || (p.vibe || []).includes(vibe))
    && (!setting || setting === "either" || p.setting === "either" || p.setting === setting);

  let prev = null;
  let spent = 0;
  const MAX_KM = 15;

  tpl.slots.forEach((slot, i) => {
    let pool = all.filter(p => !used.has(p.id) && matches(p, slot.cats));
    if (!pool.length) pool = all.filter(p => !used.has(p.id) && slot.cats.includes(p.category)); // relax filters
    if (!pool.length) return;

    // How much is left to spend, spread over the remaining stops.
    const slotsLeft = totalSlots - i;
    const remaining = Math.max(0, budget - spent);
    const perSlot = remaining / slotsLeft;

    // Prefer options that fit the per-slot allowance; if nothing fits, fall
    // back to the cheapest handful so we don't blow the budget on one stop.
    let candidates = pool.filter(p => (p.est_cost_for_two || 0) <= perSlot * 1.4);
    if (!candidates.length) {
      candidates = pool.slice().sort((a, b) => (a.est_cost_for_two || 0) - (b.est_cost_for_two || 0))
        .slice(0, Math.max(3, Math.ceil(pool.length * 0.4)));
    }

    const pick = weightedPick(candidates, (p) => {
      const t = prev ? travelEstimate(prev, p) : null;
      const proximity = !prev ? 1 : (t ? Math.max(0.05, 1 - t.km / MAX_KM) : 0.6); // nearer = better; neutral if unknown
      const rating = (p.our_rating || 3.5) / 5;                                 // 0..1
      const cost = p.est_cost_for_two || 0;
      const budgetFit = perSlot > 0 ? Math.max(0.1, 1 - cost / (perSlot * 2 + 1)) : 0.5; // cheaper = safer
      return proximity * 1.6 + rating * 1.0 + budgetFit * 1.2;
    });

    used.add(pick.id);
    stops.push({ placeId: pick.id, time: slot.time });
    spent += pick.est_cost_for_two || 0;
    prev = pick;
  });

  return { template, budget, mode: "together", date: "", title: tpl.label + " in Sydney", stops };
}

// --- Rendering an itinerary ---
// opts: { placesById, onSwap(index), reveal(stop)->bool, editable }
export function itineraryEl(plan, opts = {}) {
  const byId = opts.placesById;
  const wrap = el("div.timeline");
  let spent = 0;

  plan.stops.forEach((stop, i) => {
    const place = byId[stop.placeId];
    if (!place) return;
    const revealed = opts.reveal ? opts.reveal(stop) : true;
    if (revealed) spent += place.est_cost_for_two || 0;

    const prev = i > 0 ? byId[plan.stops[i - 1].placeId] : null;
    if (prev && revealed) {
      const t = travelEstimate(prev, place);
      if (t) wrap.append(el("div.travel", { text: fmtTravel(t) }));
    }

    const warn = revealed && outsideHours(place, stop.time);
    const cat = CATEGORIES[place.category];

    const card = revealed
      ? el("div.stop-card", {}, [
          el("img.stop-thumb", { src: place.photo || photoFor(place), alt: "" }),
          el("div.stop-info", {}, [
            el("div.stop-name", { text: place.name }),
            el("div.stop-sub", {}, [
              `${cat.icon} ${cat.label} · ${money(place.est_cost_for_two)}`,
              warn && el("span.hours-warn", { text: "  ⚠ likely closed" }),
            ]),
          ]),
          opts.editable && el("button.stop-swap", { text: "Swap", onclick: () => opts.onSwap(i) }),
        ])
      : el("div.stop-card", {}, [
          el("div.stop-thumb", { style: "display:flex;align-items:center;justify-content:center;font-size:22px", text: "🔒" }),
          el("div.stop-info", {}, [
            el("div.stop-name", { text: stop.hint || "Surprise stop" }),
            el("div.stop-sub", { text: `Unlocks at ${stop.time}` }),
          ]),
        ]);

    wrap.append(el("div.stop", {}, [
      el("div.stop-time", { text: stop.time }),
      el("div.stop-main", {}, [card]),
    ]));
  });

  return { node: wrap, spent };
}

export function budgetMeter(spent, budget) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent > budget;
  return el("div.meter", {}, [
    el("div.meter-bar", {}, [ el("div.meter-fill" + (over ? ".over" : ""), { style: `width:${pct}%` }) ]),
    el("div.meter-val", { text: `${money(spent)} / ${money(budget)}` }),
  ]);
}

// --- Swap flow ---
async function swapStop(plan, index, placesById, rerender) {
  const all = await getPlaces();
  const current = placesById[plan.stops[index].placeId];
  const inPlan = new Set(plan.stops.map(s => s.placeId));
  const kmOf = (x, y) => { const t = travelEstimate(x, y); return t ? t.km : 9e9; };
  const alts = all
    .filter(p => p.category === current.category && !inPlan.has(p.id))
    .sort((a, b) => kmOf(current, a) - kmOf(current, b))
    .slice(0, 3);

  if (!alts.length) { toast("No nearby alternatives"); return; }

  const body = el("div", {}, alts.map(p =>
    el("button.result-row", {
      onclick: () => {
        plan.stops[index].placeId = p.id;
        placesById[p.id] = p;
        close();
        rerender();
        toast(`Swapped to ${p.name}`);
      },
    }, [
      el("img.stop-thumb", { src: p.photo || photoFor(p), alt: "" }),
      el("div", {}, [
        el("div.result-name", { text: p.name }),
        (() => { const tt = travelEstimate(current, p); return el("div.result-addr", { text: `${p.area} · ${money(p.est_cost_for_two)}${tt ? " · " + fmtTravel(tt) : ""}` }); })(),
      ]),
    ])));

  const close = openSheet({ title: `Swap ${CATEGORIES[current.category].label.toLowerCase()}`, body });
}

// --- The Plan tab ---
export async function renderPlan(root, state) {
  const all = await getPlaces();
  const byId = Object.fromEntries(all.map(p => [p.id, p]));

  // Local working plan for this tab.
  let plan = state.workingPlan;

  const head = el("header.page-head", {}, [
    el("h1.page-title", { text: "Plan a day" }),
    el("p.page-sub", { text: "Pick a shape, we'll chain it by what's nearby." }),
  ]);

  const budgetCtl = budgetControl({ value: state.budget, onChange: (v) => {
    state.budget = v;
    if (plan) { plan.budget = v; refresh(); }
  }});
  const controls = el("div.panel", {}, [
    el("div.panel-label", { text: "Template" }),
    el("div.seg", {}, Object.entries(TEMPLATES).map(([k, t]) =>
      el("button" + (state.tpl === k ? ".on" : ""), {
        text: t.label,
        onclick: () => { state.tpl = k; generate(); },
      }))),
    el("div.panel-label", { text: "Budget", style: "margin-top:16px" }),
    budgetCtl,
  ]);

  const out = el("div");

  async function generate() {
    plan = await buildDayPlan({ template: state.tpl, budget: state.budget, vibe: state.vibe, setting: state.setting });
    state.workingPlan = plan;
    render();
  }
  function refresh() { render(); }

  function render() {
    // redraw controls seg active state
    controls.querySelectorAll(".seg button").forEach((b, idx) => {
      b.classList.toggle("on", Object.keys(TEMPLATES)[idx] === state.tpl);
    });
    out.replaceChildren();
    if (!plan || !plan.stops.length) {
      out.append(el("div.empty", {}, [
        el("div.empty-ico", { text: "🗺️" }),
        el("p.empty-title", { text: "Choose a template to build your day" }),
      ]));
      return;
    }
    const { node, spent } = itineraryEl(plan, {
      placesById: byId, editable: true,
      onSwap: (i) => swapStop(plan, i, byId, refresh),
    });
    out.append(
      el("div.panel", {}, [ el("div.panel-label", { text: "Budget so far" }), budgetMeter(spent, plan.budget) ]),
      node,
      el("div.row-split", { style: "margin-top:18px" }, [
        el("button.btn.btn-soft", { text: "🎲 New idea", onclick: generate }),
        el("button.btn.btn-primary", { text: "💾 Save plan", onclick: () => doSave(plan) }),
      ]),
    );
  }

  async function doSave(p) {
    const body = el("div", {}, [
      el("div.field", {}, [ el("label", { text: "Title" }),
        el("input.input#plan-title", { value: p.title }) ]),
      el("div.field", {}, [ el("label", { text: "Date (optional)" }),
        el("input.input#plan-date", { type: "date", value: p.date || "" }) ]),
      el("div.field", {}, [ el("label", { text: "Mode" }),
        el("div.seg#plan-mode", {}, [
          el("button" + (p.mode === "together" ? ".on" : ""), { text: "Plan together", dataset: { m: "together" } }),
          el("button" + (p.mode === "surprise" ? ".on" : ""), { text: "Surprise them", dataset: { m: "surprise" } }),
        ]) ]),
    ]);
    body.querySelector("#plan-mode").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      body.querySelectorAll("#plan-mode button").forEach(x => x.classList.remove("on"));
      b.classList.add("on"); p.mode = b.dataset.m;
    });
    const close = openSheet({
      title: "Save this plan", body,
      actions: [ el("button.btn.btn-primary.btn-block", { text: "Save", onclick: async () => {
        p.title = body.querySelector("#plan-title").value.trim() || p.title;
        p.date = body.querySelector("#plan-date").value;
        // Surprise mode: add reveal times (1h before each stop).
        if (p.mode === "surprise") {
          p.stops.forEach((s, i) => {
            if (i === 0) return;
            const [h, m] = s.time.split(":").map(Number);
            s.reveal_at = `${h - 1}:${String(m).padStart(2, "0")}`;
            s.hint = "Stop " + (i + 1);
          });
        }
        const id = await savePlan(structuredClone(p));
        close();
        toast("Plan saved ♡");
        clearDraft();
        location.hash = "#/plans";
      }}) ],
    });
  }

  root.append(head, controls, out);

  // Seed from a draft (from "Add to day") if present, else from template.
  const draft = getDraft();
  if (!plan && draft.stops.length) {
    plan = { template: null, budget: draft.budget || state.budget, mode: "together",
             title: "Your day in Sydney", date: "", stops: draft.stops };
    state.workingPlan = plan;
  }
  if (plan) render();
  else if (state.tpl) generate();
  else render();
}
