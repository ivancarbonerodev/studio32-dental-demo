// Servidor local ligero: sirve dist/ y monta las Netlify Functions (formato v2: Request → Response) en su `config.path`.
// Equivale a `netlify dev` para esta demo, sin instalar la CLI. Uso: npm run dev  (PORT=3000 por defecto)
import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const DIST = path.resolve('dist');
const FUNCTIONS_DIR = path.resolve('netlify/functions');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

// path → handler
const routes = new Map();
for (const file of await readdir(FUNCTIONS_DIR)) {
  if (!file.endsWith('.mjs')) continue;
  const mod = await import(pathToFileURL(path.join(FUNCTIONS_DIR, file)).href);
  if (mod.config?.path) routes.set(mod.config.path, mod.default);
}

async function resolveStatic(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\.\.+/g, '');
  const candidates = [clean, `${clean}.html`, path.join(clean, 'index.html')];
  for (const c of candidates) {
    const full = path.join(DIST, c);
    if (!full.startsWith(DIST)) continue;
    try { if ((await stat(full)).isFile()) return full; } catch { /* siguiente */ }
  }
  return null;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const handler = routes.get(url.pathname);
    if (handler) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
      const response = await handler(request, { ip: req.socket.remoteAddress });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const file = await resolveStatic(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!file) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    const body = await readFile(file);
    const compressible = /^text|json|xml|svg|javascript/.test(type);
    const cache = /assets[\/](styles|app|fonts)/.test(file) ? 'public, max-age=31536000, immutable' : /[.](webp|png)$/.test(file) ? 'public, max-age=604800' : 'no-cache';
    if (compressible && /br/.test(req.headers['accept-encoding'] || '')) {
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'br', 'cache-control': cache, vary: 'accept-encoding' });
      res.end(zlib.brotliCompressSync(body));
    } else {
      res.writeHead(200, { 'content-type': type, 'cache-control': cache });
      res.end(body);
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500); res.end('Error interno');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (funciones: ${[...routes.keys()].join(', ')})`));
