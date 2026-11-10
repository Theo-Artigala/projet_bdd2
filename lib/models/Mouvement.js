// Table mouvement : journal des débits / crédits d'un portefeuille
export class Mouvement {
  constructor(r) {
    this.id = r.id;
    this.portefeuille_id = r.portefeuille_id;
    this.ordre_id = r.ordre_id;
    this.montant = r.montant;
    this.type = r.type;                 // 'achat' | 'vente' | 'bonus' | 'correction'
    this.horodatage = r.horodatage;
  }
}
