// routes/docconfig.js
'use strict';
const express = require('express');
const { query } = require('../config/database');
const { requirePerm } = require('../middleware/auth');
const r = express.Router();
r.get('/:school_id', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT doc_config FROM schools WHERE id=$1', [req.params.school_id]);
    if (!rows.length) return res.status(404).json({ error: 'École non trouvée' });
    res.json(rows[0].doc_config || {});
  } catch (e) { next(e); }
});
r.put('/:school_id', requirePerm('config_docs'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE schools SET doc_config=$1, updated_at=NOW() WHERE id=$2 RETURNING doc_config',
      [JSON.stringify(req.body), req.params.school_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'École non trouvée' });
    res.json(rows[0].doc_config);
  } catch (e) { next(e); }
});
module.exports = r;
