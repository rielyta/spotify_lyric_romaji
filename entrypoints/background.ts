import { romanizeSong, warmUp } from '../lib/romanize';
import { findLyrics, type LyricsResult } from '../lib/lrclib';

const lyricsCache = new Map<string, Promise<LyricsResult | null>>();

export default defineBackground(() => {
  warmUp();

  browser.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
    if (msg?.type === 'romanize') {
      romanizeSong(msg.lines as string[])
        .then((res) => sendResponse({ ok: true, ...res }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }

    if (msg?.type === 'lyrics') {
      const { title, artist, duration } = msg;
      const key = `${title}|${artist}|${duration == null ? '' : Math.round(duration)}`;
      if (!lyricsCache.has(key)) {
        const p = findLyrics({ title, artist, duration });
        p.catch(() => lyricsCache.delete(key)); // error jaringan: boleh dicoba lagi
        lyricsCache.set(key, p);
      }
      lyricsCache
        .get(key)!
        .then((result) => sendResponse({ ok: true, result }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true;
    }
  });
});