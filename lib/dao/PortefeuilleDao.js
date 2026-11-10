import { Dao } from './Dao';

/** Interface d'accès à la table portefeuille. */
export class PortefeuilleDao extends Dao {
  /** Portefeuille de l'utilisateur connecté (null pour admin / analyste) */
  async findMine() { this.nonImplemente('findMine'); }
}
