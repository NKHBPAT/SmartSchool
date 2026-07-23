// ============================================================
// routes/timetable.js
// ============================================================
'use strict';
const express = require('express');
const { query } = require('../config/database');
const r1 = express.Router();
r1.get('/', async (req, res, next) => {
  try {
    let sql = 'SELECT t.*, s.name as subject_name, u.name as teacher_name FROM timetable t LEFT JOIN subjects s ON t.subject_id=s.id LEFT JOIN users u ON t.teacher_id=u.id WHERE true';
    const p = [];
    if (req.query.class_id) { sql += ` AND t.class_id=$${p.length+1}`; p.push(req.query.class_id); }
    sql += ' ORDER BY t.day, t.start_time';
    const { rows } = await query(sql, p);
    res.json(rows);
  } catch (e) { next(e); }
});
r1.post('/', async (req, res, next) => {
  try {
    const { class_id, subject_id, teacher_id, day, start_time, end_time } = req.body;
    if (!class_id || !day || !start_time || !end_time) return res.status(400).json({ error: 'class_id, day, start_time, end_time requis' });
    if (start_time >= end_time) return res.status(400).json({ error: 'end_time doit être après start_time' });
    const { rows } = await query('INSERT INTO timetable(class_id,subject_id,teacher_id,day,start_time,end_time)VALUES($1,$2,$3,$4,$5,$6)RETURNING*', [class_id, subject_id||null, teacher_id||null, day, start_time, end_time]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
r1.put('/:id', async (req, res, next) => {
  try {
    const { class_id, subject_id, teacher_id, day, start_time, end_time } = req.body;
    const { rows } = await query('UPDATE timetable SET class_id=COALESCE($1,class_id),subject_id=COALESCE($2,subject_id),teacher_id=COALESCE($3,teacher_id),day=COALESCE($4,day),start_time=COALESCE($5,start_time),end_time=COALESCE($6,end_time),updated_at=NOW()WHERE id=$7 RETURNING*', [class_id,subject_id,teacher_id,day,start_time,end_time,req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Créneau non trouvé' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});
r1.delete('/:id', async (req, res, next) => {
  try { await query('DELETE FROM timetable WHERE id=$1',[req.params.id]); res.json({ message:'Créneau supprimé' }); }
  catch (e) { next(e); }
});
module.exports = r1;
