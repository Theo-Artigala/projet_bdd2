// Lignes des indicateurs (futures vues matérialisées)
export class LigneClassement {
  constructor(r) {
    this.utilisateur_id = r.utilisateur_id;
    this.pseudo = r.pseudo;
    this.pnl_total = r.pnl_total;
    this.nb_trades = r.nb_trades;
    this.taux_reussite = r.taux_reussite;
    this.solde = r.solde;
  }
}

export class StatsToken {
  constructor(r) {
    this.token_id = r.token_id;
    this.symbole = r.symbole;
    this.volume = r.volume;
    this.nb_positions = r.nb_positions;
    this.positions_ouvertes = r.positions_ouvertes;
    this.volatilite_observee = r.volatilite_observee;
  }
}
