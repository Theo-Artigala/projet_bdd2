import { StatsDao } from '../StatsDao';
import { LigneClassement, StatsToken } from '../../models/Stats';
import { getDb, vuePosition, round2 } from './base';

export class MemoireStatsDao extends StatsDao {
  // Future vue matérialisée mv_classement
  async classement() {
    const d = getDb();
    return d.utilisateur
      .filter((u) => u.role === 'joueur')
      .map((u) => {
        const positions = d.position.filter((p) => p.utilisateur_id === u.id).map((p) => vuePosition(d, p));
        const fermees = positions.filter((p) => p.statut === 'fermee');
        const gagnantes = fermees.filter((p) => p.pnl_realise > 0).length;
        return new LigneClassement({
          utilisateur_id: u.id,
          pseudo: u.pseudo,
          pnl_total: round2(positions.reduce((s, p) => s + p.pnl_realise, 0)),
          nb_trades: fermees.length,
          taux_reussite: fermees.length ? gagnantes / fermees.length : null,
          solde: d.portefeuille.find((p) => p.utilisateur_id === u.id).solde,
        });
      })
      .sort((a, b) => b.pnl_total - a.pnl_total);
  }

  // Future vue matérialisée mv_stats_token
  async statsTokens() {
    const d = getDb();
    return d.token.map((t) => {
      const pos = d.position.filter((p) => p.token_id === t.id);
      const ids = new Set(pos.map((p) => p.id));
      const cot = d.cotation.get(t.id).slice(-300);
      let somme = 0;
      for (let i = 1; i < cot.length; i++) {
        const r = Math.log(cot[i].prix / cot[i - 1].prix);
        somme += r * r;
      }
      return new StatsToken({
        token_id: t.id,
        symbole: t.symbole,
        volume: round2(d.ordre.filter((o) => ids.has(o.position_id)).reduce((s, o) => s + o.montant, 0)),
        nb_positions: pos.length,
        positions_ouvertes: pos.filter((p) => p.statut === 'ouverte').length,
        volatilite_observee: cot.length > 1 ? Math.sqrt(somme / (cot.length - 1)) : 0,
      });
    });
  }
}
