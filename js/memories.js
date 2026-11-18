// --- Memory map: pins every place with coordinates, lets you snap a photo at
// each one, and collects them all in the "M ❤ J" envelope. -----------------

import { el, clear, openSheet, toast, pageHeader, emptyState } from "./ui.js";
import { CATEGORIES } from "./data.js";
import { getPlaces, getMemories, addMemory } from "./store.js";

// --- MapLibre GL (loaded from CDN on first visit; SW leaves cross-origin alone) ---
let mlPromise = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mlPromise) return mlPromise;
  mlPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js";
    js.onload = () => resolve(window.maplibregl);
    js.onerror = () => reject(new Error("Could not load the map library (no connection?)"));
    document.head.appendChild(js);
  });
  return mlPromise;
}

// Poster palette — cream land, soft-blue water, navy streets, salmon parks.
const POSTER = {
  LAND: "#f5e1d1", WATER: "#88abce", ROAD: "#2a3560", ROAD2: "#3a477a",
  PARK: "#f2b89e", BUILDING: "#ecd6c5", BEACH: "#f6e7cf",
};
function recolorPoster(map) {
  for (const L of (map.getStyle().layers || [])) {
    const id = L.id.toLowerCase(), t = L.type;
    try {
      if (t === "background") map.setPaintProperty(L.id, "background-color", POSTER.LAND);
      else if (t === "fill" && /(water|ocean|sea|river|lake|bay|reservoir)/.test(id)) map.setPaintProperty(L.id, "fill-color", POSTER.WATER);
      else if (t === "line" && /(water|river|stream|canal)/.test(id)) map.setPaintProperty(L.id, "line-color", POSTER.WATER);
      else if (t === "fill" && /(sand|beach)/.test(id)) map.setPaintProperty(L.id, "fill-color", POSTER.BEACH);
      else if (t === "fill" && /(park|wood|forest|grass|green|golf|pitch|cemetery|scrub|meadow|nature)/.test(id)) map.setPaintProperty(L.id, "fill-color", POSTER.PARK);
      else if (t === "fill" && /building/.test(id)) map.setPaintProperty(L.id, "fill-color", POSTER.BUILDING);
      else if (t === "fill" && /(landuse|landcover|earth|land|residential|industrial)/.test(id)) map.setPaintProperty(L.id, "fill-color", POSTER.LAND);
      else if (t === "line" && /(motorway|trunk|primary)/.test(id)) map.setPaintProperty(L.id, "line-color", POSTER.ROAD);
      else if (t === "line" && /(road|street|highway|secondary|tertiary|bridge|tunnel|transport|rail|path|link)/.test(id)) map.setPaintProperty(L.id, "line-color", POSTER.ROAD2);
      else if (t === "symbol") map.setLayoutProperty(L.id, "visibility", "none"); // hide labels for the poster look
    } catch (e) { /* layer may not accept this property */ }
  }
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

  let maplibregl, places, memories;
  try {
    [maplibregl, places, memories] = await Promise.all([
      loadMapLibre(),
      getPlaces().catch(() => []),
      getMemories().catch(() => []),
    ]);
  } catch (e) {
    mapEl.append(emptyState("🗺️", "Map couldn't load", e.message));
    return;
  }

  const pinned = places.filter(p => p.lat != null && p.lng != null);

  // Build the map once the view is swapped into the DOM (so it has a size).
  setTimeout(() => {
    if (!mapEl.isConnected) return;
    let map;
    try {
      map = new maplibregl.Map({
        container: mapEl,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [151.14, -33.87], zoom: 10,
        attributionControl: { compact: true, customAttribution: "© OpenFreeMap · © OpenStreetMap" },
      });
    } catch (e) {
      mapEl.append(emptyState("🗺️", "Map couldn't start", e.message));
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    map.on("styledata", () => { if (map.isStyleLoaded()) recolorPoster(map); });
    map.on("load", () => {
      recolorPoster(map);
      for (const p of pinned) {
        const n = memories.filter(m => sameePlace(m, p)).length;
        const marker = new maplibregl.Marker({ color: "#e0557f" }).setLngLat([p.lng, p.lat]).addTo(map);
        const elm = marker.getElement();
        elm.style.cursor = "pointer";
        elm.title = `${CATEGORIES[p.category]?.icon || "📍"} ${p.name}${n ? ` · 📸 ${n}` : ""}`;
        elm.addEventListener("click", (ev) => { ev.stopPropagation(); openPlaceMemories(p); });
      }
      if (pinned.length) {
        const lats = pinned.map(p => p.lat), lngs = pinned.map(p => p.lng);
        const spanLat = Math.max(...lats) - Math.min(...lats);
        const spanLng = Math.max(...lngs) - Math.min(...lngs);
        // A far-flung outlier (e.g. an outback trip) would zoom the whole map out —
        // so focus on Sydney when the spread is huge.
        if (spanLat > 1.5 || spanLng > 1.5) {
          map.jumpTo({ center: [151.14, -33.87], zoom: 10 });
        } else {
          const b = new maplibregl.LngLatBounds();
          pinned.forEach(p => b.extend([p.lng, p.lat]));
          map.fitBounds(b, { padding: 40, maxZoom: 14, duration: 0 });
        }
      }
    });
  }, 60);
}
