// Descarga las fotos de Unsplash (una sola vez, caché en .cache/) y genera WebP responsive en public/assets/img.
// Uso: npm run images
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = 'public/assets/img';
const CACHE = '.cache/unsplash';

// name: id de Unsplash · widths: anchos a generar · ratio: alto/ancho del recorte (el mismo que se muestra en la web)
const IMAGES = [
  { name: 'hero',           id: 'photo-1588776814546-1ffcf47267a5', widths: [480, 720, 960], ratio: 5 / 4 },
  { name: 'escaner',        id: 'photo-1606811841689-23dfddce3e95', widths: [400, 640, 800], ratio: 3 / 4 },
  { name: 'cadcam',         id: 'photo-1629909613654-28e377c37b09', widths: [400, 640, 800], ratio: 3 / 4 },
  { name: 'diseno-sonrisa', id: 'photo-1571772996211-2f02c9727629', widths: [400, 640, 800], ratio: 3 / 4 },
];

const exists = (p) => access(p).then(() => true, () => false);

await mkdir(OUT, { recursive: true });
await mkdir(CACHE, { recursive: true });

for (const img of IMAGES) {
  const src = path.join(CACHE, `${img.name}.jpg`);
  if (!(await exists(src))) {
    const url = `https://images.unsplash.com/${img.id}?auto=format&fit=crop&w=2000&q=85`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${img.name}: HTTP ${res.status}`);
    await writeFile(src, Buffer.from(await res.arrayBuffer()));
  }
  for (const w of img.widths) {
    const out = path.join(OUT, `${img.name}-${w}.webp`);
    const pipeline = sharp(src).resize({ width: w, height: Math.round(w * img.ratio), fit: 'cover' });
    const info = await pipeline.webp({ quality: 78 }).toFile(out);
    console.log(`${out}  ${(info.size / 1024).toFixed(1)} KB  ${info.width}x${info.height}`);
  }
}
