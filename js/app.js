// --- App shell: router, state, auth gating, init --------------------------

import { DEMO_MODE } from "./config.js";
import { el, clear } from "./ui.js";
import { renderPick } from "./pick.js";
import { renderPlan } from "./planner.js";
import { renderPlans, renderPlanDetail } from "./plans.js";
import { renderPlaces } from "./places.js";

const view = document.getElementById("view");

// Shared, in-memory UI state (filters persist while the app is open).
const state = {
  filters: { budget: 150, distanceKm: 25, center: null, nearMe: false,
             time: null, cats: new Set(), vibes: new Set(), setting: null },
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

async function route() {
  if (document.body.classList.contains("logged-out")) return; // login screen owns the view
  const { parts, params } = parseHash();
  clear(view);
  view.scrollTop = 0;
  window.scrollTo(0, 0);

  const [a, b] = parts;
  try {
    if (a === "plan" && b) {
      setActiveTab("plans");
      await renderPlanDetail(view, b, params.get("as") === "guest" ? "guest" : "creator");
    } else if (a === "plan") {
      setActiveTab("plan");
      await renderPlan(view, state);
    } else if (a === "plans") {
      setActiveTab("plans");
      await renderPlans(view, state);
    } else if (a === "places") {
      setActiveTab("places");
      await renderPlaces(view, state);
    } else {
      setActiveTab("pick");
      await renderPick(view, state);
    }
  } catch (err) {
    console.error("Route error:", err);
    view.innerHTML = `<div class="empty"><div class="empty-ico">⚠️</div>
      <p class="empty-title">Something went wrong</p>
      <p class="empty-sub">${err.message}</p></div>`;
  }
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
function beginApp() {
  document.body.classList.remove("logged-out");
  if (!started) { started = true; initInstallHint(); }
  if (!location.hash) location.hash = "#/pick";
  route();
}

// --- Account bar (logged-in, non-demo only) ---
function renderAccountBar(auth, user) {
  let bar = document.getElementById("account-bar");
  if (!bar) {
    bar = el("div.account-bar#account-bar");
    document.body.insertBefore(bar, view);
  }
  bar.replaceChildren(
    el("span.account-email", { text: user.email || "Signed in" }),
    el("button.account-signout", { text: "Sign out", onclick: async () => { await auth.signOut(); } }),
  );
}
function removeAccountBar() { document.getElementById("account-bar")?.remove(); }

async function showLogin(auth) {
  document.body.classList.add("logged-out");
  removeAccountBar();
  clear(view);
  auth.renderLogin(view);
}

function applyAuth(auth, session) {
  if (session && session.user) { renderAccountBar(auth, session.user); beginApp(); }
  else { showLogin(auth); }
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
