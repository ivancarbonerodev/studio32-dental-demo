// POST /lead — recibe un lead, lo valida y lo reenvía a LEAD_WEBHOOK_URL (si existe) o lo registra en logs (modo demo).
// Sin base de datos ni servicios externos. Formato del JSON de entrada y de salida del webhook: ver README.
import { json, clientIp, rateLimit, readJson } from '../lib/http.mjs';

const ORIGENES = ['chat', 'formulario', 'reserva'];
const MAX = { nombre: 80, tratamiento: 60, mensaje: 500 };
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

  if (input.consentimiento !== true) errors.consentimiento = 'Debes aceptar la política de privacidad para que podamos contactarte.';

  if (!ORIGENES.includes(input.origen)) errors.origen = `El origen debe ser uno de: ${ORIGENES.join(', ')}.`;

  if (Object.keys(errors).length) return { errors };
  return { lead: { nombre, telefono, tratamiento, mensaje, consentimiento: true, origen: input.origen } };
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

  // Modo demo: sin LEAD_WEBHOOK_URL solo se registra en los logs de la función (teléfono enmascarado, sin texto libre).
  console.log(
    '[lead][demo]',
    JSON.stringify({
      origen: lead.origen,
      nombre: lead.nombre,
      telefono: `${'*'.repeat(Math.max(lead.telefono.length - 3, 0))}${lead.telefono.slice(-3)}`,
      tratamiento: lead.tratamiento,
      mensaje_chars: lead.mensaje.length,
      fecha: payload.fecha,
    }),
  );
  return json(200, { ok: true, demo: true });
};

export const config = { path: '/lead' };
