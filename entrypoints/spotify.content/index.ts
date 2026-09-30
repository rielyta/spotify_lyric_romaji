import './style.css';
import { ensureLyrics, externalLines, hidePanel, highlight, renderPanel } from './externalLyrics';

type Mode = 'original' | 'romaji';
type PillStatus = 'hidden' | 'loading' | 'ready' | 'error';

const MODE_KEY = 'mode';
const LINE_SELECTOR = '[data-testid="lyrics-line"] > div';
/** Tunggu sebentar sebelum menganggap Spotify tidak punya lirik. */
const EMPTY_GRACE_MS = 1500;

/**
 * Kita TIDAK mengganti elemen/teks milik Spotify dengan yang baru. Yang diubah
 * hanya isi (`data`) dari text node yang sudah ada. Jadi kalau Spotify (React)
 * menaruh teks lagu baru di node yang sama, perubahannya tetap kelihatan dan
 * bisa kita kenali sebagai lirik asli yang baru.
 */
interface NodeState { orig: string; rom?: string }
const nodeState = new WeakMap<Text, NodeState>();

/** Cache hasil per lagu. Kunci = seluruh lirik asli digabung. null = bukan lagu CJK. */
const songCache = new Map<string, string[] | null>();
const failed = new Set<string>();
const pending = new Set<string>();

let mode: Mode = 'original';
let pill: HTMLElement | null = null;
let emptySince = 0;

export default defineContentScript({
  matches: ['*://open.spotify.com/*'],
  async main() {
    const stored = await browser.storage.local.get(MODE_KEY);
    mode = stored[MODE_KEY] === 'romaji' ? 'romaji' : 'original';

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[MODE_KEY]) {
        mode = changes[MODE_KEY].newValue === 'romaji' ? 'romaji' : 'original';
        schedule();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyR') {
        e.preventDefault();
        setMode(mode === 'romaji' ? 'original' : 'romaji');
      }
    });

    new MutationObserver(onMutations).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Sorotan baris LRCLIB mengikuti waktu lagu; cek ulang keadaan tiap detik.
    setInterval(highlight, 250);
    setInterval(schedule, 1000);

    schedule();
  },
});

function setMode(next: Mode) {
  mode = next;
  browser.storage.local.set({ [MODE_KEY]: next });
  schedule();
}

// ---------- Observasi DOM ----------

function onMutations(muts: MutationRecord[]) {
  for (const m of muts) {
    const target = m.target instanceof Element ? m.target : m.target.parentElement;
    if (target?.closest('#lr-pill, #lr-panel')) continue; // perubahan buatan kita sendiri

    if (m.type === 'characterData') {
      // Abaikan perubahan teks di luar lirik (mis. timer di progress bar).
      if (target?.closest('[data-testid="lyrics-line"]')) return schedule();
    } else if (m.addedNodes.length || m.removedNodes.length) {
      return schedule();
    }
  }
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    apply();
  });
}

function textNodeOf(el: Element): Text | null {
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) return child as Text;
  }
  return null;
}

function isLyricsView(): boolean {
  return location.pathname.startsWith('/lyrics');
}

// ---------- Inti ----------

/** Romaji untuk satu lagu dari cache, atau mulai minta ke background. */
function resolveRomaji(originals: string[]): { status: PillStatus; romaji: string[] | null } {
  const key = originals.join('\n');
  if (failed.has(key)) return { status: 'error', romaji: null };
  if (!songCache.has(key)) {
    request(key, originals);
    return { status: 'loading', romaji: null };
  }
  const romaji = songCache.get(key) ?? null;
  // null = bukan lagu Korea/Jepang/Mandarin: tidak ada yang perlu diubah.
  return { status: romaji ? 'ready' : 'hidden', romaji };
}

function apply() {
  const nodes = Array.from(document.querySelectorAll(LINE_SELECTOR))
    .map(textNodeOf)
    .filter((n): n is Text => n !== null);

  if (nodes.length === 0) return applyExternal();

  // Spotify punya lirik: panel LRCLIB tidak dipakai.
  emptySince = 0;
  hidePanel();

  // Teks asli tiap baris. Kalau isi node bukan teks asli yang kita catat dan
  // bukan romaji buatan kita, berarti Spotify menaruh lirik baru di situ.
  const originals = nodes.map((node) => {
    const st = nodeState.get(node);
    if (!st || (node.data !== st.orig && node.data !== st.rom)) {
      nodeState.set(node, { orig: node.data });
      return node.data;
    }
    return st.orig;
  });

  const { status, romaji } = resolveRomaji(originals);
  renderPill(status);

  if (romaji) nodes.forEach((node, i) => (nodeState.get(node)!.rom = romaji[i]));
  writeAll(nodes, mode === 'romaji' && romaji ? romaji : originals);
}

/** Halaman lirik terbuka tapi Spotify tidak punya liriknya → pakai LRCLIB. */
function applyExternal() {
  if (!isLyricsView()) {
    emptySince = 0;
    hidePanel();
    return renderPill('hidden');
  }

  if (!emptySince) emptySince = performance.now();
  if (performance.now() - emptySince < EMPTY_GRACE_MS) return;

  ensureLyrics(schedule);
  const lines = externalLines();
  if (!lines) {
    renderPill('hidden');
    return renderPanel(null);
  }

  const { status, romaji } = resolveRomaji(lines);
  renderPill(status);
  renderPanel(mode === 'romaji' && romaji ? romaji : lines);
}

function writeAll(nodes: Text[], texts: string[]) {
  nodes.forEach((node, i) => {
    const t = texts[i] ?? node.data;
    if (node.data !== t) node.data = t;
  });
}

function request(key: string, lines: string[]) {
  if (pending.has(key)) return;
  pending.add(key);

  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout 90 detik')), 90_000),
  );

  Promise.race([browser.runtime.sendMessage({ type: 'romanize', lines }), timeout])
    .then((res: any) => {
      if (!res?.ok) throw new Error(res?.error ?? 'Tidak ada respons');
      songCache.set(key, res.romaji ?? null);
    })
    .catch((err) => {
      console.warn('[Lirik Romaji]', err);
      failed.add(key);
    })
    .finally(() => {
      pending.delete(key);
      schedule();
    });
}

// ---------- Tombol mengambang ----------

function ensurePill(): HTMLElement {
  if (pill && pill.isConnected) return pill;

  pill = document.createElement('div');
  pill.id = 'lr-pill';
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Tampilan lirik');
  pill.innerHTML = `
    <button type="button" data-mode="original">Asli</button>
    <button type="button" data-mode="romaji">Romaji</button>
    <span class="lr-status" aria-live="polite"></span>
  `;
  pill.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]');
    if (btn && !btn.disabled) setMode(btn.dataset.mode as Mode);
  });
  document.body.appendChild(pill);
  return pill;
}

function renderPill(status: PillStatus) {
  if (status === 'hidden') {
    pill?.remove();
    return;
  }

  const el = ensurePill();
  el.dataset.status = status;

  el.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((b) => {
    const pressed = String(b.dataset.mode === mode);
    if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
    b.disabled = b.dataset.mode === 'romaji' && status !== 'ready';
  });

  const label = el.querySelector('.lr-status')!;
  const text = status === 'loading' ? 'Menyiapkan…' : status === 'error' ? 'Gagal memuat' : '';
  if (label.textContent !== text) label.textContent = text;
}