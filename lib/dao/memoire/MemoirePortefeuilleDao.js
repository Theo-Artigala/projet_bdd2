import { PortefeuilleDao } from '../PortefeuilleDao';
import { Portefeuille } from '../../models/Portefeuille';
import { getDb } from './base';

export class MemoirePortefeuilleDao extends PortefeuilleDao {
  // RLS : un joueur ne voit que son portefeuille
  async findMine() {
    const pf = getDb().portefeuille.find((p) => p.utilisateur_id === this.ctx.utilisateurId);
    return pf ? new Portefeuille(pf) : null;
  }
}
