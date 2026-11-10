import { CotationDao } from '../CotationDao';
import { Bougie } from '../../models/Cotation';
import { BusinessError } from '../../erreurs';
import { getDb, dernierPrix, prixSuivant, ajouterCotation, executerStops, now } from './base';

export class MemoireCotationDao extends CotationDao {
  async prixActuel(tokenId) {
    return dernierPrix(getDb(), tokenId);
  }

  // Future requête complexe : agrégation des cotations en bougies OHLC + volume des ordres
  async bougies(tokenId, intervalle = 5, limite = 300) {
    const d = getDb();
    const cot = d.cotation.get(tokenId);
    if (!cot) throw new BusinessError('Token introuvable', 404);
    const pas = intervalle * 1000;
    const bougies = [];
    for (const c of cot) {
      const time = Math.floor(c.horodatage / pas) * intervalle;
      const last = bougies[bougies.length - 1];
      if (last && last.time === time) {
        last.high = Math.max(last.high, c.prix);
        last.low = Math.min(last.low, c.prix);
        last.close = c.prix;
      } else {
        // l'ouverture reprend la clôture précédente : bougies jointives
        const open = last ? last.close : c.prix;
        bougies.push({ time, open, high: Math.max(open, c.prix), low: Math.min(open, c.prix), close: c.prix, volume: 0 });
      }
    }
    const index = new Map(bougies.map((b) => [b.time, b]));
    const positions = new Set(d.position.filter((p) => p.token_id === tokenId).map((p) => p.id));
    for (const o of d.ordre) {
      if (!positions.has(o.position_id)) continue;
      const b = index.get(Math.floor(o.horodatage / pas) * intervalle);
      if (b) b.volume += o.montant;
    }
    return bougies.slice(-limite).map((b) => new Bougie(b));
  }

  // Future procédure generer_cotations() : un prix par token actif,
  // l'insertion déclenchant l'exécution des stop loss / take profit (RG7)
  async genererCotations() {
    if (this.ctx.role !== 'moteur') throw new BusinessError('Accès refusé', 403);
    const d = getDb();
    const t = now();
    for (const token of d.token) {
      if (token.statut !== 'actif') continue;
      const prix = prixSuivant(token, dernierPrix(d, token.id));
      ajouterCotation(d, token, prix, t);
      executerStops(d, token.id, prix, t);
    }
  }
}
