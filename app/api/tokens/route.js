import { route, exigerUtilisateur } from '@/lib/api';
import { listerTokens } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await exigerUtilisateur();
  return listerTokens();
});
