// ============================================================
// routes/subjects.js
// ============================================================
'use strict';
const express = require('express');
const { query } = require('../config/database');

const subjects = express.Router();
subjects.get('/', async (req, res, next) => {
  try {
    let sql = 'SELECT s.*, c.name as class_name FROM subjects s JOIN classes c ON s.class_id=c.id WHERE true';
    const p = [];
    if (req.query.class_id) { sql += ` AND s.class_id=$${p.length+1}`; p.push(req.query.class_id); }
    if (req.user.role === 'teacher') { sql += ` AND s.teacher_id=$${p.length+1}`; p.push(req.user.id); }
    sql += ' ORDER BY s.name';
    const { rows } = await query(sql, p);
    res.json(rows);
  } catch (e) { next(e); }
});
subjects.post('/', async (req, res, next) => {
  try {
    const { name, coef, class_id, teacher_id, group_key } = req.body;
    if (!name || !class_id) return res.status(400).json({ error: 'name et class_id requis' });
    const { rows } = await query('INSERT INTO subjects(name,coef,class_id,teacher_id,group_key)VALUES($1,$2,$3,$4,$5)RETURNING*', [name, coef || 1, class_id, teacher_id || null, group_key || 'complementaire']);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
subjects.put('/:id', async (req, res, next) => {
  try {
    const { name, coef, teacher_id, group_key } = req.body;
    const { rows } = await query('UPDATE subjects SET name=COALESCE($1,name),coef=COALESCE($2,coef),teacher_id=COALESCE($3,teacher_id),group_key=COALESCE($4,group_key),updated_at=NOW()WHERE id=$5 RETURNING*', [name, coef, teacher_id, group_key, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Matière non trouvée' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});
subjects.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM subjects WHERE id=$1', [req.params.id]); res.json({ message: 'Matière supprimée' }); }
  catch (e) { next(e); }
});
module.exports = subjects;
