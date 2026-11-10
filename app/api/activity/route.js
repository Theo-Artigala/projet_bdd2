import { route, commeUtilisateur } from '@/lib/api';

export const dynamic = 'force-dynamic';

// Fil d'activité public (derniers ordres de tous les joueurs)
export const GET = route(() => commeUtilisateur([], (dao) => dao.ordres.activiteRecente()));
