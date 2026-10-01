// POST /lead — recibe un lead, lo valida y lo entrega por UNO de estos canales (por orden de prioridad):
//   1. LEAD_WEBHOOK_URL → reenvío del JSON a esa URL.
//   2. RESEND_API_KEY + LEAD_NOTIFY_EMAIL → aviso por correo con Resend.
//   3. Nada configurado → modo demo: solo se registra en logs.
// Sin base de datos. Formato del JSON de entrada y de salida del webhook: ver README.
import { json, clientIp, rateLimit, readJson } from '../lib/http.mjs';
import { sendLeadEmail } from '../lib/email.mjs';

const ORIGENES = ['chat', 'formulario', 'reserva'];
const MAX = { nombre: 80, tratamiento: 60, mensaje: 500, resumenItems: 3, resumenChars: 200 };
const WEBHOOK_TIMEOUT_MS = 5000;

const clean = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : v);

export function validateLead(input) {
  const errors = {};

  // Honeypot: el campo oculto "website" debe llegar vacío (los bots suelen rellenarlo).
  if (input.website !== undefined && input.website !== null && String(input.website).trim() !== '') {
    return { errors: { website: 'Solicitud no válida.' } };
  }

  const nombre = clean(input.nombre);
  if (typeof nombre !== 'string' || nombre.length < 2) errors.nombre = 'Indica tu nombre (mínimo 2 caracteres).';
  else if (nombre.length > MAX.nombre) errors.nombre = `El nombre no puede superar los ${MAX.nombre} caracteres.`;

  const telefonoRaw = typeof input.telefono === 'string' ? input.telefono : '';
  const telefono = telefonoRaw.replace(/[\s.\-()]/g, '');
  if (!/^\+?\d{9,15}$/.test(telefono)) errors.telefono = 'Indica un teléfono válido (entre 9 y 15 dígitos, con prefijo opcional +34).';

  let tratamiento = clean(input.tratamiento);
  if (tratamiento === undefined || tratamiento === null || tratamiento === '') tratamiento = 'no especificado';
  else if (typeof tratamiento !== 'string') errors.tratamiento = 'Tratamiento no válido.';
  else if (tratamiento.length > MAX.tratamiento) errors.tratamiento = `El tratamiento no puede superar los ${MAX.tratamiento} caracteres.`;

  let mensaje = clean(input.mensaje);
  if (mensaje === undefined || mensaje === null) mensaje = '';
  else if (typeof mensaje !== 'string') errors.mensaje = 'Mensaje no válido.';
  else if (mensaje.length > MAX.mensaje) errors.mensaje = `El mensaje no puede superar los ${MAX.mensaje} caracteres.`;

  // Resumen del chat (opcional): hasta 3 preguntas del usuario de ≤200 caracteres
  let resumen = [];
  if (input.resumen !== undefined && input.resumen !== null) {
    if (!Array.isArray(input.resumen) || input.resumen.length > MAX.resumenItems || input.resumen.some((q) => typeof q !== 'string' || clean(q).length > MAX.resumenChars)) {
      errors.resumen = `El resumen admite hasta ${MAX.resumenItems} frases de ${MAX.resumenChars} caracteres.`;
    } else {
      resumen = input.resumen.map(clean).filter(Boolean);
    }
  }

  if (input.consentimiento !== true) errors.consentimiento = 'Debes aceptar la política de privacidad para que podamos contactarte.';

  if (!ORIGENES.includes(input.origen)) errors.origen = `El origen debe ser uno de: ${ORIGENES.join(', ')}.`;

  if (Object.keys(errors).length) return { errors };
  return { lead: { nombre, telefono, tratamiento, mensaje, consentimiento: true, origen: input.origen, ...(resumen.length ? { resumen } : {}) } };
}

async function forward(url, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch (err) {
    console.error('[lead] error reenviando al webhook:', err.name === 'AbortError' ? 'timeout' : err.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' }, { allow: 'POST' });

  if (!rateLimit(`lead:${clientIp(req, context)}`, { max: 5, windowMs: 10 * 60 * 1000 })) {
    return json(429, { error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' });
  }

  const body = await readJson(req, 4000);
  if (body.error) return json(400, { error: body.error });

  const { lead, errors } = validateLead(body.data);
  if (errors) {
    const first = Object.values(errors)[0];
    return json(400, { error: first, errors });
  }

  const payload = { ...lead, fecha: new Date().toISOString(), sitio: 'studio32-demo' };
  const webhook = process.env.LEAD_WEBHOOK_URL;

  if (webhook) {
    const forwarded = await forward(webhook, payload);
    // Si el webhook falla, el usuario no se entera: dejamos constancia mínima en logs (sin datos personales).
    if (!forwarded) console.error(`[lead] NO entregado: origen=${lead.origen} tratamiento="${lead.tratamiento}"`);
    return json(200, { ok: true });
  }

  // 2) Aviso por correo con Resend. Si falla, el usuario recibe igualmente OK y el error se registra SIN datos personales.
  const resendKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.LEAD_NOTIFY_EMAIL;
  if (resendKey && notifyTo) {
    const sent = await sendLeadEmail(payload, { apiKey: resendKey, to: notifyTo });
    if (!sent.ok) console.error(`[lead] correo NO enviado (${sent.reason}): origen=${lead.origen} tratamiento="${lead.tratamiento}"`);
    return json(200, { ok: true });
  }
  if (resendKey || notifyTo) console.warn('[lead] RESEND_API_KEY y LEAD_NOTIFY_EMAIL deben definirse las dos; se usa el modo demo.');

  // 3) Modo demo: sin canal configurado solo se registra en los logs de la función (teléfono enmascarado, sin texto libre).
  console.log(
    '[lead][demo]',
    JSON.stringify({
      origen: lead.origen,
      nombre: lead.nombre,
      telefono: `${'*'.repeat(Math.max(lead.telefono.length - 3, 0))}${lead.telefono.slice(-3)}`,
      tratamiento: lead.tratamiento,
      mensaje_chars: lead.mensaje.length,
      resumen_items: lead.resumen?.length ?? 0,
      fecha: payload.fecha,
    }),
  );
  return json(200, { ok: true, demo: true });
};

export const config = { path: '/lead' };
