// --- Service worker: cache the app shell for offline / fast loads ---------
// Bump CACHE when you change any shell file so clients pick up the new copy.

const CACHE = "twoup-shell-v21";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./js/app.js",
  "./js/config.js",
  "./js/data.js",
  "./js/geo.js",
  "./js/store.js",
  "./js/db.local.js",
  "./js/places-api.js",
  "./js/ui.js",
  "./js/components.js",
  "./js/planner.js",
  "./js/narrowing.js",
  "./js/swipe.js",
  "./js/pick.js",
  "./js/plans.js",
  "./js/places.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // let cross-origin pass through

  // Navigations: fall back to cached index.html when offline.
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  // App code (js/css/html/json/manifest): network-first, so a new deploy
  // shows up immediately when online. Falls back to cache when offline.
  if (/\.(js|mjs|css|html|json|webmanifest)$/i.test(url.pathname)) {
    e.respondWith(
      fetch(request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Everything else (images, icons, fonts): cache-first, refresh in background.
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
