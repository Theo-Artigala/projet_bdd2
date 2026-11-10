// =====================================================================
// Simulation du marché (≈ future procédure generer_cotations)
// ---------------------------------------------------------------------
// Chaque seconde, pour chaque token actif :
//   1. il change parfois de PHASE : calme / normal / frénésie ;
//   2. il a une petite chance de se faire RUG : chute d'environ −90 %
//      en quelques secondes, puis liquidation des positions et mort du token ;
//   3. sinon, son prix suit une marche aléatoire dont la volatilité et les
//      sauts dépendent de la phase ;
//   4. un VOLUME simulé (le reste du marché) est tiré selon la phase.
// Quand il n'y a pas assez de tokens vivants, de nouveaux tokens NAISSENT,
// en phase de lancement (frénésie).
// =====================================================================

import {
  ajouterCotation,
  dernierPrix,
  executerStops,
  liquiderToken,
  creerToken,
  creerUtilisateur,
  passerAchat,
  passerVente,
  round2,
  now,
  TICK_MS,
} from './base';

// ----- Réglages -----
const PHASES = {
  //            volatilité  sauts  volume  poids du tirage  durée (s)
  calme:    { vol: 0.3, saut: 0.3, volume: 0.25, poids: 35, duree: [90, 300] },
  normal:   { vol: 1,   saut: 1,   volume: 1,    poids: 45, duree: [60, 240] },
  frenesie: { vol: 3,   saut: 4,   volume: 5,    poids: 20, duree: [30, 120] },
};
const P_SAUT = 0.006;          // chance d'un pump / dump par seconde (phase normale)
// Probabilité de rug par seconde : 1 − e^(−3600 × p) ≈ 1/3 → environ 1 token sur 3 meurt dans l'heure
// (les variables POD_P_RUG / POD_AGE_MIN_RUG ne servent qu'aux tests, pour provoquer des rugs rapidement)
const P_RUG = Number(process.env.POD_P_RUG) || 1.1e-4;
const AGE_MIN_RUG = process.env.POD_AGE_MIN_RUG != null ? Number(process.env.POD_AGE_MIN_RUG) : 120_000; // pas de rug pendant les 2 premières minutes
const DUREE_RUG = 5;           // la chute dure 5 secondes
const CHUTE_RUG = 0.1;         // le prix finit vers 10 % de sa valeur (≈ −90 %)
const VOLUME_BASE = 40;        // $ échangés par seconde par le « reste du marché » (phase normale)
const MIN_TOKENS = 5;          // en dessous, un nouveau token naît immédiatement
const MAX_TOKENS = 8;          // au-dessus, plus de naissance spontanée
const P_NAISSANCE = 1 / 600;   // naissance spontanée : en moyenne une toutes les 10 min
const DUREE_LANCEMENT = [120, 240];
const SEED_TICKS = 1800;       // historique généré au démarrage (30 min)

// ----- Hasard -----
// Tirage d'une loi normale centrée réduite (méthode de Box-Muller)
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const entre = ([a, b]) => a + Math.random() * (b - a);
const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];

// ----- Phases -----
function etatDe(d, token) {
  if (!d.etat.has(token.id)) d.etat.set(token.id, { phase: 'normal', finPhase: 0, rug: null });
  return d.etat.get(token.id);
}

function changerPhase(etat, t, phase) {
  if (!phase) {
    let r = Math.random() * 100;
    phase = Object.keys(PHASES).find((p) => (r -= PHASES[p].poids) < 0) || 'normal';
  }
  etat.phase = phase;
  etat.finPhase = t + entre(PHASES[phase].duree) * 1000;
}

// Prix suivant = prix × e^(σ·Z) (marche aléatoire géométrique), σ multiplié selon la phase,
// + parfois un saut symétrique en log, + un léger rappel si le token s'éloigne trop de son prix de départ
function prixSuivant(token, prix, phase) {
  const p = PHASES[phase];
  let facteur = Math.exp(token.volatilite * p.vol * gaussian());
  if (Math.random() < P_SAUT * p.saut) {
    const saut = 0.15 + Math.random() * 0.35;
    facteur *= Math.exp(Math.random() < 0.5 ? saut : -saut);
  }
  const ratio = prix / token.prix_initial;
  if (ratio < 0.05) facteur *= 1.01;
  if (ratio > 50) facteur *= 0.99;
  return Math.max(prix * facteur, 1e-9);
}

// Volume du « reste du marché » : dépend de la phase et grimpe quand le prix bouge fort
function volumeSimule(prixAvant, prix, phase, enRug) {
  const mouvement = Math.abs(Math.log(prix / prixAvant));
  const v = VOLUME_BASE * PHASES[phase].volume * Math.exp(0.7 * gaussian()) * (1 + 30 * mouvement);
  return enRug ? v * 20 : v;
}

// ----- Une seconde de vie d'un token -----
function avancer(d, token, t, rugAutorise) {
  const etat = etatDe(d, token);
  if (t >= etat.finPhase) changerPhase(etat, t);
  const avant = dernierPrix(d, token.id);

  // rug en cours : chute rapide
  if (etat.rug) {
    const prix = avant * etat.rug.facteur * Math.exp(0.05 * gaussian());
    ajouterCotation(d, token, prix, t, volumeSimule(avant, prix, 'frenesie', true));
    executerStops(d, token.id, prix, t);
    if (--etat.rug.restants <= 0) {
      etat.rug = null;
      liquiderToken(d, token, prix, t);
    }
    return;
  }

  // déclenchement d'un rug (plus probable en frénésie)
  const risque = P_RUG * (etat.phase === 'frenesie' ? 2 : 1);
  if (rugAutorise && t - token.date_creation > AGE_MIN_RUG && Math.random() < risque) {
    const chute = CHUTE_RUG * entre([0.7, 1.3]); // entre −87 % et −93 %
    etat.rug = { restants: DUREE_RUG, facteur: Math.pow(chute, 1 / DUREE_RUG) };
    return avancer(d, token, t, rugAutorise);
  }

  const prix = prixSuivant(token, avant, etat.phase);
  ajouterCotation(d, token, prix, t, volumeSimule(avant, prix, etat.phase, false));
  executerStops(d, token.id, prix, t);
}

// ----- Naissance d'un token -----
const ADJECTIFS = ['Turbo', 'Laser', 'Cosmic', 'Giga', 'Hyper', 'Baby', 'Golden', 'Sleepy', 'Angry', 'Crispy',
  'Spicy', 'Lucky', 'Rocket', 'Ultra', 'Funky', 'Atomic', 'Sneaky', 'Royal', 'Pixel', 'Wobbly'];
const NOMS = ['Frog', 'Banana', 'Hamster', 'Potato', 'Penguin', 'Waffle', 'Llama', 'Taco', 'Noodle', 'Duck',
  'Goblin', 'Pickle', 'Otter', 'Muffin', 'Beetle', 'Walrus', 'Donut', 'Cactus', 'Squid', 'Mango'];

function nouveauNom(d) {
  for (let i = 0; i < 50; i++) {
    const adj = auHasard(ADJECTIFS);
    const nom = auHasard(NOMS);
    let symbole = (adj[0] + nom.slice(0, 4)).toUpperCase();
    if (d.token.some((t) => t.symbole === symbole)) symbole = nom.slice(0, 4).toUpperCase() + Math.floor(Math.random() * 90 + 10);
    if (!d.token.some((t) => t.symbole === symbole || t.nom === `${adj} ${nom}`)) return { nom: `${adj} ${nom}`, symbole };
  }
  return { nom: `Token ${d.token.length + 1}`, symbole: `TK${d.token.length + 1}` };
}

export function naitreToken(d, t = now()) {
  const { nom, symbole } = nouveauNom(d);
  const volatilite = round2((0.008 + Math.random() * 0.032) * 1e4) / 1e4; // entre 0,8 % et 4 % par seconde
  const prix = Math.pow(10, entre([-3, 3.5]));                             // de 0,001 à ~3 000
  const token = creerToken(d, { nom, symbole, volatilite, prix }, t);
  changerPhase(etatDe(d, token), t, 'frenesie');                          // lancement agité
  etatDe(d, token).finPhase = t + entre(DUREE_LANCEMENT) * 1000;
  return token;
}

// ----- Tick du moteur : appelé chaque seconde -----
export function tickMarche(d, t = now()) {
  for (const token of d.token) {
    if (token.statut === 'actif') avancer(d, token, t, true);
  }
  const vivants = d.token.filter((tk) => tk.statut !== 'mort').length;
  if (vivants < MIN_TOKENS || (vivants < MAX_TOKENS && Math.random() < P_NAISSANCE)) naitreToken(d, t);
}

// =====================================================================
// Données de départ (provisoire : remplacé plus tard par sql/02_data.sql)
// =====================================================================
export function initialiser(d) {
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
  // 30 minutes d'historique, avec phases et volume, mais sans rug
  const debut = now() - SEED_TICKS * TICK_MS;
  for (const t of tokens) {
    const token = creerToken(d, t, debut);
    for (let i = 1; i < SEED_TICKS; i++) avancer(d, token, debut + i * TICK_MS, false);
  }

  // Historique de trades déjà clôturés pour les bots (classement non vide)
  for (const bot of d.utilisateur.filter((u) => u.bot)) {
    for (let n = 0; n < 6; n++) {
      const token = auHasard(d.token);
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
