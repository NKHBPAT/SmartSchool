'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { rateLimit } = require('express-rate-limit');
const { query } = require('../config/database');
const { setEx, incr, get, del } = require('../config/redis');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  message: { error: 'Trop de tentatives de connexion. Attendez 15 minutes.' },
  keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
});

// POST /api/auth/login
router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 1, max: 200 }).withMessage('Mot de passe requis'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;

    // Check IP/email lockout
    const lockKey = `lockout:${email.toLowerCase()}`;
    const failKey = `fails:${email.toLowerCase()}`;
    const locked = await get(lockKey);
    if (locked) {
      const ttl = await incr(lockKey + ':ttl') || 60;
      return res.status(429).json({ error: `Compte verrouillé. Réessayez dans ${ttl} secondes.` });
    }

    const { rows } = await query(
      'SELECT id, name, email, password_hash, role, school_id, permissions, child_ids, valid_year, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = rows[0];
    const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;

    if (!user || !validPassword || !user.is_active) {
      // Track failures
      const fails = await incr(failKey);
      if (fails === 1) await setEx(failKey, 900, fails);
      if (parseInt(fails) >= 5) {
        await setEx(lockKey, 60, '1');
        logger.warn(`Compte verrouillé après ${fails} échecs: ${email}`);
      }
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (user.valid_year && user.valid_year < new Date().getFullYear()) {
      return res.status(403).json({ error: 'Accès expiré. Contactez l\'administrateur.' });
    }

    // Clear failures
    await del(failKey);

    const tokenPayload = { userId: user.id, role: user.role, schoolId: user.school_id };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    const refreshToken = jwt.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });

    // Cache token in Redis for session tracking
    await setEx(`session:${user.id}:${token.slice(-16)}`, 28800, { userId: user.id, role: user.role });

    logger.info(`Connexion réussie: ${user.email} [${user.role}]`);
    res.json({
      token,
      refreshToken,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, schoolId: user.school_id,
        permissions: user.permissions || {},
        childIds: user.child_ids || [],
        validYear: user.valid_year,
      }
    });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    // Blacklist current token until expiry
    await setEx(`blacklist:${req.token}`, 28800, '1');
    logger.info(`Déconnexion: ${req.user.email}`);
    res.json({ message: 'Déconnecté avec succès' });
  } catch (err) { next(err); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token manquant' });
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const { rows } = await query('SELECT id, role, school_id FROM users WHERE id = $1 AND is_active = true', [payload.userId]);
    if (!rows.length) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    const user = rows[0];
    const newToken = jwt.sign({ userId: user.id, role: user.role, schoolId: user.school_id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token: newToken });
  } catch (err) {
    if (err.name?.includes('Token')) return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }).withMessage('Min 6 caractères'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { currentPassword, newPassword } = req.body;
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) { next(err); }
});

module.exports = router;
