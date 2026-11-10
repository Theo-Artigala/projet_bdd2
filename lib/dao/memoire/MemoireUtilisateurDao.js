import { UtilisateurDao } from '../UtilisateurDao';
import { Utilisateur } from '../../models/Utilisateur';
import { BusinessError } from '../../erreurs';
import { getDb, creerUtilisateur } from './base';

const PSEUDOS_RESERVES = ['admin', 'analyste', 'administrateur', 'moderateur', 'system'];

export class MemoireUtilisateurDao extends UtilisateurDao {
  async findAll() {
    return getDb().utilisateur.map((u) => new Utilisateur(u));
  }

  async findById(id) {
    const u = getDb().utilisateur.find((x) => x.id === id);
    return u ? new Utilisateur(u) : null;
  }

  async findBots() {
    return getDb().utilisateur.filter((u) => u.bot).map((u) => new Utilisateur(u));
  }

  async creerJoueur(pseudo) {
    const d = getDb();
    pseudo = String(pseudo || '').trim();
    // ≈ CHECK (pseudo ~ '^[A-Za-z0-9_]{3,20}$')
    if (!/^[A-Za-z0-9_]{3,20}$/.test(pseudo)) {
      throw new BusinessError('Pseudo : 3 à 20 caractères (lettres, chiffres, _)');
    }
    // ≈ index UNIQUE sur lower(pseudo)
    const bas = pseudo.toLowerCase();
    if (PSEUDOS_RESERVES.includes(bas) || d.utilisateur.some((u) => u.pseudo.toLowerCase() === bas)) {
      throw new BusinessError('Ce pseudo est déjà pris', 409);
    }
    if (d.utilisateur.length >= 500) throw new BusinessError('La partie est pleine', 503);
    return new Utilisateur(creerUtilisateur(d, { pseudo, role: 'joueur' }));
  }
}
