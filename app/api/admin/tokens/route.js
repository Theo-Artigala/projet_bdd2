import { route, commeUtilisateur, lireJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  const body = await lireJson(req);
  return commeUtilisateur(['admin'], (dao) => dao.tokens.create(body));
});
