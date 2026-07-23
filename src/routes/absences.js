// ============================================================
// routes/absences.js
// ============================================================
'use strict';
const express = require('express');
const { query } = require('../config/database');

const absences = express.Router();
absences.get('/', async (req, res, next) => {
  try {
    let sql = 'SELECT a.*, st.name, st.first_name FROM absences a JOIN students st ON a.student_id=st.id WHERE true';
    const p = [];
    if (req.query.student_id) { sql += ` AND a.student_id=$${p.length+1}`; p.push(req.query.student_id); }
    if (req.query.seq) { sql += ` AND a.seq=$${p.length+1}`; p.push(req.query.seq); }
    if (req.query.school_id) { sql += ` AND a.school_id=$${p.length+1}`; p.push(req.query.school_id); }
    const { rows } = await query(sql, p);
    res.json(rows);
  } catch (e) { next(e); }
});
absences.post('/', async (req, res, next) => {
  try {
    const { student_id, seq, hours, justified, unjustified, note, school_id } = req.body;
    if (!student_id || !seq) return res.status(400).json({ error: 'student_id et seq requis' });
    const sid = req.user.role !== 'admin' ? req.user.school_id : school_id;
    const { rows } = await query(
      `INSERT INTO absences(student_id,seq,hours,justified,unjustified,note,school_id)
       VALUES($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT(student_id,seq) DO UPDATE SET hours=EXCLUDED.hours,justified=EXCLUDED.justified,unjustified=EXCLUDED.unjustified,note=EXCLUDED.note,updated_at=NOW()
       RETURNING *`,
      [student_id, seq, hours||0, justified||0, unjustified||0, note||'', sid]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
absences.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM absences WHERE id=$1',[req.params.id]); res.json({ message:'Supprimé' }); }
  catch (e) { next(e); }
});
module.exports = absences;
