-- =====================================================================
-- PumpOrDump : création des tables (PostgreSQL)
-- =====================================================================

DROP TABLE IF EXISTS mouvement, position, cotation, token, portefeuille, utilisateur CASCADE;

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
-- PORTEFEUILLE : un seul par utilisateur (1-1)
-- ---------------------------------------------------------------------
CREATE TABLE portefeuille (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    utilisateur_id BIGINT        NOT NULL UNIQUE
                   REFERENCES utilisateur(id) ON DELETE CASCADE,
    solde          NUMERIC(14,2) NOT NULL DEFAULT 1000.00
                   CHECK (solde >= 0)
);

-- ---------------------------------------------------------------------
-- TOKEN : actifs fictifs au prix aléatoire
-- ---------------------------------------------------------------------
CREATE TABLE token (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nom           VARCHAR(50)  NOT NULL,
    symbole       VARCHAR(10)  NOT NULL UNIQUE,
    volatilite    NUMERIC(5,4) NOT NULL DEFAULT 0.0500
                  CHECK (volatilite > 0 AND volatilite <= 1),
    statut        VARCHAR(10)  NOT NULL DEFAULT 'actif'
                  CHECK (statut IN ('actif', 'suspendu')),
    date_creation TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- COTATION : historique des prix d'un token
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
-- POSITION : association N-N utilisateur <-> token (un trade)
-- ---------------------------------------------------------------------
CREATE TABLE position (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    utilisateur_id BIGINT        NOT NULL
                   REFERENCES utilisateur(id) ON DELETE RESTRICT,
    token_id       BIGINT        NOT NULL
                   REFERENCES token(id) ON DELETE RESTRICT,
    mise           NUMERIC(14,2) NOT NULL CHECK (mise > 0),
    prix_entree    NUMERIC(18,8) NOT NULL CHECK (prix_entree > 0),
    prix_sortie    NUMERIC(18,8)          CHECK (prix_sortie > 0),
    date_entree    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    date_sortie    TIMESTAMPTZ,
    statut         VARCHAR(10)   NOT NULL DEFAULT 'ouverte'
                   CHECK (statut IN ('ouverte', 'fermee', 'liquidee')),
    pnl            NUMERIC(14,2),

    -- Une position ouverte n'a pas de sortie ; une position close en a une complète
    CONSTRAINT chk_position_coherence CHECK (
        (statut = 'ouverte'  AND prix_sortie IS NULL     AND date_sortie IS NULL     AND pnl IS NULL)
     OR (statut <> 'ouverte' AND prix_sortie IS NOT NULL AND date_sortie IS NOT NULL AND pnl IS NOT NULL)
    ),
    CONSTRAINT chk_position_dates CHECK (date_sortie IS NULL OR date_sortie >= date_entree)
);

-- Une seule position ouverte par joueur et par token
CREATE UNIQUE INDEX uq_position_ouverte
    ON position (utilisateur_id, token_id)
    WHERE statut = 'ouverte';

CREATE INDEX idx_position_token ON position (token_id);

-- ---------------------------------------------------------------------
-- MOUVEMENT : journal des débits / crédits du portefeuille
-- ---------------------------------------------------------------------
CREATE TABLE mouvement (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    portefeuille_id BIGINT        NOT NULL
                    REFERENCES portefeuille(id) ON DELETE CASCADE,
    position_id     BIGINT
                    REFERENCES position(id) ON DELETE SET NULL,
    montant         NUMERIC(14,2) NOT NULL CHECK (montant <> 0),
    type            VARCHAR(10)   NOT NULL
                    CHECK (type IN ('mise', 'gain', 'bonus', 'correction')),
    horodatage      TIMESTAMPTZ   NOT NULL DEFAULT now(),

    -- Une mise ou un gain est toujours rattaché à une position
    CONSTRAINT chk_mouvement_position CHECK (
        type NOT IN ('mise', 'gain') OR position_id IS NOT NULL
    )
);

CREATE INDEX idx_mouvement_portefeuille ON mouvement (portefeuille_id);
CREATE INDEX idx_mouvement_position     ON mouvement (position_id);
