import { route, commeUtilisateur } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = route(() => commeUtilisateur([], (dao) => dao.tokens.findAll()));
