import { Dao } from './Dao';

/** Interface d'accès à la table ordre. */
export class OrdreDao extends Dao {
  /** Achat : ouvre ou renforce la position (future procédure passer_ordre) */
  async acheter(tokenId, montant) { this.nonImplemente('acheter'); }
  /** Vente d'un pourcentage d'une position (future procédure passer_ordre) */
  async vendre(positionId, pourcentage) { this.nonImplemente('vendre'); }
  /** Fil d'activité public : derniers ordres de tous les joueurs (future vue) */
  async activiteRecente(limite = 25) { this.nonImplemente('activiteRecente'); }
  /** Ordres des autres joueurs sur un token depuis une date (points du graphique) */
  async ordresDesAutres(tokenId, depuis) { this.nonImplemente('ordresDesAutres'); }
}
