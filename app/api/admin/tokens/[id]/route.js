import { route, commeUtilisateur, lireJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (req, { params }) => {
  const { id } = await params;
  const body = await lireJson(req);
  return commeUtilisateur(['admin'], (dao) => dao.tokens.update(Number(id), body));
});
