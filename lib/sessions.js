// Sessions de connexion (hors base de données) : jeton aléatoire -> utilisateur.
// Le cookie du navigateur ne contient que le jeton, jamais l'id : impossible de
// se faire passer pour quelqu'un d'autre en modifiant son cookie.
import { randomBytes } from 'crypto';

const EN_LIGNE_MS = 15000;

function sessions() {
  if (!globalThis.__pod_sessions) globalThis.__pod_sessions = new Map();
  return globalThis.__pod_sessions; // jeton -> { utilisateurId, vu }
}

export function ouvrirSession(utilisateurId) {
  const jeton = randomBytes(24).toString('base64url');
  sessions().set(jeton, { utilisateurId, vu: Date.now() });
  return jeton;
}

export function fermerSession(jeton) {
  sessions().delete(jeton);
}

// Retrouve l'utilisateur d'un jeton et note qu'il est actif (pour « joueurs en ligne »)
export function lireSession(jeton) {
  const s = jeton && sessions().get(jeton);
  if (!s) return null;
  s.vu = Date.now();
  return s.utilisateurId;
}

export function joueursEnLigne() {
  const limite = Date.now() - EN_LIGNE_MS;
  const ids = new Set();
  for (const s of sessions().values()) if (s.vu > limite) ids.add(s.utilisateurId);
  return ids.size;
}
