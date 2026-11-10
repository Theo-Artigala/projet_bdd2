// Classe de base de tous les DAO.
// Un DAO est créé POUR UNE REQUÊTE et connaît le contexte de l'utilisateur connecté :
//   ctx = { role: 'joueur' | 'admin' | 'analyste' | 'anonyme' | 'moteur', utilisateurId }
// Avec PostgreSQL, ce contexte se traduira par :
//   SET LOCAL ROLE pod_<role>;  SELECT set_config('app.user_id', $1, true);
// et c'est la RLS qui filtrera les lignes.
export class Dao {
  constructor(ctx) {
    this.ctx = ctx;
  }

  nonImplemente(methode) {
    throw new Error(`${this.constructor.name}.${methode}() n'est pas implémenté`);
  }
}
