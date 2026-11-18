// --- Memory map: pins every place with coordinates, lets you snap a photo at
// each one, and collects them all in the "M ❤ J" envelope. -----------------

import { el, clear, openSheet, toast, pageHeader, emptyState } from "./ui.js";
import { CATEGORIES } from "./data.js";
import { getPlaces, getMemories, addMemory } from "./store.js";

// --- Leaflet (loaded from CDN on first visit; SW leaves cross-origin alone) ---
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = () => resolve(window.L);
    js.onerror = () => reject(new Error("Could not load the map library (no connection?)"));
    document.head.appendChild(js);
  });
  return leafletPromise;
}

// Shrink a captured photo to a data URI so it stores comfortably in the DB.
function compress(file, maxW = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

const catLabel = (p) => (CATEGORIES[p.category]?.label) || "Place";
const sameePlace = (mem, place) =>
  (mem.place_id && place.id) ? mem.place_id === place.id
    : (mem.place_name || "").toLowerCase() === (place.name || "").toLowerCase();

// A hidden file input wired to the camera / photo library.
function photoPicker(place, onSaved) {
  const input = el("input", { type: "file", accept: "image/*", capture: "environment",
    style: "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" });
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    try {
      toast("Saving photo…");
      const photo_url = await compress(file);
      await addMemory({ place_id: place.id, place_name: place.name, photo_url });
      toast(`Saved to ${place.name} 💛`);
      onSaved && onSaved();
    } catch (e) {
      console.error(e);
      toast("Couldn't save that photo");
    }
  });
  const btn = el("button.btn.btn-primary", { style: "width:100%",
    onclick: () => input.click(), html: "📸 Take / add a photo" });
  return el("div", {}, [btn, input]);
}

// Tap a pin → this place's photos + a button to add one.
function openPlaceMemories(place) {
  const body = el("div");
  const refresh = async () => {
    clear(body);
    let mems = [];
    try { mems = (await getMemories()).filter(m => sameePlace(m, place)); } catch {}
    body.append(
      el("p.page-sub", { text: place.area ? `${catLabel(place)} · ${place.area}` : catLabel(place),
        style: "margin:-2px 0 10px" }),
      photoPicker(place, refresh),
      mems.length
        ? el("div.memory-grid", { style: "margin-top:12px" },
            mems.map(m => el("img.memory-photo", { src: m.photo_url, alt: place.name, loading: "lazy" })))
        : el("p.page-sub", { text: "No photos here yet — add your first one.", style: "margin-top:12px" }),
    );
  };
  refresh();
  openSheet({ title: place.name, body });
}

// The envelope: every photo, grouped under the place it was taken at.
async function openEnvelope() {
  let mems = [];
  try { mems = await getMemories(); } catch {}
  const body = el("div");
  if (!mems.length) {
    body.append(emptyState("✉️", "Your envelope is empty",
      "Tap a pin on the map and add a photo to start collecting your memories."));
  } else {
    const groups = new Map();
    for (const m of mems) {
      const k = m.place_name || "Somewhere";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    body.append(el("p.page-sub", { text: `${mems.length} photo${mems.length === 1 ? "" : "s"} across ${groups.size} place${groups.size === 1 ? "" : "s"}.`, style: "margin:-2px 0 6px" }));
    for (const [name, list] of groups) {
      body.append(
        el("h3.memory-heading", { text: name }),
        el("div.memory-grid", {},
          list.map(m => el("img.memory-photo", { src: m.photo_url, alt: name, loading: "lazy" }))),
      );
    }
  }
  openSheet({ title: "M ❤ J — our memories", body });
}

export async function renderMemories(root, state) {
  root.append(pageHeader("Memory map", "Every place you've saved. Tap a pin to add a photo."));

  const mapEl = el("div.memory-map", { id: "memory-map" });
  root.append(mapEl);

  // Floating "M ❤ J" envelope.
  const envelope = el("button.envelope-btn", { "aria-label": "Open our memories", onclick: openEnvelope }, [
    el("span.env-ico", { text: "✉️" }),
    el("span.env-label", {}, ["M ", el("span.env-heart", { text: "❤" }), " J"]),
  ]);
  root.append(envelope);

  let L, places = [], memories = [];
  try {
    [L, places, memories] = await Promise.all([
      loadLeaflet(),
      getPlaces().catch(() => []),
      getMemories().catch(() => []),
    ]);
  } catch (e) {
    mapEl.append(emptyState("🗺️", "Map couldn't load", e.message));
    return;
  }

  const pinned = places.filter(p => p.lat != null && p.lng != null);

  const map = L.map(mapEl, { zoomControl: true, attributionControl: true })
    .setView([-33.87, 151.21], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  }).addTo(map);

  const pts = [];
  for (const p of pinned) {
    const n = memories.filter(m => sameePlace(m, p)).length;
    const marker = L.marker([p.lat, p.lng]).addTo(map);
    marker.bindTooltip(`${CATEGORIES[p.category]?.icon || "📍"} ${p.name}${n ? ` · 📸 ${n}` : ""}`);
    marker.on("click", () => openPlaceMemories(p));
    pts.push([p.lat, p.lng]);
  }

  // The view is built detached then swapped in, so size the map after it lands.
  setTimeout(() => {
    map.invalidateSize();
    if (pts.length) {
      const lats = pts.map(p => p[0]), lngs = pts.map(p => p[1]);
      const spanLat = Math.max(...lats) - Math.min(...lats);
      const spanLng = Math.max(...lngs) - Math.min(...lngs);
      // A far-flung outlier (e.g. an outback trip) would zoom the whole map out,
      // hiding the Sydney cluster — so focus on Sydney when the spread is huge.
      if (spanLat > 1.5 || spanLng > 1.5) map.setView([-33.87, 151.21], 11);
      else map.fitBounds(pts, { padding: [36, 36], maxZoom: 14 });
    }
  }, 60);

}
