import { Dao } from './Dao';

/** Interface d'accès à la table position. */
export class PositionDao extends Dao {
  /** Positions du joueur connecté (statut optionnel : 'ouverte' | 'fermee') */
  async findMine(statut) { this.nonImplemente('findMine'); }
  /** Admin : positions ouvertes de tous les joueurs */
  async findOuvertes() { this.nonImplemente('findOuvertes'); }
  /** Place / retire le stop loss et / ou le take profit d'une position du joueur */
  async definirStops(positionId, { stop_loss, take_profit }) { this.nonImplemente('definirStops'); }
}
