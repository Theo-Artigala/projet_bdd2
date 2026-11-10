import { cookies } from 'next/headers';
import { route, utilisateurCourant, requeteLocale, lireJson, contexteDe, COOKIE_SESSION } from '@/lib/api';
import { avecDaos } from '@/lib/dao';
import { BusinessError } from '@/lib/erreurs';
import { ouvrirSession, fermerSession, joueursEnLigne } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const u = await utilisateurCourant();
  const base = { local: await requeteLocale(), en_ligne: joueursEnLigne() };
  if (!u) return { ...base, utilisateur: null };
  const pf = await avecDaos(contexteDe(u), (dao) => dao.portefeuilles.findMine());
  return {
    ...base,
    utilisateur: { id: u.id, pseudo: u.pseudo, role: u.role },
    solde: pf ? pf.solde : null,
  };
});

// Connexion :
//  - { pseudo }  : crée un nouveau joueur (tout le monde)
//  - { userId }  : reprend un compte existant (hôte uniquement, depuis sa machine)
export const POST = route(async (req) => {
  const { pseudo, userId } = await lireJson(req);
  const u = await avecDaos({ role: 'anonyme' }, async (dao) => {
    if (userId == null) return dao.utilisateurs.creerJoueur(pseudo);
    if (!(await requeteLocale())) throw new BusinessError("Réservé à l'hôte de la partie", 403);
    const existant = await dao.utilisateurs.findById(Number(userId));
    if (!existant) throw new BusinessError('Utilisateur introuvable', 404);
    return existant;
  });
  const store = await cookies();
  const ancien = store.get(COOKIE_SESSION)?.value;
  if (ancien) fermerSession(ancien);
  store.set(COOKIE_SESSION, ouvrirSession(u.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
});

export const DELETE = route(async () => {
  const store = await cookies();
  const jeton = store.get(COOKIE_SESSION)?.value;
  if (jeton) fermerSession(jeton);
  store.delete(COOKIE_SESSION);
  return { ok: true };
});
