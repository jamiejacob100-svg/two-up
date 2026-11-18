// --- Looping background video --------------------------------------------
// The video lives in a PRIVATE Supabase Storage bucket. We sign a short-lived
// URL (needs the logged-in session), download the file once, and cache the
// bytes in the Cache API so later opens are instant and never re-download.

import { DEMO_MODE } from "./config.js";

const BUCKET = "media";
const VIDEO_PATH = "background.mp4";
const CACHE_NAME = "twoup-bg-media";     // kept across deploys (see sw.js activate)
const CACHE_KEY = "/__bg/background.mp4";

async function fromCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(CACHE_KEY);
    if (hit) return URL.createObjectURL(await hit.blob());
  } catch {}
  return null;
}

async function fetchSignAndCache() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(VIDEO_PATH, 3600);
  if (error || !data || !data.signedUrl) return null;
  const res = await fetch(data.signedUrl);
  if (!res.ok) return null;
  const blob = await res.blob();
  try { const cache = await caches.open(CACHE_NAME); await cache.put(CACHE_KEY, new Response(blob)); } catch {}
  return URL.createObjectURL(blob);
}

export async function mountBackgroundVideo() {
  if (DEMO_MODE) return;                              // no private storage in demo
  if (document.querySelector(".bg-video")) return;    // already mounted

  let url = await fromCache();
  if (!url) { try { url = await fetchSignAndCache(); } catch { url = null; } }
  if (!url) return;                                   // not uploaded yet / offline — app stays normal

  const video = document.createElement("video");
  video.className = "bg-video";
  video.src = url;
  video.muted = true; video.loop = true; video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.setAttribute("aria-hidden", "true");
  document.body.prepend(video);
  document.documentElement.classList.add("bg-video-on");
  document.body.classList.add("bg-video-on");
  video.play().catch(() => { /* autoplay may need a gesture on some browsers */ });
}
