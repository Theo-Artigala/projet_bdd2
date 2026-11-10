import { cookies } from 'next/headers';
import { route, utilisateurCourant, lireJson } from '@/lib/api';
import { BusinessError, getPortefeuille, getUtilisateur } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const u = await utilisateurCourant();
  if (!u) return { utilisateur: null };
  const pf = getPortefeuille(u.id);
  return {
    utilisateur: { id: u.id, pseudo: u.pseudo, role: u.role },
    solde: pf ? pf.solde : null,
  };
});

export const POST = route(async (req) => {
  const { userId } = await lireJson(req);
  const u = getUtilisateur(Number(userId));
  if (!u) throw new BusinessError('Utilisateur introuvable', 404);
  (await cookies()).set('uid', String(u.id), { httpOnly: true, sameSite: 'lax', path: '/' });
  return { ok: true };
});

export const DELETE = route(async () => {
  (await cookies()).delete('uid');
  return { ok: true };
});
