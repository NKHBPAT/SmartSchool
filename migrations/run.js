// migrations/run.js — Exécute les migrations SQL
'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT id FROM _migrations WHERE filename=$1', [file]);
      if (rows.length) { console.log(`⏭  Déjà exécuté: ${file}`); continue; }
      console.log(`▶️  Exécution: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations(filename)VALUES($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ ${file} exécuté`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} échouée: ${e.message}`);
      }
    }
    console.log('\n✅ Toutes les migrations sont à jour');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(e => { console.error('❌', e.message); process.exit(1); });
