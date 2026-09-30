// @ts-ignore: file JS internal kuromoji, tidak punya type
import BrowserDictionaryLoader from '@sglkc/kuromoji/src/loader/BrowserDictionaryLoader.js';

BrowserDictionaryLoader.prototype.loadArrayBuffer = function (
  url: string,
  callback: (err: unknown, buf: ArrayBuffer | null) => void,
) {
  (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Gagal ambil kamus: ${res.status} ${url}`);
    const bytes = new Uint8Array(await res.arrayBuffer());

    // Kalau Chrome sudah mendekompresi file .gz, langsung pakai.
    const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
    if (!isGzip) return bytes.buffer;

    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  })().then(
    (buf) => callback(null, buf),
    (err) => callback(err, null),
  );
};