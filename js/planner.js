// --- Day planner: templates, proximity chaining, travel, budget -----------

import { el, money, toast, openSheet, budgetControl } from "./ui.js";
import { CATEGORIES, TIME_SLOTS, photoFor, CITY_CENTER, zoneOf } from "./data.js";
import { travelEstimate, fmtTravel, directionsUrl, haversineKm } from "./geo.js";
import { getPlaces, savePlan } from "./store.js";

const DRAFT_KEY = "twoup.draft.v1";

// Each template is a time window (start→end, 24h decimal) plus a "shape": the
// ordered categories to try to fit. Stops are scheduled by real travel + how
// long each thing takes, and we stop once the day's time runs out — so a hike
// far away (long drive + long walk) naturally leaves room for little else.
export const TEMPLATES = {
  full:    { label: "Full day",   start: 9.5, end: 21,   shape: [["coffee"], ["activity", "beach"], ["food"], ["activity", "view", "beach"], ["food", "view"], ["drinks"]] },
  half:    { label: "Half day",   start: 10,  end: 16,   shape: [["coffee"], ["activity", "beach"], ["food"], ["dessert", "view"]] },
  evening: { label: "Evening",    start: 18,  end: 23,   shape: [["food"], ["dessert", "drinks"], ["view", "drinks"]] },
  quick:   { label: "Quick date", start: 11,  end: 14.5, shape: [["coffee"], ["activity", "dessert"]] },
};

// Numeric open/close (24h decimal) per category, for the hours check.
export function hoursFor(cat) {
  const map = {
    coffee: { open: 7, close: 15 }, food: { open: 11.5, close: 22 },
    activity: { open: 9, close: 17 }, view: { open: 0, close: 24 },
    drinks: { open: 16, close: 25 }, dessert: { open: 12, close: 23 },
    sidequest: { open: 0, close: 24 },
    bedrot: { open: 0, close: 24 },
    beach: { open: 6, close: 20 },
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

// Rough travel time between two places, in hours. Walk if very close, else drive
// at a speed that rises with distance (city crawl → highway for day trips).
function travelHours(a, b) {
  const km = haversineKm(a, b);
  if (km == null) return 0.2;                       // unknown coords → assume ~12 min
  if (km < 2.5) return Math.max(0.05, km / 4.5);    // walking
  const speed = km < 20 ? 24 : km < 60 ? 55 : 75;   // km/h, incl. real roads below
  return (km * 1.15) / speed;
}

// How long you'd actually spend at a place, in hours. Far-flung hikes / beaches
// are day trips, so they take much longer.
export function stopHours(place) {
  const base = { coffee: 0.75, food: 1.5, view: 2, drinks: 1.5, dessert: 0.75,
                 activity: 2.5, beach: 2.5, sidequest: 1.5, bedrot: 2 };
  let h = base[place.category] ?? 1.5;
  if (place.category === "activity" || place.category === "beach") {
    const farZone = ["bluemtns", "outback", "royal"].includes(zoneOf(place));
    const dist = (place.lat != null && place.lng != null) ? haversineKm(CITY_CENTER, place) : 0;
    if (farZone || dist > 45) h = Math.max(h, 4);        // Blue Mtns / outback / big hikes
    else if (dist > 20) h = Math.max(h, 3);              // further day-walks
  }
  return h;
}

// Decimal hours → "H:MM", rounded to the nearest 5 minutes.
function decToTime(dec) {
  let total = Math.round((dec * 60) / 5) * 5;
  let h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export async function buildDayPlan({ template, budget, vibe, setting }) {
  const all = await getPlaces();
  const tpl = TEMPLATES[template];
  const used = new Set();
  const stops = [];
  const shape = tpl.shape;

  const matches = (p, cats) => cats.includes(p.category)
    && (!vibe || (p.vibe || []).includes(vibe))
    && (!setting || setting === "either" || p.setting === "either" || p.setting === setting);

  let cursor = tpl.start;   // decimal hours, the running clock
  let prev = null;          // previous place
  let spent = 0;

  for (let i = 0; i < shape.length; i++) {
    const cats = shape[i];
    let pool = all.filter(p => !used.has(p.id) && matches(p, cats));
    if (!pool.length) pool = all.filter(p => !used.has(p.id) && cats.includes(p.category)); // relax
    if (!pool.length) continue;

    const slotsLeft = shape.length - i;
    const remaining = Math.max(0, budget - spent);
    const perSlot = remaining / slotsLeft;

    let candidates = pool.filter(p => (p.est_cost_for_two || 0) <= perSlot * 1.4);
    if (!candidates.length) {
      candidates = pool.slice().sort((a, b) => (a.est_cost_for_two || 0) - (b.est_cost_for_two || 0))
        .slice(0, Math.max(3, Math.ceil(pool.length * 0.4)));
    }

    const pick = weightedPick(candidates, (p) => {
      const km = prev ? haversineKm(prev, p) : null;
      const proximity = !prev ? 1 : (km != null ? Math.max(0.05, 1 - km / 40) : 0.6);
      const rating = (p.our_rating || 3.5) / 5;
      const cost = p.est_cost_for_two || 0;
      const budgetFit = perSlot > 0 ? Math.max(0.1, 1 - cost / (perSlot * 2 + 1)) : 0.5;
      return proximity * 1.4 + rating * 1.0 + budgetFit * 1.0;
    });

    const travel = prev ? travelHours(prev, pick) : 0;
    const arrival = Math.max(cursor + travel, tpl.start);
    const dur = stopHours(pick);
    // Once the day is already running, stop adding things that won't fit.
    if (stops.length && arrival + dur > tpl.end + 0.25) break;

    used.add(pick.id);
    stops.push({ placeId: pick.id, time: decToTime(arrival) });
    spent += pick.est_cost_for_two || 0;
    cursor = arrival + dur;
    prev = pick;

    if (cursor >= tpl.end) break; // day is full
  }

  return { template, budget, mode: "together", date: "", title: tpl.label + " in Sydney", stops };
}

// "9:5" / "9:30" → "09:30" for <input type="time">; "" stays "".
function padTime(t) {
  if (!t) return "";
  const m = String(t).match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return t;
  return `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
}

// --- Rendering an itinerary ---
// opts: { placesById, onSwap(index), reveal(stop)->bool, editable, onTimeChange(index, hhmm) }
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
          opts.editable && el("div.stop-actions", {}, [
            opts.onSwap && el("button.stop-swap", { text: "Swap", onclick: () => opts.onSwap(i) }),
            opts.onRemove && el("button.stop-remove", { text: "✕", title: "Remove", onclick: () => opts.onRemove(i) }),
          ]),
        ])
      : el("div.stop-card", {}, [
          el("div.stop-thumb", { style: "display:flex;align-items:center;justify-content:center;font-size:22px", text: "🔒" }),
          el("div.stop-info", {}, [
            el("div.stop-name", { text: stop.hint || "Surprise stop" }),
            el("div.stop-sub", { text: `Unlocks at ${stop.time}` }),
          ]),
        ]);

    const timeEl = (opts.editable && opts.onTimeChange && revealed)
      ? el("input.stop-time-input", {
          type: "time", value: padTime(stop.time),
          onchange: (e) => opts.onTimeChange(i, e.target.value),
        })
      : el("div.stop-time", { text: stop.time });

    wrap.append(el("div.stop", {}, [
      timeEl,
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

// --- Build from scratch: add a stop by hand -------------------------------
// A sensible start time for the next stop: after the last one finishes
// (its duration + a little travel), else a gentle 9:30 morning start.
function defaultNextTime(plan, byId) {
  const stops = plan.stops || [];
  if (!stops.length) return "9:30";
  const last = stops[stops.length - 1];
  const lastPlace = byId[last.placeId];
  const dur = lastPlace ? stopHours(lastPlace) : 1.5;
  let dec = timeToDec(last.time || "9:30") + dur + 0.25;
  if (dec >= 23.5) dec = 23.5;
  return decToTime(dec);
}

function addStop(plan, byId, rerender) {
  const all = Object.values(byId);
  const inPlan = new Set(plan.stops.map(s => s.placeId));
  let activeCat = null;

  const list = el("div.add-list");
  const chips = el("div.add-cats");

  function drawList() {
    list.replaceChildren();
    let pool = all.filter(p => !inPlan.has(p.id));
    if (activeCat) pool = pool.filter(p => p.category === activeCat);
    pool.sort((a, b) => (b.our_rating || 0) - (a.our_rating || 0));
    if (!pool.length) { list.append(el("p.lede", { text: "Nothing left in this category." })); return; }
    pool.slice(0, 40).forEach(p => {
      const c = CATEGORIES[p.category];
      list.append(el("button.result-row", {
        onclick: () => {
          plan.stops.push({ placeId: p.id, time: defaultNextTime(plan, byId) });
          plan.stops.sort((x, y) => timeToDec(x.time) - timeToDec(y.time));
          close();
          rerender();
          toast(`Added ${p.name}`);
        },
      }, [
        el("img.stop-thumb", { src: p.photo || photoFor(p), alt: "" }),
        el("div", {}, [
          el("div.result-name", { text: p.name }),
          el("div.result-addr", { text: `${c.icon} ${c.label} · ${p.area} · ${money(p.est_cost_for_two)}` }),
        ]),
      ]));
    });
  }

  // Category filter chips (All + each category that has places left).
  const cats = [...new Set(all.filter(p => !inPlan.has(p.id)).map(p => p.category))];
  const chipBtn = (key, label) => {
    const b = el("button.add-chip" + (activeCat === key ? ".on" : ""), { text: label, onclick: () => {
      activeCat = key;
      chips.querySelectorAll(".add-chip").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      drawList();
    }});
    return b;
  };
  chips.append(chipBtn(null, "All"));
  cats.forEach(k => chips.append(chipBtn(k, `${CATEGORIES[k].icon} ${CATEGORIES[k].label}`)));

  drawList();
  const close = openSheet({ title: "Add a stop", body: el("div", {}, [chips, list]) });
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
    el("button.btn.btn-soft.btn-block", { text: "✏️ Build your own from scratch", style: "margin-top:12px",
      onclick: () => startScratch() }),
    el("div.panel-label", { text: "Budget", style: "margin-top:16px" }),
    budgetCtl,
  ]);

  const out = el("div");

  async function generate() {
    plan = await buildDayPlan({ template: state.tpl, budget: state.budget, vibe: state.vibe, setting: state.setting });
    state.workingPlan = plan;
    render();
  }
  function startScratch() {
    state.tpl = null;
    plan = { template: null, budget: state.budget, mode: "together", title: "My plan", date: "", stops: [] };
    state.workingPlan = plan;
    render();
    addStop(plan, byId, refresh); // jump straight into picking the first stop
  }
  function refresh() { render(); }

  function render() {
    // redraw controls seg active state
    controls.querySelectorAll(".seg button").forEach((b, idx) => {
      b.classList.toggle("on", Object.keys(TEMPLATES)[idx] === state.tpl);
    });
    out.replaceChildren();

    // No plan yet → invite choosing a template or building from scratch.
    if (!plan) {
      out.append(el("div.empty", {}, [
        el("div.empty-ico", { text: "🗺️" }),
        el("p.empty-title", { text: "Choose a template, or build your own" }),
        el("button.btn.btn-primary", { text: "✏️ Start from scratch", style: "margin-top:14px",
          onclick: () => startScratch() }),
      ]));
      return;
    }

    const scratch = !plan.template;
    const { node, spent } = itineraryEl(plan, {
      placesById: byId, editable: true,
      onSwap: (i) => swapStop(plan, i, byId, refresh),
      onRemove: scratch ? (i) => { plan.stops.splice(i, 1); refresh(); } : undefined,
      onTimeChange: (i, hhmm) => { if (hhmm) { plan.stops[i].time = hhmm; } },
    });

    out.append(el("div.panel", {}, [ el("div.panel-label", { text: "Budget so far" }), budgetMeter(spent, plan.budget) ]));

    if (plan.stops.length) out.append(node);
    else out.append(el("div.empty", { style: "padding:28px 10px" }, [
      el("div.empty-ico", { text: "➕" }),
      el("p.empty-title", { text: "Your plan is empty — add your first stop" }),
    ]));

    out.append(el("button.btn.btn-soft.btn-block", { text: "➕ Add a stop", style: "margin-top:14px",
      onclick: () => addStop(plan, byId, refresh) }));

    out.append(el("div.row-split", { style: "margin-top:12px" }, [
      scratch
        ? el("button.btn.btn-ghost", { text: "↺ Clear", onclick: () => { plan.stops = []; refresh(); } })
        : el("button.btn.btn-soft", { text: "🎲 New idea", onclick: generate }),
      el("button.btn.btn-primary", { text: "💾 Save plan", onclick: () => doSave(plan),
        disabled: plan.stops.length ? null : true }),
    ]));
  }

  async function doSave(p) {
    const body = el("div", {}, [
      el("div.field", {}, [ el("label", { text: "Title" }),
        el("input.input", { id: "plan-title", value: p.title }) ]),
      el("div.field", {}, [ el("label", { text: "Date (optional)" }),
        el("input.input", { id: "plan-date", type: "date", value: p.date || "" }) ]),
      el("div.field", {}, [ el("label", { text: "Mode" }),
        el("div.seg", { id: "plan-mode" }, [
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
        // Keep stops in chronological order (manual builds / edited times).
        p.stops.sort((a, b) => timeToDec(a.time || "0:0") - timeToDec(b.time || "0:0"));
        // Surprise mode: add reveal times (1h before each stop).
        if (p.mode === "surprise") {
          p.stops.forEach((s, i) => {
            if (i === 0) return;
            const [h, m] = s.time.split(":").map(Number);
            s.reveal_at = `${h - 1}:${String(m).padStart(2, "0")}`;
            s.hint = "Stop " + (i + 1);
          });
        }
        try {
          await savePlan(JSON.parse(JSON.stringify(p)));
          close();
          toast("Plan saved ♡");
          clearDraft();
          location.hash = "#/plans";
        } catch (e) {
          console.error("save plan failed:", e);
          toast("Couldn't save the plan: " + (e.message || e), 9000);
        }
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
