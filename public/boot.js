// Boot script — externalized from index.html so the CSP can drop
// `script-src 'unsafe-inline'`. Served same-origin, allowed by `script-src 'self'`.

// Prompt installation PWA
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.__pwaPrompt = e;
  window.dispatchEvent(new Event('pwa-installable'));
});

// Masquer splash
window.addEventListener('load', () => {
  setTimeout(() => {
    const s = document.getElementById('splash');
    if (s) { s.classList.add('hidden'); setTimeout(() => s.remove(), 500); }
  }, 1800);
});
