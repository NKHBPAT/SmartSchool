// routes/synthesis.js
'use strict';
const express = require('express');
const { query } = require('../config/database');
const { requirePerm } = require('../middleware/auth');
const r = express.Router();

// GET /api/synthesis/school?school_id=
r.get('/school', requirePerm('view_synthesis'), async (req, res, next) => {
  try {
    const sid = req.user.role !== 'admin' ? req.user.school_id : (req.query.school_id || req.user.school_id);
    if (!sid) return res.status(400).json({ error: 'school_id requis' });
    const { rows: classes } = await query('SELECT * FROM classes WHERE school_id=$1 ORDER BY name', [sid]);
    const results = [];
    for (const cls of classes) {
      const { rows: students } = await query('SELECT id FROM students WHERE class_id=$1 AND is_active=true', [cls.id]);
      const { rows: subjects } = await query('SELECT id, coef FROM subjects WHERE class_id=$1', [cls.id]);
      const { rows: grades } = await query('SELECT g.* FROM grades g JOIN subjects s ON g.subject_id=s.id WHERE s.class_id=$1', [cls.id]);
      results.push({ class: cls, studentCount: students.length, subjectCount: subjects.length, gradeCount: grades.length });
    }
    res.json({ schoolId: sid, classes: results });
  } catch (e) { next(e); }
});
module.exports = r;
