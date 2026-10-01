// Genera public/assets/og-image.png (1200x630) con la identidad de Studio32. Uso: npm run og
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const font = (pkg, file) => pathToFileURL(path.resolve(`node_modules/@fontsource/${pkg}/files/${file}.woff2`)).href;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Space Grotesk';font-weight:700;src:url(${font('space-grotesk', 'space-grotesk-latin-700-normal')})}
@font-face{font-family:'Inter';font-weight:500;src:url(${font('inter', 'inter-latin-500-normal')})}
@font-face{font-family:'Inter';font-weight:600;src:url(${font('inter', 'inter-latin-600-normal')})}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0B0F14;color:#fff;font-family:Inter,sans-serif;position:relative;overflow:hidden;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between}
.glow{position:absolute;right:-180px;top:-200px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle,rgba(0,217,163,.45),rgba(0,217,163,0) 65%)}
.logo{font-family:'Space Grotesk';font-weight:700;font-size:44px;letter-spacing:-.02em;position:relative}
.logo span{color:#00D9A3}
h1{font-family:'Space Grotesk';font-weight:700;font-size:78px;line-height:1.04;letter-spacing:-.025em;max-width:900px;position:relative}
h1 em{font-style:normal;color:#00D9A3}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:26px;font-weight:500;color:rgba(255,255,255,.75);position:relative}
.pill{background:#00D9A3;color:#0B0F14;font-weight:600;padding:12px 26px;border-radius:999px;font-size:24px}
</style></head><body>
<div class="glow"></div>
<div class="logo">STUDIO<span>32</span></div>
<h1>Deja de posponer tu <em>sonrisa</em> por miedo al dentista.</h1>
<div class="foot"><span>Clínica dental digital · Chamberí, Madrid</span><span class="pill">Demo de portfolio</span></div>
</body></html>`;

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630 });
// Desde un archivo local (setContent bloquea las fuentes file://)
await mkdir('.cache', { recursive: true });
await writeFile('.cache/og.html', html);
await page.goto(pathToFileURL(path.resolve('.cache/og.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await browser.close();

await sharp(png).png({ palette: true, quality: 90 }).toFile('public/assets/og-image.png');
console.log('public/assets/og-image.png generado');
