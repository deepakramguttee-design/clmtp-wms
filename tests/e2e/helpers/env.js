import fs from 'node:fs';
import path from 'node:path';

// Lit .env.test à la racine du projet (jamais commité — voir .gitignore).
// Format attendu : KEY=VALUE, une paire par ligne.
export function loadEnvTest() {
  const file = path.resolve(process.cwd(), '.env.test');
  if (!fs.existsSync(file)) {
    throw new Error(
      '.env.test introuvable à la racine du projet. ' +
      'Copiez les variables E2E_* de .env.example dans un fichier .env.test et renseignez les valeurs.'
    );
  }
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2];
  }
  for (const key of ['E2E_EMAIL', 'E2E_PASSWORD']) {
    if (!env[key]) throw new Error(`${key} manquant dans .env.test`);
  }
  return env;
}
