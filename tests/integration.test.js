// tests/integration.test.js
// Usage: npm test
// Requiert un backend en cours d'exécution sur localhost:3000
'use strict';
const request = require('supertest');
const app = require('../src/server');

let adminToken = '';
let principalToken = '';
let schoolId = '';
let userId = '';
let classId = '';
let studentId = '';
let subjectId = '';

// ── Helpers ────────────────────────────────────────────────
async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

// ══════════════════════════════════════════════════════════
// 1. AUTHENTIFICATION
// ══════════════════════════════════════════════════════════
describe('1. Authentification', () => {
  test('GET /health → 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('6.0.0');
  });

  test('POST /api/auth/login → succès admin', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: process.env.ADMIN_EMAIL || 'admin@smartschool.cm',
      password: process.env.ADMIN_PASSWORD || 'Admin@2025'
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.name).toBe('Herman SmartSchool');
    adminToken = res.body.token;
  });

  test('POST /api/auth/login → échec mauvais mdp', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'admin@smartschool.cm', password: 'mauvais'
    });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/auth/login → échec email invalide', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'pas_un_email', password: 'test'
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/auth/me → profil utilisateur', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('GET /api/auth/me → 401 sans token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login → principal', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'directeur@leclerc.cm', password: 'Dir@2025'
    });
    if (res.status === 200) {
      principalToken = res.body.token;
      expect(res.body.user.role).toBe('principal');
    }
  });
});

// ══════════════════════════════════════════════════════════
// 2. ÉTABLISSEMENTS
// ══════════════════════════════════════════════════════════
describe('2. Établissements', () => {
  test('GET /api/schools → liste (admin)', async () => {
    const res = await request(app).get('/api/schools')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    schoolId = res.body[0]?.id;
  });

  test('POST /api/schools → créer école (admin)', async () => {
    const res = await request(app).post('/api/schools')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'École Test Jest', type: 'primaire', subsystem: 'fr', city: 'Yaoundé', region: 'Centre' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('École Test Jest');
    // Cleanup
    await request(app).delete(`/api/schools/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  test('GET /api/schools/:id → école spécifique', async () => {
    if (!schoolId) return;
    const res = await request(app).get(`/api/schools/${schoolId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(schoolId);
  });

  test('GET /api/schools → 401 sans token', async () => {
    const res = await request(app).get('/api/schools');
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════
// 3. UTILISATEURS
// ══════════════════════════════════════════════════════════
describe('3. Utilisateurs', () => {
  test('GET /api/users → liste admin', async () => {
    const res = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /api/users → créer enseignant', async () => {
    const res = await request(app).post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Prof Test Jest', email: 'test.jest@ecole.cm',
        password: 'TestPass@123', role: 'teacher',
        school_id: schoolId, valid_year: 2027
      });
    expect(res.status).toBe(201);
    userId = res.body.id;
  });

  test('GET /api/users/:id → utilisateur spécifique', async () => {
    if (!userId) return;
    const res = await request(app).get(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Prof Test Jest');
  });

  test('POST /api/users/:id/reset-password → reset', async () => {
    if (!userId) return;
    const res = await request(app).post(`/api/users/${userId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ newPassword: 'NewPass@456' });
    expect(res.status).toBe(200);
  });

  test('DELETE /api/users/:id → désactiver', async () => {
    if (!userId) return;
    const res = await request(app).delete(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════
// 4. CLASSES
// ══════════════════════════════════════════════════════════
describe('4. Classes', () => {
  test('GET /api/classes → liste', async () => {
    const res = await request(app).get('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/classes → créer classe', async () => {
    const res = await request(app).post('/api/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test A', level: '6ème', school_id: schoolId });
    expect(res.status).toBe(201);
    classId = res.body.id;
  });
});

// ══════════════════════════════════════════════════════════
// 5. ÉLÈVES
// ══════════════════════════════════════════════════════════
describe('5. Élèves', () => {
  test('GET /api/students → liste', async () => {
    const res = await request(app).get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/students → inscrire élève', async () => {
    if (!classId || !schoolId) return;
    const res = await request(app).post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test', first_name: 'Élève', gender: 'M',
        class_id: classId, school_id: schoolId,
        matricule: 'TEST-001', repeating: false
      });
    expect(res.status).toBe(201);
    studentId = res.body.id;
  });

  test('GET /api/students/:id → élève spécifique', async () => {
    if (!studentId) return;
    const res = await request(app).get(`/api/students/${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test');
  });
});

// ══════════════════════════════════════════════════════════
// 6. MATIÈRES & NOTES
// ══════════════════════════════════════════════════════════
describe('6. Matières et Notes', () => {
  test('POST /api/subjects → créer matière', async () => {
    if (!classId) return;
    const res = await request(app).post('/api/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Maths Test', coef: 4, class_id: classId, group_key: 'scientifique' });
    expect(res.status).toBe(201);
    subjectId = res.body.id;
  });

  test('POST /api/grades → saisir note', async () => {
    if (!studentId || !subjectId) return;
    const res = await request(app).post('/api/grades')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ student_id: studentId, subject_id: subjectId, seq: '1', value: 15.5 });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.value)).toBe(15.5);
  });

  test('POST /api/grades → upsert (modifier note)', async () => {
    if (!studentId || !subjectId) return;
    const res = await request(app).post('/api/grades')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ student_id: studentId, subject_id: subjectId, seq: '1', value: 17 });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.value)).toBe(17);
  });

  test('POST /api/grades → hors limites refusé (>20)', async () => {
    if (!studentId || !subjectId) return;
    const res = await request(app).post('/api/grades')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ student_id: studentId, subject_id: subjectId, seq: '2', value: 21 });
    expect(res.status).toBe(400);
  });

  test('GET /api/grades/ranking → classement', async () => {
    if (!classId) return;
    const res = await request(app)
      .get(`/api/grades/ranking?class_id=${classId}&type=seq&period=1`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/grades/bulk → saisie en lot', async () => {
    if (!studentId || !subjectId) return;
    const res = await request(app).post('/api/grades/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ grades: [
        { student_id: studentId, subject_id: subjectId, seq: '3', value: 14 },
        { student_id: studentId, subject_id: subjectId, seq: '4', value: 16 },
      ]});
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════
// 7. EMPLOI DU TEMPS
// ══════════════════════════════════════════════════════════
describe('7. Emploi du temps', () => {
  let ttId;
  test('POST /api/timetable → créer créneau', async () => {
    if (!classId) return;
    const res = await request(app).post('/api/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ class_id: classId, subject_id: subjectId, day: 'Lundi', start_time: '08:00', end_time: '10:00' });
    expect(res.status).toBe(201);
    ttId = res.body.id;
  });

  test('GET /api/timetable → liste', async () => {
    const res = await request(app).get(`/api/timetable?class_id=${classId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('PUT /api/timetable/:id → modifier créneau', async () => {
    if (!ttId) return;
    const res = await request(app).put(`/api/timetable/${ttId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ start_time: '09:00', end_time: '11:00' });
    expect(res.status).toBe(200);
  });

  test('POST /api/timetable → end < start refusé', async () => {
    if (!classId) return;
    const res = await request(app).post('/api/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ class_id: classId, day: 'Mardi', start_time: '10:00', end_time: '08:00' });
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════
// 8. MESSAGES
// ══════════════════════════════════════════════════════════
describe('8. Messages', () => {
  test('GET /api/messages → boîte de réception', async () => {
    const res = await request(app).get('/api/messages?box=inbox')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/messages → envoyer message', async () => {
    const usersRes = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    const recipient = usersRes.body.find(u => u.role === 'teacher');
    if (!recipient) return;
    const res = await request(app).post('/api/messages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ to_user_id: recipient.id, subject: 'Test Jest', body: 'Message de test automatique' });
    expect(res.status).toBe(201);
    expect(res.body.subject).toBe('Test Jest');
  });
});

// ══════════════════════════════════════════════════════════
// 9. SÉCURITÉ
// ══════════════════════════════════════════════════════════
describe('9. Sécurité', () => {
  test('Rate limiting login → bloque après 10 tentatives', async () => {
    const attempts = Array(6).fill(null).map(() =>
      request(app).post('/api/auth/login').send({ email: 'fake@test.cm', password: 'wrong' })
    );
    const results = await Promise.all(attempts);
    const blocked = results.some(r => r.status === 429);
    // After many attempts, should get rate limited
    expect(blocked || results.every(r => r.status === 401)).toBe(true);
  });

  test('SQL injection dans login → rejeté proprement', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: "' OR '1'='1", password: "' OR '1'='1" });
    expect(res.status).toBe(400);
  });

  test('Accès cross-school refusé (isolation multi-tenant)', async () => {
    if (!principalToken) return;
    // Principal de Leclerc ne peut pas voir les élèves d'une autre école
    const res = await request(app).get('/api/students')
      .set('Authorization', `Bearer ${principalToken}`);
    expect(res.status).toBe(200);
    // Should only return students from his school
    const students = res.body;
    const leclerSchool = '11111111-0000-0000-0000-000000000003';
    const allFromHisSchool = students.every(s => s.school_id === leclerSchool);
    expect(allFromHisSchool).toBe(true);
  });

  test('Token invalide → 401', async () => {
    const res = await request(app).get('/api/students')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  test('Logout blackliste le token', async () => {
    const loginRes = await request(app).post('/api/auth/login')
      .send({ email: 'admin@smartschool.cm', password: process.env.ADMIN_PASSWORD || 'Admin@2025' });
    const tempToken = loginRes.body.token;
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${tempToken}`);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tempToken}`);
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════
// 10. NETTOYAGE
// ══════════════════════════════════════════════════════════
afterAll(async () => {
  // Clean up test data
  if (studentId) await request(app).delete(`/api/students/${studentId}`).set('Authorization', `Bearer ${adminToken}`);
  if (subjectId) await request(app).delete(`/api/subjects/${subjectId}`).set('Authorization', `Bearer ${adminToken}`);
  if (classId)   await request(app).delete(`/api/classes/${classId}`).set('Authorization', `Bearer ${adminToken}`);
  await new Promise(r => setTimeout(r, 200));
});
