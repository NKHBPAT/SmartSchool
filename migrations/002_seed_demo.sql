-- ============================================================
-- SmartSchool v6 — Seed de données de démonstration
-- Fichier : migrations/002_seed_demo.sql
-- ATTENTION : Supprimer ou adapter avant mise en production !
-- ============================================================

-- Nettoyer dans l'ordre des dépendances
TRUNCATE sms_logs, audit_logs, messages, progression, passes, absences,
         timetable, grades, subjects, students, classes, users, schools
         RESTART IDENTITY CASCADE;

-- ── SCHOOLS ──────────────────────────────────────────────
INSERT INTO schools (id, name, type, subsystem, city, region, access_code, doc_config) VALUES
('11111111-0000-0000-0000-000000000001','École Primaire Les Flambeaux','primaire','fr','Yaoundé','Centre','ECO-FL01',
 '{"showLogo":true,"showDOB":true,"showPOB":true,"showGender":true,"showMatricule":true,"showParent":true,"showAbsences":true,"showObservations":true,"showRank":true,"showClassStats":true,"showDecision":true,"showStamp":true,"showGroupHeaders":false,"useGroups":false,"bulletinColor":"#1a3a6c","signTitle1":"Le Professeur","signTitle2":"La Directrice","listColumns":["mat","name","gender","class","dob","parent"]}'),
('11111111-0000-0000-0000-000000000002','Collège de la Réunification','college','fr','Douala','Littoral','COL-RE01','{"bulletinColor":"#1a3a6c","useGroups":true,"showGroupHeaders":true,"signTitle2":"Le Principal"}'),
('11111111-0000-0000-0000-000000000003','Lycée Général Leclerc','lycee','fr','Yaoundé','Centre','LYC-GL01','{"bulletinColor":"#1a3a6c","useGroups":true,"showGroupHeaders":true,"signTitle2":"Le Proviseur"}'),
('11111111-0000-0000-0000-000000000004','Lycée Bilingue d''Etoudi','lycee','en','Yaoundé','Centre','LYC-BI01','{"bulletinColor":"#0d5c8f","useGroups":false,"showGroupHeaders":false,"signTitle2":"The Principal"}'),
('11111111-0000-0000-0000-000000000005','Lycée Technique de Yaoundé','lycee_tech','fr','Yaoundé','Centre','LYT-YA01','{"bulletinColor":"#b45309","useGroups":true,"showGroupHeaders":true,"signTitle2":"Le Directeur","grpGenLabel":"Enseignements Généraux","grpTechLabel":"Enseignements Techniques","grpProLabel":"Activités Pratiques"}');

-- ── USERS (mots de passe bcrypt de "Dir@2025" etc.) ──────
-- NOTE : Les hash ci-dessous sont générés avec bcrypt rounds=12
-- En production, utiliser le script seeds/hash_passwords.js
-- Pour la démo, le seed.js hashe dynamiquement depuis le .env

-- Insertions via le script Node.js seeds/run.js (voir ci-dessous)
-- Ce fichier SQL est un template — les mots de passe sont hashés par le script

-- ── PLACEHOLDER pour les users ───────────────────────────
-- Voir seeds/run.js pour l'insertion complète avec bcrypt

SELECT 'Migration 002 : structure seed prête. Lancer: npm run seed' AS info;
