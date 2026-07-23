'use strict';
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { get, setEx } = require('../config/redis');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }
    const token = authHeader.split(' ')[1];
    // Check token blacklist (logout)
    const blacklisted = await get(`blacklist:${token}`);
    if (blacklisted) return res.status(401).json({ error: 'Token révoqué' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Load fresh user data from DB
    const { rows } = await query(
      'SELECT id, name, email, role, school_id, permissions, child_ids, valid_year FROM users WHERE id = $1 AND is_active = true',
      [payload.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    const user = rows[0];
    if (user.valid_year && user.valid_year < new Date().getFullYear()) {
      return res.status(401).json({ error: 'Accès expiré. Contactez l\'administrateur.' });
    }
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expiré' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Token invalide' });
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (req.user.role === 'admin') return next(); // admin can do everything
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permission refusée' });
    }
    next();
  };
}

function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (req.user.role === 'admin') return next();
    const perms = req.user.permissions || {};
    if (!perms[perm]) return res.status(403).json({ error: `Permission requise: ${perm}` });
    next();
  };
}

function sameSchool(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
  if (req.user.role === 'admin') return next();
  // Attach school filter to request
  req.schoolId = req.user.school_id;
  next();
}

module.exports = { authMiddleware, requireRole, requirePerm, sameSchool };
