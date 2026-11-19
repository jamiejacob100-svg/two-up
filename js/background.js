// --- Looping background video --------------------------------------------
// The video lives in a PRIVATE Supabase Storage bucket. We sign a short-lived
// URL (needs the logged-in session) and play it. We also try to cache the bytes
// so later opens are instant — but if that caching fetch is blocked, we just
// play the signed URL directly (media elements don't need CORS to play).

import { DEMO_MODE } from "./config.js";
import { toast } from "./ui.js";

const BUCKET = "media";
const FALLBACK_PATH = "background.mp4";
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

// Returns { url } on success, or { err } with a short human reason.
async function signedUrl() {
  const { supabase } = await import("./supabase.js");
  let path = FALLBACK_PATH, files = 0;
  try {
    const { data: list, error: lerr } = await supabase.storage.from(BUCKET).list("", { limit: 100 });
    if (lerr) return { err: "can't read bucket (" + lerr.message + ")" };
    files = (list || []).length;
    if (list && list.length) {
      const vid = list.find(f => /\.(mp4|m4v|mov|webm)$/i.test(f.name || "")) || list.find(f => f.name);
      if (vid && vid.name) path = vid.name;
    }
  } catch (e) { return { err: "list failed: " + (e && e.message) }; }
  if (!files) return { err: "bucket 'media' is empty" };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data || !data.signedUrl) return { err: "sign failed for '" + path + "': " + (error && error.message) };
  return { url: data.signedUrl };
}

// Returns { url } or { err }.
async function getVideoUrl() {
  const cached = await fromCache();
  if (cached) return { url: cached };
  const signed = await signedUrl();
  if (signed.err) return signed;
  // Try to download + cache the bytes for next time. If that fetch is blocked
  // (CORS etc.), fall back to playing the signed URL directly.
  try {
    const res = await fetch(signed.url);
    if (res.ok) {
      const blob = await res.blob();
      try { const c = await caches.open(CACHE_NAME); await c.put(CACHE_KEY, new Response(blob)); } catch {}
      return { url: URL.createObjectURL(blob) };
    }
  } catch (e) { console.info("[bg] cache fetch blocked, using direct URL:", e && e.message); }
  return { url: signed.url };
}

export async function mountBackgroundVideo() {
  if (DEMO_MODE) return;                               // no private storage in demo
  if (document.querySelector(".bg-video")) return;     // already mounted

  let res;
  try { res = await getVideoUrl(); } catch (e) { res = { err: (e && e.message) || "load error" }; }
  const url = res && res.url;
  if (!url) {
    const reason = (res && res.err) || "no video found";
    console.info("[bg]", reason);
    try { toast("🎬 Background video off — " + reason, 9000); } catch {}
    return;
  }

  const video = document.createElement("video");
  video.className = "bg-video";
  video.muted = true; video.loop = true; video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("muted", "");
  video.setAttribute("aria-hidden", "true");
  video.addEventListener("error", () => {
    const c = video.error && video.error.code;
    try { toast("🎬 Video found but won't play (format code " + c + ")", 9000); } catch {}
  });
  video.src = url;
  document.body.prepend(video);
  document.documentElement.classList.add("bg-video-on");
  document.body.classList.add("bg-video-on");
  video.play().catch(() => { /* autoplay may need a gesture on some browsers */ });
  console.info("[bg] background video mounted");
}
