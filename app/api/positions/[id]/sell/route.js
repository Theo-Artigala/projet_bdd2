import { route, commeUtilisateur, lireJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Vente d'un pourcentage (1 à 100) de la quantité détenue
export const POST = route(async (req, { params }) => {
  const { id } = await params;
  const { pourcentage } = await lireJson(req);
  return commeUtilisateur(['joueur'], (dao) => dao.ordres.vendre(Number(id), pourcentage));
});
