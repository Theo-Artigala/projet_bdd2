import { Dao } from './Dao';

/** Interface d'accès à la table cotation. */
export class CotationDao extends Dao {
  /** Dernier prix connu d'un token (future fonction SQL prix_actuel) */
  async prixActuel(tokenId) { this.nonImplemente('prixActuel'); }
  /** Bougies OHLC + volume sur `intervalle` secondes (future requête complexe) */
  async bougies(tokenId, intervalle, limite = 300) { this.nonImplemente('bougies'); }
  /** Moteur : nouveau prix aléatoire pour chaque token actif, puis exécution des SL / TP */
  async genererCotations() { this.nonImplemente('genererCotations'); }
}
