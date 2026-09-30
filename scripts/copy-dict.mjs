// Menyalin kamus kuromoji (untuk Jepang) ke public/dict supaya ikut ter-bundle
// di ekstensi. Jadi tidak perlu ambil dari CDN dan tetap jalan offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@sglkc/kuromoji/dict';
const dest = 'public/dict';

if (!existsSync(src)) {
  console.warn('[copy-dict] Kamus kuromoji tidak ditemukan, lewati.');
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-dict] Kamus kuromoji disalin ke public/dict');
