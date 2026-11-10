// Table portefeuille (un par joueur)
export class Portefeuille {
  constructor(r) {
    this.id = r.id;
    this.utilisateur_id = r.utilisateur_id;
    this.solde = r.solde;
  }
}
