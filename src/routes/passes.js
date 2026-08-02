// routes/passes.js
'use strict';
const express = require('express');
const { query } = require('../config/database');
const r = express.Router();
r.get('/', async (req, res, next) => {
  try {
    const p = [req.user.school_id || req.query.school_id];
    const { rows } = await query(
      'SELECT pa.*,st.name,st.first_name,u.name as auth_name FROM passes pa JOIN students st ON pa.student_id=st.id LEFT JOIN users u ON pa.authorized_by=u.id WHERE pa.school_id=$1 ORDER BY pa.pass_date DESC', p
    );
    res.json(rows);
  } catch (e) { next(e); }
});
r.post('/', async (req, res, next) => {
  try {
    const { student_id, type, reason, pass_date, time_out, time_in } = req.body;
    if (!student_id || !reason) return res.status(400).json({ error: 'student_id et reason requis' });
    const school_id = req.user.school_id;
    const { rows } = await query(
      'INSERT INTO passes(student_id,type,reason,pass_date,time_out,time_in,authorized_by,school_id)VALUES($1,$2,$3,$4,$5,$6,$7,$8)RETURNING*',
      [student_id, type||'sortie', reason, pass_date||new Date().toISOString().slice(0,10), time_out, time_in||null, req.user.id, school_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
r.put('/:id', async (req, res, next) => {
  try {
    const { student_id, type, reason, pass_date, time_out, time_in } = req.body;
    if (!student_id || !reason) return res.status(400).json({ error: 'student_id et reason requis' });
    const { rows } = await query(
      'UPDATE passes SET student_id=$1,type=$2,reason=$3,pass_date=$4,time_out=$5,time_in=$6 WHERE id=$7 RETURNING*',
      [student_id, type||'sortie', reason, pass_date||new Date().toISOString().slice(0,10), time_out, time_in||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Autorisation introuvable' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});
r.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM passes WHERE id=$1',[req.params.id]); res.json({ message:'Supprimé' }); }
  catch (e) { next(e); }
});
module.exports = r;
