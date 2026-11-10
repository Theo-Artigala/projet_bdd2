// Moteur du jeu : toutes les secondes,
//   1. génère un nouveau prix pour chaque token (et exécute les SL / TP touchés) ;
//   2. fait jouer les bots.
// Il passe par les DAO comme n'importe quel utilisateur :
//   - rôle « moteur » pour les cotations (futur rôle PostgreSQL dédié) ;
//   - rôle « joueur » de chaque bot pour ses ordres (soumis aux mêmes règles que les humains).
import { avecDaos } from './dao';

const TICK_MS = 1000;

export function demarrerMoteur() {
  if (globalThis.__pod_moteur) return;
  globalThis.__pod_moteur = setInterval(() => {
    tick().catch((e) => console.error('[moteur]', e));
  }, TICK_MS);
}

async function tick() {
  await avecDaos({ role: 'moteur' }, (dao) => dao.cotations.genererCotations());
  const bots = await avecDaos({ role: 'moteur' }, (dao) => dao.utilisateurs.findBots());
  for (const bot of bots) {
    await avecDaos({ role: 'joueur', utilisateurId: bot.id }, jouerBot).catch(() => {
      // un bot qui enfreint une règle (solde insuffisant...) est simplement ignoré
    });
  }
}

const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];

async function jouerBot(dao) {
  const r = Math.random();
  if (r >= 0.035) return;
  const ouvertes = await dao.positions.findMine('ouverte');
  if (ouvertes.length && r < 0.02) {
    await dao.ordres.vendre(auHasard(ouvertes).id, auHasard([25, 50, 100, 100]));
    return;
  }
  const tokens = (await dao.tokens.findAll()).filter((t) => t.statut === 'actif');
  const pf = await dao.portefeuilles.findMine();
  const montant = Math.round(Math.min(pf.solde, 10 + Math.random() * 120) * 100) / 100;
  if (tokens.length && montant >= 1) await dao.ordres.acheter(auHasard(tokens).id, montant);
}
