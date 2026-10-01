import { track } from './consent.js';

// cal: valor exacto de la opción del desplegable "tratamiento" en el evento de Cal.com ('' = sin opción equivalente)
export const TRATAMIENTOS = [
  { value: 'revision', label: 'Revisión digital gratuita', cal: 'Revision' },
  { value: 'implantes', label: 'Implantes', cal: 'Implantes' },
  { value: 'ortodoncia', label: 'Ortodoncia invisible', cal: 'Ortodoncia invisible' },
  { value: 'blanqueamiento', label: 'Blanqueamiento', cal: 'Blanqueamiento' },
  { value: 'urgencia', label: 'Urgencia dental', cal: 'Urgencia' },
  { value: 'otro', label: 'Otro / no lo sé', cal: '' },
];

// Mismas reglas que netlify/functions/lead.mjs (el servidor es quien manda; esto solo evita viajes inútiles).
export function validateLead({ nombre, telefono, consentimiento }) {
  const errors = {};
  if (String(nombre || '').trim().length < 2) errors.nombre = 'Indica tu nombre.';
  if (!/^\+?\d{9,15}$/.test(String(telefono || '').replace(/[\s.\-()]/g, ''))) errors.telefono = 'Indica un teléfono válido (9 dígitos o con prefijo +34).';
  if (!consentimiento) errors.consentimiento = 'Debes aceptar la política de privacidad para que podamos contactarte.';
  return errors;
}

export async function postLead(payload) {
  try {
    const res = await fetch('/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true };
    return { ok: false, error: data.error || 'No hemos podido enviar tus datos.', errors: data.errors };
  } catch {
    return { ok: false, error: 'No hemos podido conectar. Revisa tu conexión o llámanos al 910 05 32 32.' };
  }
}

// Componente Alpine reutilizable: formulario corto (origen "formulario") y formulario dentro del chat (origen "chat").
// `website` es el honeypot: oculto para personas, los bots suelen rellenarlo y el servidor lo rechaza.
window.leadForm = function leadForm(origen, { withTratamiento = true } = {}) {
  return {
    origen,
    withTratamiento,
    tratamientos: TRATAMIENTOS,
    nombre: '',
    telefono: '',
    tratamiento: TRATAMIENTOS[0].value,
    consentimiento: false,
    website: '',
    errors: {},
    status: 'idle', // idle | sending | sent | error
    message: '',
    setTratamiento(value) {
      if (TRATAMIENTOS.some((t) => t.value === value)) this.tratamiento = value;
    },
    async submit() {
      if (this.status === 'sending') return;
      this.errors = validateLead(this);
      if (Object.keys(this.errors).length) {
        this.status = 'error';
        this.message = 'Revisa los campos marcados.';
        return;
      }
      this.status = 'sending';
      this.message = '';
      const res = await postLead({
        nombre: this.nombre,
        telefono: this.telefono,
        tratamiento: this.withTratamiento ? (TRATAMIENTOS.find((t) => t.value === this.tratamiento)?.label ?? 'no especificado') : 'no especificado',
        consentimiento: this.consentimiento === true,
        origen: this.origen,
        website: this.website,
      });
      if (res.ok) {
        this.status = 'sent';
        track('Lead', { origen: this.origen });
        this.$dispatch('lead-sent', { origen: this.origen });
      } else {
        this.status = 'error';
        this.message = res.error;
        this.errors = res.errors || {};
      }
    },
  };
};
