import { route, commeUtilisateur, lireJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Le joueur ne reçoit que SES positions (cloisonnement façon RLS)
export const GET = route((req) => {
  const statut = new URL(req.url).searchParams.get('statut') || undefined;
  return commeUtilisateur(['joueur'], (dao) => dao.positions.findMine(statut));
});

// Achat : ouvre une position ou renforce celle déjà ouverte sur ce token.
// Le client n'envoie QUE le token et le montant, jamais le prix.
export const POST = route(async (req) => {
  const { tokenId, montant } = await lireJson(req);
  return commeUtilisateur(['joueur'], (dao) => dao.ordres.acheter(Number(tokenId), montant));
});
