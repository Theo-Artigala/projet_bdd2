import { route, exigerUtilisateur, lireJson } from '@/lib/api';
import { listerPositions, ouvrirPosition } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Le joueur ne reçoit que SES positions (cloisonnement façon RLS)
export const GET = route(async (req) => {
  const u = await exigerUtilisateur('joueur');
  const statut = new URL(req.url).searchParams.get('statut') || undefined;
  return listerPositions(u.id, statut);
});

// Ouverture : le client n'envoie QUE le token et la mise, jamais le prix
export const POST = route(async (req) => {
  const u = await exigerUtilisateur('joueur');
  const { tokenId, mise } = await lireJson(req);
  return ouvrirPosition(u.id, Number(tokenId), mise);
});
