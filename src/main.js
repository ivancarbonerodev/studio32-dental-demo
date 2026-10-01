import Alpine from 'alpinejs';
import intersect from '@alpinejs/intersect';
import collapse from '@alpinejs/collapse';
import { loadCal, updatePrefill, normalizePhone } from './cal.js';
import { initConsent, track } from './consent.js';
import { TRATAMIENTOS } from './lead.js';
import './chat.js';
import { createIcons, MessageCircle, ArrowRight, CalendarCheck, CalendarPlus, CalendarX2, Check, CheckCircle2, ChevronDown, FileX2, HeartCrack, Mail, MapPin, Menu, Phone, PhoneCall, Scan, ScanFace, Send, ShieldCheck, Smartphone, Sparkles, X, Zap, Smile, Siren, Drill, Sun, Image, Info, MapPinned, ExternalLink, Cookie, LoaderCircle, ShieldAlert, Lock } from 'lucide';

// Iconos usados en la página (solo estos entran en el bundle)
const icons = { MessageCircle, ArrowRight, CalendarCheck, CalendarPlus, CalendarX2, Check, CheckCircle2, ChevronDown, FileX2, HeartCrack, Mail, MapPin, Menu, Phone, PhoneCall, Scan, ScanFace, Send, ShieldCheck, Smartphone, Sparkles, X, Zap, Smile, Siren, Drill, Sun, Image, Info, MapPinned, ExternalLink, Cookie, LoaderCircle, ShieldAlert, Lock };

window.counter = function counter(target, decimals = 0) {
  return {
    value: 0,
    display: (0).toFixed(decimals),
    animate() {
      const duration = 1800;
      let startTime = null;
      const step = (ts) => {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.value = target * eased;
        this.display = this.value.toFixed(decimals).replace('.', ',');
        if (progress < 1) requestAnimationFrame(step);
        else this.display = target.toFixed(decimals).replace('.', ',');
      };
      requestAnimationFrame(step);
    },
  };
};

// Reserva con Cal.com: tratamiento + teléfono se pasan como prefill (campos: tratamiento [desplegable], attendeePhoneNumber)
window.booking = function booking(calLink) {
  return {
    calLink,
    configured: !!calLink && !calLink.startsWith('tu-usuario') && !calLink.startsWith('%'),
    loaded: false,
    ready: false,
    failed: false,
    tratamiento: 'revision',
    telefono: '',
    tratamientos: TRATAMIENTOS,
    params() {
      const t = this.tratamientos.find((x) => x.value === this.tratamiento);
      return { tratamiento: t ? t.cal : '', attendeePhoneNumber: normalizePhone(this.telefono) };
    },
    load() {
      if (!this.configured || this.loaded) return;
      this.loaded = true;
      const initial = Object.fromEntries(Object.entries(this.params()).filter(([, v]) => v));
      loadCal(this.calLink, initial, () => { this.ready = true; }, () => track('Reserva'));
      setTimeout(() => { if (!this.ready) this.failed = true; }, 12000);
    },
    prefill() {
      if (this.loaded) updatePrefill(this.params());
    },
    setTratamiento(value) {
      if (this.tratamientos.some((x) => x.value === value)) { this.tratamiento = value; this.prefill(); }
    },
  };
};

Alpine.plugin(intersect);
Alpine.plugin(collapse);
window.Alpine = Alpine;
Alpine.start();

initConsent();

// Iconos Lucide: se pintan al arrancar y cada vez que Alpine añade nodos con data-lucide (plantillas, x-if…).
createIcons({ icons });
new MutationObserver((muts) => {
  if (muts.some((x) => [...x.addedNodes].some((n) => n.nodeType === 1 && (n.matches?.('[data-lucide]') || n.querySelector?.('[data-lucide]'))))) createIcons({ icons });
}).observe(document.body, { childList: true, subtree: true });
