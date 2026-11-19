// --- Plans tab: list, view, share, surprise reveal ------------------------

import { el, money, toast, openSheet, emptyState } from "./ui.js";
import { TEMPLATES, itineraryEl, budgetMeter } from "./planner.js";
import { getPlans, getPlan, getPlaces, deletePlan, currentUserId } from "./store.js";
import { APP_NAME } from "./config.js";

function fmtDate(d) {
  if (!d) return "No date set";
  try { return new Date(d + "T00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }
  catch { return d; }
}

// A surprise is hidden from the person who DIDN'T make it: they only ever see
// that it exists, its date and roughly how long it runs — never the contents.
function lockedForMe(plan, myId) {
  return plan.mode === "surprise" && plan.created_by && myId && plan.created_by !== myId;
}

// Human time label from "HH:MM".
function clock(t) {
  const d = timeToDec(t); let h = Math.floor(d); const m = Math.round((d - h) * 60);
  const ap = h >= 12 ? "pm" : "am"; let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")}${ap}`;
}
// Duration window (start–end) of a plan, without revealing any stop.
function planWindow(plan) {
  const ts = (plan.stops || []).map(s => s.time).filter(Boolean).map(timeToDec).sort((a, b) => a - b);
  if (!ts.length) return null;
  const back = (dec) => { let h = Math.floor(dec); const m = Math.round((dec - h) * 60); const ap = h >= 12 ? "pm" : "am"; let hh = h % 12; if (hh === 0) hh = 12; return `${hh}:${String(m).padStart(2, "0")}${ap}`; };
  if (ts.length === 1) return back(ts[0]);
  return `${back(ts[0])} – ${back(ts[ts.length - 1])}`;
}

// Current clock as 24h decimal, for surprise reveals.
function nowDec() { const n = new Date(); return n.getHours() + n.getMinutes() / 60; }
function timeToDec(t) { const [h, m] = (t || "0:0").split(":").map(Number); return h + (m || 0) / 60; }

export async function renderPlans(root) {
  root.append(el("header.page-head", {}, [
    el("h1.page-title", { text: "Our plans" }),
    el("p.page-sub", { text: "Saved days out. Tap to open, swap or share." }),
  ]));

  let plans = [];
  try { plans = await getPlans(); }
  catch (e) {
    console.error("load plans failed:", e);
    root.append(emptyState("⚠️", "Couldn't load your plans", (e.message || String(e))));
    return;
  }

  if (!plans.length) {
    root.append(emptyState("💌", "No plans yet", "Build one in the Plan tab, then save it here."));
    return;
  }

  const myId = await currentUserId().catch(() => null);

  root.append(el("div", {}, plans.map(p => {
    // A surprise someone else made: show only that it exists + date + duration.
    if (lockedForMe(p, myId)) {
      const win = planWindow(p);
      return el("button.card.plan-item", { onclick: () => location.hash = `#/plan/${p.id}` }, [
        el("div.plan-ico", { text: "🎁" }),
        el("div.plan-info", {}, [
          el("div.plan-name", { text: "A surprise is planned for you" }),
          el("div.plan-sub", { text: `${fmtDate(p.date)}${win ? " · " + win : ""}` }),
        ]),
        el("span.badge.badge-surprise", { text: "🔒" }),
      ]);
    }
    const badge = p.mode === "surprise"
      ? el("span.badge.badge-surprise", { text: "Surprise" })
      : el("span.badge.badge-together", { text: "Together" });
    return el("button.card.plan-item", { onclick: () => location.hash = `#/plan/${p.id}` }, [
      el("div.plan-ico", { text: p.mode === "surprise" ? "🎁" : "🗓️" }),
      el("div.plan-info", {}, [
        el("div.plan-name", { text: p.title }),
        el("div.plan-sub", { text: `${fmtDate(p.date)} · ${p.stops.length} stops` }),
      ]),
      badge,
    ]);
  })));
}

// Full-page plan view (route #/plan/:id). `viewer` = 'creator' | 'guest'.
export async function renderPlanDetail(root, id, viewer = "creator") {
  const plan = await getPlan(id);
  if (!plan) { root.append(emptyState("🤷", "Plan not found", "It may have been deleted.")); return; }

  // Not your surprise → you only ever see that it exists, its date and window.
  const myId = await currentUserId().catch(() => null);
  if (lockedForMe(plan, myId)) {
    const win = planWindow(plan);
    root.append(el("header.page-head", {}, [
      el("button.btn.btn-ghost", { text: "‹ Plans", style: "padding:6px 2px;margin-bottom:6px", onclick: () => location.hash = "#/plans" }),
      el("h1.page-title", { text: "A surprise 🎁" }),
      el("p.page-sub", { text: `${fmtDate(plan.date)}${win ? " · " + win : ""}` }),
    ]));
    root.append(emptyState("🤫", "It's a surprise",
      `Your other half has planned something for ${fmtDate(plan.date)}. You'll find out on the day — no peeking!`));
    return;
  }

  const all = await getPlaces();
  const byId = Object.fromEntries(all.map(p => [p.id, p]));

  const isSurprise = plan.mode === "surprise";
  const asGuest = viewer === "guest" && isSurprise;

  root.append(el("header.page-head", {}, [
    el("button.btn.btn-ghost", { text: "‹ Plans", style: "padding:6px 2px;margin-bottom:6px", onclick: () => location.hash = "#/plans" }),
    el("h1.page-title", { text: plan.title }),
    el("p.page-sub", { text: `${fmtDate(plan.date)} · ${plan.mode === "surprise" ? "Surprise mode" : "Plan together"}` }),
  ]));

  if (plan.plan_hints) root.append(el("div.notes-box", { text: "👟 " + plan.plan_hints, style: "margin-bottom:14px" }));

  // Reveal rule for surprise mode: a stop is visible once within its reveal
  // window (default 1h before) — and the creator always sees everything.
  const reveal = (stop) => {
    if (!asGuest) return true;
    if (!stop.reveal_at) return true; // first stop / no reveal set
    return nowDec() >= timeToDec(stop.reveal_at);
  };

  const container = el("div");
  function draw() {
    container.replaceChildren();
    const { node, spent } = itineraryEl(plan, { placesById: byId, reveal, editable: false });
    if (!asGuest) container.append(el("div.panel", {}, [ el("div.panel-label", { text: "Budget" }), budgetMeter(spent, plan.budget) ]));
    container.append(node);
  }
  draw();
  root.append(container);

  if (asGuest) {
    root.append(el("p.page-sub", { text: "Some stops unlock closer to the time — keep the app handy 😉", style: "text-align:center;margin-top:18px" }));
    return;
  }

  // Creator actions.
  root.append(el("div.panel", { style: "margin-top:18px" }, [
    el("div.panel-label", { text: "Share" }),
    el("div.row-split", {}, [
      el("button.btn.btn-primary", { text: "📤 Share", onclick: () => sharePlan(plan) }),
      el("button.btn.btn-soft", { text: "👁 Preview surprise", onclick: () => location.hash = `#/plan/${plan.id}?as=guest` }),
    ]),
    el("button.btn.btn-ghost.btn-block", { text: "🗑 Delete plan", style: "margin-top:10px;color:var(--bad)",
      onclick: () => confirmDelete(plan) }),
  ]));
}

async function sharePlan(plan) {
  const url = location.origin + location.pathname + `#/plan/${plan.id}`;
  const text = `${plan.title} — a plan on ${APP_NAME}`;
  if (navigator.share) {
    try { await navigator.share({ title: plan.title, text, url }); return; } catch { /* cancelled */ }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied to clipboard"); }
  catch { toast("Share not supported here"); }
}

function confirmDelete(plan) {
  const close = openSheet({
    title: "Delete this plan?",
    body: el("p.lede", { text: `"${plan.title}" will be removed. This can't be undone.` }),
    actions: [
      el("button.btn.btn-ghost", { text: "Cancel", onclick: () => close() }),
      el("button.btn.btn-primary", { text: "Delete", style: "background:var(--bad)", onclick: async () => {
        await deletePlan(plan.id); close(); toast("Plan deleted"); location.hash = "#/plans";
      }}),
    ],
  });
}
