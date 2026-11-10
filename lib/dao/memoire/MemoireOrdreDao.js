import { OrdreDao } from '../OrdreDao';
import { Activite } from '../../models/Ordre';
import { BusinessError } from '../../erreurs';
import { getDb, dernierPrix, passerAchat, passerVente, vuePosition, round2, now } from './base';

const MESSAGE_STATUT = { suspendu: 'Ce token est suspendu', mort: 'Ce token est mort (rug) 💀' };

export class MemoireOrdreDao extends OrdreDao {
  // ≈ CALL passer_ordre(...) : chaque RAISE EXCEPTION de la procédure deviendra une BusinessError
  async acheter(tokenId, montant) {
    const d = getDb();
    if (this.ctx.role !== 'joueur') throw new BusinessError('Seuls les joueurs peuvent trader', 403);
    montant = round2(Number(montant));
    if (!(montant >= 1)) throw new BusinessError('Montant minimum : 1 $');
    const token = d.token.find((t) => t.id === tokenId);
    if (!token) throw new BusinessError('Token introuvable', 404);
    // RG4 : pas d'ordre sur un token suspendu ou mort
    if (token.statut !== 'actif') throw new BusinessError(MESSAGE_STATUT[token.statut]);
    // RG1 : le montant doit être couvert par le solde
    const pf = d.portefeuille.find((p) => p.utilisateur_id === this.ctx.utilisateurId);
    if (montant > pf.solde) throw new BusinessError('Solde insuffisant');
    // RG2 : le prix est imposé par le serveur
    const pos = passerAchat(d, this.ctx.utilisateurId, tokenId, montant, dernierPrix(d, tokenId), now());
    return vuePosition(d, pos);
  }

  async vendre(positionId, pourcentage) {
    const d = getDb();
    if (this.ctx.role !== 'joueur') throw new BusinessError('Seuls les joueurs peuvent trader', 403);
    const pos = d.position.find((p) => p.id === positionId);
    // RLS : la position d'un autre joueur est invisible, donc « introuvable »
    if (!pos || pos.utilisateur_id !== this.ctx.utilisateurId) throw new BusinessError('Position introuvable', 404);
    if (pos.statut !== 'ouverte') throw new BusinessError('Position déjà fermée');
    pourcentage = Number(pourcentage);
    if (!(pourcentage > 0 && pourcentage <= 100)) throw new BusinessError('Pourcentage entre 1 et 100');
    const statut = d.token.find((t) => t.id === pos.token_id).statut;
    if (statut !== 'actif') throw new BusinessError(MESSAGE_STATUT[statut]);
    passerVente(d, pos, pourcentage, dernierPrix(d, pos.token_id), now(), 'manuel');
    return vuePosition(d, pos);
  }

  // Future vue v_activite : volontairement publique (pseudo, token, sens, montant)
  async activiteRecente(limite = 25) {
    const d = getDb();
    return d.ordre
      .slice(-limite)
      .reverse()
      .map((o) => {
        const pos = d.position.find((p) => p.id === o.position_id);
        const u = d.utilisateur.find((x) => x.id === pos.utilisateur_id);
        return new Activite({
          ...o,
          pseudo: u.pseudo,
          bot: u.bot,
          symbole: d.token.find((t) => t.id === pos.token_id).symbole,
        });
      });
  }

  async ordresDesAutres(tokenId, depuis) {
    const d = getDb();
    const positions = new Map(
      d.position
        .filter((p) => p.token_id === tokenId && p.utilisateur_id !== this.ctx.utilisateurId)
        .map((p) => [p.id, p])
    );
    return d.ordre
      .filter((o) => o.horodatage >= depuis && positions.has(o.position_id))
      .map((o) => ({
        id: o.id,
        horodatage: o.horodatage,
        prix: o.prix,
        sens: o.sens,
        montant: o.montant,
        pseudo: d.utilisateur.find((u) => u.id === positions.get(o.position_id).utilisateur_id).pseudo,
      }));
  }
}
