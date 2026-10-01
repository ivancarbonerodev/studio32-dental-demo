// Lighthouse móvil sobre el sitio local (requiere `npm run build` y servidor en marcha: `npm run dev`).
// Uso: node scripts/lighthouse.mjs [url ...]   (por defecto: home y /privacidad en http://localhost:3000)
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import puppeteer from 'puppeteer';

const urls = process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:3000/', 'http://localhost:3000/privacidad'];
const chrome = await chromeLauncher.launch({ chromePath: await puppeteer.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
let failed = false;
try {
  for (const url of urls) {
    const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', formFactor: 'mobile', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] });
    const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    console.log(`\n${url}\n  ${Object.entries(scores).map(([k, v]) => `${k}: ${v}`).join('  ·  ')}`);
    const a = lhr.audits;
    console.log(`  LCP ${a['largest-contentful-paint'].displayValue} · TBT ${a['total-blocking-time'].displayValue} · CLS ${a['cumulative-layout-shift'].displayValue} · FCP ${a['first-contentful-paint'].displayValue}`);
    for (const au of Object.values(a)) {
      if (au.score !== null && au.score < 1 && !['informative', 'manual', 'notApplicable'].includes(au.scoreDisplayMode)) {
        console.log(`  ✗ ${au.id}${au.displayValue ? ` (${au.displayValue})` : ''}`);
        for (const it of (Array.isArray(au.details?.items) ? au.details.items : []).slice(0, 4)) {
          const n = it.node?.snippet || it.url || it.source?.url || '';
          if (n) console.log(`      ${String(n).replace(/\s+/g, ' ').slice(0, 150)}${it.node?.explanation ? ' — ' + it.node.explanation.replace(/\s+/g, ' ').slice(0, 200) : ''}`);
        }
      }
    }
    if (Object.values(scores).some((s) => s < 90)) failed = true;
  }
} finally {
  await chrome.kill();
}
process.exit(failed ? 1 : 0);
