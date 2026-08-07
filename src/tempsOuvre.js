// Temps ouvré atelier CLMTP.
// Horaires : 8h00-12h00 et 13h00-17h00 (13h00-16h00 le mercredi).
// Pause déjeuner 12h-13h, soirées, nuits et week-ends exclus du décompte.
// Le chronomètre des OR et les durées facturées passent par ces fonctions.

const MINUTES_PAR_JOUR = 24 * 60;
const DEBUT_MATIN = 8 * 60;
const FIN_MATIN = 12 * 60;
const DEBUT_APRES_MIDI = 13 * 60;
const FIN_JOUR = 17 * 60;
const FIN_MERCREDI = 16 * 60;
const DIMANCHE = 0, MERCREDI = 3, SAMEDI = 6;

/** Plages ouvrées du jour, en minutes depuis minuit (heure locale). */
export function plagesOuvrees(jour) {
  const js = jour.getDay();
  if (js === SAMEDI || js === DIMANCHE) return [];
  const finApresMidi = js === MERCREDI ? FIN_MERCREDI : FIN_JOUR;
  return [
    { debut: DEBUT_MATIN, fin: FIN_MATIN },
    { debut: DEBUT_APRES_MIDI, fin: finApresMidi },
  ];
}

function minutesDepuisMinuit(d) {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function memeJour(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Minutes ouvrées écoulées entre deux instants (fractions possibles).
 * @param {Date} debut
 * @param {Date} fin
 * @returns {number}
 */
export function minutesOuvreesEntre(debut, fin) {
  if (!(debut instanceof Date) || !(fin instanceof Date)) return 0;
  if (isNaN(debut) || isNaN(fin) || fin.getTime() <= debut.getTime()) return 0;
  let total = 0;
  const curseur = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
  const dernier = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
  while (curseur.getTime() <= dernier.getTime()) {
    const borneDebut = memeJour(curseur, debut) ? minutesDepuisMinuit(debut) : 0;
    const borneFin = memeJour(curseur, fin) ? minutesDepuisMinuit(fin) : MINUTES_PAR_JOUR;
    for (const p of plagesOuvrees(curseur)) {
      const rec = Math.min(borneFin, p.fin) - Math.max(borneDebut, p.debut);
      if (rec > 0) total += rec;
    }
    curseur.setDate(curseur.getDate() + 1);
  }
  return total;
}

/** Secondes ouvrées écoulées (pour l'affichage du chronomètre). */
export function secondesOuvreesEntre(debut, fin) {
  return Math.floor(minutesOuvreesEntre(debut, fin) * 60);
}

/** Heures ouvrées arrondies à 2 décimales (pour duree_heures / facturation). */
export function heuresOuvreesEntre(debut, fin) {
  return Math.round((minutesOuvreesEntre(debut, fin) / 60) * 100) / 100;
}
