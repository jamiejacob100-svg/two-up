// --- Shared UI helpers -----------------------------------------------------

// Tiny hyperscript: el('div.card', {onclick}, [children])
export function el(sel, props = {}, children = []) {
  const [tag, ...cls] = sel.split(".");
  const node = document.createElement(tag || "div");
  if (cls.length) node.className = cls.join(" ");
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "dataset") {
      Object.assign(node.dataset, v);
    } else {
      node.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function money(n) {
  if (n == null) return "—";
  if (n === 0) return "Free";
  return "$" + Math.round(n);
}

export function stars(rating) {
  if (rating == null) return "";
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(Math.max(0, 5 - full));
}

// --- Toast ---
export function toast(msg, ms = 2200) {
  const root = document.getElementById("toast-root");
  const t = el("div.toast", { text: msg });
  root.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, ms);
}

// --- Bottom sheet ---
// openSheet({ title, body, onClose }) -> returns a close() function.
export function openSheet({ title = "", body, actions = [], onClose } = {}) {
  const root = document.getElementById("sheet-root");
  const close = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); onClose && onClose(); }, 260);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  const sheet = el("section.sheet", { role: "dialog", "aria-modal": "true" }, [
    el("div.sheet-grip"),
    title && el("header.sheet-head", {}, [
      el("h2.sheet-title", { text: title }),
      el("button.sheet-close", { "aria-label": "Close", onclick: close, html: "✕" }),
    ]),
    el("div.sheet-body", {}, [body]),
    actions.length && el("footer.sheet-actions", {}, actions),
  ]);
  const overlay = el("div.sheet-overlay", { onclick: (e) => { if (e.target === overlay) close(); } }, [sheet]);

  root.append(overlay);
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => { overlay.classList.add("show"); sheet.classList.add("show"); });
  return close;
}

// Budget control: a slider + an editable number you can tap and type into.
// Both stay in sync; onChange(value) fires on either. The number input may
// exceed the slider's max (the slider just pins to its max).
// Generic slider + editable number, kept in sync. The number may exceed the
// slider's max (the slider just pins to its max). prefix/suffix label it.
export function rangeControl({ value, min = 0, max = 400, step = 10, prefix = "", suffix = "", label = "value", onChange }) {
  const num = el("input.budget-num", { type: "number", min: String(min), step: String(step),
    value: String(value), inputmode: "numeric", "aria-label": label });
  const range = el("input", { type: "range", min: String(min), max: String(max), step: "1",
    value: String(Math.min(value, max)) });
  const sync = (v, from) => {
    if (isNaN(v)) v = min;
    v = Math.max(min, Math.round(v));
    if (from !== "num") num.value = String(v);
    if (from !== "range") range.value = String(Math.min(v, max));
    onChange(v);
  };
  range.addEventListener("input", (e) => sync(+e.target.value, "range"));
  num.addEventListener("input", (e) => sync(+e.target.value, "num"));
  num.addEventListener("focus", () => num.select());
  return el("div.range-row", {}, [ range,
    el("label.budget-val", {}, [
      prefix && el("span.budget-cur", { text: prefix }),
      num,
      suffix && el("span.budget-suf", { text: suffix }),
    ]) ]);
}

export function budgetControl({ value, min = 0, max = 400, step = 10, onChange }) {
  return rangeControl({ value, min, max, step, prefix: "$", label: "Budget", onChange });
}

export function distanceControl({ value, min = 1, max = 25, step = 1, onChange }) {
  return rangeControl({ value, min, max, step, suffix: "km", label: "Max distance", onChange });
}

export function pageHeader(title, subtitle) {
  return el("header.page-head", {}, [
    el("h1.page-title", { text: title }),
    subtitle && el("p.page-sub", { text: subtitle }),
  ]);
}

export function emptyState(icon, title, sub) {
  return el("div.empty", {}, [
    el("div.empty-ico", { text: icon }),
    el("p.empty-title", { text: title }),
    sub && el("p.empty-sub", { text: sub }),
  ]);
}
