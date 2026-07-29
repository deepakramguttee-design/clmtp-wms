// Durcissement des imports Excel (F-004).
// - Plafond de taille de fichier (anti-ReDoS / anti-DoS mémoire).
// - Sanitisation anti prototype-pollution : lignes retournées en objets à
//   prototype NUL, clés dangereuses (__proto__ / prototype / constructor) ignorées.
// À utiliser en complément de SheetJS officiel (>= 0.20.x) qui corrige les CVE parser.

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024; // 8 Mo

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// Vrai si le fichier dépasse le plafond autorisé.
export function tooLarge(file) {
  return !!file && typeof file.size === 'number' && file.size > MAX_IMPORT_BYTES;
}

// Convertit la feuille en lignes JSON de façon sûre :
// chaque ligne est un objet à prototype nul, sans clé dangereuse.
// Aucune écriture sur Object.prototype n'est donc possible via un en-tête forgé.
export function safeSheetToJson(XLSX, ws) {
  const raw = XLSX.utils.sheet_to_json(ws);
  return raw.map((row) => {
    const clean = Object.create(null);
    for (const k of Object.keys(row)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      clean[k] = row[k];
    }
    return clean;
  });
}
