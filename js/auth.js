// --- Auth (email + password) ----------------------------------------------
// Loaded lazily by app.js only when Supabase is configured. No magic links:
// on iPhone a magic link opens Safari instead of the home-screen app.

import { supabase } from "./supabase.js";
import { el } from "./ui.js";
import { APP_NAME } from "./config.js";

export async function getSession() {
  try { const { data } = await supabase.auth.getSession(); return data.session || null; }
  catch { return null; }
}
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}
export async function signOut() { return supabase.auth.signOut(); }
export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}

// Renders the login screen into `root`. Sign-in success is handled by the
// onAuthChange listener in app.js, so this just drives the form.
export function renderLogin(root) {
  const email = el("input.input", { type: "email", placeholder: "you@example.com",
    autocomplete: "username", inputmode: "email" });
  const pass = el("input.input", { type: "password", placeholder: "Password",
    autocomplete: "current-password" });
  const err = el("div.login-err", { hidden: true });
  const btn = el("button.btn.btn-primary.btn-block.btn-lg", { type: "submit", text: "Log in" });

  const submit = async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!email.value || !pass.value) { showErr("Enter your email and password."); return; }
    btn.disabled = true; btn.textContent = "Logging in…";
    const { error } = await signIn(email.value, pass.value);
    btn.disabled = false; btn.textContent = "Log in";
    if (error) showErr(friendlyError(error));
    // success → onAuthChange in app.js swaps to the app.
  };
  function showErr(m) { err.textContent = m; err.hidden = false; }
  function friendlyError(error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("invalid login")) return "Wrong email or password.";
    if (m.includes("fetch") || m.includes("network")) return "Couldn't reach the server — check your connection and the Supabase URL in config.js.";
    if (m.includes("email not confirmed")) return "This account isn't confirmed yet (tick “Auto Confirm User” when creating it).";
    return error.message || "Could not log in.";
  }

  const form = el("form.login-form", { onsubmit: submit }, [
    el("div.field", {}, [ el("label", { text: "Email" }), email ]),
    el("div.field", {}, [ el("label", { text: "Password" }), pass ]),
    err,
    btn,
  ]);

  root.replaceChildren(el("div.login-wrap", {}, [
    el("div.login-logo", { text: "✦" }),
    el("h1.login-title", { text: APP_NAME }),
    el("p.login-sub", { text: "Log in to plan together." }),
    form,
    el("p.login-note", { text: "Accounts are created by hand — there's no public sign-up." }),
  ]));
}
