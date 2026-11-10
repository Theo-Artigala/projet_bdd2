import { route, exigerUtilisateur } from '@/lib/api';
import { fermerPosition } from '@/lib/store';

export const dynamic = 'force-dynamic';

export const POST = route(async (req, { params }) => {
  const u = await exigerUtilisateur('joueur');
  const { id } = await params;
  return fermerPosition(u.id, Number(id));
});
