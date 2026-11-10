// Table position (association N-N utilisateur <-> token)
// + colonnes calculées à partir des ordres (vue des positions)
export class Position {
  constructor(r) {
    this.id = r.id;
    this.utilisateur_id = r.utilisateur_id;
    this.token_id = r.token_id;
    this.quantite = r.quantite;         // tokens détenus
    this.cout = r.cout;                 // prix payé pour ces tokens
    this.stop_loss = r.stop_loss;
    this.take_profit = r.take_profit;
    this.statut = r.statut;             // 'ouverte' | 'fermee'
    this.date_ouverture = r.date_ouverture;
    this.date_fermeture = r.date_fermeture;
    // calculés
    this.symbole = r.symbole;
    this.pseudo = r.pseudo;
    this.prix_moyen = r.prix_moyen;             // cout / quantite
    this.prix_moyen_achat = r.prix_moyen_achat; // sur tous les achats
    this.total_investi = r.total_investi;       // somme des achats
    this.total_recupere = r.total_recupere;     // somme des ventes
    this.pnl_realise = r.pnl_realise;           // somme (montant vente − coût vendu)
    this.ordres = r.ordres ?? [];
  }
}
