// ============================================================
// routes/students.js
// ============================================================
'use strict';
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { requirePerm, sameSchool } = require('../middleware/auth');

// Génère un matricule professionnel : {CODE_ECOLE}-{ANNEE}-{SEQUENCE sur 6 chiffres}
// Ex: COL-2026-000001. Incrémentation atomique via ON CONFLICT -> zéro doublon.
async function generateMatricule(schoolId) {
  const year = new Date().getFullYear();
  const schoolRes = await query('SELECT code, name FROM schools WHERE id = $1', [schoolId]);
  let code = schoolRes.rows[0]?.code;
  if (!code || !code.trim()) {
    code = (schoolRes.rows[0]?.name || 'ECL').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'ECL';
  }
  const { rows } = await query(
    `INSERT INTO matricule_counters (school_id, year, counter) VALUES ($1, $2, 1)
     ON CONFLICT (school_id, year) DO UPDATE SET counter = matricule_counters.counter + 1
     RETURNING counter`,
    [schoolId, year]
  );
  const seq = String(rows[0].counter).padStart(6, '0');
  return `${code}-${year}-${seq}`;
}

router.get('/', sameSchool, requirePerm('view_students'), async (req, res, next) => {
  try {
    let sql = 'SELECT * FROM students WHERE is_active = true';
    const params = [];
    if (req.schoolId) { sql += ' AND school_id = $1'; params.push(req.schoolId); }
    if (req.query.class_id) { sql += ` AND class_id = $${params.length+1}`; params.push(req.query.class_id); }
    if (req.query.q) { sql += ` AND (name ILIKE $${params.length+1} OR first_name ILIKE $${params.length+1} OR matricule ILIKE $${params.length+1})`; params.push(`%${req.query.q}%`); }
    sql += ' ORDER BY name, first_name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', sameSchool, requirePerm('view_students'), async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM students WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', requirePerm('add_students'), async (req, res, next) => {
  try {
    const { name, first_name, dob, pob, gender, class_id, school_id, parent_name, parent_user_id, phone, address, matricule, repeating, enrolled } = req.body;
    if (!name || !first_name) return res.status(400).json({ error: 'Nom et prénom requis' });
    if (!class_id || String(class_id).trim() === '') {
      return res.status(400).json({ error: "Veuillez sélectionner une classe. Créez d'abord une classe si aucune n'existe." });
    }
    const sid = req.user.role !== 'admin' ? req.user.school_id : school_id;

    const finalMatricule = (matricule && matricule.trim() !== '')
      ? matricule.trim()
      : await generateMatricule(sid);

    const { rows } = await query(
      `INSERT INTO students (name, first_name, dob, pob, gender, class_id, school_id, parent_name, parent_user_id, phone, address, matricule, repeating, enrolled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [name, first_name, dob, pob, gender || 'M', class_id, sid, parent_name, parent_user_id || null, phone, address, finalMatricule, repeating || false, enrolled || new Date().toISOString().slice(0,10)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: "Ce matricule existe déjà pour cet établissement. Laissez le champ vide pour une génération automatique." });
    }
    next(err);
  }
});

router.put('/:id', requirePerm('edit_students'), async (req, res, next) => {
  try {
    const f = req.body;
    const { rows } = await query(
      `UPDATE students SET name=COALESCE($1,name), first_name=COALESCE($2,first_name), dob=COALESCE($3,dob),
       pob=COALESCE($4,pob), gender=COALESCE($5,gender), class_id=COALESCE($6,class_id),
       parent_name=COALESCE($7,parent_name), phone=COALESCE($8,phone), address=COALESCE($9,address),
       matricule=COALESCE($10,matricule), repeating=COALESCE($11,repeating), photo_url=COALESCE($12,photo_url),
       updated_at=NOW() WHERE id=$13 RETURNING *`,
      [f.name, f.first_name, f.dob, f.pob, f.gender, f.class_id, f.parent_name, f.phone, f.address, f.matricule, f.repeating, f.photo_url, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Élève non trouvé' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce matricule existe déjà pour cet établissement.' });
    }
    next(err);
  }
});

router.delete('/:id', requirePerm('delete_students'), async (req, res, next) => {
  try {
    await query('UPDATE students SET is_active=false WHERE id=$1', [req.params.id]);
    res.json({ message: 'Élève supprimé' });
  } catch (err) { next(err); }
});

module.exports = router;
