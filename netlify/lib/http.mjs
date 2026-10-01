// Utilidades comunes a las funciones: respuestas JSON, IP del cliente y límite de peticiones.
export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export const clientIp = (req, context) =>
  context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

// Límite básico por IP en memoria. Es "best effort": cada instancia de la función tiene su propio contador
// y se reinicia en frío. Frena abusos casuales; para algo más serio usa un servicio externo (Upstash, WAF…).
const buckets = new Map();
export function rateLimit(key, { max, windowMs }) {
  if (process.env.DISABLE_RATE_LIMIT === '1') return true; // solo para pruebas automáticas
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}

// Lee el cuerpo JSON con tope de tamaño. Devuelve { data } o { error }.
export async function readJson(req, maxBytes) {
  const text = await req.text();
  if (text.length > maxBytes) return { error: 'La petición es demasiado grande.' };
  try {
    const data = JSON.parse(text);
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return { error: 'Formato no válido.' };
    return { data };
  } catch {
    return { error: 'El cuerpo debe ser JSON válido.' };
  }
}
