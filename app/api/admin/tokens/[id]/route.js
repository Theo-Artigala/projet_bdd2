import { route, exigerUtilisateur, lireJson } from '@/lib/api';
import { modifierToken } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (req, { params }) => {
  await exigerUtilisateur('admin');
  const { id } = await params;
  return modifierToken(Number(id), await lireJson(req));
});
