import './dictLoaderFix';
import Kuroshiro from '@sglkc/kuroshiro';
import KuromojiAnalyzer from '@sglkc/kuroshiro-analyzer-kuromoji';
import { pinyin } from 'pinyin-pro';
import * as KoreanLib from '@romanize/korean';
import { detectScript, HAS_CJK, type CjkScript } from './detect';

// Paket ini CommonJS; ambil fungsinya dengan cara yang aman di bundler maupun Node.
const romanizeKorean: (s: string) => string =
  (KoreanLib as any).romanize ?? (KoreanLib as any).default?.romanize;

let kuroshiro: Promise<Kuroshiro> | null = null;

function getKuroshiro(): Promise<Kuroshiro> {
  if (!kuroshiro) {
    kuroshiro = (async () => {
      const k = new Kuroshiro();
      await withTimeout(k.init(new KuromojiAnalyzer({ dictPath: '/dict/' })), 60_000, 'Muat kamus Jepang');
      return k;
    })().catch((err) => {
      console.error('[Lirik Romaji] Gagal init kuroshiro:', err);
      kuroshiro = null;
      throw err;
    });
  }
  return kuroshiro;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms)),
  ]);
}

/** Mulai muat kamus Jepang lebih awal supaya lagu pertama tidak terlalu lama. */
export function warmUp(): void {
  getKuroshiro().catch(() => {});
}

// ō → ou, ū → uu, dst. Gaya yang biasa dipakai di lirik romaji.
const LONG_VOWELS: Record<string, string> = { ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ee', ō: 'ou' };

function tidy(line: string): string {
  return line
    .replace(/[āīūēō]/g, (c) => LONG_VOWELS[c])
    .replace(/\s+([,.!?、。！？」』)])/g, '$1')
    .replace(/([(「『])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function romanizeJapanese(lines: string[]): Promise<string[]> {
  const k = await getKuroshiro();

  // Satu lagu dikonversi dalam SATU panggilan (baris digabung dengan \n),
  // jadi analyzer melihat konteks antarbaris, lalu hasilnya dipecah lagi.
  const whole = await k.convert(lines.join('\n'), { to: 'romaji', mode: 'spaced' });
  const parts = whole.split(/[ \t]*\n[ \t]*/);

  if (parts.length === lines.length) return parts;

  // Jaga-jaga kalau jumlah baris tidak cocok: konversi per baris.
  return Promise.all(lines.map((l) => k.convert(l, { to: 'romaji', mode: 'spaced' })));
}

// @romanize/korean melempar error kalau ketemu karakter seperti "…" atau "！",
// jadi yang dikirim hanya potongan hangul-nya saja, sisanya dibiarkan.
function romanizeKoreanLine(line: string): string {
  return line.replace(/[\uAC00-\uD7A3]+/g, (run) => {
    try {
      return romanizeKorean(run);
    } catch {
      return run;
    }
  });
}

function romanizeChinese(line: string): string {
  return pinyin(line, { toneType: 'none', type: 'string', nonZh: 'consecutive' });
}

export interface RomanizeResult {
  script: CjkScript | null;
  romaji: string[] | null;
}

export async function romanizeSong(lines: string[]): Promise<RomanizeResult> {
  const script = detectScript(lines);
  if (!script) return { script: null, romaji: null };

  let raw: string[];
  if (script === 'japanese') raw = await romanizeJapanese(lines);
  else if (script === 'korean') raw = lines.map(romanizeKoreanLine);
  else raw = lines.map(romanizeChinese);

  // Baris tanpa huruf CJK (mis. "Oh yeah baby") dibiarkan persis seperti aslinya.
  const romaji = lines.map((orig, i) => (HAS_CJK.test(orig) ? tidy(raw[i] ?? orig) : orig));
  return { script, romaji };
}
