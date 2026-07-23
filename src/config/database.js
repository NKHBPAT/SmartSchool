'use strict';
const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'smartschool_db',
      user: process.env.DB_USER || 'smartschool_user',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => logger.error('Erreur pool DB:', err));
  }
  return pool;
}

async function connectDB() {
  const p = getPool();
  const client = await p.connect();
  await client.query('SELECT NOW()');
  client.release();
  return p;
}

async function query(sql, params = []) {
  const p = getPool();
  const start = Date.now();
  const result = await p.query(sql, params);
  const dur = Date.now() - start;
  if (dur > 500) logger.warn(`Requête lente (${dur}ms): ${sql.substring(0, 100)}`);
  return result;
}

async function transaction(fn) {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { connectDB, getPool, query, transaction };
