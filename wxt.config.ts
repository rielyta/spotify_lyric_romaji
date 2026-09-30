import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Lirik Romaji',
    description: 'Ubah lirik Korea, Jepang, dan Mandarin di Spotify Web jadi romanisasi.',
    permissions: ['storage'],
    host_permissions: ['https://lrclib.net/*'],
    icons: { 16: 'icon16.png', 48: 'icon48.png', 128: 'icon128.png' },
    browser_specific_settings: {
      gecko: { id: 'lirik-romaji@local' },
    },
  },
});
