// Table token + colonnes calculées par la vue des cours (prix actuel, ATH, variation 5 min)
export class Token {
  constructor(r) {
    this.id = r.id;
    this.nom = r.nom;
    this.symbole = r.symbole;
    this.volatilite = r.volatilite;
    this.prix_initial = r.prix_initial;
    this.statut = r.statut;             // 'actif' | 'suspendu' | 'mort'
    this.date_creation = r.date_creation;
    this.date_mort = r.date_mort ?? null;
    // calculés
    this.prix = r.prix ?? null;
    this.ath = r.ath ?? null;
    this.variation = r.variation ?? null;
    this.phase = r.phase ?? null;       // état du moteur : 'calme' | 'normal' | 'frenesie' | 'rug' (pas une colonne)
  }
}
