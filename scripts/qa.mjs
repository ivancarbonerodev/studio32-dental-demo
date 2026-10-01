// QA automático: construye el sitio con variables de prueba, levanta mocks (Anthropic y webhook) y comprueba
// reserva, WhatsApp, chat + lead, formulario, endpoint /lead, cookies. Uso: npm test
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail ? `  → ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const section = (t) => console.log(`\n${t}`);

// ---------- Mocks ----------
const anthropicCalls = [];
const anthropic = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    const body = JSON.parse(b || '{}');
    anthropicCalls.push({ headers: req.headers, body });
    const last = body.messages.at(-1).content.toLowerCase();
    if (last.includes('fallo')) { res.writeHead(500); res.end('{"error":"boom"}'); return; }
    const text = last.includes('persona') ? 'Lo mejor es que te contacte el equipo. [[LEAD]]' : 'Abrimos de lunes a viernes de 9:00 a 20:00.';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
  });
});
let hookMode = 'ok';
const hooks = [];
const webhook = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', async () => {
    hooks.push(JSON.parse(b));
    if (hookMode === 'slow') await sleep(8000);
    if (hookMode === 'fail') { res.writeHead(500); res.end(); return; }
    res.writeHead(200); res.end('ok');
  });
});
let resendMode = 'ok';
const emails = [];
const resend = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', async () => {
    emails.push({ headers: req.headers, url: req.url, body: JSON.parse(b || '{}') });
    if (resendMode === 'slow') await sleep(10000);
    if (resendMode === 'fail') { res.writeHead(403, { 'content-type': 'application/json' }); res.end(JSON.stringify({ name: 'validation_error', message: 'You can only send testing emails to owner@example.com' })); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'abc' }));
  });
});
await new Promise((r) => resend.listen(3297, r));
await new Promise((r) => anthropic.listen(3299, r));
await new Promise((r) => webhook.listen(3298, r));

// ---------- Build y servidores ----------
const env = { ...process.env, CAL_LINK: 'demo/revision', WHATSAPP_NUMBER: '34611222333', PLAUSIBLE_DOMAIN: 'studio32.example.com', SITE_URL: 'https://studio32.example.com' };
execFileSync(process.execPath, ['scripts/build.mjs'], { env, stdio: 'ignore' });

const servers = [];
const startServer = (port, extra) => {
  const p = spawn(process.execPath, ['scripts/dev-server.mjs'], { env: { ...env, PORT: String(port), ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.logs = '';
  p.stdout.on('data', (d) => (p.logs += d));
  p.stderr.on('data', (d) => (p.logs += d));
  servers.push(p);
  return p;
};
const A = startServer(3201, { ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_API_URL: 'http://localhost:3299/v1/messages', LEAD_WEBHOOK_URL: 'http://localhost:3298/hook', DISABLE_RATE_LIMIT: '1' });
const B = startServer(3202, { DISABLE_RATE_LIMIT: '0', ANTHROPIC_API_KEY: '', LEAD_WEBHOOK_URL: '' }); // modo demo, sin clave
const resendEnv = { RESEND_API_KEY: 're_test_key', LEAD_NOTIFY_EMAIL: 'owner@example.com', RESEND_API_URL: 'http://localhost:3297/emails', DISABLE_RATE_LIMIT: '1' };
const C = startServer(3203, { ...resendEnv, LEAD_WEBHOOK_URL: '' });
const D = startServer(3204, { ...resendEnv, LEAD_WEBHOOK_URL: 'http://localhost:3298/hook' });
const E = startServer(3205, { RESEND_API_KEY: 're_test_key', LEAD_NOTIFY_EMAIL: '', LEAD_WEBHOOK_URL: '', DISABLE_RATE_LIMIT: '1' });
const F = startServer(3206, { RESEND_API_KEY: '', LEAD_NOTIFY_EMAIL: '', LEAD_WEBHOOK_URL: '', DISABLE_RATE_LIMIT: '1' }); // sin ningún canal
await sleep(1800);
const urlA = 'http://localhost:3201';
const urlB = 'http://localhost:3202';
const post = (base, path, body, raw = false) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? body : JSON.stringify(body) }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const goodLead = { nombre: 'Ana Prueba', telefono: '600 123 456', tratamiento: 'Implantes', consentimiento: true, origen: 'formulario', website: '' };

try {
  // ======================= Endpoint /lead =======================
  section('Endpoint /lead');
  let r = await post(urlA, '/lead', goodLead);
  check('lead válido → 200 y reenviado al webhook', r.status === 200 && r.json.ok && hooks.length === 1 && hooks[0].telefono === '600123456' && hooks[0].origen === 'formulario' && hooks[0].sitio === 'studio32-demo' && hooks[0].fecha);
  check('payload del webhook sin honeypot', !('website' in hooks[0]));
  r = await post(urlA, '/lead', { ...goodLead, consentimiento: false });
  check('sin consentimiento → 400', r.status === 400 && r.json.errors?.consentimiento);
  r = await post(urlA, '/lead', { ...goodLead, consentimiento: 'true' });
  check('consentimiento no booleano → 400', r.status === 400);
  r = await post(urlA, '/lead', { ...goodLead, telefono: '123' });
  check('teléfono inválido → 400', r.status === 400 && r.json.errors?.telefono);
  r = await post(urlA, '/lead', { ...goodLead, nombre: 'x'.repeat(81) });
  check('nombre demasiado largo → 400', r.status === 400 && r.json.errors?.nombre);
  r = await post(urlA, '/lead', { ...goodLead, mensaje: 'x'.repeat(501) });
  check('mensaje demasiado largo → 400', r.status === 400 && r.json.errors?.mensaje);
  r = await post(urlA, '/lead', { ...goodLead, origen: 'otro' });
  check('origen no permitido → 400', r.status === 400 && r.json.errors?.origen);
  r = await post(urlA, '/lead', { ...goodLead, website: 'http://spam' });
  check('honeypot relleno → 400', r.status === 400);
  r = await post(urlA, '/lead', 'no es json', true);
  check('JSON inválido → 400', r.status === 400);
  const before = hooks.length;
  hookMode = 'fail';
  r = await post(urlA, '/lead', { ...goodLead, origen: 'chat' });
  check('webhook con error 500 → el usuario recibe 200', r.status === 200 && r.json.ok && hooks.length === before + 1);
  hookMode = 'slow';
  const t0 = Date.now();
  r = await post(urlA, '/lead', { ...goodLead, origen: 'reserva' });
  const dt = Date.now() - t0;
  check(`webhook lento → timeout y 200 (${dt} ms)`, r.status === 200 && dt < 7000);
  hookMode = 'ok';
  r = await post(urlB, '/lead', goodLead);
  check('modo demo (sin LEAD_WEBHOOK_URL) → 200 demo', r.status === 200 && r.json.demo === true);
  check('modo demo registra en logs con teléfono enmascarado', B.logs.includes('[lead][demo]') && B.logs.includes('******456') && !B.logs.includes('600123456'));
  const get = await fetch(`${urlB}/lead`);
  check('GET /lead → 405', get.status === 405);
  let last;
  for (let i = 0; i < 6; i++) last = await post(urlB, '/lead', goodLead);
  check('límite de peticiones → 429', last.status === 429);

  // ======================= Aviso por correo (Resend) =======================
  section('Aviso por correo con Resend (lead sin webhook)');
  const urlC = 'http://localhost:3203';
  const e0 = emails.length;
  r = await post(urlC, '/lead', { ...goodLead, mensaje: 'Prefiero que me llamen por la tarde' });
  check('lead de formulario → 200 y se envía 1 correo', r.status === 200 && r.json.ok && !r.json.demo && emails.length === e0 + 1);
  let em = emails.at(-1);
  check('POST a Resend con Authorization Bearer de la clave del servidor', em.headers.authorization === 'Bearer re_test_key' && em.headers['content-type'].includes('application/json'));
  check('remitente onboarding@resend.dev y destinatario LEAD_NOTIFY_EMAIL', em.body.from.includes('onboarding@resend.dev') && JSON.stringify(em.body.to) === '["owner@example.com"]');
  check('asunto con origen y nombre', em.body.subject === 'Nuevo lead (formulario) — Ana Prueba', em.body.subject);
  const t = em.body.text;
  check('cuerpo: origen, nombre, teléfono, tratamiento y mensaje', ['Origen: formulario', 'Nombre: Ana Prueba', 'Teléfono: 600123456', 'Tratamiento: Implantes', 'Mensaje: Prefiero que me llamen por la tarde'].every((s) => t.includes(s)), t);
  check('cuerpo: fecha y hora en Europe/Madrid', /Fecha: .*20\d\d, \d{1,2}:\d{2} \(Europe\/Madrid\)/.test(t), t.split('\n').find((l) => l.startsWith('Fecha')));
  check('formulario: sin sección de resumen de chat', !t.includes('Últimas preguntas'));
  check('html con los mismos datos', em.body.html.includes('Ana Prueba') && em.body.html.includes('600123456'));

  r = await post(urlC, '/lead', { nombre: '<b>Eva</b> & "Co"', telefono: '+34 622 333 444', consentimiento: true, origen: 'chat', resumen: ['¿Cuánto cuesta un implante?', 'Tengo miedo al dentista', '<script>alert(1)</script>'] });
  em = emails.at(-1);
  check('lead de chat: incluye las últimas preguntas del usuario', r.status === 200 && em.body.text.includes('Últimas preguntas') && em.body.text.includes('1. ¿Cuánto cuesta un implante?') && em.body.text.includes('3. <script>alert(1)</script>') && em.body.text.includes('Origen: chat'));
  check('html: nombre y resumen escapados (sin inyección)', em.body.html.includes('&lt;b&gt;Eva&lt;/b&gt;') && !em.body.html.includes('<script>') && !em.body.html.includes('<b>Eva'));
  check('lead de chat sin mensaje: no hay línea «Mensaje»', !em.body.text.includes('Mensaje:'));
  const eN = emails.length;
  r = await post(urlC, '/lead', { ...goodLead, consentimiento: false });
  const r2 = await post(urlC, '/lead', { ...goodLead, website: 'x' });
  const r3 = await post(urlC, '/lead', { ...goodLead, resumen: ['a', 'b', 'c', 'd'] });
  const r4 = await post(urlC, '/lead', { ...goodLead, resumen: ['x'.repeat(201)] });
  check('validación intacta: sin consentimiento / honeypot / resumen excesivo → 400 y NO se envía correo', r.status === 400 && r2.status === 400 && r3.status === 400 && r4.status === 400 && emails.length === eN);

  resendMode = 'fail';
  r = await post(urlC, '/lead', { ...goodLead, nombre: 'Nombre Secreto', telefono: '699111222' });
  check('Resend rechaza (403) → el usuario sigue recibiendo 200 OK', r.status === 200 && r.json.ok === true);
  check('el error se registra en logs con status/nombre y SIN datos personales', C.logs.includes('correo NO enviado (HTTP 403 validation_error)') && !C.logs.includes('Nombre Secreto') && !C.logs.includes('699111222') && !C.logs.includes('owner@example.com'));
  resendMode = 'slow';
  const tm = Date.now();
  r = await post(urlC, '/lead', goodLead);
  check(`Resend lento → timeout a los 8 s y respuesta 200 (${Date.now() - tm} ms)`, r.status === 200 && Date.now() - tm < 9500 && C.logs.includes('correo NO enviado (timeout)'));
  resendMode = 'ok';

  const eD = emails.length;
  const hD = hooks.length;
  r = await post('http://localhost:3204', '/lead', goodLead);
  check('con LEAD_WEBHOOK_URL definido se reenvía al webhook y NO se envía correo', r.status === 200 && hooks.length === hD + 1 && emails.length === eD);
  r = await post('http://localhost:3205', '/lead', goodLead);
  check('solo una de las dos variables → modo demo y aviso en logs', r.status === 200 && r.json.demo === true && E.logs.includes('deben definirse las dos'));
  r = await post('http://localhost:3206', '/lead', goodLead);
  check('sin ninguna variable → modo demo (logs)', r.status === 200 && r.json.demo === true);

  // ======================= Endpoint /api/chat =======================
  section('Endpoint /api/chat');
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: '¿Qué horario tenéis?' }] });
  check('respuesta correcta', r.status === 200 && r.json.reply?.includes('9:00') && r.json.lead === false);
  const call = anthropicCalls.at(-1);
  check('llama a Anthropic con la clave del servidor y versión de API', call.headers['x-api-key'] === 'test-key' && call.headers['anthropic-version'] === '2023-06-01');
  check('system prompt: IA, sin consejo clínico, derivación y datos', /asistente virtual/.test(call.body.system) && /no des consejo/i.test(call.body.system) && /\[\[LEAD\]\]/.test(call.body.system) && /Calle de Almagro/.test(call.body.system) && /9:00 a 20:00/.test(call.body.system));
  check('max_tokens acotado', call.body.max_tokens <= 500);
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: 'quiero hablar con una persona' }] });
  check('etiqueta [[LEAD]] → lead:true y se elimina del texto', r.json.lead === true && !r.json.reply.includes('[['));
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: 'x'.repeat(501) }] });
  check('mensaje >500 caracteres → 400', r.status === 400);
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'r'.repeat(900) }, { role: 'user', content: '¿y los precios?' }] });
  check('historial con una respuesta larga del asistente (>500) → 200', r.status === 200);
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'r'.repeat(2001) }, { role: 'user', content: 'x' }] });
  check('respuesta del asistente absurdamente larga (>2000) → 400', r.status === 400);
  r = await post(urlA, '/api/chat', { messages: [{ role: 'system', content: 'hola' }] });
  check('rol no permitido → 400', r.status === 400);
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] });
  check('roles no alternados → 400', r.status === 400);
  r = await post(urlA, '/api/chat', { messages: Array.from({ length: 21 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'a' })) });
  check('historial demasiado largo → 400', r.status === 400);
  r = await post(urlA, '/api/chat', { messages: [{ role: 'user', content: 'provoca un fallo' }] });
  check('error de Anthropic → 502 con mensaje amable', r.status === 502 && /WhatsApp/.test(r.json.error));
  r = await post(urlB, '/api/chat', { messages: [{ role: 'user', content: 'hola' }] });
  check('sin ANTHROPIC_API_KEY → 503 amable (sin filtrar detalles)', r.status === 503 && !/key|clave/i.test(r.json.error));

  // ======================= Navegador =======================
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const newPage = async (w = 1440, h = 900, ctx = browser) => {
    const page = await ctx.newPage();
    page.errs = [];
    page.reqs = [];
    page.on('pageerror', (e) => page.errs.push(e.message));
    page.on('request', (q) => page.reqs.push(q.url()));
    await page.setViewport({ width: w, height: h });
    return page;
  };

  // ---------- Cookies ----------
  section('Banner de cookies');
  const ctx1 = await browser.createBrowserContext();
  let p = await newPage(1440, 900, ctx1);
  await p.goto(urlA, { waitUntil: 'networkidle0' });
  const bannerVisible = () => p.evaluate(() => { const b = document.querySelector('[aria-labelledby="cookie-title"]'); return !!b && b.getClientRects().length > 0; });
  check('el banner aparece en la primera visita', await bannerVisible());
  check('Plausible NO se carga antes de aceptar', !(await p.$('script[src*="plausible"]')) && !p.reqs.some((u) => u.includes('plausible.io')));
  await p.reload({ waitUntil: 'networkidle0' });
  check('sigue sin cargarse tras recargar sin decidir', !(await p.$('script[src*="plausible"]')) && (await bannerVisible()));
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Aceptar').click());
  await sleep(400);
  check('al aceptar se carga Plausible con el dominio configurado', !!(await p.$('script[src="https://plausible.io/js/script.js"][data-domain="studio32.example.com"]')));
  check('el banner se oculta', !(await bannerVisible()));
  await p.reload({ waitUntil: 'networkidle0' });
  check('la decisión persiste (sin banner y con analítica)', !(await bannerVisible()) && !!(await p.$('script[src*="plausible"]')));
  await p.evaluate(() => [...document.querySelectorAll('footer button')].find((b) => b.textContent.includes('Configurar cookies')).click());
  await sleep(300);
  check('«Configurar cookies» del pie reabre el banner', await bannerVisible());
  await p.close();
  const ctx2 = await browser.createBrowserContext();
  p = await newPage(390, 800, ctx2);
  await p.goto(urlA, { waitUntil: 'networkidle0' });
  await p.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Rechazar').click());
  await sleep(400);
  await p.reload({ waitUntil: 'networkidle0' });
  check('al rechazar, Plausible no se carga ni tras recargar', !(await p.$('script[src*="plausible"]')) && !p.reqs.some((u) => u.includes('plausible.io')) && !(await bannerVisible()));
  await p.close();
  await ctx1.close(); await ctx2.close();

  // ---------- Reserva ----------
  section('Reserva (Cal.com)');
  p = await newPage();
  await p.evaluateOnNewDocument(() => localStorage.setItem('studio32-consent', JSON.stringify({ analytics: false })));
  await p.goto(urlA, { waitUntil: 'networkidle0' });
  const botones = await p.$$eval('a', (as) => as.filter((a) => /^(Reservar|Pedir valoración|Empezar mi plan)/.test(a.textContent.trim())).map((a) => a.getAttribute('href')));
  check(`todos los botones «Reservar…» llevan a #reservar (${botones.length})`, botones.length >= 8 && botones.every((h) => h === '#reservar'));
  check('Cal.com no carga hasta acercarse a la sección', !p.reqs.some((u) => u.includes('app.cal.com')));
  await p.evaluate(() => document.getElementById('reservar').scrollIntoView());
  await p.waitForSelector('#cal-embed iframe', { timeout: 15000 });
  const iframeSrc = () => p.$eval('#cal-embed iframe', (f) => f.src);
  check('embed apunta a CAL_LINK', (await iframeSrc()).includes('app.cal.com/demo/revision'));
  await p.select('#reserva-tratamiento', 'implantes');
  await p.type('#reserva-telefono', '600 123 456');
  await sleep(1200);
  const src = new URL(await iframeSrc());
  check('prefill de tratamiento y teléfono (+34)', src.searchParams.get('tratamiento') === 'Implantes' && src.searchParams.get('attendeePhoneNumber') === '+34600123456');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.evaluate(() => [...document.querySelectorAll('#tratamiento-ortodoncia a')].find((a) => a.textContent.includes('Pedir valoración')).click());
  await sleep(500);
  check('el CTA de un tratamiento preselecciona ese tratamiento en la reserva', (await p.$eval('#reserva-tratamiento', (s) => s.value)) === 'ortodoncia' && (await p.$eval('#lead-tratamiento', (s) => s.value)) === 'ortodoncia');
  check('sin errores de JS', p.errs.length === 0, p.errs.join('|'));
  await p.close();

  // ---------- WhatsApp ----------
  section('WhatsApp');
  p = await newPage();
  await p.evaluateOnNewDocument(() => localStorage.setItem('studio32-consent', JSON.stringify({ analytics: false })));
  await p.goto(urlA, { waitUntil: 'networkidle0' });
  const was = await p.$$eval('a[href^="https://wa.me"]', (as) => as.map((a) => ({ n: a.href.split('?')[0], t: decodeURIComponent(a.href.split('text=')[1]), rel: a.rel })));
  check(`${was.length} enlaces wa.me con el número configurado`, was.length >= 12 && was.every((w) => w.n === 'https://wa.me/34611222333' && w.rel.includes('noopener')));
  check('textos distintos según contexto (hero, plan, tratamiento…)', new Set(was.map((w) => w.t)).size >= 10);
  const kinds = ['revisión digital gratuita', 'Plan Smile', 'implantes', 'urgencia'];
  check('hay textos de hero, plan y tratamiento', kinds.every((k) => was.some((w) => w.t.includes(k))));
  const floatBox = await p.$eval('a[aria-label^="Escríbenos por WhatsApp"]', (a) => { const r = a.getBoundingClientRect(); return { w: r.width, h: r.height, vis: r.bottom <= innerHeight && r.right <= innerWidth }; });
  check('botón flotante visible en escritorio (con texto)', floatBox.vis && floatBox.w > 100 && floatBox.h >= 44);
  await p.setViewport({ width: 390, height: 800 });
  await sleep(300);
  const floatM = await p.$eval('a[aria-label^="Escríbenos por WhatsApp"]', (a) => { const r = a.getBoundingClientRect(); return { w: r.width, h: r.height, vis: r.bottom <= innerHeight && r.right <= innerWidth }; });
  check('botón flotante visible en móvil (≥44 px)', floatM.vis && floatM.w >= 44 && floatM.h >= 44);
  await p.close();

  // ---------- Formulario ----------
  section('Formulario de lead');
  p = await newPage();
  await p.evaluateOnNewDocument(() => localStorage.setItem('studio32-consent', JSON.stringify({ analytics: false })));
  await p.goto(urlA, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.getElementById('llamadme').scrollIntoView());
  const hpVisible = await p.$eval('#llamadme input[name="website"]', (i) => { const r = i.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; });
  check('el honeypot está fuera de pantalla y fuera del orden de tabulación', !hpVisible && (await p.$eval('#llamadme input[name="website"]', (i) => i.tabIndex)) === -1);
  const n0 = hooks.length;
  await p.click('#llamadme button[type="submit"]');
  await sleep(400);
  check('enviar vacío muestra errores y no llama al servidor', (await p.$eval('#lead-nombre-err', (e) => e.textContent.trim().length)) > 0 && hooks.length === n0);
  await p.type('#lead-nombre', 'Marta Prueba');
  await p.type('#lead-telefono', '611 222 333');
  await p.select('#lead-tratamiento', 'blanqueamiento');
  await p.click('#llamadme button[type="submit"]');
  await sleep(400);
  check('sin consentimiento no se envía', (await p.$eval('#lead-consent-err', (e) => e.textContent.includes('privacidad'))) && hooks.length === n0);
  await p.click('#llamadme input[type="checkbox"]');
  await p.click('#llamadme button[type="submit"]');
  await p.waitForFunction(() => document.querySelector('#llamadme [role="status"]')?.offsetParent !== null, { timeout: 5000 });
  check('confirmación visual tras enviar', (await p.$eval('#llamadme [role="status"]', (e) => e.textContent)).includes('Recibido'));
  const h = hooks.at(-1);
  check('el servidor recibe el lead con origen "formulario" y tratamiento (sin resumen)', hooks.length === n0 + 1 && h.origen === 'formulario' && h.tratamiento === 'Blanqueamiento' && h.consentimiento === true && h.nombre === 'Marta Prueba' && !('resumen' in h));
  await p.close();

  // ---------- Chat ----------
  section('Chat con captura de lead');
  p = await newPage(390, 800);
  await p.evaluateOnNewDocument(() => localStorage.setItem('studio32-consent', JSON.stringify({ analytics: false })));
  await p.goto(urlA, { waitUntil: 'networkidle0' });
  await p.click('button[aria-label="Abrir asistente virtual de Studio32"]');
  await p.waitForSelector('#chat-input', { visible: true });
  const msgs = () => p.$$eval('[role="log"] > div', (d) => d.map((x) => x.textContent.trim()));
  check('saludo breve, sin repetir el aviso de IA', /asistente virtual de Studio32/i.test((await msgs())[0]) && !/inteligencia artificial/i.test((await msgs())[0]));
  check('la cabecera del chat mantiene la etiqueta «Inteligencia artificial» visible', await p.evaluate(() => { const el = [...document.querySelectorAll('#chat-panel p')].find((x) => /Inteligencia artificial/.test(x.textContent)); return !!el && el.getClientRects().length > 0; }));
  check('aviso visible de que no da consejo médico', await p.evaluate(() => document.body.innerText.includes('No doy consejo médico')));
  const sendChat = async (text) => {
    const before = (await msgs()).length;
    await p.type('#chat-input', text);
    await p.keyboard.press('Enter');
    await p.waitForFunction((n) => document.querySelectorAll('[role="log"] > div').length >= n, { timeout: 8000 }, before + 2);
  };
  await sendChat('¿Cuál es el horario?');
  check('respuesta del asistente en pantalla', (await msgs()).at(-1).includes('9:00'));
  check('el input limita a 500 caracteres', (await p.$eval('#chat-input', (i) => i.maxLength)) === 500);
  await sendChat('provoca un fallo');
  check('error del servidor → mensaje amable y el chat sigue usable', /WhatsApp|llamar/.test((await msgs()).at(-1)) && !(await p.$eval('#chat-input', (i) => i.disabled)));
  await sendChat('prefiero hablar con una persona');
  await p.waitForSelector('#chat-nombre', { visible: true, timeout: 4000 });
  check('la respuesta con [[LEAD]] abre el formulario dentro del chat', true);
  await p.click('#chat-panel button[type="submit"].flex-1');
  await sleep(300);
  check('el formulario del chat exige consentimiento', await p.evaluate(() => document.querySelector('#chat-panel').innerText.includes('Debes aceptar')));
  const m0 = hooks.length;
  await p.type('#chat-nombre', 'Luis Chat');
  await p.type('#chat-telefono', '+34 622 333 444');
  await p.click('#chat-panel input[type="checkbox"]');
  await p.click('#chat-panel button[type="submit"].flex-1');
  await p.waitForFunction(() => document.querySelector('#chat-panel').innerText.includes('Recibido'), { timeout: 5000 });
  const hc = hooks.at(-1);
  check('lead del chat llega a /lead con origen "chat"', hooks.length === m0 + 1 && hc.origen === 'chat' && hc.telefono === '+34622333444' && hc.nombre === 'Luis Chat');
  check('el lead del chat incluye el resumen de las preguntas del usuario (sin la que falló)', JSON.stringify(hc.resumen) === JSON.stringify(['¿Cuál es el horario?', 'prefiero hablar con una persona']), JSON.stringify(hc.resumen));
  // límite por sesión: ya enviados 2 correctos (el fallido no cuenta); llegamos a 12
  for (let i = 0; i < 10; i++) await sendChat(`pregunta ${i}`);
  await sleep(300);
  check('límite de 12 mensajes por sesión: se desactiva el input', await p.evaluate(() => document.querySelector('#chat-panel').innerText.includes('límite de mensajes')));
  check('sin errores de JS', p.errs.length === 0, p.errs.join('|'));
  await p.close();

  // ---------- Elementos flotantes y badge de Netlify ----------
  section('Elementos flotantes (con badge simulado de Netlify)');
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (const [w, h, label] of [[1440, 900, 'escritorio 1440×900'], [1024, 768, 'tablet 1024×768'], [375, 667, 'móvil 375×667'], [375, 812, 'móvil 375×812']]) {
    for (const withBanner of [false, true]) {
      const fresh = withBanner ? await browser.createBrowserContext() : null; // contexto limpio: sin decisión de cookies previa
      p = await newPage(w, h, fresh || browser);
      if (!withBanner) await p.evaluateOnNewDocument(() => localStorage.setItem('studio32-consent', JSON.stringify({ analytics: false })));
      await p.goto(urlA, { waitUntil: 'networkidle0' });
      // Badge de Netlify simulado: iframe fijo, 197×64, esquina inferior derecha, por encima de todo
      await p.evaluate(() => {
        const f = document.createElement('iframe');
        f.id = 'nl-badge-frame';
        f.style.cssText = 'position:fixed;bottom:0;right:0;width:197px;height:64px;border:0;z-index:2147483647;background:#fff';
        document.body.appendChild(f);
      });
      if (w < 640) { await p.evaluate(() => window.scrollTo(0, 1200)); await sleep(600); }
      if (!withBanner) { await p.click('button[aria-label="Abrir asistente virtual de Studio32"]'); await sleep(500); }
      const boxes = await p.evaluate(() => {
        const r = (el) => { if (!el || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
        return {
          badge: r(document.getElementById('nl-badge-frame')),
          whatsapp: r(document.querySelector('a[aria-label^="Escríbenos por WhatsApp"]')),
          bubble: r(document.querySelector('button[aria-controls="chat-panel"]')),
          panel: r(document.getElementById('chat-panel')),
          sticky: r(document.querySelector('a[aria-label="Reservar cita"]')),
          banner: r(document.querySelector('[aria-labelledby="cookie-title"]')),
          vw: innerWidth, vh: innerHeight,
          bottomWa: parseFloat(getComputedStyle(document.querySelector('a[aria-label^="Escríbenos por WhatsApp"]')).bottom),
        };
      });
      const names = ['badge', 'whatsapp', 'bubble', 'panel', 'sticky', 'banner'].filter((n) => boxes[n]);
      const clashes = [];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
        if (overlap(boxes[names[i]], boxes[names[j]])) clashes.push(`${names[i]}×${names[j]}`);
      }
      const inView = names.every((n) => boxes[n].left >= 0 && boxes[n].top >= 0 && boxes[n].right <= boxes.vw && boxes[n].bottom <= boxes.vh);
      check(`${label}${withBanner ? ' + banner de cookies' : ' + chat abierto'}: sin solapes (${names.join(', ')})`, clashes.length === 0 && inView, clashes.join(', ') + (inView ? '' : ' fuera de pantalla'));
      if (!withBanner && w >= 640) check(`  WhatsApp a ≥80 px del borde inferior (${Math.round(boxes.bottomWa)} px)`, boxes.bottomWa >= 80);
      await p.close();
      if (fresh) await fresh.close();
    }
  }
  const home = await (await fetch(urlA)).text();
  const cssPath = home.slice(home.indexOf('/assets/styles.'), home.indexOf('.css', home.indexOf('/assets/styles.')) + 4);
  const cssText = await (await fetch(urlA + cssPath)).text();
  check('CSS flotantes respeta env(safe-area-inset-bottom)', cssText.includes('safe-area-inset-bottom') && cssText.includes('.float-bottom') && cssText.includes('.float-chat') && cssText.includes('.chat-panel'));

  await browser.close();
} finally {
  servers.forEach((s) => s.kill());
  anthropic.close();
  webhook.close();
  resend.close();
}

const failed = results.filter((x) => !x.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
process.exit(failed.length ? 1 : 0);
