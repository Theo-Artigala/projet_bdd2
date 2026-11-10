import { MouvementDao } from '../MouvementDao';
import { Mouvement } from '../../models/Mouvement';
import { getDb } from './base';

export class MemoireMouvementDao extends MouvementDao {
  // RLS : uniquement les mouvements du portefeuille du joueur connecté
  async findMine(limite = 50) {
    const d = getDb();
    const pf = d.portefeuille.find((p) => p.utilisateur_id === this.ctx.utilisateurId);
    if (!pf) return [];
    return d.mouvement
      .filter((m) => m.portefeuille_id === pf.id)
      .slice(-limite)
      .reverse()
      .map((m) => new Mouvement(m));
  }
}
