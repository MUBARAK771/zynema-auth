export const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isName = v => v.trim().length >= 2 && v.trim().length <= 80;
export function passwordScore(p) {
  const checks = [p.length >= 8, /[a-z]/.test(p), /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)];
  const n = checks.filter(Boolean).length;
  return { score: n, label: ['Too short', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'][p.length ? n : 0], ok: p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) };
}
export function friendlyError(err) {
  const m = (err?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email or password is incorrect.';
  if (m.includes('email not confirmed') || m.includes('confirm')) return 'Verify your email first. Check your inbox for the link.';
  if (m.includes('already registered')) return 'An account with this email already exists. Sign in instead.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('same password')) return 'Choose a password different from your current one.';
  if (m.includes('network') || m.includes('fetch')) return 'Network problem. Check your connection and retry.';
  return err?.message || 'Something went wrong. Try again.';
}
