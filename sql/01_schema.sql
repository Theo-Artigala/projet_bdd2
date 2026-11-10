-- =====================================================================
-- PumpOrDump : création des tables (PostgreSQL)
-- =====================================================================

DROP TABLE IF EXISTS mouvement, ordre, position, cotation, token, portefeuille, utilisateur CASCADE;

-- ---------------------------------------------------------------------
-- UTILISATEUR : joueurs, admins, analystes
-- ---------------------------------------------------------------------
CREATE TABLE utilisateur (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pseudo           VARCHAR(30)  NOT NULL UNIQUE,
    email            VARCHAR(255) NOT NULL UNIQUE,
    role             VARCHAR(10)  NOT NULL DEFAULT 'joueur'
                     CHECK (role IN ('joueur', 'admin', 'analyste')),
    date_inscription TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- PORTEFEUILLE : au plus un par utilisateur (seuls les joueurs en ont un)
-- ---------------------------------------------------------------------
CREATE TABLE portefeuille (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    utilisateur_id BIGINT        NOT NULL UNIQUE
                   REFERENCES utilisateur(id) ON DELETE CASCADE,
    solde          NUMERIC(14,2) NOT NULL DEFAULT 0
                   CHECK (solde >= 0)
);

-- ---------------------------------------------------------------------
-- TOKEN : actifs fictifs au prix aléatoire
-- ---------------------------------------------------------------------
CREATE TABLE token (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom           VARCHAR(50)   NOT NULL,
    symbole       VARCHAR(10)   NOT NULL UNIQUE,
    volatilite    NUMERIC(5,4)  NOT NULL DEFAULT 0.0200
                  CHECK (volatilite > 0 AND volatilite <= 1),
    prix_initial  NUMERIC(18,8) NOT NULL CHECK (prix_initial > 0),
    statut        VARCHAR(10)   NOT NULL DEFAULT 'actif'
                  CHECK (statut IN ('actif', 'suspendu')),
    date_creation TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- COTATION : historique des prix d'un token (un prix par seconde)
-- ---------------------------------------------------------------------
CREATE TABLE cotation (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_id    BIGINT        NOT NULL
                REFERENCES token(id) ON DELETE CASCADE,
    prix        NUMERIC(18,8) NOT NULL CHECK (prix > 0),
    horodatage  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (token_id, horodatage)
);

-- Accès rapide au dernier prix d'un token
CREATE INDEX idx_cotation_token_date ON cotation (token_id, horodatage DESC);

-- ---------------------------------------------------------------------
-- POSITION : association N-N utilisateur <-> token
-- Une position regroupe tous les achats / ventes d'un joueur sur un token
-- entre son ouverture et sa fermeture (quantité retombée à 0).
-- Elle ne stocke que son ÉTAT COURANT (quantite, cout), maintenu par trigger.
-- Les totaux (investi, récupéré, PnL réalisé) se calculent à partir des ordres
-- dans une vue : pas de donnée dérivée stockée (3FN).
-- ---------------------------------------------------------------------
CREATE TABLE position (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    utilisateur_id BIGINT        NOT NULL
                   REFERENCES utilisateur(id) ON DELETE RESTRICT,
    token_id       BIGINT        NOT NULL
                   REFERENCES token(id) ON DELETE RESTRICT,
    quantite       NUMERIC(30,12) NOT NULL DEFAULT 0 CHECK (quantite >= 0),  -- tokens détenus
    cout           NUMERIC(14,2)  NOT NULL DEFAULT 0 CHECK (cout >= 0),      -- prix payé pour ces tokens
    stop_loss      NUMERIC(18,8)  CHECK (stop_loss > 0),
    take_profit    NUMERIC(18,8)  CHECK (take_profit > 0),
    statut         VARCHAR(10)    NOT NULL DEFAULT 'ouverte'
                   CHECK (statut IN ('ouverte', 'fermee')),
    date_ouverture TIMESTAMPTZ    NOT NULL DEFAULT now(),
    date_fermeture TIMESTAMPTZ,

    -- Une position fermée n'a plus de tokens, plus de stops et a une date de fermeture
    CONSTRAINT chk_position_coherence CHECK (
        (statut = 'ouverte' AND date_fermeture IS NULL)
     OR (statut = 'fermee'  AND date_fermeture IS NOT NULL AND quantite = 0
                            AND stop_loss IS NULL AND take_profit IS NULL)
    ),
    CONSTRAINT chk_position_dates CHECK (date_fermeture IS NULL OR date_fermeture >= date_ouverture),
    CONSTRAINT chk_position_stops CHECK (stop_loss IS NULL OR take_profit IS NULL OR stop_loss < take_profit)
);

-- RG5 : une seule position ouverte par joueur et par token
CREATE UNIQUE INDEX uq_position_ouverte
    ON position (utilisateur_id, token_id)
    WHERE statut = 'ouverte';

CREATE INDEX idx_position_token ON position (token_id);

-- ---------------------------------------------------------------------
-- ORDRE : chaque achat ou vente passé sur une position
-- ---------------------------------------------------------------------
CREATE TABLE ordre (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    position_id BIGINT         NOT NULL
                REFERENCES position(id) ON DELETE CASCADE,
    sens        VARCHAR(5)     NOT NULL CHECK (sens IN ('achat', 'vente')),
    quantite    NUMERIC(30,12) NOT NULL CHECK (quantite > 0),
    prix        NUMERIC(18,8)  NOT NULL CHECK (prix > 0),
    montant     NUMERIC(14,2)  NOT NULL CHECK (montant >= 0),
    -- vente : part du coût de la position cédée (sert au calcul du PnL réalisé)
    cout_vendu  NUMERIC(14,2)  CHECK (cout_vendu >= 0),
    origine     VARCHAR(12)    NOT NULL DEFAULT 'manuel'
                CHECK (origine IN ('manuel', 'stop_loss', 'take_profit')),
    horodatage  TIMESTAMPTZ    NOT NULL DEFAULT now(),

    -- Seule une vente peut être déclenchée automatiquement
    CONSTRAINT chk_ordre_origine CHECK (sens = 'vente' OR origine = 'manuel'),
    -- cout_vendu est renseigné pour une vente, et seulement pour une vente
    CONSTRAINT chk_ordre_cout_vendu CHECK ((sens = 'vente') = (cout_vendu IS NOT NULL))
);

CREATE INDEX idx_ordre_position ON ordre (position_id, horodatage);

-- ---------------------------------------------------------------------
-- MOUVEMENT : journal des débits / crédits du portefeuille
-- ---------------------------------------------------------------------
CREATE TABLE mouvement (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    portefeuille_id BIGINT        NOT NULL
                    REFERENCES portefeuille(id) ON DELETE CASCADE,
    ordre_id        BIGINT        UNIQUE
                    REFERENCES ordre(id) ON DELETE RESTRICT,
    montant         NUMERIC(14,2) NOT NULL CHECK (montant <> 0),
    type            VARCHAR(10)   NOT NULL
                    CHECK (type IN ('achat', 'vente', 'bonus', 'correction')),
    horodatage      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- Un achat débite, une vente crédite, et les deux viennent d'un ordre
    CONSTRAINT chk_mouvement_sens CHECK (
        (type = 'achat' AND montant < 0 AND ordre_id IS NOT NULL)
     OR (type = 'vente' AND montant > 0 AND ordre_id IS NOT NULL)
     OR (type IN ('bonus', 'correction'))
    )
);

CREATE INDEX idx_mouvement_portefeuille ON mouvement (portefeuille_id);
