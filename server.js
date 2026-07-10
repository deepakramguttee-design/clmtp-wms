import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── En-têtes de sécurité — parité avec netlify.toml ──
// Le CSP est identique à celui déployé sur Netlify pour un comportement homogène
// entre l'hébergement Netlify et l'auto-hébergement via ce serveur express.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://jtqlaiabxwbgwgduqzpl.supabase.co wss://jtqlaiabxwbgwgduqzpl.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', CSP);
  // HSTS : uniquement en HTTPS. Sur un serveur HTTP en LAN il serait ignoré par
  // le navigateur ; on ne l'émet que derrière une terminaison TLS (reverse proxy).
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// Assets hashés (immuables) : cache long. index.html / service worker : jamais mis en cache.
app.use(express.static(join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (/[\\/]assets[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/(?:index\.html|sw\.js)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  },
}));

// SPA fallback — toutes les routes vers index.html (non mis en cache)
app.get('/{*splat}', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`LogiWMS → http://localhost:${PORT}`);
});
