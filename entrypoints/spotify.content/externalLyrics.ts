// Lirik dari LRCLIB untuk lagu yang tidak punya lirik di Spotify.
import type { LyricLine, LyricsResult } from '../../lib/lrclib';
import { getDuration, getNowPlaying, getPosition } from './player';

type Status = 'idle' | 'loading' | 'found' | 'none' | 'error';

let songId = '';
let status: Status = 'idle';
let result: LyricsResult | null = null;
let panel: HTMLElement | null = null;
let activeIndex = -1;
let shownTexts: string[] = [];

/** Baris lirik LRCLIB untuk lagu saat ini (teks saja), atau null kalau belum/tidak ada. */
export function externalLines(): string[] | null {
  return status === 'found' && result ? result.lines.map((l) => l.text) : null;
}

/** Pastikan lirik untuk lagu yang sedang diputar sudah (sedang) diambil. */
export function ensureLyrics(onChange: () => void): void {
  const np = getNowPlaying();
  if (!np) return;
  const id = `${np.title}|${np.artist}`;
  if (id === songId) return;

  songId = id;
  status = 'loading';
  result = null;
  activeIndex = -1;
  shownTexts = [];

  browser.runtime
    .sendMessage({ type: 'lyrics', title: np.title, artist: np.artist, duration: getDuration() })
    .then((res: any) => {
      if (id !== songId) return; // lagu sudah ganti
      if (!res?.ok) throw new Error(res?.error);
      result = res.result;
      status = result && result.lines.some((l) => l.text) ? 'found' : 'none';
    })
    .catch((err) => {
      if (id !== songId) return;
      console.warn('[Lirik Romaji] LRCLIB:', err);
      status = 'error';
    })
    .finally(onChange);
}

// ---------- Panel ----------

function mainArea(): DOMRect | null {
  const el = document.querySelector(
    '[data-testid="main-view-container"], .main-view-container, main',
  );
  return el?.getBoundingClientRect() ?? null;
}

function ensurePanel(): HTMLElement {
  if (panel?.isConnected) return panel;
  panel = document.createElement('section');
  panel.id = 'lr-panel';
  panel.setAttribute('aria-label', 'Lirik dari LRCLIB');
  panel.innerHTML = `<div class="lr-scroll"><ol class="lr-lines"></ol><p class="lr-msg"></p></div>
    <p class="lr-credit">Lirik dari LRCLIB</p>`;
  document.body.appendChild(panel);
  return panel;
}

function place(el: HTMLElement) {
  const r = mainArea();
  if (!r || r.width < 200) return;
  el.style.top = `${r.top}px`;
  el.style.left = `${r.left}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
}

export function hidePanel() {
  panel?.remove();
  panel = null;
  shownTexts = [];
  activeIndex = -1;
}

/** Tampilkan panel. `texts` = baris yang ditampilkan (asli atau romaji). */
export function renderPanel(texts: string[] | null) {
  const el = ensurePanel();
  place(el);

  const msg = el.querySelector<HTMLElement>('.lr-msg')!;
  const list = el.querySelector<HTMLOListElement>('.lr-lines')!;

  const message =
    status === 'loading' ? 'Mencari lirik di LRCLIB…'
    : status === 'none' ? 'Lirik lagu ini belum ada di LRCLIB.'
    : status === 'error' ? 'Gagal menghubungi LRCLIB.'
    : '';
  if (msg.textContent !== message) msg.textContent = message;

  if (!texts || !result) {
    if (list.childElementCount) list.replaceChildren();
    shownTexts = [];
    return;
  }

  el.dataset.synced = String(result.synced);
  if (texts.length === shownTexts.length && texts.every((t, i) => t === shownTexts[i])) return;

  shownTexts = texts;
  list.replaceChildren(
    ...texts.map((t) => {
      const li = document.createElement('li');
      li.textContent = t || '♪';
      return li;
    }),
  );
  activeIndex = -1;
  highlight();
}

/** Sorot baris yang sedang dinyanyikan. Dipanggil berkala. */
export function highlight() {
  if (!panel?.isConnected || !result?.synced) return;
  place(panel);

  const pos = getPosition();
  if (pos == null) return;
  const lines: LyricLine[] = result.lines;

  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time! <= pos + 0.25) idx = i;
    else break;
  }
  if (idx === activeIndex) return;

  const items = panel.querySelectorAll<HTMLLIElement>('.lr-lines li');
  items[activeIndex]?.classList.remove('lr-active');
  items.forEach((li, i) => li.classList.toggle('lr-past', i < idx));
  activeIndex = idx;

  const cur = items[idx];
  if (cur) {
    cur.classList.add('lr-active');
    cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}