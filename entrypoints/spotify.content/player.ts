// Membaca info lagu & posisi pemutaran dari UI Spotify Web.

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

function parseTime(text: string | null | undefined): number | null {
  if (!text) return null;
  const negative = text.trim().startsWith('-');
  const parts = text.replace(/[^\d:]/g, '').split(':').filter(Boolean).map(Number);
  if (parts.length === 0 || parts.some(Number.isNaN)) return null;
  const secs = parts.reduce((acc, p) => acc * 60 + p, 0);
  return negative ? -secs : secs;
}

export interface NowPlaying {
  title: string;
  artist: string;
}

export function getNowPlaying(): NowPlaying | null {
  const title = byTestId('context-item-info-title')?.textContent?.trim();
  const artist = byTestId('context-item-info-artist')?.textContent?.trim();
  if (title && artist) return { title, artist };

  // Cadangan: judul tab berbentuk "Judul • Artis".
  const [t, ...rest] = document.title.split(' • ');
  if (t && rest.length) return { title: t.trim(), artist: rest.join(' • ').trim() };
  return null;
}

// Tampilan posisi di Spotify hanya berubah tiap detik, jadi di antara detik
// kita perkirakan sendiri. Kalau angkanya berhenti berubah (lagu di-pause),
// perkiraannya berhenti maksimal <1 detik di depan.
let lastText = '';
let lastPos = 0;
let lastChange = 0;

export function getPosition(): number | null {
  const text = byTestId('playback-position')?.textContent ?? null;
  const pos = parseTime(text);
  if (pos == null) return null;

  const now = performance.now();
  if (text !== lastText) {
    lastText = text!;
    lastPos = pos;
    lastChange = now;
  }
  return lastPos + Math.min((now - lastChange) / 1000, 0.99);
}

export function getDuration(): number | null {
  const d = parseTime(byTestId('playback-duration')?.textContent);
  if (d == null) return null;
  if (d >= 0) return d;
  // Mode "sisa waktu" (-2:30): durasi = posisi + sisa.
  const p = parseTime(byTestId('playback-position')?.textContent);
  return p == null ? null : p - d;
}