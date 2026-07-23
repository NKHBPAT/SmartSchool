'use strict';
const { createClient } = require('redis');
const logger = require('../utils/logger');

let client;

async function connectRedis() {
  client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) }
  });
  client.on('error', err => logger.warn('Redis warning:', err.message));
  client.on('connect', () => logger.info('Redis connecté'));
  await client.connect();
  return client;
}

function getRedis() { return client; }

async function setEx(key, seconds, value) {
  if (!client?.isReady) return;
  await client.setEx(key, seconds, typeof value === 'object' ? JSON.stringify(value) : String(value));
}

async function get(key) {
  if (!client?.isReady) return null;
  const val = await client.get(key);
  try { return JSON.parse(val); } catch { return val; }
}

async function del(key) {
  if (!client?.isReady) return;
  await client.del(key);
}

async function incr(key) {
  if (!client?.isReady) return 1;
  return await client.incr(key);
}

module.exports = { connectRedis, getRedis, setEx, get, del, incr };
