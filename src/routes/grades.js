// ============================================================
// routes/grades.js — Saisie et consultation des notes
// ============================================================
'use strict';
const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { requirePerm } = require('../middleware/auth');

// GET /api/grades?class_id=&seq=&student_id=
router.get('/', async (req, res, next) => {
  try {
    const { class_id, seq, student_id, subject_id } = req.query;
    let sql = `SELECT g.*, s.name as subject_name, s.coef,
               st.name as student_name, st.first_name as student_first_name
               FROM grades g
               JOIN subjects s ON g.subject_id = s.id
               JOIN students st ON g.student_id = st.id
               WHERE true`;
    const params = [];
    if (class_id) { sql += ` AND s.class_id = $${params.length+1}`; params.push(class_id); }
    if (seq) { sql += ` AND g.seq = $${params.length+1}`; params.push(seq); }
    if (student_id) { sql += ` AND g.student_id = $${params.length+1}`; params.push(student_id); }
    if (subject_id) { sql += ` AND g.subject_id = $${params.length+1}`; params.push(subject_id); }
    sql += ' ORDER BY st.name, s.name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/grades — saisir une note
router.post('/', requirePerm('enter_grades'), async (req, res, next) => {
  try {
    const { student_id, subject_id, seq, value } = req.body;
    if (!student_id || !subject_id || !seq || value === undefined) {
      return res.status(400).json({ error: 'student_id, subject_id, seq et value requis' });
    }
    if (value < 0 || value > 20) return res.status(400).json({ error: 'Note entre 0 et 20' });
    // Upsert
    const { rows } = await query(
      `INSERT INTO grades (student_id, subject_id, seq, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (student_id, subject_id, seq)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING *`,
      [student_id, subject_id, seq, parseFloat(value)]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// POST /api/grades/bulk — saisie en lot pour toute une classe/séquence
router.post('/bulk', requirePerm('enter_grades'), async (req, res, next) => {
  try {
    const { grades } = req.body; // [{student_id, subject_id, seq, value}, ...]
    if (!Array.isArray(grades) || !grades.length) return res.status(400).json({ error: 'grades[] requis' });
    const inserted = await transaction(async (client) => {
      const results = [];
      for (const g of grades) {
        if (g.value === null || g.value === undefined) {
          await client.query('DELETE FROM grades WHERE student_id=$1 AND subject_id=$2 AND seq=$3', [g.student_id, g.subject_id, g.seq]);
        } else {
          const { rows } = await client.query(
            `INSERT INTO grades (student_id, subject_id, seq, value)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (student_id, subject_id, seq)
             DO UPDATE SET value=EXCLUDED.value, updated_at=NOW() RETURNING *`,
            [g.student_id, g.subject_id, g.seq, parseFloat(g.value)]
          );
          results.push(rows[0]);
        }
      }
      return results;
    });
    res.json({ inserted: inserted.length, grades: inserted });
  } catch (err) { next(err); }
});

// DELETE /api/grades/:id
router.delete('/:id', requirePerm('edit_grades'), async (req, res, next) => {
  try {
    await query('DELETE FROM grades WHERE id=$1', [req.params.id]);
    res.json({ message: 'Note supprimée' });
  } catch (err) { next(err); }
});

// GET /api/grades/ranking?class_id=&type=seq|term|annual&period=
router.get('/ranking', async (req, res, next) => {
  try {
    const { class_id, type, period } = req.query;
    if (!class_id) return res.status(400).json({ error: 'class_id requis' });
    // Load all grades for the class
    const { rows: subjects } = await query('SELECT * FROM subjects WHERE class_id=$1', [class_id]);
    const { rows: students } = await query('SELECT * FROM students WHERE class_id=$1 AND is_active=true ORDER BY name', [class_id]);
    const { rows: grades } = await query(
      'SELECT g.* FROM grades g JOIN subjects s ON g.subject_id=s.id WHERE s.class_id=$1', [class_id]
    );

    const getSeqAvg = (stId, seq) => {
      let pts = 0, coef = 0;
      subjects.forEach(s => {
        const g = grades.find(g => g.student_id === stId && g.subject_id === s.id && g.seq === seq);
        if (g) { pts += g.value * s.coef; coef += s.coef; }
      });
      return coef ? pts / coef : null;
    };
    const TERM_SEQS = { '1':['1','2'], '2':['3','4'], '3':['5','6'] };
    const getTermAvg = (stId, term) => {
      const seqs = TERM_SEQS[term] || [];
      const avgs = seqs.map(s => getSeqAvg(stId, s)).filter(a => a !== null);
      return avgs.length ? avgs.reduce((s,a) => s+a, 0) / avgs.length : null;
    };
    const getAnnualAvg = stId => {
      const avgs = ['1','2','3'].map(t => getTermAvg(stId, t)).filter(a => a !== null);
      return avgs.length ? avgs.reduce((s,a) => s+a, 0) / avgs.length : null;
    };

    let getAvg;
    if (type === 'seq') getAvg = stId => getSeqAvg(stId, period);
    else if (type === 'term') getAvg = stId => getTermAvg(stId, period);
    else getAvg = stId => getAnnualAvg(stId);

    const ranking = students
      .map(st => ({ ...st, avg: getAvg(st.id) }))
      .filter(s => s.avg !== null)
      .sort((a, b) => b.avg - a.avg)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    res.json(ranking);
  } catch (err) { next(err); }
});

module.exports = router;
