'use strict';
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${err.name || 'Error'}: ${err.message}`, {
    path: req.path, method: req.method,
    user: req.user?.id, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ error: 'Cet enregistrement existe déjà', detail: err.detail });
  }
  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ error: 'Référence invalide', detail: err.detail });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Données invalides', details: err.details });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500
      ? 'Erreur interne du serveur'
      : err.message || 'Erreur interne',
  });
}

module.exports = errorHandler;
