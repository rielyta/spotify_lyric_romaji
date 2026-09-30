export interface LyricLine {
  time: number | null; // detik; null kalau lirik tidak tersinkron
  text: string;
}

export interface LyricsResult {
  synced: boolean;
  lines: LyricLine[];
}

interface LrclibTrack {
  trackName: string;
  artistName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface TrackQuery {
  title: string;
  artist: string;
  duration: number | null;
}

const API = 'https://lrclib.net/api';
const HEADERS = { 'Lrclib-Client': 'LirikRomaji/0.1' };

/** "[01:23.45] teks" → { time: 83.45, text: "teks" }. Satu baris bisa punya beberapa timestamp. */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (stamps.length === 0) continue; // baris metadata seperti [ar:...] dilewati
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ time: Number(m[1]) * 60 + Number(m[2]), text });
  }
  return out.sort((a, b) => a.time! - b.time!);
}

/** Buang embel-embel seperti "(feat. X)", "- Remastered 2011", "- From 'Anime'". */
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[([（【].*?[)\]）】]\s*/g, ' ')
    .replace(/\s+-\s+.*$/, '')
    .trim();
}

async function search(params: Record<string, string>): Promise<LrclibTrack[]> {
  const url = new URL(`${API}/search`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  return res.json();
}

/** Pilih hasil terbaik: durasi paling dekat, dan utamakan yang tersinkron. */
function pickBest(list: LrclibTrack[], duration: number | null, maxDiff: number): LrclibTrack | null {
  const scored = list
    .filter((t) => !t.instrumental && (t.syncedLyrics || t.plainLyrics))
    .map((t) => ({ t, diff: duration == null ? 0 : Math.abs(t.duration - duration) }))
    .filter((x) => x.diff <= maxDiff)
    .sort((a, b) => Number(!a.t.syncedLyrics) - Number(!b.t.syncedLyrics) || a.diff - b.diff);
  return scored[0]?.t ?? null;
}

function toResult(t: LrclibTrack): LyricsResult {
  if (t.syncedLyrics) {
    const lines = parseLrc(t.syncedLyrics);
    if (lines.length) return { synced: true, lines };
  }
  const lines = (t.plainLyrics ?? '').split(/\r?\n/).map((text) => ({ time: null, text: text.trim() }));
  return { synced: false, lines };
}

export async function findLyrics(q: TrackQuery): Promise<LyricsResult | null> {
  const artist = q.artist.split(/,|&| feat\.? | x /i)[0].trim();
  const clean = cleanTitle(q.title);

  // Dari yang paling ketat ke yang paling longgar.
  const attempts: Array<[Record<string, string>, number]> = [
    [{ track_name: q.title, artist_name: artist }, 5],
    [{ track_name: clean, artist_name: artist }, 5],
    [{ q: `${clean} ${artist}` }, 5],
    // Tanpa nama artis hanya diterima kalau durasinya hampir sama persis.
    ...(q.duration != null ? [[{ track_name: clean }, 2] as [Record<string, string>, number]] : []),
  ];

  const tried = new Set<string>();
  for (const [params, maxDiff] of attempts) {
    const sig = JSON.stringify(params);
    if (tried.has(sig)) continue;
    tried.add(sig);

    const best = pickBest(await search(params), q.duration, maxDiff);
    if (best) return toResult(best);
  }
  return null;
}