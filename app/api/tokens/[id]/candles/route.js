import { route, commeUtilisateur } from '@/lib/api';

export const dynamic = 'force-dynamic';

const INTERVALLES = [1, 5, 15, 60];

// Bougies + ordres des autres joueurs sur la période affichée
export const GET = route(async (req, { params }) => {
  const { id } = await params;
  const demande = Number(new URL(req.url).searchParams.get('interval'));
  const intervalle = INTERVALLES.includes(demande) ? demande : 5;
  return commeUtilisateur([], async (dao) => {
    const bougies = await dao.cotations.bougies(Number(id), intervalle);
    const depuis = bougies.length ? bougies[0].time * 1000 : 0;
    return { bougies, autres: await dao.ordres.ordresDesAutres(Number(id), depuis) };
  });
});
