// --- Swipe deck (Tinder-style) --------------------------------------------
// Left  = not interested (pass)
// Right = save for later  (store.addSaved)
// Up    = do it now        (planner.addToDraft → shows in Plan)
// Buttons and ← → ↑ keys mirror the gestures.

import { el, money, toast } from "./ui.js";
import { CATEGORIES, photoFor } from "./data.js";
import { addSaved } from "./store.js";
import { addToDraft } from "./planner.js";
import { openDetail } from "./components.js";

const THRESHOLD = 95; // px before a drag counts as a swipe

export function openSwipe(places, { onDone } = {}) {
  places = places.slice();
  let i = 0;
  let busy = false;
  const counts = { saved: 0, now: 0, passed: 0 };

  const countEl = el("div.swipe-count");
  const stack = el("div.swipe-stack");
  const controls = el("div.swipe-controls", {}, [
    ctrlBtn("nope", "✕", "Not interested", () => commit("left")),
    ctrlBtn("save", "♡", "Save for later", () => commit("right")),
    ctrlBtn("now", "⚡", "Do it now", () => commit("up")),
  ]);
  const legend = el("div.swipe-legend", {}, [
    el("span", { html: "<b>✕</b> Pass" }),
    el("span", { html: "<b>♡</b> Save for later" }),
    el("span", { html: "<b>⚡</b> Do it now" }),
  ]);

  const overlay = el("div.swipe-overlay", {}, [
    el("div.swipe-head", {}, [
      el("button.swipe-x", { html: "✕", "aria-label": "Close", onclick: close }),
      el("div.swipe-title", { text: "Swipe to pick" }),
      countEl,
    ]),
    stack, controls, legend,
  ]);

  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
  render();

  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.classList.add("closing");
    setTimeout(() => overlay.remove(), 200);
    onDone && onDone(counts);
  }
  function onKey(e) {
    if (e.key === "Escape") return close();
    if (i >= places.length || busy) return;
    if (e.key === "ArrowLeft") commit("left");
    else if (e.key === "ArrowRight") commit("right");
    else if (e.key === "ArrowUp") commit("up");
  }

  function render() {
    stack.replaceChildren();
    if (i >= places.length) {
      countEl.textContent = "";
      controls.classList.add("hidden");
      legend.classList.add("hidden");
      stack.append(endScreen());
      return;
    }
    countEl.textContent = `${i + 1} / ${places.length}`;
    if (places[i + 1]) {
      const behind = cardEl(places[i + 1]);
      behind.classList.add("behind");
      stack.append(behind);
    }
    const active = cardEl(places[i]);
    active.classList.add("active");
    attachDrag(active);
    stack.append(active);
  }

  function cardEl(place) {
    const cat = CATEGORIES[place.category];
    const card = el("div.swipe-card", {}, [
      el("img.swipe-photo", { src: place.photo || photoFor(place), alt: place.name, draggable: "false" }),
      el("div.swipe-grad"),
      el("div.stamp.save", { text: "SAVE" }),
      el("div.stamp.nope", { text: "NOPE" }),
      el("div.stamp.now", { text: "DO NOW" }),
      el("div.swipe-info", {}, [
        el("div.swipe-name", { text: place.name }),
        el("div.swipe-meta", { text: `${cat.icon} ${cat.label} · ${place.area} · ${money(place.est_cost_for_two)}` }),
        place.our_notes && el("div.swipe-notes", { text: place.our_notes }),
        el("button.swipe-detail", { html: "ⓘ Details", onclick: (e) => { e.stopPropagation(); openDetail(place); } }),
      ]),
    ]);
    return card;
  }

  function attachDrag(card) {
    let sx = 0, sy = 0, dragging = false;
    const nope = card.querySelector(".nope");
    const save = card.querySelector(".save");
    const now = card.querySelector(".now");

    card.addEventListener("pointerdown", (e) => {
      if (busy || e.target.closest(".swipe-detail")) return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      card.setPointerCapture(e.pointerId);
      card.style.transition = "none";
    });
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx * 0.05}deg)`;
      const up = dy < 0 && Math.abs(dy) > Math.abs(dx);
      now.style.opacity = up ? clamp(-dy / THRESHOLD) : 0;
      save.style.opacity = !up ? clamp(dx / THRESHOLD) : 0;
      nope.style.opacity = !up ? clamp(-dx / THRESHOLD) : 0;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (dy < -THRESHOLD && Math.abs(dy) > Math.abs(dx)) commit("up", card);
      else if (dx > THRESHOLD) commit("right", card);
      else if (dx < -THRESHOLD) commit("left", card);
      else snapBack(card);
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", () => { dragging = false; snapBack(card); });
  }

  function snapBack(card) {
    card.style.transition = "transform .25s ease";
    card.style.transform = "";
    card.querySelectorAll(".stamp").forEach(s => s.style.opacity = 0);
  }

  function commit(dir, card) {
    if (busy || i >= places.length) return;
    busy = true;
    card = card || stack.querySelector(".swipe-card.active");
    const place = places[i];
    const dest = dir === "left" ? "translate(-140%, -20px) rotate(-22deg)"
      : dir === "right" ? "translate(140%, -20px) rotate(22deg)"
      : "translate(0, -140%) rotate(-4deg)";
    if (card) {
      card.style.transition = "transform .28s ease, opacity .28s ease";
      card.style.transform = dest;
      card.style.opacity = "0";
    }
    setTimeout(() => {
      if (dir === "right") { addSaved(place.id); counts.saved++; }
      else if (dir === "up") { addToDraft(place.id); counts.now++; }
      else counts.passed++;
      i++;
      busy = false;
      render();
    }, 240);
  }

  function endScreen() {
    const bits = [];
    if (counts.now) bits.push(`⚡ ${counts.now} added to today`);
    if (counts.saved) bits.push(`♡ ${counts.saved} saved for later`);
    return el("div.swipe-end", {}, [
      el("div.swipe-end-ico", { text: counts.now || counts.saved ? "🎉" : "✨" }),
      el("h2", { text: counts.now || counts.saved ? "Nice picks!" : "All done" }),
      el("p.swipe-end-sub", { text: bits.length ? bits.join("  ·  ") : "Nothing caught your eye this round." }),
      el("div.swipe-end-actions", {}, [
        counts.now && el("button.btn.btn-primary", { text: "Open today's plan", onclick: () => { close(); location.hash = "#/plan"; } }),
        el("button.btn.btn-soft", { text: "Done", onclick: close }),
      ]),
    ]);
  }

  function ctrlBtn(cls, glyph, label, onClick) {
    return el(`button.swipe-btn.${cls}`, { html: glyph, "aria-label": label, title: label, onclick: onClick });
  }
}

function clamp(n) { return Math.max(0, Math.min(1, n)); }
