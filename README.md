# PumpOrDump

Jeu de trading sur des tokens fictifs dont le prix évolue au hasard : on entre sur un token avec une mise, on choisit quand sortir, on gagne ou on perd selon la variation du prix.

Projet de fin de module « Bases de Données Avancées » (2026-2027). C'est la **base de données** qui est le cœur
du projet ; l'application sert de vitrine. L'appli a d'abord été codée avec des DAO **en mémoire** ;
les implémentations PostgreSQL des DAO viennent ensuite, étape par étape.

> **Usage d'une IA** : l'application (interface, routes, DAO) a été développée avec l'aide d'une IA
> (Claude Code), en « vibe coding ». Le schéma, les requêtes et les objets SQL sont relus, compris
> et défendus par le groupe.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 et choisir un pseudo.
Pour l'instant les données sont en mémoire : elles repartent de zéro à chaque redémarrage du serveur.

## Jouer à plusieurs (tunnel Cloudflare)

```bash
npm run build
npm start
```

Puis, dans un autre terminal :

```bash
cloudflared tunnel --url http://localhost:3000
```

Partage l'adresse `https://….trycloudflare.com` affichée : chaque visiteur choisit un pseudo et reçoit 1 000 $.
L'adresse change à chaque lancement du tunnel, et tout est effacé quand le serveur redémarre (données en mémoire).

## Comptes

- **Visiteurs** : un simple pseudo (pas de mot de passe pour l'instant ; il arrivera avec la base de données).
  La session est gardée 30 jours dans un cookie ; un pseudo déjà pris ne peut pas être réutilisé.
- **Hôte** : depuis `http://localhost:3000` (sans passer par le tunnel), l'écran de connexion propose en plus
  « Mode hôte » pour reprendre n'importe quel compte, dont **admin** et **analyste**.
  Ces deux comptes sont refusés pour toute requête qui passe par le tunnel.
- **Bots** : paperhands, whale_42 et degen_sam tradent tout seuls pour animer le marché.

## Organisation

```
sql/
  01_schema.sql              tables, contraintes, index
  (02 à 07 à venir : données, vues, fonctions/procédures, triggers, sécurité, tests)
pumpordump.looping           MCD (Looping)
lib/
  models/                    une classe par entité : Utilisateur, Portefeuille, Token, Cotation,
                             Position, Ordre, Mouvement (+ lignes des indicateurs)
  dao/
    Dao.js                   classe de base : chaque DAO reçoit le contexte de l'utilisateur
    UtilisateurDao.js ...    une interface (classe abstraite) par entité
    memoire/                 implémentation en mémoire (provisoire)
    index.js                 avecDaos(ctx, fn) : choisit l'implémentation, ouvrira la transaction
  api.js                     identification de l'utilisateur + accès aux DAO pour les routes
  sessions.js                jetons de session (cookie)
  moteur.js                  prix chaque seconde, exécution des SL / TP, bots
app/
  api/*                      routes HTTP : n'appellent QUE les DAO, jamais de données en direct
  */page.js                  écrans : connexion, trading, historique, classement, admin
```

**Règle d'or : aucun accès aux données en dehors de `lib/dao/`.** Chaque requête HTTP crée ses DAO avec le
contexte de l'utilisateur connecté (`{ role, utilisateurId }`). Avec PostgreSQL, `avecDaos` ouvrira une
transaction, fera `SET LOCAL ROLE pod_<role>` et `set_config('app.user_id', …)`, et c'est la RLS qui
filtrera les lignes.

| Rôle applicatif | Qui | Peut |
|---|---|---|
| `joueur` | les joueurs (humains et bots) | trader, voir ses positions / ordres / mouvements, le classement |
| `admin` | l'hôte | gérer les tokens, voir toutes les positions ouvertes |
| `analyste` | l'hôte | lecture seule : cours et classement |
| `moteur` | le serveur | générer les cotations, exécuter les SL / TP |

## Règles métier

- **RG1** : un achat doit être couvert par le solde ; le portefeuille est débité.
- **RG2** : le prix de chaque ordre (achat / vente) est imposé par le serveur (dernière cotation).
- **RG3** : chaque ordre met à jour la position (quantité, coût) ; à quantité nulle elle est fermée.
  Le PnL réalisé n'est pas stocké : c'est la somme de `montant − cout_vendu` des ventes.
- **RG4** : pas d'ordre sur un token suspendu ou mort.
- **RG5** : une seule position ouverte par joueur et par token (racheter la renforce).
- **RG6** : stop loss sous le prix actuel, take profit au-dessus.
- **RG7** : à chaque nouvelle cotation, les positions qui touchent leur SL / TP sont vendues du pourcentage choisi (100 % par défaut) ; s'il reste des tokens, ce SL / TP est retiré.
- **RG8** : rug — un token peut s'effondrer d'environ −90 % en quelques secondes ; à la fin, les positions encore ouvertes sont liquidées (origine `rug`) et le token passe `mort`.
- **RG9** : il y a toujours au moins 5 tokens vivants ; le moteur en fait naître de nouveaux (jusqu'à 8).

## Simulation du marché (`lib/dao/memoire/marche.js`)

Chaque seconde, pour chaque token actif :

- **Phase** : le token passe au hasard d'une phase à l'autre (calme ×0,3, normal ×1, frénésie ×3 sur la volatilité ; le volume suit : ×0,25, ×1, ×5).
- **Prix** : `prix = prix × e^(σ·Z)` avec Z tiré d'une loi normale (Box-Muller) et σ = volatilité du token × phase ;
  de temps en temps un saut (pump ou dump) de 15 à 50 % en log, plus fréquent en frénésie ; léger rappel si le token
  s'éloigne trop de son prix de départ (÷20 ou ×50).
- **Volume** : le « reste du marché » échange un montant aléatoire qui dépend de la phase et grimpe quand le prix bouge fort ;
  les ordres des joueurs s'y ajoutent.
- **Rug** : probabilité ≈ 1,1 × 10⁻⁴ par seconde (doublée en frénésie), soit environ 1 token sur 3 qui meurt dans l'heure.
  Le prix chute vers 10 % de sa valeur en 5 secondes, puis les positions sont liquidées et le token est mort.
- **Naissance** : nom généré (« Turbo Frog », « Spicy Waffle »…), volatilité de 0,8 % à 4 % par seconde, prix de départ de 0,001 à ~3 000,
  lancement en frénésie pendant 2 à 4 minutes.
