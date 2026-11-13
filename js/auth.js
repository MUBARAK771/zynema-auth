import { supabase } from './supabase.js';
import { CONFIG } from './config.js';

// Allowlist check prevents open redirects.
export function safeRedirect(url) {
  try { const u = new URL(url, CONFIG.APP_URL); if (CONFIG.ALLOWED_REDIRECTS.includes(u.origin)) return u.href; } catch {}
  return CONFIG.APP_URL;
}
export const nextParam = () => safeRedirect(new URLSearchParams(location.search).get('next') || CONFIG.APP_URL);
export const goToApp = next => location.replace(safeRedirect(next || CONFIG.APP_URL));

const LOCAL_AUTH_HOSTS = new Set(['localhost', '127.0.0.1']);
const cb = type => {
  const origin = LOCAL_AUTH_HOSTS.has(location.hostname) ? location.origin : CONFIG.AUTH_URL;
  const callback = new URL('/callback.html', origin);
  callback.searchParams.set('type', type);
  return callback.href;
};

export async function signUp({ fullName, email, password }) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName }, emailRedirectTo: cb('signup') } });
  if (error) throw error;
  if (data.user && data.user.identities?.length === 0) throw new Error('already registered');
  if (data.session) await supabase.auth.signOut(); // never grant access before verification
  return data;
}
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user.email_confirmed_at) { await supabase.auth.signOut(); throw new Error('email not confirmed'); }
  return data;
}
export async function resendVerification(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: cb('signup') } }); if (error) throw error;
}
export async function sendReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: cb('recovery') }); if (error) throw error;
}
export async function updatePassword(password) { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; }
export async function updateName(fullName) {
  const { data, error } = await supabase.auth.updateUser({ data: { full_name: fullName } }); if (error) throw error; return data.user;
}
export async function logout() { await supabase.auth.signOut({ scope: 'global' }); location.replace('login.html'); }
// Server-verified user, not just the cached session.
export async function getUser() { const { data: { user }, error } = await supabase.auth.getUser(); return error ? null : user; }
export async function requireUser() { const u = await getUser(); if (!u) location.replace('login.html'); return u; }
