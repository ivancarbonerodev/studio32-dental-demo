// Aviso por correo de cada lead con Resend (API HTTP, sin dependencias).
// Remitente de pruebas onboarding@resend.dev: solo puede enviar a la dirección del propietario de la cuenta de Resend.
const RESEND_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails'; // override solo para pruebas
const FROM = 'Studio32 Leads <onboarding@resend.dev>';
const TIMEOUT_MS = 8000;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const formatMadrid = (date) =>
  `${new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(date)} (Europe/Madrid)`;

export function buildLeadEmail(lead, date = new Date()) {
  const fecha = formatMadrid(date);
  const rows = [
    ['Origen', lead.origen],
    ['Nombre', lead.nombre],
    ['Teléfono', lead.telefono],
    ['Tratamiento', lead.tratamiento],
    ...(lead.mensaje ? [['Mensaje', lead.mensaje]] : []),
    ['Fecha', fecha],
  ];
  const resumen = lead.resumen?.length ? lead.resumen : null;

  const text = [
    'Nuevo lead desde la web de Studio32 (demo)',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(resumen ? ['', 'Últimas preguntas del usuario en el chat:', ...resumen.map((q, i) => `${i + 1}. ${q}`)] : []),
  ].join('\n');

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#0B0F14;max-width:560px">
<h2 style="margin:0 0 12px">Nuevo lead (${esc(lead.origen)})</h2>
<table style="border-collapse:collapse;width:100%">
${rows.map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`).join('\n')}
</table>
${resumen ? `<h3 style="margin:20px 0 8px;font-size:15px">Últimas preguntas del usuario en el chat</h3><ol style="margin:0;padding-left:20px">${resumen.map((q) => `<li style="margin:4px 0">${esc(q)}</li>`).join('')}</ol>` : ''}
<p style="margin-top:24px;color:#777;font-size:12px">Web de demostración Studio32 · aviso automático</p>
</div>`;

  return { subject: `Nuevo lead (${lead.origen}) — ${lead.nombre}`, text, html };
}

// Devuelve { ok: true } o { ok: false, reason } con un motivo SIN datos personales (para los logs).
export async function sendLeadEmail(lead, { apiKey, to }) {
  const recipients = String(to).split(',').map((s) => s.trim()).filter(Boolean);
  const { subject, text, html } = buildLeadEmail(lead);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: FROM, to: recipients, subject, text, html }),
      signal: ctrl.signal,
    });
    if (res.ok) return { ok: true };
    // Solo status y nombre del error de Resend (p. ej. "validation_error"); el mensaje puede incluir direcciones de correo.
    const body = await res.json().catch(() => ({}));
    return { ok: false, reason: `HTTP ${res.status}${body?.name ? ` ${String(body.name).slice(0, 40)}` : ''}` };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? 'timeout' : `error de red (${err.name})` };
  } finally {
    clearTimeout(timer);
  }
}
