# Lirik Romaji

Ekstensi browser untuk Spotify Web (open.spotify.com) yang mengubah lirik
Korea, Jepang, dan Mandarin jadi romanisasi. Ada dua mode: **Asli** dan **Romaji**,
dan pergantian mode berlaku untuk seluruh lirik lagu sekaligus.

## Cara pakai cepat (tanpa build)

1. Ekstrak `lirik-romaji-chrome.zip`.
2. Buka `chrome://extensions`, nyalakan **Developer mode**.
3. Klik **Load unpacked**, pilih folder hasil ekstrak.
4. Buka open.spotify.com, putar lagu Korea/Jepang/Mandarin, buka panel lirik.
5. Pakai tombol **Asli / Romaji** di kanan bawah, tombol di popup ekstensi,
   atau pintasan **Alt + R**.

## Build dari source

```bash
npm install        # otomatis menyalin kamus Jepang ke public/dict
npm run dev        # buka Chrome dengan ekstensi + hot reload
npm run build      # hasil di .output/chrome-mv3
npm run build:firefox
```

## Cara kerjanya

- `lib/detect.ts`: menentukan bahasa dari SELURUH lirik, bukan per baris.
  Satu kana di mana pun berarti lagu Jepang, jadi baris yang isinya kanji saja
  (mis. 運命) tetap jadi `ummei`, bukan pinyin `yun ming`.
- `lib/romanize.ts`: Jepang pakai kuroshiro + kuromoji (seluruh lagu dikonversi
  dalam satu panggilan), Korea pakai `@romanize/korean` (Revised Romanization),
  Mandarin pakai `pinyin-pro` tanpa nada. Baris tanpa huruf CJK dibiarkan.
- `entrypoints/background.ts`: romanisasi dijalankan di background, kamus
  kuromoji (~18 MB) ikut di-bundle, jadi tidak perlu CDN dan jalan offline.
- `entrypoints/spotify.content/`: membaca baris `[data-testid="lyrics-line"] > div`,
  menyimpan teks asli, lalu mengganti isi text node sesuai mode. Hasil disimpan
  per lagu, jadi pindah mode itu instan.

## Catatan

- Kalau Spotify mengubah struktur HTML-nya, selector di `LINE_SELECTOR`
  (`entrypoints/spotify.content/index.ts`) yang perlu disesuaikan.
- Lagu Jepang pertama setelah browser dibuka butuh beberapa detik karena kamus
  dimuat dulu. Tombol akan menampilkan "Menyiapkan…".
- Romanisasi Jepang berbasis kamus, jadi kadang ada bacaan yang meleset
  (contoh: 二人 bisa terbaca `ni nin`, bukan `futari`).
