import { Dao } from './Dao';

/** Interface d'accès à la table position. */
export class PositionDao extends Dao {
  /** Positions du joueur connecté (statut optionnel : 'ouverte' | 'fermee') */
  async findMine(statut) { this.nonImplemente('findMine'); }
  /** Admin : positions ouvertes de tous les joueurs */
  async findOuvertes() { this.nonImplemente('findOuvertes'); }
  /** Place / retire le stop loss et / ou le take profit d'une position du joueur */
  /** champs : stop_loss, stop_loss_pct, take_profit, take_profit_pct (prix null = retirer) */
  async definirStops(positionId, champs) { this.nonImplemente('definirStops'); }
}
