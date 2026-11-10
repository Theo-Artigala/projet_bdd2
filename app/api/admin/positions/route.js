import { route, commeUtilisateur } from '@/lib/api';

export const dynamic = 'force-dynamic';

// L'admin voit les positions ouvertes de tout le monde
export const GET = route(() => commeUtilisateur(['admin'], (dao) => dao.positions.findOuvertes()));
