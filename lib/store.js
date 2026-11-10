// =====================================================================
// Couche d'accès aux données — VERSION EN MÉMOIRE
// ---------------------------------------------------------------------
// Ce fichier est le SEUL endroit qui manipule les données.
// Chaque "table" ci-dessous correspond à une table de sql/01_schema.sql.
// Quand on branchera PostgreSQL, on remplacera le contenu de ces fonctions
// par des requêtes SQL ; le reste de l'appli ne bougera pas.
//
// Les règles métier (RG1..RG5) sont codées ici en JS pour l'instant.
// Elles sont marquées « → futur trigger » : elles migreront dans la BDD.
// =====================================================================

export class BusinessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const TICK_MS = 1000;          // un nouveau prix par seconde
const MAX_COTATIONS = 6000;    // ~1h40 d'historique par token
const SEED_TICKS = 1800;       // historique généré au démarrage (30 min)
const SOLDE_INITIAL = 1000;

// La base en mémoire est initialisée tout en bas du fichier (voir « Singleton »)
let db;

function createDb() {
  return {
    seq: { utilisateur: 0, portefeuille: 0, token: 0, cotation: 0, position: 0, mouvement: 0 },
    utilisateur: [],
    portefeuille: [],
    token: [],
    cotation: new Map(), // token_id -> [{id, token_id, prix, horodatage}]  (ordre chronologique)
    position: [],
    mouvement: [],
  };
}

const nextId = (d, table) => ++d.seq[table];
const now = () => Date.now();
const round2 = (x) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------
// Génération aléatoire des prix
// ---------------------------------------------------------------------
function gaussian() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function prixSuivant(token, prix) {
  let facteur = Math.exp(token.volatilite * gaussian());
  // de temps en temps un gros pump ou un gros dump
  if (Math.random() < 0.006) {
    const ampleur = 0.15 + Math.random() * 0.35;
    facteur *= Math.random() < 0.5 ? 1 + ampleur : 1 - ampleur * 0.7;
  }
  // rappel vers le prix de départ pour éviter que le token meure à zéro
  const ratio = prix / token.prix_initial;
  if (ratio < 0.05) facteur *= 1.01;
  if (ratio > 50) facteur *= 0.99;
  return Math.max(prix * facteur, 1e-6);
}

function ajouterCotation(d, token, prix, horodatage) {
  const liste = d.cotation.get(token.id);
  liste.push({ id: nextId(d, 'cotation'), token_id: token.id, prix, horodatage });
  if (liste.length > MAX_COTATIONS) liste.shift();
  if (prix > token.ath) token.ath = prix;
}

function tick(d) {
  const t = now();
  for (const token of d.token) {
    if (token.statut !== 'actif') continue;
    ajouterCotation(d, token, prixSuivant(token, dernierPrix(token.id, d)), t);
  }
  activiteBots(d);
}

// Des joueurs "bots" tradent tout seuls pour que le jeu soit vivant
function activiteBots(d) {
  const bots = d.utilisateur.filter((u) => u.bot);
  for (const bot of bots) {
    try {
      const ouvertes = d.position.filter((p) => p.utilisateur_id === bot.id && p.statut === 'ouverte');
      if (ouvertes.length && Math.random() < 0.02) {
        const p = ouvertes[Math.floor(Math.random() * ouvertes.length)];
        fermerPosition(bot.id, p.id);
      } else if (Math.random() < 0.015) {
        const actifs = d.token.filter((tk) => tk.statut === 'actif');
        const token = actifs[Math.floor(Math.random() * actifs.length)];
        const solde = getPortefeuille(bot.id).solde;
        const mise = round2(Math.min(solde, 10 + Math.random() * 150));
        if (token && mise >= 1) ouvrirPosition(bot.id, token.id, mise);
      }
    } catch {
      // un bot qui enfreint une règle est simplement ignoré
    }
  }
}

// ---------------------------------------------------------------------
// Données de départ
// ---------------------------------------------------------------------
function seed(d) {
  const users = [
    { pseudo: 'moonboy', role: 'joueur', bot: false },
    { pseudo: 'paperhands', role: 'joueur', bot: true },
    { pseudo: 'whale_42', role: 'joueur', bot: true },
    { pseudo: 'degen_sam', role: 'joueur', bot: true },
    { pseudo: 'admin', role: 'admin', bot: false },
    { pseudo: 'analyste', role: 'analyste', bot: false },
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
    const token = creerTokenInterne(d, t.nom, t.symbole, t.volatilite, t.prix, debut);
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
      const i = Math.floor(Math.random() * (cot.length - 200));
      const j = i + 20 + Math.floor(Math.random() * 150);
      const mise = round2(20 + Math.random() * 120);
      const pf = d.portefeuille.find((p) => p.utilisateur_id === bot.id);
      if (pf.solde < mise) continue;
      const pos = insererPosition(d, bot.id, token.id, mise, cot[i].prix, cot[i].horodatage);
      debiter(d, pf, mise, pos.id, cot[i].horodatage);
      cloturer(d, pos, cot[j].prix, cot[j].horodatage, 'fermee');
    }
  }
}

function creerUtilisateur(d, { pseudo, role, bot }) {
  const u = {
    id: nextId(d, 'utilisateur'),
    pseudo,
    email: `${pseudo}@pumpordump.test`,
    role,
    bot,
    date_inscription: now(),
  };
  d.utilisateur.push(u);
  // Seuls les joueurs ont un portefeuille (Possede : Utilisateur 0,1)
  if (role === 'joueur') {
    const pf = { id: nextId(d, 'portefeuille'), utilisateur_id: u.id, solde: 0 };
    d.portefeuille.push(pf);
    crediter(d, pf, SOLDE_INITIAL, null, 'bonus', now());
  }
  return u;
}

function creerTokenInterne(d, nom, symbole, volatilite, prix, horodatage = now()) {
  const token = {
    id: nextId(d, 'token'),
    nom,
    symbole,
    volatilite,
    statut: 'actif',
    date_creation: horodatage,
    prix_initial: prix,
    ath: prix,
  };
  d.token.push(token);
  d.cotation.set(token.id, []);
  ajouterCotation(d, token, prix, horodatage);
  return token;
}

// ---------------------------------------------------------------------
// Primitives d'écriture (≈ INSERT / UPDATE)
// ---------------------------------------------------------------------
function insererPosition(d, utilisateur_id, token_id, mise, prix_entree, date_entree) {
  const pos = {
    id: nextId(d, 'position'),
    utilisateur_id,
    token_id,
    mise,
    prix_entree,
    prix_sortie: null,
    date_entree,
    date_sortie: null,
    statut: 'ouverte',
    pnl: null,
  };
  d.position.push(pos);
  return pos;
}

function ajouterMouvement(d, pf, montant, position_id, type, horodatage) {
  d.mouvement.push({
    id: nextId(d, 'mouvement'),
    portefeuille_id: pf.id,
    position_id,
    montant,
    type,
    horodatage,
  });
}

function debiter(d, pf, montant, position_id, horodatage) {
  pf.solde = round2(pf.solde - montant);
  ajouterMouvement(d, pf, -montant, position_id, 'mise', horodatage);
}

function crediter(d, pf, montant, position_id, type, horodatage) {
  pf.solde = round2(pf.solde + montant);
  ajouterMouvement(d, pf, montant, position_id, type, horodatage);
}

function cloturer(d, pos, prix_sortie, horodatage, statut) {
  // RG3 → futur trigger : calcul du PnL et crédit du portefeuille
  const pnl = round2(pos.mise * (prix_sortie / pos.prix_entree - 1));
  pos.prix_sortie = prix_sortie;
  pos.date_sortie = horodatage;
  pos.pnl = pnl;
  pos.statut = statut;
  const pf = d.portefeuille.find((p) => p.utilisateur_id === pos.utilisateur_id);
  const retour = round2(pos.mise + pnl);
  if (retour > 0) crediter(d, pf, retour, pos.id, 'gain', horodatage);
}

// =====================================================================
// API publique du store (ce que les routes appellent)
// =====================================================================

// ----- Utilisateurs / session -----
export function listerUtilisateurs() {
  return db.utilisateur.map(({ id, pseudo, role, bot }) => ({ id, pseudo, role, bot }));
}

export function getUtilisateur(id) {
  return db.utilisateur.find((u) => u.id === id) || null;
}

export function getPortefeuille(utilisateur_id) {
  return db.portefeuille.find((p) => p.utilisateur_id === utilisateur_id) || null;
}

// ----- Tokens / cotations -----
export function dernierPrix(token_id, d = db) {
  const liste = d.cotation.get(token_id);
  return liste[liste.length - 1].prix;
}

export function listerTokens() {
  const t = now();
  return db.token.map((token) => {
    const cot = db.cotation.get(token.id);
    const prix = cot[cot.length - 1].prix;
    // variation sur les 5 dernières minutes
    const ref = cot.find((c) => c.horodatage >= t - 5 * 60 * 1000) || cot[0];
    return {
      id: token.id,
      nom: token.nom,
      symbole: token.symbole,
      volatilite: token.volatilite,
      statut: token.statut,
      prix,
      ath: token.ath,
      variation: prix / ref.prix - 1,
    };
  });
}

export function getToken(id) {
  return db.token.find((t) => t.id === id) || null;
}

// Agrège les cotations en bougies OHLC de `intervalle` secondes
export function getBougies(token_id, intervalle = 5, limite = 300) {
  const cot = db.cotation.get(token_id);
  if (!cot) throw new BusinessError('Token introuvable', 404);
  const pas = intervalle * 1000;
  const bougies = [];
  for (const c of cot) {
    const time = Math.floor(c.horodatage / pas) * intervalle;
    const last = bougies[bougies.length - 1];
    if (last && last.time === time) {
      last.high = Math.max(last.high, c.prix);
      last.low = Math.min(last.low, c.prix);
      last.close = c.prix;
    } else {
      // l'ouverture reprend la clôture précédente : bougies jointives
      const open = last ? last.close : c.prix;
      bougies.push({ time, open, high: Math.max(open, c.prix), low: Math.min(open, c.prix), close: c.prix, volume: 0 });
    }
  }
  // volume = montants misés / récupérés dans la bougie
  const index = new Map(bougies.map((b) => [b.time, b]));
  for (const p of db.position) {
    if (p.token_id !== token_id) continue;
    const be = index.get(Math.floor(p.date_entree / pas) * intervalle);
    if (be) be.volume += p.mise;
    if (p.date_sortie) {
      const bs = index.get(Math.floor(p.date_sortie / pas) * intervalle);
      if (bs) bs.volume += p.mise + p.pnl;
    }
  }
  return bougies.slice(-limite);
}

// ----- Positions (cloisonnement façon RLS : on filtre sur l'utilisateur) -----
export function listerPositions(utilisateur_id, statut) {
  return db.position
    .filter((p) => p.utilisateur_id === utilisateur_id && (!statut || (statut === 'fermee' ? p.statut !== 'ouverte' : p.statut === statut)))
    .sort((a, b) => b.date_entree - a.date_entree)
    .map(enrichirPosition);
}

export function listerToutesPositionsOuvertes() {
  return db.position.filter((p) => p.statut === 'ouverte').map(enrichirPosition);
}

function enrichirPosition(p) {
  const token = getToken(p.token_id);
  const u = getUtilisateur(p.utilisateur_id);
  return { ...p, symbole: token.symbole, pseudo: u.pseudo };
}

export function ouvrirPosition(utilisateur_id, token_id, mise) {
  const u = getUtilisateur(utilisateur_id);
  if (!u || u.role !== 'joueur') throw new BusinessError('Seuls les joueurs peuvent trader', 403);
  mise = round2(Number(mise));
  if (!(mise > 0)) throw new BusinessError('La mise doit être positive');

  const token = getToken(token_id);
  if (!token) throw new BusinessError('Token introuvable', 404);
  // RG4 → futur trigger : pas de trade sur un token suspendu
  if (token.statut !== 'actif') throw new BusinessError('Ce token est suspendu');

  // RG5 → futur index unique partiel : une seule position ouverte par token
  if (db.position.some((p) => p.utilisateur_id === utilisateur_id && p.token_id === token_id && p.statut === 'ouverte')) {
    throw new BusinessError('Tu as déjà une position ouverte sur ce token');
  }

  // RG1 → futur trigger : la mise doit être couverte par le solde, puis débit
  const pf = getPortefeuille(utilisateur_id);
  if (mise > pf.solde) throw new BusinessError('Solde insuffisant');

  // RG2 → futur trigger : le prix d'entrée est imposé par le serveur
  const prix = dernierPrix(token_id);
  const t = now();
  const pos = insererPosition(db, utilisateur_id, token_id, mise, prix, t);
  debiter(db, pf, mise, pos.id, t);
  return enrichirPosition(pos);
}

export function fermerPosition(utilisateur_id, position_id) {
  const pos = db.position.find((p) => p.id === position_id);
  // RLS : un joueur ne voit pas les positions des autres → « introuvable »
  if (!pos || pos.utilisateur_id !== utilisateur_id) throw new BusinessError('Position introuvable', 404);
  if (pos.statut !== 'ouverte') throw new BusinessError('Position déjà fermée');
  // RG2 : prix de sortie imposé par le serveur
  cloturer(db, pos, dernierPrix(pos.token_id), now(), 'fermee');
  return enrichirPosition(pos);
}

// ----- Admin -----
export function creerToken({ nom, symbole, volatilite, prix }) {
  nom = String(nom || '').trim();
  symbole = String(symbole || '').trim().toUpperCase();
  volatilite = Number(volatilite);
  prix = Number(prix);
  if (!nom || nom.length > 50) throw new BusinessError('Nom invalide');
  if (!/^[A-Z0-9]{2,10}$/.test(symbole)) throw new BusinessError('Symbole : 2 à 10 lettres/chiffres');
  if (db.token.some((t) => t.symbole === symbole)) throw new BusinessError('Symbole déjà utilisé');
  if (!(volatilite > 0 && volatilite <= 1)) throw new BusinessError('Volatilité entre 0 et 1');
  if (!(prix > 0)) throw new BusinessError('Prix initial invalide');
  return creerTokenInterne(db, nom, symbole, volatilite, prix);
}

export function modifierToken(id, { statut, volatilite }) {
  const token = getToken(id);
  if (!token) throw new BusinessError('Token introuvable', 404);
  if (statut !== undefined) {
    if (!['actif', 'suspendu'].includes(statut)) throw new BusinessError('Statut invalide');
    token.statut = statut;
  }
  if (volatilite !== undefined) {
    const v = Number(volatilite);
    if (!(v > 0 && v <= 1)) throw new BusinessError('Volatilité entre 0 et 1');
    token.volatilite = v;
  }
  return token;
}

// ----- Indicateurs (futures vues matérialisées) -----
export function classementJoueurs() {
  return db.utilisateur
    .filter((u) => u.role === 'joueur')
    .map((u) => {
      const fermees = db.position.filter((p) => p.utilisateur_id === u.id && p.statut !== 'ouverte');
      const gagnants = fermees.filter((p) => p.pnl > 0).length;
      return {
        utilisateur_id: u.id,
        pseudo: u.pseudo,
        pnl_total: round2(fermees.reduce((s, p) => s + p.pnl, 0)),
        nb_trades: fermees.length,
        taux_reussite: fermees.length ? gagnants / fermees.length : null,
        solde: getPortefeuille(u.id).solde,
      };
    })
    .sort((a, b) => b.pnl_total - a.pnl_total);
}

export function statsTokens() {
  return db.token.map((t) => {
    const pos = db.position.filter((p) => p.token_id === t.id);
    const cot = db.cotation.get(t.id).slice(-300);
    let somme = 0;
    for (let i = 1; i < cot.length; i++) {
      const r = Math.log(cot[i].prix / cot[i - 1].prix);
      somme += r * r;
    }
    return {
      token_id: t.id,
      symbole: t.symbole,
      volume_mise: round2(pos.reduce((s, p) => s + p.mise, 0)),
      nb_positions: pos.length,
      positions_ouvertes: pos.filter((p) => p.statut === 'ouverte').length,
      volatilite_observee: cot.length > 1 ? Math.sqrt(somme / (cot.length - 1)) : 0,
    };
  });
}

// ---------------------------------------------------------------------
// Singleton : survit aux rechargements à chaud de Next.js en dev
// (placé en fin de fichier pour que toutes les fonctions soient définies)
// ---------------------------------------------------------------------
if (!globalThis.__pumpordump) {
  const d = createDb();
  seed(d);
  d.timer = setInterval(() => tick(d), TICK_MS);
  globalThis.__pumpordump = d;
}
db = globalThis.__pumpordump;
