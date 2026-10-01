// Consentimiento de cookies y analítica. Plausible NO se carga hasta que el usuario acepta.
const KEY = 'studio32-consent';
const PLAUSIBLE_SRC = 'https://plausible.io/js/script.js';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return v && typeof v.analytics === 'boolean' ? v : null;
  } catch {
    return null;
  }
}

function write(analytics) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ analytics, ts: new Date().toISOString() }));
  } catch { /* modo privado: la decisión solo vale para esta página */ }
}

let loaded = false;
function loadAnalytics() {
  if (loaded) return;
  const domain = document.querySelector('meta[name="plausible-domain"]')?.content?.trim();
  if (!domain) return; // PLAUSIBLE_DOMAIN no definido: analítica desactivada
  loaded = true;
  const s = document.createElement('script');
  s.defer = true;
  s.src = PLAUSIBLE_SRC;
  s.dataset.domain = domain;
  document.head.appendChild(s);
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
}

// Evento de conversión; no hace nada si no hay consentimiento ni analítica cargada.
export function track(name, props) {
  if (loaded && window.plausible) window.plausible(name, props ? { props } : undefined);
}

export function initConsent() {
  const saved = read();
  if (saved?.analytics) loadAnalytics();
}

window.cookieBanner = function cookieBanner() {
  return {
    visible: false,
    init() {
      this.visible = read() === null;
      window.addEventListener('open-cookie-settings', () => { this.visible = true; });
    },
    accept() { write(true); loadAnalytics(); this.visible = false; },
    reject() { write(false); this.visible = false; },
  };
};
