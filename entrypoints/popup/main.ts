type Mode = 'original' | 'romaji';
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-mode]'));

function render(mode: Mode) {
  buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
}

browser.storage.local.get('mode').then((s) => render(s.mode === 'romaji' ? 'romaji' : 'original'));

buttons.forEach((b) =>
  b.addEventListener('click', () => {
    const mode = b.dataset.mode as Mode;
    browser.storage.local.set({ mode });
    render(mode);
  }),
);
