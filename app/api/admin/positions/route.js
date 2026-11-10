import { route, exigerUtilisateur } from '@/lib/api';
import { listerToutesPositionsOuvertes } from '@/lib/store';

export const dynamic = 'force-dynamic';

// L'admin voit les positions ouvertes de tout le monde
export const GET = route(async () => {
  await exigerUtilisateur('admin');
  return listerToutesPositionsOuvertes();
});
