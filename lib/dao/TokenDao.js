import { Dao } from './Dao';

/** Interface d'accès à la table token (avec le cours actuel). */
export class TokenDao extends Dao {
  /** Tous les tokens avec prix actuel, ATH et variation sur 5 min */
  async findAll() { this.nonImplemente('findAll'); }
  async findById(id) { this.nonImplemente('findById'); }
  /** Admin : création d'un token et de sa première cotation */
  async create({ nom, symbole, volatilite, prix }) { this.nonImplemente('create'); }
  /** Admin : changement de statut (actif / suspendu) ou de volatilité */
  async update(id, { statut, volatilite }) { this.nonImplemente('update'); }
}
