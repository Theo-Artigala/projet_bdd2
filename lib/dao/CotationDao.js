import { Dao } from './Dao';

/** Interface d'accès à la table cotation. */
export class CotationDao extends Dao {
  /** Dernier prix connu d'un token (future fonction SQL prix_actuel) */
  async prixActuel(tokenId) { this.nonImplemente('prixActuel'); }
  /** Bougies OHLC + volume sur `intervalle` secondes (future requête complexe) */
  async bougies(tokenId, intervalle, limite = 300) { this.nonImplemente('bougies'); }
  /** Moteur : prix + volume pour chaque token actif (selon sa phase), SL / TP, rugs, naissances */
  async genererCotations() { this.nonImplemente('genererCotations'); }
}
