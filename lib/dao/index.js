// Point d'entrée de la couche DAO : c'est ici qu'on choisit l'implémentation.
// Aujourd'hui : en mémoire. Demain : PostgreSQL (dossier dao/pg/), sans toucher aux routes.
import { MemoireUtilisateurDao } from './memoire/MemoireUtilisateurDao';
import { MemoirePortefeuilleDao } from './memoire/MemoirePortefeuilleDao';
import { MemoireTokenDao } from './memoire/MemoireTokenDao';
import { MemoireCotationDao } from './memoire/MemoireCotationDao';
import { MemoirePositionDao } from './memoire/MemoirePositionDao';
import { MemoireOrdreDao } from './memoire/MemoireOrdreDao';
import { MemoireMouvementDao } from './memoire/MemoireMouvementDao';
import { MemoireStatsDao } from './memoire/MemoireStatsDao';

/**
 * Exécute `fn` avec les DAO liés au contexte de l'utilisateur.
 * Avec PostgreSQL, cette fonction ouvrira une transaction :
 *   BEGIN; SET LOCAL ROLE pod_<role>; SELECT set_config('app.user_id', $1, true);
 *   ... fn(dao) ...
 *   COMMIT (ou ROLLBACK si une erreur est levée)
 *
 * @param {{role: 'joueur'|'admin'|'analyste'|'anonyme'|'moteur', utilisateurId?: number}} ctx
 * @param {(dao: object) => Promise<any>} fn
 */
export async function avecDaos(ctx, fn) {
  const dao = {
    utilisateurs: new MemoireUtilisateurDao(ctx),
    portefeuilles: new MemoirePortefeuilleDao(ctx),
    tokens: new MemoireTokenDao(ctx),
    cotations: new MemoireCotationDao(ctx),
    positions: new MemoirePositionDao(ctx),
    ordres: new MemoireOrdreDao(ctx),
    mouvements: new MemoireMouvementDao(ctx),
    stats: new MemoireStatsDao(ctx),
  };
  return fn(dao);
}
