// routes/bulletins.js — Données pour génération de bulletins
'use strict';
const express = require('express');
const { query } = require('../config/database');
const { requirePerm } = require('../middleware/auth');
const r = express.Router();

// GET /api/bulletins/data?class_id=&type=seq|term|annual&period=1
// Retourne toutes les données nécessaires pour générer les bulletins
r.get('/data', requirePerm('print_bulletins'), async (req, res, next) => {
  try {
    const { class_id, type, period } = req.query;
    if (!class_id) return res.status(400).json({ error: 'class_id requis' });

    const [{ rows: students }, { rows: subjects }, { rows: grades }, { rows: classInfo }] = await Promise.all([
      query('SELECT * FROM students WHERE class_id=$1 AND is_active=true ORDER BY name', [class_id]),
      query('SELECT s.*, u.name as teacher_name FROM subjects s LEFT JOIN users u ON s.teacher_id=u.id WHERE s.class_id=$1', [class_id]),
      query('SELECT g.* FROM grades g JOIN subjects s ON g.subject_id=s.id WHERE s.class_id=$1', [class_id]),
      query('SELECT c.*, sc.name as school_name, sc.type as school_type, sc.subsystem, sc.city, sc.region, sc.logo_url, sc.doc_config, u.name as principal_name, u2.name as class_teacher_name FROM classes c LEFT JOIN schools sc ON c.school_id=sc.id LEFT JOIN users u ON sc.principal_id=u.id LEFT JOIN users u2 ON c.teacher_id=u2.id WHERE c.id=$1', [class_id])
    ]);

    // Get absences
    const seqs = type === 'seq' ? [period] : type === 'term' ? ({'1':['1','2'],'2':['3','4'],'3':['5','6']}[period]||[]) : ['1','2','3','4','5','6'];
    const { rows: absences } = await query(
      'SELECT * FROM absences WHERE student_id = ANY($1::uuid[]) AND seq = ANY($2::text[])',
      [students.map(s => s.id), seqs]
    );

    res.json({ students, subjects, grades, absences, classInfo: classInfo[0] || null, requestedType: type, requestedPeriod: period });
  } catch (e) { next(e); }
});
module.exports = r;
