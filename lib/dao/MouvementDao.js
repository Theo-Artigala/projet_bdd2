import { Dao } from './Dao';

/** Interface d'accès à la table mouvement. */
export class MouvementDao extends Dao {
  /** Relevé du portefeuille du joueur connecté */
  async findMine(limite = 50) { this.nonImplemente('findMine'); }
}
