// Prueba EN VIVO contra Cal.com (necesita red y CAL_LINK en .env): comprueba que el prefill rellena de verdad
// los campos "tratamiento" (desplegable) y teléfono del formulario de reserva. Uso: npm run qa:cal
import { spawn, execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';

if (!process.env.CAL_LINK) { console.error('Define CAL_LINK (en .env o en el entorno).'); process.exit(1); }
execFileSync(process.execPath, ['scripts/build.mjs'], { env: process.env, stdio: 'ignore' });
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], { env: { ...process.env, PORT: '3210' }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  ['revision', 'Revision'],
  ['implantes', 'Implantes'],
  ['ortodoncia', 'Ortodoncia invisible'],
  ['blanqueamiento', 'Blanqueamiento'],
  ['urgencia', 'Urgencia'],
  ['otro', ''],
];

let failed = 0;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('studio32-consent', JSON.stringify({ analytics: false })));
  await page.goto('http://localhost:3210/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.getElementById('reservar').scrollIntoView());
  await page.waitForSelector('#cal-embed iframe', { timeout: 20000 });

  const readForm = async () => {
    const frame = await (await page.$('#cal-embed iframe')).contentFrame();
    await frame.waitForSelector('button[data-testid="day"]:not([disabled])', { timeout: 30000 });
    await sleep(800);
    await (await frame.$('button[data-testid="day"]:not([disabled])')).click();
    await frame.waitForSelector('button[data-testid="time"]', { timeout: 15000 });
    await (await frame.$('button[data-testid="time"]')).click();
    await frame.waitForSelector('input[name="attendeePhoneNumber"]', { timeout: 15000 });
    await sleep(1200);
    return frame.evaluate(() => {
      const t = document.body.innerText.split('\n');
      const i = t.indexOf('Tratamiento');
      // Valor visible del desplegable: la línea tras la etiqueta «Tratamiento» y su asterisco (vacío si sigue el texto legal)
      const v = t[i + 2] || '';
      return { tratamiento: v.startsWith('Al continuar') ? '' : v, phone: document.querySelector('input[name="attendeePhoneNumber"]').value, shown: t.slice(i, i + 3).join(' | ') };
    });
  };

  for (const [value, expected] of CASES) {
    await page.select('#reserva-tratamiento', value);
    await page.$eval('#reserva-telefono', (i) => { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.type('#reserva-telefono', '611 222 333');
    await sleep(1500); // debounce + recarga del iframe
    const r = await readForm();
    const ok = r.tratamiento === expected && r.phone.replace(/\s/g, '').endsWith('611222333');
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${value.padEnd(15)} → desplegable: "${r.tratamiento || '(vacío)'}" · teléfono: "${r.phone}"${ok ? '' : `  (esperado "${expected}")`}`);
    // volver al calendario para la siguiente ronda (el iframe se recarga al cambiar el prefill)
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `\n${failed} casos fallidos` : '\nPrefill verificado en el formulario real de Cal.com');
process.exit(failed ? 1 : 0);
