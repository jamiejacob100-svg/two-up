// --- App shell: router, state, auth gating, init --------------------------

import { DEMO_MODE } from "./config.js";
import { el, clear, openSheet } from "./ui.js";
import { renderPick } from "./pick.js";
import { renderPlan } from "./planner.js";
import { renderPlans, renderPlanDetail } from "./plans.js";
import { renderPlaces } from "./places.js";
import { renderMemories } from "./memories.js";
import { loadCategoryPhotos } from "./store.js";
import { mountBackgroundVideo } from "./background.js";

const view = document.getElementById("view");

// Shared, in-memory UI state (filters persist while the app is open).
const state = {
  filters: { budget: 150, distanceKm: 25, center: null, nearMe: false,
             time: null, cats: new Set(), cuisines: new Set(), days: new Set(),
             dealType: null, zones: new Set(), treats: new Set(), beds: new Set(),
             vibes: new Set(), setting: null },
  tpl: "full", budget: 150, vibe: null, setting: null, workingPlan: null,
  rerender: () => route(),
};

function parseHash() {
  const raw = (location.hash || "#/pick").replace(/^#/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean); // e.g. ["plan","plan_abc"]
  const params = new URLSearchParams(query || "");
  return { parts, params };
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === tab));
}

// Render into a detached container, then swap it in — and only if this is
// still the most recent route() call. This makes overlapping route() calls
// (e.g. from rapid auth events) safe: no clear-then-append races, no duplicates.
let routeToken = 0;
async function route() {
  if (document.body.classList.contains("logged-out")) return; // login screen owns the view
  const token = ++routeToken;
  const { parts, params } = parseHash();
  const [a, b] = parts;
  const root = document.createElement("div");
  try {
    if (a === "plan" && b) {
      setActiveTab("plans");
      await renderPlanDetail(root, b, params.get("as") === "guest" ? "guest" : "creator");
    } else if (a === "plan") {
      setActiveTab("plan");
      await renderPlan(root, state);
    } else if (a === "plans") {
      setActiveTab("plans");
      await renderPlans(root, state);
    } else if (a === "places") {
      setActiveTab("places");
      await renderPlaces(root, state);
    } else if (a === "memories") {
      setActiveTab("memories");
      await renderMemories(root, state);
    } else {
      setActiveTab("pick");
      await renderPick(root, state);
    }
  } catch (err) {
    console.error("Route error:", err);
    root.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div>
      <p class="empty-title">Something went wrong</p>
      <p class="empty-sub">${err.message}</p></div>`;
  }
  if (token !== routeToken) return; // a newer route() superseded this one
  clear(view);
  while (root.firstChild) view.appendChild(root.firstChild);
  view.scrollTop = 0;
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

// --- iOS install hint (shown once on iPhone Safari that isn't installed) ---
function initInstallHint() {
  const hint = document.getElementById("install-hint");
  if (!hint) return;
  const isIOS = /iphone|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  const seen = (() => { try { return localStorage.getItem("twoup.install.seen"); } catch { return "1"; } })();
  if (isIOS && !standalone && !seen) hint.hidden = false;
  document.querySelector("[data-dismiss-install]")?.addEventListener("click", () => {
    hint.hidden = true;
    try { localStorage.setItem("twoup.install.seen", "1"); } catch {}
  });
}

// --- Enter the app (shared by demo + logged-in) ---
let started = false;
async function beginApp() {
  document.body.classList.remove("logged-out");
  if (!started) { started = true; initInstallHint(); }
  if (!location.hash) location.hash = "#/pick";
  try { await loadCategoryPhotos(); } catch {}   // small, cached — so cards have photos on first paint
  route();
  mountBackgroundVideo();                        // fire-and-forget, after first paint
}

// --- Profile button (top-right, logged-in non-demo) ---
function renderProfile(auth, user) {
  let btn = document.getElementById("profile-btn");
  if (!btn) {
    btn = el("button.profile-btn", { id: "profile-btn", "aria-label": "Account" });
    document.body.appendChild(btn);
  }
  btn.textContent = ((user.email || "?").trim()[0] || "?").toUpperCase();
  btn.onclick = () => openAccount(auth, user);
}
function removeProfile() { document.getElementById("profile-btn")?.remove(); }

function openAccount(auth, user) {
  const close = openSheet({
    title: "Account",
    body: el("div", {}, [
      el("p", { text: user.email || "Signed in", style: "font-weight:700;font-size:16px" }),
      el("p.page-sub", { text: "Signed in to Two Up.", style: "margin-top:2px" }),
    ]),
    actions: [
      el("button.btn.btn-ghost", { text: "Close", onclick: () => close() }),
      el("button.btn.btn-primary", { text: "Sign out", onclick: async () => { close(); await auth.signOut(); } }),
    ],
  });
}

async function showLogin(auth) {
  document.body.classList.add("logged-out");
  removeProfile();
  clear(view);
  auth.renderLogin(view);
}

// Only transition on an actual change of signed-in state — auth fires several
// events (initial session, signed-in, token refresh) and we must not re-render
// the whole app each time.
let authState = null; // "in" | "out"
function applyAuth(auth, session) {
  if (session && session.user) {
    renderProfile(auth, session.user);
    if (authState !== "in") { authState = "in"; beginApp(); }
  } else {
    if (authState !== "out") { authState = "out"; showLogin(auth); }
  }
}

// --- Boot ---
async function boot() {
  if (DEMO_MODE) {
    document.getElementById("demo-banner").hidden = false;
    beginApp();
    return;
  }
  // Configured: require login.
  const auth = await import("./auth.js");
  auth.onAuthChange((session) => applyAuth(auth, session));
  applyAuth(auth, await auth.getSession());
}

// --- Service worker ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(e => console.warn("SW failed:", e));
  });
}

boot();
