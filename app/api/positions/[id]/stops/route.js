import { route, commeUtilisateur, lireJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Place ou retire le stop loss / take profit ({ stop_loss: prix | null, take_profit: prix | null })
export const PATCH = route(async (req, { params }) => {
  const { id } = await params;
  const body = await lireJson(req);
  const champs = {};
  if ('stop_loss' in body) champs.stop_loss = body.stop_loss;
  if ('take_profit' in body) champs.take_profit = body.take_profit;
  return commeUtilisateur(['joueur'], (dao) => dao.positions.definirStops(Number(id), champs));
});
