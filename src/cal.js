// Embed inline de Cal.com. El loader oficial se inyecta solo cuando el calendario está cerca del viewport.
const ORIGIN = 'https://app.cal.com';

function installLoader() {
  if (window.Cal) return;
  (function (C, A, L) {
    const p = (a, ar) => { a.q.push(ar); };
    const d = C.document;
    C.Cal = C.Cal || function () {
      const cal = C.Cal;
      const ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement('script')).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api = function () { p(api, arguments); };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === 'string') {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ['initNamespace', namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, `${ORIGIN}/embed/embed.js`, 'init');
}

// Teléfono → formato E.164 si parece español (9 dígitos); si no, se respeta el + que haya escrito.
export function normalizePhone(raw) {
  const t = String(raw || '').trim();
  const digits = t.replace(/\D/g, '');
  if (!digits) return '';
  if (t.startsWith('+')) return `+${digits}`;
  if (digits.length === 9) return `+34${digits}`;
  return digits;
}

export function loadCal(calLink, config, onReady, onBooked) {
  installLoader();
  window.Cal('init', { origin: ORIGIN });
  window.Cal('inline', {
    elementOrSelector: '#cal-embed',
    calLink,
    layout: 'month_view',
    config: { theme: 'light', ...config },
  });
  window.Cal('ui', { theme: 'light', hideEventTypeDetails: false, layout: 'month_view' });
  window.Cal('on', { action: 'linkReady', callback: onReady });
  if (onBooked) window.Cal('on', { action: 'bookingSuccessful', callback: onBooked });
}

// Cambia los datos de prefill del iframe ya cargado sin recrear el embed.
export function updatePrefill(params) {
  const iframe = document.querySelector('#cal-embed iframe');
  if (!iframe) return false;
  const url = new URL(iframe.src);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v); else url.searchParams.delete(k);
  }
  if (url.href !== iframe.src) iframe.src = url.href;
  return true;
}
