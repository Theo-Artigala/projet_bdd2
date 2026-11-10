import { TokenDao } from '../TokenDao';
import { BusinessError } from '../../erreurs';
import { getDb, creerToken, vueToken } from './base';

export class MemoireTokenDao extends TokenDao {
  async findAll() {
    const d = getDb();
    return d.token.map((t) => vueToken(d, t));
  }

  async findById(id) {
    const d = getDb();
    const t = d.token.find((x) => x.id === id);
    return t ? vueToken(d, t) : null;
  }

  async create({ nom, symbole, volatilite, prix }) {
    if (this.ctx.role !== 'admin') throw new BusinessError('Accès refusé', 403);
    const d = getDb();
    nom = String(nom || '').trim();
    symbole = String(symbole || '').trim().toUpperCase();
    volatilite = Number(volatilite);
    prix = Number(prix);
    // ≈ contraintes CHECK / UNIQUE de la table token
    if (!nom || nom.length > 50) throw new BusinessError('Nom invalide');
    if (!/^[A-Z0-9]{2,10}$/.test(symbole)) throw new BusinessError('Symbole : 2 à 10 lettres/chiffres');
    if (d.token.some((t) => t.symbole === symbole)) throw new BusinessError('Symbole déjà utilisé');
    if (!(volatilite > 0 && volatilite <= 1)) throw new BusinessError('Volatilité entre 0 et 1');
    if (!(prix > 0)) throw new BusinessError('Prix initial invalide');
    return vueToken(d, creerToken(d, { nom, symbole, volatilite, prix }));
  }

  async update(id, { statut, volatilite }) {
    if (this.ctx.role !== 'admin') throw new BusinessError('Accès refusé', 403);
    const d = getDb();
    const token = d.token.find((t) => t.id === id);
    if (!token) throw new BusinessError('Token introuvable', 404);
    if (statut !== undefined && !['actif', 'suspendu'].includes(statut)) throw new BusinessError('Statut invalide');
    const v = volatilite === undefined ? undefined : Number(volatilite);
    if (v !== undefined && !(v > 0 && v <= 1)) throw new BusinessError('Volatilité entre 0 et 1');
    if (statut !== undefined) token.statut = statut;
    if (v !== undefined) token.volatilite = v;
    return vueToken(d, token);
  }
}
