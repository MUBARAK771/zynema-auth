import { CONFIG } from './config.js';

export function toast(msg, type = 'info') {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; box.append(t);
  setTimeout(() => t.remove(), 5000);
}
export function setLoading(btn, on, label) {
  btn.dataset.label ??= btn.textContent; btn.disabled = on;
  btn.innerHTML = on ? '<span class="spin"></span>' + (label || 'Please wait') : btn.dataset.label;
}
export function fieldError(input, msg) {
  const el = document.getElementById(input.id + '-err'); if (!el) return;
  el.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}
export function wireEyeToggles() {
  document.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
    const i = document.getElementById(b.dataset.eye); const show = i.type === 'password';
    i.type = show ? 'text' : 'password'; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.textContent = show ? 'Hide' : 'Show';
  }));
}
export function wireAppLinks() { document.querySelectorAll('[data-app-path]').forEach(a => a.href = CONFIG.APP_URL + a.dataset.appPath); }
export function wireNav() {
  const b = document.getElementById('menu-btn'), n = document.getElementById('nav');
  b?.addEventListener('click', () => { const o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
}
export async function loadMovieArtwork() {
  if (!CONFIG.TMDB_API_KEY) return;
  try {
    const r = await fetch(`https://api.themoviedb.org/3/trending/movie/week?api_key=${CONFIG.TMDB_API_KEY}`);
    if (!r.ok) return;
    const { results } = await r.json();
    if (!Array.isArray(results)) return;
    document.querySelectorAll('.poster').forEach((el, i) => {
      const m = results[i]; if (!m?.poster_path) return;
      el.style.backgroundImage = `url(https://image.tmdb.org/t/p/w500${m.poster_path})`; el.setAttribute('aria-label', m.title);
    });
    const backdrops = results
      .filter((movie) => typeof movie?.backdrop_path === 'string')
      .map((movie) => `url("https://image.tmdb.org/t/p/w1280${movie.backdrop_path}")`);
    const hero = document.querySelector('.hero');
    if (hero && backdrops.length) {
      let index = 0;
      hero.style.setProperty('--hero-art', backdrops[index]);
      if (backdrops.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.setInterval(() => {
          hero.classList.add('is-changing');
          window.setTimeout(() => {
            index = (index + 1) % backdrops.length;
            hero.style.setProperty('--hero-art', backdrops[index]);
            window.requestAnimationFrame(() => hero.classList.remove('is-changing'));
          }, 500);
        }, 7000);
      }
    }
    const authArt = document.querySelector('.art');
    const auth = authArt?.closest('.auth');
    if (auth && backdrops.length) {
      auth.style.setProperty('--auth-art', backdrops[0]);
      auth.classList.add('has-artwork');
    }
  } catch { /* gradient fallback stays */ }
}
