-- ============================================================
-- SmartSchool v6 — Migration PostgreSQL complète
-- Fichier : migrations/001_initial_schema.sql
-- Exécuter : psql -U smartschool_user -d smartschool_db -f migrations/001_initial_schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Pour la recherche full-text

-- ── SCHOOLS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schools (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    type        VARCHAR(20) NOT NULL DEFAULT 'lycee'
                CHECK (type IN ('primaire','college','lycee','college_tech','lycee_tech')),
    subsystem   VARCHAR(2) NOT NULL DEFAULT 'fr' CHECK (subsystem IN ('fr','en')),
    city        VARCHAR(100) NOT NULL DEFAULT '',
    region      VARCHAR(50),
    principal_id UUID,  -- FK ajoutée après création de users
    access_code VARCHAR(30) UNIQUE,
    logo_url    TEXT,
    doc_config  JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(200) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,  -- TOUJOURS bcrypt
    role            VARCHAR(20) NOT NULL DEFAULT 'teacher'
                    CHECK (role IN ('admin','principal','teacher','secretary','surveillant','parent')),
    school_id       UUID REFERENCES schools(id) ON DELETE SET NULL,
    phone           VARCHAR(30),
    access_code     VARCHAR(30),
    valid_year      INTEGER DEFAULT 2027,
    permissions     JSONB NOT NULL DEFAULT '{}',
    child_ids       UUID[] DEFAULT '{}',   -- Pour les parents
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- FK différée pour principal_id
ALTER TABLE schools ADD CONSTRAINT fk_school_principal
    FOREIGN KEY (principal_id) REFERENCES users(id) ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- ── CLASSES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    level       VARCHAR(50) NOT NULL DEFAULT '',
    school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    teacher_id  UUID REFERENCES users(id) ON DELETE SET NULL,  -- Prof titulaire
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);

-- ── STUDENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    dob             DATE,
    pob             VARCHAR(100),
    gender          CHAR(1) NOT NULL DEFAULT 'M' CHECK (gender IN ('M','F')),
    class_id        UUID REFERENCES classes(id) ON DELETE SET NULL,
    school_id       UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_name     VARCHAR(200),
    parent_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    phone           VARCHAR(30),
    address         TEXT,
    matricule       VARCHAR(50) UNIQUE,
    photo_url       TEXT,
    repeating       BOOLEAN NOT NULL DEFAULT false,
    enrolled        DATE DEFAULT CURRENT_DATE,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_students_parent ON students(parent_user_id);

-- ── SUBJECTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL,
    coef        SMALLINT NOT NULL DEFAULT 1 CHECK (coef BETWEEN 1 AND 9),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    group_key   VARCHAR(30) NOT NULL DEFAULT 'complementaire',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subjects_class ON subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher ON subjects(teacher_id);

-- ── GRADES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grades (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    seq         VARCHAR(1) NOT NULL CHECK (seq IN ('1','2','3','4','5','6')),
    value       NUMERIC(4,2) NOT NULL CHECK (value >= 0 AND value <= 20),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, subject_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_seq ON grades(seq);

-- ── TIMETABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id  UUID REFERENCES subjects(id) ON DELETE SET NULL,
    teacher_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    day         VARCHAR(15) NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    CHECK (end_time > start_time),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetable_class ON timetable(class_id);

-- ── ABSENCES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS absences (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    seq         VARCHAR(1) NOT NULL CHECK (seq IN ('1','2','3','4','5','6')),
    hours       NUMERIC(5,1) NOT NULL DEFAULT 0,
    justified   NUMERIC(5,1) NOT NULL DEFAULT 0,
    unjustified NUMERIC(5,1) NOT NULL DEFAULT 0,
    note        TEXT DEFAULT '',
    school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_absences_student ON absences(student_id);

-- ── PASSES (AUTORISATIONS SORTIE/ENTRÉE) ─────────────────
CREATE TABLE IF NOT EXISTS passes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type            VARCHAR(10) NOT NULL DEFAULT 'sortie' CHECK (type IN ('sortie','entree')),
    reason          TEXT NOT NULL,
    pass_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    time_out        TIME,
    time_in         TIME,
    authorized_by   UUID REFERENCES users(id) ON DELETE SET NULL,
    school_id       UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passes_student ON passes(student_id);
CREATE INDEX IF NOT EXISTS idx_passes_school ON passes(school_id);
CREATE INDEX IF NOT EXISTS idx_passes_date ON passes(pass_date);

-- ── PROGRESSION ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progression (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    seq         VARCHAR(1) NOT NULL CHECK (seq IN ('1','2','3','4','5','6')),
    planned     SMALLINT NOT NULL DEFAULT 0,
    done        SMALLINT NOT NULL DEFAULT 0,
    notes       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(teacher_id, subject_id, class_id, seq)
);

-- ── MESSAGES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    to_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject         VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT false,
    reply_to        UUID REFERENCES messages(id) ON DELETE SET NULL,
    school_id       UUID REFERENCES schools(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(to_user_id, is_read) WHERE is_read = false;

-- ── SMS LOGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    to_parent_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    student_id      UUID REFERENCES students(id) ON DELETE SET NULL,
    message         VARCHAR(500) NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'simulated'
                    CHECK (status IN ('sent','simulated','failed')),
    school_id       UUID REFERENCES schools(id) ON DELETE SET NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_school ON sms_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_sms_student ON sms_logs(student_id);

-- ── AUDIT LOG (optionnel mais recommandé) ─────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    action      VARCHAR(50) NOT NULL,
    table_name  VARCHAR(50),
    record_id   UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- ── TRIGGERS updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['schools','users','classes','students','subjects','grades','timetable','absences','progression'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t);
  END LOOP;
END $$;

-- ── VIEWS ─────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_students_full AS
SELECT s.*, c.name AS class_name, c.level, sc.name AS school_name,
       sc.type AS school_type, sc.subsystem, u.name AS parent_user_name
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN schools sc ON s.school_id = sc.id
LEFT JOIN users u ON s.parent_user_id = u.id
WHERE s.is_active = true;

CREATE OR REPLACE VIEW v_grades_full AS
SELECT g.*, s.name AS subject_name, s.coef, s.group_key,
       st.name AS student_name, st.first_name AS student_first_name,
       c.id AS class_id, c.name AS class_name
FROM grades g
JOIN subjects s ON g.subject_id = s.id
JOIN students st ON g.student_id = st.id
JOIN classes c ON s.class_id = c.id;

COMMENT ON TABLE schools IS 'Établissements scolaires';
COMMENT ON TABLE users IS 'Utilisateurs (admin, directeurs, enseignants, parents)';
COMMENT ON TABLE students IS 'Élèves inscrits';
COMMENT ON TABLE grades IS 'Notes par séquence. Contrainte UNIQUE(student,subject,seq) pour upsert.';
COMMENT ON TABLE passes IS 'Autorisations de sortie et d''entrée';
COMMENT ON TABLE sms_logs IS 'Historique des SMS envoyés aux parents';
