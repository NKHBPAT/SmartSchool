// routes/progression.js
'use strict';
const express = require('express');
const { query } = require('../config/database');
const r1 = express.Router();
r1.get('/', async (req, res, next) => {
  try {
    const tid = req.user.role === 'teacher' ? req.user.id : req.query.teacher_id;
    let sql = 'SELECT p.*,s.name as subject_name,c.name as class_name FROM progression p JOIN subjects s ON p.subject_id=s.id JOIN classes c ON p.class_id=c.id WHERE true';
    const params = [];
    if (tid) { sql += ` AND p.teacher_id=$${params.length+1}`; params.push(tid); }
    if (req.query.seq) { sql += ` AND p.seq=$${params.length+1}`; params.push(req.query.seq); }
    sql += ' ORDER BY c.name,s.name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) { next(e); }
});
r1.post('/', async (req, res, next) => {
  try {
    const { subject_id, class_id, seq, planned, done, notes } = req.body;
    if (!subject_id || !class_id || !seq) return res.status(400).json({ error: 'subject_id, class_id, seq requis' });
    const { rows } = await query(
      `INSERT INTO progression(teacher_id,subject_id,class_id,seq,planned,done,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(teacher_id,subject_id,class_id,seq) DO UPDATE SET planned=EXCLUDED.planned,done=EXCLUDED.done,notes=EXCLUDED.notes,updated_at=NOW()
       RETURNING*`,
      [req.user.id, subject_id, class_id, seq, planned||0, done||0, notes||'']
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
r1.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM progression WHERE id=$1',[req.params.id]); res.json({ message:'Supprimé' }); }
  catch (e) { next(e); }
});
module.exports = r1;
