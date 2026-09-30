export type CjkScript = 'japanese' | 'korean' | 'chinese';

const KANA = /[\u3040-\u30FF\u31F0-\u31FF]/;
const HANGUL = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g;
const HAN = /[\u4E00-\u9FFF\u3400-\u4DBF]/g;

/** Karakter CJK apa pun (dipakai untuk tahu baris mana yang perlu diubah). */
export const HAS_CJK = /[\u3040-\u30FF\u31F0-\u31FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

/**
 * Deteksi dilakukan untuk SELURUH lirik sekaligus, bukan per baris.
 * Alasannya: lagu Jepang sering punya baris yang isinya kanji saja
 * (mis. "運命"). Kalau dicek per baris, baris itu akan terbaca sebagai
 * Mandarin dan jadi pinyin. Dengan melihat satu lagu utuh, cukup ada
 * satu kana di mana saja dan seluruh lagu diperlakukan sebagai Jepang.
 */
export function detectScript(lines: string[]): CjkScript | null {
  const text = lines.join('\n');
  if (KANA.test(text)) return 'japanese';

  const hangul = text.match(HANGUL)?.length ?? 0;
  const han = text.match(HAN)?.length ?? 0;
  if (hangul === 0 && han === 0) return null;
  return hangul >= han ? 'korean' : 'chinese';
}
