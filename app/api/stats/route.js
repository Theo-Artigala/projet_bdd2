import { route, commeUtilisateur } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Indicateurs agrégés (futures vues matérialisées)
export const GET = route(() =>
  commeUtilisateur([], async (dao) => ({
    classement: await dao.stats.classement(),
    tokens: await dao.stats.statsTokens(),
  }))
);
