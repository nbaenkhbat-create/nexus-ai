/**
 * NEXUS — Бүртгэл / нэвтрэлт (Supabase Auth).
 *  - Имэйл бүртгэл + баталгаажуулалт
 *  - Google OAuth (Supabase талд тохируулаа шаардана — README харна уу)
 *  - Нууц үг сэргээх / шинэчлэх
 * Нууц үгийг хэзээ ч өөрийн database-д plaintext-ээр хадгалдаггүй.
 */
import { configured, getClient } from "./supabase.js";

export { configured };

async function authedClient() {
  const sb = await getClient();
  if (!sb) return null;
  return sb;
}

export async function getSession() {
  const sb = await authedClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

export async function getUser() {
  const sb = await authedClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data.user;
}

export async function signUp({ email, password, displayName }) {
  const sb = await authedClient();
  if (!sb) throw new Error("Систем тохируулаагүй байна (Supabase).");
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }) {
  const sb = await authedClient();
  if (!sb) throw new Error("Систем тохируулаагүй байна (Supabase).");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const sb = await authedClient();
  if (!sb) throw new Error("Систем тохируулаагүй байна (Supabase).");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: absoluteBase() + "/app.html" },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await authedClient();
  if (!sb) return;
  await sb.auth.signOut();
}

export async function sendPasswordReset({ email }) {
  const sb = await authedClient();
  if (!sb) throw new Error("Систем тохируулаагүй байна (Supabase).");
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: absoluteBase() + "/reset.html",
  });
  if (error) throw error;
}

export async function updatePassword({ password }) {
  const sb = await authedClient();
  if (!sb) throw new Error("Систем тохируулаагүй байна (Supabase).");
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw error;
}

export async function updateDisplayName({ displayName }) {
  const sb = await authedClient();
  if (!sb) throw new Error("Систем тохируулаагүй байна (Supabase).");
  const { error } = await sb.auth.updateUser({ data: { display_name: displayName } });
  if (error) throw error;
}

function absoluteBase() {
  // GitHub Pages repo-subpath-ийг хадгална (https://user.github.io/repo/)
  const { origin, pathname } = window.location;
  const base = pathname.replace(/\/[^/]*$/, "");
  return origin + base;
}

export function onAuthChange(cb) {
  getClient()
    .then((sb) => {
      if (sb) sb.auth.onAuthStateChange((_event, session) => cb(session));
      else cb(null);
    })
    .catch(() => cb(null));
}
