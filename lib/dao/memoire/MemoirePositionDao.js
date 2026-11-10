import { PositionDao } from '../PositionDao';
import { BusinessError } from '../../erreurs';
import { getDb, dernierPrix, vuePosition } from './base';

export class MemoirePositionDao extends PositionDao {
  // RLS : un joueur ne voit que ses positions
  async findMine(statut) {
    const d = getDb();
    return d.position
      .filter((p) => p.utilisateur_id === this.ctx.utilisateurId && (!statut || p.statut === statut))
      .sort((a, b) => b.date_ouverture - a.date_ouverture)
      .map((p) => vuePosition(d, p));
  }

  async findOuvertes() {
    if (this.ctx.role !== 'admin') throw new BusinessError('Accès refusé', 403);
    const d = getDb();
    return d.position.filter((p) => p.statut === 'ouverte').map((p) => vuePosition(d, p));
  }

  // RG6 (futur trigger BEFORE UPDATE) : SL sous le prix actuel, TP au-dessus
  async definirStops(positionId, champs) {
    const d = getDb();
    const pos = d.position.find((p) => p.id === positionId);
    // RLS : la position d'un autre joueur est invisible, donc « introuvable »
    if (!pos || pos.utilisateur_id !== this.ctx.utilisateurId) throw new BusinessError('Position introuvable', 404);
    if (pos.statut !== 'ouverte') throw new BusinessError('Position déjà fermée');
    const prix = dernierPrix(d, pos.token_id);
    const lire = (k) => (champs[k] == null ? null : Number(champs[k]));
    const sl = 'stop_loss' in champs ? lire('stop_loss') : undefined;
    const tp = 'take_profit' in champs ? lire('take_profit') : undefined;
    // pourcentage vendu au déclenchement : 100 % par défaut, retiré avec le stop
    const pct = (valeur, cle) => (valeur == null ? null : champs[cle] == null ? 100 : Number(champs[cle]));
    const slPct = sl === undefined ? undefined : pct(sl, 'stop_loss_pct');
    const tpPct = tp === undefined ? undefined : pct(tp, 'take_profit_pct');
    // tout est validé avant de modifier (comme une transaction)
    if (sl != null && !(sl > 0 && sl < prix)) throw new BusinessError('Le stop loss doit être sous le prix actuel');
    if (tp != null && !(tp > prix)) throw new BusinessError('Le take profit doit être au-dessus du prix actuel');
    for (const v of [slPct, tpPct]) {
      if (v != null && !(Number.isInteger(v) && v >= 1 && v <= 100)) {
        throw new BusinessError('Le pourcentage vendu doit être un entier entre 1 et 100');
      }
    }
    if (sl !== undefined) { pos.stop_loss = sl; pos.stop_loss_pct = slPct; }
    if (tp !== undefined) { pos.take_profit = tp; pos.take_profit_pct = tpPct; }
    return vuePosition(d, pos);
  }
}
