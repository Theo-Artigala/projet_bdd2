# PumpOrDump

Jeu de trading sur des tokens fictifs dont le prix évolue au hasard : on entre sur un token avec une mise, on choisit quand sortir, on gagne ou on perd selon la variation du prix.

Projet de base de données : l'appli est d'abord codée **sans BDD** (données en mémoire), puis la base PostgreSQL est mise en place étape par étape.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000 et choisir un compte (connexion simulée).
Les données repartent de zéro à chaque redémarrage du serveur.

## Comptes

| Pseudo | Rôle | Droits |
|---|---|---|
| moonboy | joueur | trade, voit ses positions et son historique |
| paperhands, whale_42, degen_sam | joueur (bots) | tradent tout seuls |
| admin | admin | crée / suspend les tokens, voit toutes les positions |
| analyste | analyste | lecture seule : graphiques et classement |

## Organisation

- `lib/store.js` : **seule couche d'accès aux données** (une "table" par tableau JS). C'est ce fichier qu'on remplacera par des requêtes SQL. Les règles métier RG1 à RG5 y sont marquées « → futur trigger ».
- `app/api/*` : routes HTTP (le rôle est vérifié côté serveur).
- `app/*/page.js` : écrans (trading, historique, classement, admin).
- `sql/01_schema.sql` : script de création des tables PostgreSQL.
- `pumpordump.looping` : MCD (Looping).

## Règles métier

- **RG1** : la mise doit être couverte par le solde ; le portefeuille est débité à l'ouverture.
- **RG2** : les prix d'entrée et de sortie sont imposés par le serveur (dernière cotation).
- **RG3** : à la fermeture, `pnl = mise × (prix_sortie / prix_entree − 1)` et le portefeuille est crédité de `mise + pnl`.
- **RG4** : pas de trade sur un token suspendu.
- **RG5** : une seule position ouverte par joueur et par token.
