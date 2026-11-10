import { Dao } from './Dao';

/** Interface d'accès à la table utilisateur (+ portefeuille créé avec le joueur). */
export class UtilisateurDao extends Dao {
  /** @returns {Promise<import('../models/Utilisateur').Utilisateur[]>} */
  async findAll() { this.nonImplemente('findAll'); }
  /** @returns {Promise<import('../models/Utilisateur').Utilisateur|null>} */
  async findById(id) { this.nonImplemente('findById'); }
  /** Joueurs automatiques (utilisé par le moteur) */
  async findBots() { this.nonImplemente('findBots'); }
  /** Inscription d'un joueur : crée l'utilisateur et son portefeuille crédité de 1 000 $ */
  async creerJoueur(pseudo) { this.nonImplemente('creerJoueur'); }
}
