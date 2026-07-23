// routes/upload.js — Upload logos et photos élèves
'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const r = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
['logos','photos'].forEach(d => {
  const p = path.join(uploadDir, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'photos';
    cb(null, path.join(uploadDir, type === 'logo' ? 'logos' : 'photos'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '5') * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez JPEG, PNG ou WebP.'));
  }
});

// POST /api/upload/logo/:school_id
r.post('/logo/:school_id', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const url = `/uploads/logos/${req.file.filename}`;
    await query('UPDATE schools SET logo_url=$1, updated_at=NOW() WHERE id=$2', [url, req.params.school_id]);
    res.json({ url, message: 'Logo enregistré' });
  } catch (e) { next(e); }
});

// POST /api/upload/photo/:student_id
r.post('/photo/:student_id', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier requis' });
    const url = `/uploads/photos/${req.file.filename}`;
    await query('UPDATE students SET photo_url=$1, updated_at=NOW() WHERE id=$2', [url, req.params.student_id]);
    res.json({ url, message: 'Photo enregistrée' });
  } catch (e) { next(e); }
});

module.exports = r;
