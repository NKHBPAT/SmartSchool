'use strict';
console.log("🟢 SERVER.JS CHARGÉ");
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

const app = express();

// ── Security headers ──────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
    }
  }
}));

// ── CORS ──────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_WWW,
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Parsers ───────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: msg => logger.info(msg.trim()) }
  }));
}

// ── Global rate limit ─────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' }
});
app.use('/api/', globalLimiter);

// ── Static uploads ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '6.0.0', env: process.env.NODE_ENV, ts: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.get('/api/public/school/:code', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT name, logo_url FROM schools WHERE UPPER(code) = UPPER($1) LIMIT 1',
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ error: 'École introuvable' });
    res.json({ name: rows[0].name, logo: rows[0].logo_url });
  } catch (e) { next(e); }
});
app.use('/api/schools',    authMiddleware, require('./routes/schools'));
app.use('/api/users',      authMiddleware, require('./routes/users'));
app.use('/api/classes',    authMiddleware, require('./routes/classes'));
app.use('/api/students',   authMiddleware, require('./routes/students'));
app.use('/api/subjects',   authMiddleware, require('./routes/subjects'));
app.use('/api/grades',     authMiddleware, require('./routes/grades'));
app.use('/api/timetable',  authMiddleware, require('./routes/timetable'));
app.use('/api/absences',   authMiddleware, require('./routes/absences'));
app.use('/api/bulletins',  authMiddleware, require('./routes/bulletins'));
app.use('/api/synthesis',  authMiddleware, require('./routes/synthesis'));
app.use('/api/messages',   authMiddleware, require('./routes/messages'));
app.use('/api/passes',     authMiddleware, require('./routes/passes'));
app.use('/api/progression',authMiddleware, require('./routes/progression'));
app.use('/api/sms',        authMiddleware, require('./routes/sms'));
app.use('/api/docs',       authMiddleware, require('./routes/docconfig'));
app.use('/api/upload',     authMiddleware, require('./routes/upload'));

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route non trouvée', path: req.path }));

// ── Error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3000;

async function start() {
  console.log("🟡 FONCTION START APPELÉE");

  try {
    await connectDB();
    console.log('✅ Base de données connectée');

    //await connectRedis();
    //console.log('✅ Redis connecté');

    app.listen(PORT, () => {
      console.log(`🚀 SmartSchool API démarrée sur le port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Erreur démarrage:', err);
    process.exit(1);
  }
}

if (require.main === module) start();
module.exports = app;
