import { route, commeUtilisateur, lireJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Place ou retire le stop loss / take profit :
// { stop_loss: prix | null, stop_loss_pct?: 1..100, take_profit: prix | null, take_profit_pct?: 1..100 }
export const PATCH = route(async (req, { params }) => {
  const { id } = await params;
  const body = await lireJson(req);
  const champs = {};
  for (const k of ['stop_loss', 'stop_loss_pct', 'take_profit', 'take_profit_pct']) {
    if (k in body) champs[k] = body[k];
  }
  return commeUtilisateur(['joueur'], (dao) => dao.positions.definirStops(Number(id), champs));
});
