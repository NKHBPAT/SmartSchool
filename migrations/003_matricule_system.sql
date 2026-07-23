-- ============================================================
-- 003_matricule_system.sql
-- Système de génération de matricules professionnels
-- Format : {CODE_ECOLE}-{ANNEE}-{SEQUENCE sur 6 chiffres}
-- Exemple : COL-2026-000001
-- ============================================================

-- 1. Préfixe court par établissement (ex: COL, FL, LGL)
ALTER TABLE schools ADD COLUMN IF NOT EXISTS code VARCHAR(10);

-- 2. Table de compteurs atomiques, par établissement + année scolaire
--    (garantit zéro doublon même avec plusieurs ajouts simultanés)
CREATE TABLE IF NOT EXISTS matricule_counters (
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  year INT NOT NULL,
  counter INT NOT NULL DEFAULT 0,
  PRIMARY KEY (school_id, year)
);

-- 3. Remplace la contrainte unique GLOBALE sur matricule
--    par une contrainte unique PAR ÉTABLISSEMENT (plus logique)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_matricule_key;
ALTER TABLE students ADD CONSTRAINT students_school_matricule_unique UNIQUE (school_id, matricule);

-- 4. Attribue un code par défaut à chaque école existante
--    (à ajuster ensuite manuellement via le formulaire "Établissements" si besoin)
UPDATE schools
SET code = UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-zÀ-ÿ]', '', 'g'), 3))
WHERE code IS NULL;
