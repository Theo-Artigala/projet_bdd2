// Table utilisateur
export class Utilisateur {
  constructor(r) {
    this.id = r.id;
    this.pseudo = r.pseudo;
    this.email = r.email;
    this.role = r.role;                 // 'joueur' | 'admin' | 'analyste'
    this.bot = r.bot ?? false;          // joueur automatique (animation du marché)
    this.date_inscription = r.date_inscription;
  }
}
