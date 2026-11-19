// --- Web push notifications ------------------------------------------------
// Asks permission, subscribes the device, and stores the subscription in
// Supabase so the Edge Function can push to the OTHER person when a plan is made.

import { DEMO_MODE, VAPID_PUBLIC } from "./config.js";
import { toast } from "./ui.js";

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported() {
  return !DEMO_MODE && "serviceWorker" in navigator && "PushManager" in window &&
    "Notification" in window && !!VAPID_PUBLIC;
}

export async function notificationsOn() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription()) && Notification.permission === "granted";
  } catch { return false; }
}

export async function enableNotifications() {
  if (!pushSupported()) {
    toast("Notifications aren't supported here. On iPhone, add the app to your home screen first.", 7000);
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Notifications weren't allowed"); return false; }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    const { supabase } = await import("./supabase.js");
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: data?.user?.id || null,
      endpoint: sub.endpoint,
      subscription: sub.toJSON(),
    }, { onConflict: "endpoint" });
    if (error) throw error;

    toast("Notifications are on 🔔");
    return true;
  } catch (e) {
    console.error("[push] enable failed:", e);
    toast("Couldn't turn on notifications: " + (e.message || e), 8000);
    return false;
  }
}

export async function disableNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        const { supabase } = await import("./supabase.js");
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      } catch {}
      await sub.unsubscribe();
    }
    toast("Notifications turned off");
    return true;
  } catch { return false; }
}
