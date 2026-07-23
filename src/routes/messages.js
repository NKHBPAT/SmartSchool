// routes/messages.js
'use strict';
const express = require('express');
const { query } = require('../config/database');
const r = express.Router();
r.get('/', async (req, res, next) => {
  try {
    const box = req.query.box || 'inbox';
    const col = box === 'sent' ? 'from_user_id' : 'to_user_id';
    const { rows } = await query(
      `SELECT m.*, uf.name as from_name, ut.name as to_name FROM messages m
       LEFT JOIN users uf ON m.from_user_id=uf.id LEFT JOIN users ut ON m.to_user_id=ut.id
       WHERE m.${col}=$1 ORDER BY m.created_at DESC`, [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});
r.post('/', async (req, res, next) => {
  try {
    const { to_user_id, subject, body } = req.body;
    if (!to_user_id || !subject || !body) return res.status(400).json({ error: 'Destinataire, objet et corps requis' });
    const school_id = req.user.school_id || null;
    const { rows } = await query(
      'INSERT INTO messages(from_user_id,to_user_id,subject,body,school_id)VALUES($1,$2,$3,$4,$5)RETURNING*',
      [req.user.id, to_user_id, subject.substring(0,200), body.substring(0,2000), school_id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});
r.patch('/:id/read', async (req, res, next) => {
  try {
    await query('UPDATE messages SET is_read=true WHERE id=$1 AND to_user_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Lu' });
  } catch (e) { next(e); }
});
r.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM messages WHERE id=$1 AND (from_user_id=$2 OR to_user_id=$2)', [req.params.id, req.user.id]);
    res.json({ message: 'Supprimé' });
  } catch (e) { next(e); }
});
module.exports = r;
