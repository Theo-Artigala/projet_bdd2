// Table ordre : un achat ou une vente sur une position
export class Ordre {
  constructor(r) {
    this.id = r.id;
    this.position_id = r.position_id;
    this.sens = r.sens;                 // 'achat' | 'vente'
    this.quantite = r.quantite;
    this.prix = r.prix;
    this.montant = r.montant;
    this.cout_vendu = r.cout_vendu ?? null; // vente : part du coût de la position cédée
    this.origine = r.origine;           // 'manuel' | 'stop_loss' | 'take_profit' | 'rug'
    this.horodatage = r.horodatage;
  }
}

// Ligne du fil d'activité public (vue des derniers ordres de tous les joueurs)
export class Activite {
  constructor(r) {
    this.id = r.id;
    this.pseudo = r.pseudo;
    this.bot = r.bot;
    this.symbole = r.symbole;
    this.sens = r.sens;
    this.montant = r.montant;
    this.origine = r.origine;
    this.horodatage = r.horodatage;
  }
}
