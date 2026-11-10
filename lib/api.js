import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { BusinessError, getUtilisateur } from './store';

// Utilisateur "connecté" : simple cookie uid (connexion simulée).
// Plus tard, ce sera l'équivalent de auth.uid() dans les politiques RLS.
export async function utilisateurCourant() {
  const store = await cookies();
  const id = Number(store.get('uid')?.value);
  return id ? getUtilisateur(id) : null;
}

export async function exigerUtilisateur(...roles) {
  const u = await utilisateurCourant();
  if (!u) throw new BusinessError('Non connecté', 401);
  if (roles.length && !roles.includes(u.role)) throw new BusinessError('Accès refusé', 403);
  return u;
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
