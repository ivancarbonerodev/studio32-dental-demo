// Build: Tailwind CLI (CSS minificado) + esbuild (Alpine + Lucide) + plantillas HTML → dist/
// Uso: npm run build
// Variables (ver .env.example): SITE_URL (o URL de Netlify), CAL_LINK, WHATSAPP_NUMBER, PLAUSIBLE_DOMAIN
import { rm, mkdir, cp, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const DIST = 'dist';
const siteUrl = (process.env.SITE_URL || process.env.URL || 'https://studio32.example.com').replace(/\/$/, '');
const calLink = process.env.CAL_LINK || 'tu-usuario/revision-digital'; // placeholder hasta definir CAL_LINK
const plausibleDomain = process.env.PLAUSIBLE_DOMAIN || ''; // vacío = analítica desactivada

// WhatsApp: número internacional sin "+" ni espacios (placeholder obviamente falso hasta definir WHATSAPP_NUMBER)
const waNumber = (process.env.WHATSAPP_NUMBER || '34600000000').replace(/\D/g, '');
const waMessages = JSON.parse(await readFile('src/whatsapp-messages.json', 'utf8'));
const waLink = (key) => {
  if (!(key in waMessages)) throw new Error(`Mensaje de WhatsApp desconocido: %WA:${key}%`);
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessages[key])}`;
};

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);

// Datos estructurados (schema.org Dentist). Sin aggregateRating: no se publican valoraciones inventadas.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dentist',
  '@id': `${siteUrl}/#clinica`,
  name: 'Studio32 Dental Studio',
  description: 'Clínica dental digital en Chamberí, Madrid: escáner 3D sin moldes, implantes, ortodoncia invisible, blanqueamiento y urgencias con cita previa. (Clínica ficticia — demo.)',
  url: `${siteUrl}/`,
  image: `${siteUrl}/assets/og-image.png`,
  telephone: '+34910053232',
  email: 'hola@studio32.example.com',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Calle de Almagro, 12',
    postalCode: '28010',
    addressLocality: 'Madrid',
    addressRegion: 'Comunidad de Madrid',
    addressCountry: 'ES',
  },
  areaServed: 'Madrid',
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '20:00' },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '10:00', closes: '14:00' },
  ],
  medicalSpecialty: 'Dentistry',
  availableService: ['Implantes dentales', 'Ortodoncia invisible', 'Blanqueamiento dental', 'Urgencias dentales'].map((name) => ({ '@type': 'MedicalProcedure', name })),
};

await rm(DIST, { recursive: true, force: true });
await mkdir(`${DIST}/assets`, { recursive: true });

// Estáticos: imágenes, og-image, etc.
await cp('public', DIST, { recursive: true });

// Fuentes autoalojadas (@fontsource, subset latin)
await mkdir(`${DIST}/assets/fonts`, { recursive: true });
for (const [pkg, weights] of [['inter', [400, 500, 600, 700]], ['space-grotesk', [500, 600, 700]]]) {
  for (const w of weights) {
    await cp(`node_modules/@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff2`, `${DIST}/assets/fonts/${pkg}-latin-${w}-normal.woff2`);
  }
}

// CSS: Tailwind CLI, minificado
execFileSync(process.execPath, ['node_modules/tailwindcss/lib/cli.js', '-i', 'src/input.css', '-o', `${DIST}/assets/styles.tmp.css`, '--minify'], { stdio: 'inherit' });
const css = await readFile(`${DIST}/assets/styles.tmp.css`);
const cssName = `styles.${hash(css)}.css`;
await writeFile(`${DIST}/assets/${cssName}`, css);
await rm(`${DIST}/assets/styles.tmp.css`);

// JS: Alpine + plugins + iconos Lucide (solo los usados)
const result = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, entryNames: 'app' });
const js = Buffer.from(result.outputFiles[0].contents);
const jsName = `app.${hash(js)}.js`;
await writeFile(`${DIST}/assets/${jsName}`, js);

// HTML: includes + placeholders
const partials = {};
const include = async (html) => {
  for (const m of html.matchAll(/<!--@include (\S+)-->/g)) {
    partials[m[1]] ??= await readFile(`src/${m[1]}`, 'utf8');
  }
  return html.replace(/<!--@include (\S+)-->/g, (_, p) => partials[p]);
};
const fill = (html) =>
  html
    .replaceAll('%CSS%', `/assets/${cssName}`)
    .replaceAll('%JS%', `/assets/${jsName}`)
    .replaceAll('%SITE_URL%', siteUrl)
    .replaceAll('%CAL_LINK%', calLink)
    .replaceAll('%PLAUSIBLE_DOMAIN%', plausibleDomain)
    .replaceAll('%JSONLD%', JSON.stringify(jsonLd))
    .replace(/%WA:([a-z-]+)%/g, (_, key) => waLink(key));

await writeFile(`${DIST}/index.html`, fill(await include(await readFile('src/index.html', 'utf8'))));

// Páginas legales (plantillas) a partir de src/legal/*.html con el layout compartido
const layout = await readFile('src/legal/_layout.html', 'utf8');
const legalPages = [];
for (const file of (await readdir('src/legal')).filter((f) => f.endsWith('.html') && !f.startsWith('_'))) {
  const slug = file.replace('.html', '');
  const raw = await readFile(`src/legal/${file}`, 'utf8');
  const title = raw.match(/<!--title: (.*?)-->/)[1];
  const description = raw.match(/<!--description: (.*?)-->/)[1];
  const content = raw.replace(/<!--(title|description): .*?-->\n?/g, '');
  const page = layout.replaceAll('%TITLE%', title).replaceAll('%DESCRIPTION%', description).replaceAll('%PATH%', `/${slug}`).replace('%CONTENT%', content);
  await writeFile(`${DIST}/${slug}.html`, fill(await include(page)));
  legalPages.push(slug);
}

// robots.txt y sitemap.xml
const today = new Date().toISOString().slice(0, 10);
await writeFile(`${DIST}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
const urls = [['/', '1.0'], ...legalPages.map((s) => [`/${s}`, '0.3'])];
await writeFile(
  `${DIST}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(([p, prio]) => `  <url><loc>${siteUrl}${p === '/' ? '/' : p}</loc><lastmod>${today}</lastmod><priority>${prio}</priority></url>`)
    .join('\n')}\n</urlset>\n`,
);

console.log(`\nBuild OK → ${DIST}/`);
console.log(`  SITE_URL=${siteUrl}  CAL_LINK=${calLink}  WHATSAPP_NUMBER=${waNumber}  PLAUSIBLE_DOMAIN=${plausibleDomain || '(sin definir)'}`);
console.log(`  ${cssName}  ${(css.length / 1024).toFixed(1)} KB · ${jsName}  ${(js.length / 1024).toFixed(1)} KB · páginas legales: ${legalPages.join(', ')}`);
