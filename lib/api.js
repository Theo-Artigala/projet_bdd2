// Outils communs aux routes API : identification de l'utilisateur, accès aux DAO,
// conversion des erreurs en réponses JSON.
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { BusinessError } from './erreurs';
import { avecDaos } from './dao';
import { lireSession } from './sessions';
import { demarrerMoteur } from './moteur';

demarrerMoteur();

export const COOKIE_SESSION = 'pod_session';

// La requête vient-elle de la machine de l'hôte, sans passer par le tunnel ?
// Cloudflare ajoute toujours les en-têtes cf-ray / cf-connecting-ip (un visiteur
// ne peut pas les retirer) et le domaine n'est alors pas localhost.
export async function requeteLocale() {
  const h = await headers();
  if (h.get('cf-ray') || h.get('cf-connecting-ip')) return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h.get('host') || '');
}

// Utilisateur connecté (ou null)
export async function utilisateurCourant() {
  const id = lireSession((await cookies()).get(COOKIE_SESSION)?.value);
  if (!id) return null;
  const u = await avecDaos({ role: 'anonyme' }, (dao) => dao.utilisateurs.findById(id));
  // les comptes admin / analyste ne sont utilisables que depuis la machine hôte
  if (u && u.role !== 'joueur' && !(await requeteLocale())) return null;
  return u;
}

export async function exigerUtilisateur(...roles) {
  const u = await utilisateurCourant();
  if (!u) throw new BusinessError('Non connecté', 401);
  if (roles.length && !roles.includes(u.role)) throw new BusinessError('Accès refusé', 403);
  return u;
}

// Contexte transmis aux DAO (futur SET ROLE + set_config('app.user_id'))
export const contexteDe = (u) => ({ role: u.role, utilisateurId: u.id });

/**
 * Vérifie que l'utilisateur est connecté (avec un des rôles donnés, si précisés),
 * puis exécute `fn(dao, utilisateur)` avec les DAO liés à son contexte.
 */
export async function commeUtilisateur(roles, fn) {
  const u = await exigerUtilisateur(...roles);
  return avecDaos(contexteDe(u), (dao) => fn(dao, u));
}

// Enveloppe commune : transforme les erreurs métier en réponses JSON
export function route(handler) {
  return async (req, ctx) => {
    try {
      const data = await handler(req, ctx);
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof BusinessError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }
  };
}

export async function lireJson(req) {
  try {
    return await req.json();
  } catch {
    throw new BusinessError('Corps JSON invalide');
  }
}
