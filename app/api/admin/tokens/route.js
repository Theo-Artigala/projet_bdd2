import { route, exigerUtilisateur, lireJson } from '@/lib/api';
import { creerToken } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  await exigerUtilisateur('admin');
  return creerToken(await lireJson(req));
});
