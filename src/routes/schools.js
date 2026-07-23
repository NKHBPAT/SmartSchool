// ============================================================
// routes/schools.js
// ============================================================
'use strict';
const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { requireRole, sameSchool } = require('../middleware/auth');

// GET /api/schools — Admin: all, others: own school
router.get('/', sameSchool, async (req, res, next) => {
  try {
    let sql = 'SELECT id, name, type, subsystem, city, region, principal_id, access_code, code, logo_url, doc_config, created_at FROM schools';
    const params = [];
    if (req.schoolId) { sql += ' WHERE id = $1'; params.push(req.schoolId); }
    sql += ' ORDER BY name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/schools/:id
router.get('/:id', sameSchool, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM schools WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'École non trouvée' });
    if (req.schoolId && rows[0].id !== req.schoolId) return res.status(403).json({ error: 'Accès refusé' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/schools — Admin only
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, type, subsystem, city, region, principal_id, access_code, doc_config, code } = req.body;
    if (!name || !city) return res.status(400).json({ error: 'Nom et ville requis' });
    const { rows } = await query(
      `INSERT INTO schools (name, type, subsystem, city, region, principal_id, access_code, doc_config, code)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, type || 'lycee', subsystem || 'fr', city, region, principal_id || null, access_code, JSON.stringify(doc_config || {}), code || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PUT /api/schools/:id
router.put('/:id', requireRole('admin', 'principal'), async (req, res, next) => {
  try {
    const { name, type, subsystem, city, region, principal_id, access_code, doc_config, logo_url, code } = req.body;
const { rows } = await query(
  `UPDATE schools SET name=COALESCE($1,name), type=COALESCE($2,type), subsystem=COALESCE($3,subsystem),
   city=COALESCE($4,city), region=COALESCE($5,region), principal_id=COALESCE($6,principal_id),
   access_code=COALESCE($7,access_code), doc_config=COALESCE($8,doc_config), logo_url=COALESCE($9,logo_url),
   code=COALESCE($10,code), updated_at=NOW() WHERE id=$11 RETURNING *`,
  [name, type, subsystem, city, region, principal_id, access_code, doc_config ? JSON.stringify(doc_config) : null, logo_url, code, req.params.id]
);
    if (!rows.length) return res.status(404).json({ error: 'École non trouvée' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// DELETE /api/schools/:id — Admin only
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await query('DELETE FROM schools WHERE id = $1', [req.params.id]);
    res.json({ message: 'École supprimée' });
  } catch (err) { next(err); }
});

module.exports = router;
