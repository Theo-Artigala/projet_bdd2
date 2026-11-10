import { route, requeteLocale } from '@/lib/api';
import { avecDaos } from '@/lib/dao';
import { BusinessError } from '@/lib/erreurs';

export const dynamic = 'force-dynamic';

// Liste des comptes existants : uniquement pour l'hôte (écran « Mode hôte »)
export const GET = route(async () => {
  if (!(await requeteLocale())) throw new BusinessError("Réservé à l'hôte de la partie", 403);
  const users = await avecDaos({ role: 'anonyme' }, (dao) => dao.utilisateurs.findAll());
  return users.map(({ id, pseudo, role, bot }) => ({ id, pseudo, role, bot }));
});
