// ============================================================
// routes/users.js
// ============================================================
'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { requireRole, sameSchool } = require('../middleware/auth');

router.get('/', sameSchool, async (req, res, next) => {
  try {
    let sql = `SELECT id, name, email, role, school_id, phone, access_code, valid_year, permissions, child_ids, created_at
               FROM users WHERE is_active = true`;
    const params = [];
    if (req.schoolId) { sql += ' AND school_id = $1'; params.push(req.schoolId); }
    if (req.query.role) { sql += ` AND role = $${params.length + 1}`; params.push(req.query.role); }
    sql += ' ORDER BY name';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', sameSchool, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, school_id, phone, access_code, valid_year, permissions, child_ids FROM users WHERE id=$1 AND is_active=true',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.post('/', requireRole('admin', 'principal', 'secretary'), async (req, res, next) => {
  try {
    const { name, email, password, role, school_id, phone, access_code, valid_year, permissions, child_ids } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nom, email et mot de passe requis' });
    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const schoolId = req.user.role !== 'admin' ? req.user.school_id : school_id;
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role, school_id, phone, access_code, valid_year, permissions, child_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name, email, role, school_id`,
      [name, email.toLowerCase(), hash, role || 'teacher', schoolId, phone, access_code, valid_year || new Date().getFullYear() + 1, JSON.stringify(permissions || {}), child_ids || []]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});
router.put('/:id', requireRole('admin', 'principal', 'secretary'), async (req, res, next) => {
  try {
    const { name, email, password, role, school_id, phone, access_code, valid_year, permissions, child_ids } = req.body;
    let hash = undefined;
    if (password) hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const { rows } = await query(
      `UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email),
       ${hash ? 'password_hash=$3,' : ''} role=COALESCE($${hash?4:3},role),
       school_id=COALESCE($${hash?5:4},school_id),
       phone=COALESCE($${hash?6:5},phone), access_code=COALESCE($${hash?7:6},access_code),
       valid_year=COALESCE($${hash?8:7},valid_year), permissions=COALESCE($${hash?9:8},permissions),
       child_ids=COALESCE($${hash?10:9},child_ids), updated_at=NOW()
       WHERE id=$${hash?11:10} AND is_active=true RETURNING id, name, email, role, school_id`,
      hash
        ? [name, email?.toLowerCase(), hash, role, school_id, phone, access_code, valid_year, JSON.stringify(permissions), child_ids, req.params.id]
        : [name, email?.toLowerCase(), role, school_id, phone, access_code, valid_year, JSON.stringify(permissions), child_ids, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await query('UPDATE users SET is_active=false, updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ message: 'Utilisateur désactivé' });
  } catch (err) { next(err); }
});

// POST /api/users/:id/reset-password — Admin only
router.post('/:id/reset-password', requireRole('admin', 'principal'), async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Mot de passe trop court' });
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.params.id]);
    res.json({ message: 'Mot de passe réinitialisé' });
  } catch (err) { next(err); }
});

module.exports = router;
