// =====================================================================
// "Base de données" en mémoire — utilisée par les DAO memoire/*
// ---------------------------------------------------------------------
// Chaque tableau correspond à une table de sql/01_schema.sql.
// Les fonctions de ce fichier imitent ce que fera PostgreSQL :
//   - passerAchat / passerVente  ≈ procédure passer_ordre + trigger RG3 sur ordre
//   - executerStops              ≈ trigger AFTER INSERT sur cotation (RG7)
//   - vuePosition / vueToken     ≈ vues qui calculent les colonnes dérivées
// Tout est perdu au redémarrage du serveur.
// =====================================================================

import { Position } from '../../models/Position';
import { Token } from '../../models/Token';
import { Ordre } from '../../models/Ordre';

const VERSION = 4;             // à incrémenter si la forme des données change
export const TICK_MS = 1000;   // un nouveau prix par seconde
const MAX_COTATIONS = 6000;    // ~1h40 d'historique par token
const SEED_TICKS = 1800;       // historique généré au démarrage (30 min)
export const SOLDE_INITIAL = 1000;

export const now = () => Date.now();
export const round2 = (x) => Math.round(x * 100) / 100;

function createDb() {
  return {
    version: VERSION,
    seq: { utilisateur: 0, portefeuille: 0, token: 0, cotation: 0, position: 0, ordre: 0, mouvement: 0 },
    utilisateur: [],
    portefeuille: [],
    token: [],
    cotation: new Map(), // token_id -> [{id, token_id, prix, horodatage}] (ordre chronologique)
    position: [],
    ordre: [],
    mouvement: [],
    ath: new Map(),      // token_id -> plus haut prix (calculé, pas une colonne)
  };
}

const nextId = (d, table) => ++d.seq[table];

// ---------------------------------------------------------------------
// Génération aléatoire des prix
// ---------------------------------------------------------------------
// Tirage d'une loi normale centrée réduite (méthode de Box-Muller)
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Prix suivant = prix × e^(σ·Z)  (marche aléatoire géométrique)
// + de temps en temps un saut (pump ou dump) symétrique en log
// + un léger rappel si le token s'éloigne trop de son prix de départ
export function prixSuivant(token, prix) {
  let facteur = Math.exp(token.volatilite * gaussian());
  if (Math.random() < 0.006) {
    const saut = 0.15 + Math.random() * 0.35;
    facteur *= Math.exp(Math.random() < 0.5 ? saut : -saut);
  }
  const ratio = prix / token.prix_initial;
  if (ratio < 0.05) facteur *= 1.01;
  if (ratio > 50) facteur *= 0.99;
  return Math.max(prix * facteur, 1e-6);
}

export function ajouterCotation(d, token, prix, horodatage) {
  const liste = d.cotation.get(token.id);
  liste.push({ id: nextId(d, 'cotation'), token_id: token.id, prix, horodatage });
  if (liste.length > MAX_COTATIONS) liste.shift();
  if (prix > (d.ath.get(token.id) ?? 0)) d.ath.set(token.id, prix);
}

export function dernierPrix(d, tokenId) {
  const liste = d.cotation.get(tokenId);
  return liste[liste.length - 1].prix;
}

// ---------------------------------------------------------------------
// Création d'utilisateurs et de tokens
// ---------------------------------------------------------------------
export function creerUtilisateur(d, { pseudo, role, bot = false }) {
  const t = now();
  const u = { id: nextId(d, 'utilisateur'), pseudo, email: `${pseudo.toLowerCase()}@pumpordump.test`, role, bot, date_inscription: t };
  d.utilisateur.push(u);
  // Seuls les joueurs ont un portefeuille, crédité du bonus de bienvenue
  if (role === 'joueur') {
    const pf = { id: nextId(d, 'portefeuille'), utilisateur_id: u.id, solde: 0 };
    d.portefeuille.push(pf);
    mouvementPortefeuille(d, pf, SOLDE_INITIAL, null, 'bonus', t);
  }
  return u;
}

export function creerToken(d, { nom, symbole, volatilite, prix }, horodatage = now()) {
  const token = {
    id: nextId(d, 'token'),
    nom,
    symbole,
    volatilite,
    prix_initial: prix,
    statut: 'actif',
    date_creation: horodatage,
  };
  d.token.push(token);
  d.cotation.set(token.id, []);
  ajouterCotation(d, token, prix, horodatage);
  return token;
}

// ---------------------------------------------------------------------
// Ordres (≈ procédure passer_ordre + triggers)
// ---------------------------------------------------------------------
function mouvementPortefeuille(d, pf, montant, ordre_id, type, horodatage) {
  pf.solde = round2(pf.solde + montant);
  d.mouvement.push({ id: nextId(d, 'mouvement'), portefeuille_id: pf.id, ordre_id, montant, type, horodatage });
}

function insererOrdre(d, pos, champs) {
  const o = { id: nextId(d, 'ordre'), position_id: pos.id, cout_vendu: null, ...champs };
  d.ordre.push(o);
  return o;
}

export function positionOuverte(d, utilisateurId, tokenId) {
  return d.position.find((p) => p.utilisateur_id === utilisateurId && p.token_id === tokenId && p.statut === 'ouverte');
}

// Achat : ouvre la position si besoin (RG5 : une seule ouverte par token), sinon la renforce.
// Les vérifications (RG1, RG4...) sont faites par l'appelant.
export function passerAchat(d, utilisateurId, tokenId, montant, prix, t) {
  let pos = positionOuverte(d, utilisateurId, tokenId);
  if (!pos) {
    pos = {
      id: nextId(d, 'position'),
      utilisateur_id: utilisateurId,
      token_id: tokenId,
      quantite: 0,
      cout: 0,
      stop_loss: null,
      take_profit: null,
      statut: 'ouverte',
      date_ouverture: t,
      date_fermeture: null,
    };
    d.position.push(pos);
  }
  const quantite = montant / prix;
  const o = insererOrdre(d, pos, { sens: 'achat', quantite, prix, montant, origine: 'manuel', horodatage: t });
  // RG3 (futur trigger) : la position gagne la quantité et le coût
  pos.quantite += quantite;
  pos.cout = round2(pos.cout + montant);
  // RG1 (futur trigger) : débit du portefeuille
  const pf = d.portefeuille.find((p) => p.utilisateur_id === utilisateurId);
  mouvementPortefeuille(d, pf, -montant, o.id, 'achat', t);
  return pos;
}

// Vente d'un pourcentage de la quantité détenue
export function passerVente(d, pos, pourcentage, prix, t, origine) {
  const total = pourcentage >= 100;
  const quantite = total ? pos.quantite : pos.quantite * (pourcentage / 100);
  const montant = round2(quantite * prix);
  const coutVendu = total ? pos.cout : round2(pos.cout * (pourcentage / 100));
  const o = insererOrdre(d, pos, { sens: 'vente', quantite, prix, montant, cout_vendu: coutVendu, origine, horodatage: t });
  // RG3 (futur trigger) : la position perd la quantité et le coût vendus ; fermée à 0
  pos.quantite = total ? 0 : pos.quantite - quantite;
  pos.cout = round2(pos.cout - coutVendu);
  if (total) {
    pos.statut = 'fermee';
    pos.date_fermeture = t;
    pos.stop_loss = null;
    pos.take_profit = null;
  }
  const pf = d.portefeuille.find((p) => p.utilisateur_id === pos.utilisateur_id);
  if (montant > 0) mouvementPortefeuille(d, pf, montant, o.id, 'vente', t);
  return pos;
}

// RG7 (futur trigger AFTER INSERT ON cotation) : exécution automatique des SL / TP
export function executerStops(d, tokenId, prix, t) {
  for (const pos of d.position) {
    if (pos.token_id !== tokenId || pos.statut !== 'ouverte') continue;
    if (pos.stop_loss != null && prix <= pos.stop_loss) passerVente(d, pos, 100, prix, t, 'stop_loss');
    else if (pos.take_profit != null && prix >= pos.take_profit) passerVente(d, pos, 100, prix, t, 'take_profit');
  }
}

// ---------------------------------------------------------------------
// "Vues" : colonnes calculées
// ---------------------------------------------------------------------
export function vuePosition(d, p) {
  const ordres = d.ordre.filter((o) => o.position_id === p.id);
  const achats = ordres.filter((o) => o.sens === 'achat');
  const ventes = ordres.filter((o) => o.sens === 'vente');
  const somme = (liste, f) => round2(liste.reduce((s, o) => s + f(o), 0));
  const qAchetee = achats.reduce((s, o) => s + o.quantite, 0);
  const totalInvesti = somme(achats, (o) => o.montant);
  return new Position({
    ...p,
    symbole: d.token.find((t) => t.id === p.token_id).symbole,
    pseudo: d.utilisateur.find((u) => u.id === p.utilisateur_id).pseudo,
    prix_moyen: p.quantite > 0 ? p.cout / p.quantite : null,
    prix_moyen_achat: qAchetee > 0 ? totalInvesti / qAchetee : null,
    total_investi: totalInvesti,
    total_recupere: somme(ventes, (o) => o.montant),
    pnl_realise: somme(ventes, (o) => o.montant - o.cout_vendu),
    ordres: ordres.map((o) => new Ordre(o)),
  });
}

export function vueToken(d, token) {
  const cot = d.cotation.get(token.id);
  const prix = cot[cot.length - 1].prix;
  const ref = cot.find((c) => c.horodatage >= now() - 5 * 60 * 1000) || cot[0];
  return new Token({ ...token, prix, ath: d.ath.get(token.id), variation: prix / ref.prix - 1 });
}

// ---------------------------------------------------------------------
// Données de départ (provisoire : remplacé plus tard par sql/02_data.sql)
// ---------------------------------------------------------------------
function seed(d) {
  const users = [
    { pseudo: 'moonboy', role: 'joueur' },
    { pseudo: 'paperhands', role: 'joueur', bot: true },
    { pseudo: 'whale_42', role: 'joueur', bot: true },
    { pseudo: 'degen_sam', role: 'joueur', bot: true },
    { pseudo: 'admin', role: 'admin' },
    { pseudo: 'analyste', role: 'analyste' },
  ];
  for (const u of users) creerUtilisateur(d, u);

  const tokens = [
    { nom: 'Moon Rocket', symbole: 'MOON', volatilite: 0.012, prix: 4200 },
    { nom: 'Degen Cat', symbole: 'DCAT', volatilite: 0.02, prix: 18.5 },
    { nom: 'Rug Pull Inu', symbole: 'RUG', volatilite: 0.035, prix: 0.042 },
    { nom: 'Diamond Hands', symbole: 'DIAM', volatilite: 0.008, prix: 315 },
    { nom: 'Pump Juice', symbole: 'PUMP', volatilite: 0.025, prix: 1.27 },
  ];
  const debut = now() - SEED_TICKS * TICK_MS;
  for (const t of tokens) {
    const token = creerToken(d, t, debut);
    let prix = t.prix;
    for (let i = 1; i < SEED_TICKS; i++) {
      prix = prixSuivant(token, prix);
      ajouterCotation(d, token, prix, debut + i * TICK_MS);
    }
  }

  // Historique de trades déjà clôturés pour les bots (classement non vide)
  for (const bot of d.utilisateur.filter((u) => u.bot)) {
    for (let n = 0; n < 6; n++) {
      const token = d.token[Math.floor(Math.random() * d.token.length)];
      const cot = d.cotation.get(token.id);
      const i = Math.floor(Math.random() * (cot.length - 300));
      const j = i + 20 + Math.floor(Math.random() * 120);
      const k = j + 20 + Math.floor(Math.random() * 120);
      const pf = d.portefeuille.find((p) => p.utilisateur_id === bot.id);
      const m = round2(20 + Math.random() * 100);
      if (pf.solde < m * 2) continue;
      const pos = passerAchat(d, bot.id, token.id, m, cot[i].prix, cot[i].horodatage);
      if (Math.random() < 0.5) passerAchat(d, bot.id, token.id, m, cot[j].prix, cot[j].horodatage);
      if (Math.random() < 0.5) passerVente(d, pos, 50, cot[j + 5].prix, cot[j + 5].horodatage, 'manuel');
      passerVente(d, pos, 100, cot[k].prix, cot[k].horodatage, 'manuel');
    }
  }
}

// ---------------------------------------------------------------------
// Singleton : survit aux rechargements à chaud de Next.js en dev
// ---------------------------------------------------------------------
export function getDb() {
  if (globalThis.__pumpordump?.version !== VERSION) {
    if (globalThis.__pumpordump?.timer) clearInterval(globalThis.__pumpordump.timer);
    const d = createDb();
    seed(d);
    globalThis.__pumpordump = d;
  }
  return globalThis.__pumpordump;
}
