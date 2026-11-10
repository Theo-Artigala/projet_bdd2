import { route, exigerUtilisateur } from '@/lib/api';
import { getBougies } from '@/lib/store';

export const dynamic = 'force-dynamic';

const INTERVALLES = [1, 5, 15, 60];

export const GET = route(async (req, { params }) => {
  await exigerUtilisateur();
  const { id } = await params;
  const demande = Number(new URL(req.url).searchParams.get('interval'));
  const intervalle = INTERVALLES.includes(demande) ? demande : 5;
  return getBougies(Number(id), intervalle);
});
