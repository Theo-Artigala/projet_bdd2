import { route, exigerUtilisateur } from '@/lib/api';
import { classementJoueurs, statsTokens } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Indicateurs agrégés (futures vues matérialisées)
export const GET = route(async () => {
  await exigerUtilisateur();
  return { classement: classementJoueurs(), tokens: statsTokens() };
});
