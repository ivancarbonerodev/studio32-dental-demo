// POST /api/chat — asistente virtual de Studio32 con la API de Anthropic. La clave vive solo en ANTHROPIC_API_KEY.
import { json, clientIp, rateLimit, readJson } from '../lib/http.mjs';
import { SYSTEM_PROMPT } from '../lib/clinic.mjs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages'; // override solo para pruebas
const MAX_INPUT_CHARS = 500; // por mensaje del usuario
const MAX_ASSISTANT_CHARS = 2000; // respuestas previas del asistente que el cliente reenvía en el historial
const MAX_MESSAGES = 20; // turnos aceptados en el historial
const MAX_BODY_BYTES = 20000;
const MAX_TOKENS = 400;
const TIMEOUT_MS = 20000;

const FRIENDLY_ERROR = 'Ahora mismo no puedo responder. Puedes reservar online, escribirnos por WhatsApp o llamar al 910 05 32 32.';

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' }, { allow: 'POST' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[chat] falta ANTHROPIC_API_KEY');
    return json(503, { error: FRIENDLY_ERROR });
  }

  if (!rateLimit(`chat:${clientIp(req, context)}`, { max: 30, windowMs: 10 * 60 * 1000 })) {
    return json(429, { error: 'Has enviado muchos mensajes seguidos. Espera unos minutos o escríbenos por WhatsApp.' });
  }

  const body = await readJson(req, MAX_BODY_BYTES);
  if (body.error) return json(400, { error: body.error });

  // Validación estricta del historial: solo roles user/assistant, texto, longitud acotada, empieza y termina en "user".
  const raw = body.data.messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return json(400, { error: 'Conversación no válida.' });
  const messages = [];
  for (const m of raw) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return json(400, { error: 'Conversación no válida.' });
    const content = m.content.trim();
    if (!content) return json(400, { error: 'No se admiten mensajes vacíos.' });
    if (m.role === 'user' && content.length > MAX_INPUT_CHARS) return json(400, { error: `Tu mensaje es demasiado largo (máximo ${MAX_INPUT_CHARS} caracteres).` });
    if (m.role === 'assistant' && content.length > MAX_ASSISTANT_CHARS) return json(400, { error: 'Conversación no válida.' });
    messages.push({ role: m.role, content });
  }
  if (messages[0].role !== 'user' || messages.at(-1).role !== 'user') return json(400, { error: 'Conversación no válida.' });
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].role === messages[i - 1].role) return json(400, { error: 'Conversación no válida.' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.error(`[chat] Anthropic respondió HTTP ${res.status}`);
      return json(502, { error: FRIENDLY_ERROR });
    }
    const data = await res.json();
    let reply = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!reply) return json(502, { error: FRIENDLY_ERROR });
    const lead = reply.includes('[[LEAD]]');
    // El widget muestra texto plano: se eliminan restos de Markdown por si el modelo los usa igualmente.
    reply = reply
      .replaceAll('[[LEAD]]', '')
      .replace(/\*\*|__/g, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*\*\s+/gm, '- ')
      .trim();
    return json(200, { reply, lead });
  } catch (err) {
    console.error('[chat] error:', err.name === 'AbortError' ? 'timeout' : err.message);
    return json(502, { error: FRIENDLY_ERROR });
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: '/api/chat' };
