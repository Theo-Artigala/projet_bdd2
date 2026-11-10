import { route } from '@/lib/api';
import { listerUtilisateurs } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Liste publique pour l'écran de connexion simulée
export const GET = route(() => listerUtilisateurs());
