// routes/sms.js — Notifications SMS (simulation + intégration réelle)
'use strict';
const express = require('express');
const { query } = require('../config/database');
const { requirePerm } = require('../middleware/auth');
const logger = require('../utils/logger');
const r = express.Router();

// Providers SMS
async function sendOrangeSMS(to, message) {
  if (!process.env.ORANGE_SMS_ENABLED === 'true' || !process.env.ORANGE_SMS_TOKEN) {
    return { status: 'simulated', provider: 'orange' };
  }
  try {
    const axios = require('axios');
    const resp = await axios.post(
      `${process.env.ORANGE_SMS_API_URL}/outbound/${encodeURIComponent(process.env.ORANGE_SMS_FROM)}/requests`,
      { outboundSMSMessageRequest: {
          address: `tel:+237${to.replace(/\D/g,'')}`,
          senderAddress: `tel:${process.env.ORANGE_SMS_FROM}`,
          outboundSMSTextMessage: { message }
      }},
      { headers: { Authorization: `Bearer ${process.env.ORANGE_SMS_TOKEN}`, 'Content-Type':'application/json' }, timeout: 10000 }
    );
    return { status: 'sent', provider: 'orange', ref: resp.data?.outboundSMSMessageRequest?.deliveryInfoList?.deliveryInfo?.[0]?.address };
  } catch (e) {
    logger.error('Orange SMS error:', e.message);
    return { status: 'failed', provider: 'orange', error: e.message };
  }
}

async function sendTwilioSMS(to, message) {
  if (!process.env.TWILIO_ENABLED === 'true' || !process.env.TWILIO_ACCOUNT_SID) {
    return { status: 'simulated', provider: 'twilio' };
  }
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM,
      to: `+237${to.replace(/\D/g,'')}`
    });
    return { status: 'sent', provider: 'twilio', sid: msg.sid };
  } catch (e) {
    logger.error('Twilio SMS error:', e.message);
    return { status: 'failed', provider: 'twilio', error: e.message };
  }
}

async function sendSMS(to, message) {
  if (process.env.ORANGE_SMS_ENABLED === 'true') return sendOrangeSMS(to, message);
  if (process.env.TWILIO_ENABLED === 'true') return sendTwilioSMS(to, message);
  logger.info(`[SMS SIMULÉ] À: ${to} | Message: ${message.substring(0,60)}...`);
  return { status: 'simulated', provider: 'none' };
}

// GET /api/sms — historique
r.get('/', requirePerm('send_sms'), async (req, res, next) => {
  try {
    const sid = req.user.school_id || req.query.school_id;
    let sql = `SELECT sl.*, st.name, st.first_name, u.name as parent_name
               FROM sms_logs sl LEFT JOIN students st ON sl.student_id=st.id
               LEFT JOIN users u ON sl.to_parent_id=u.id WHERE true`;
    const p = [];
    if (sid && req.user.role !== 'admin') { sql += ` AND sl.school_id=$${p.length+1}`; p.push(sid); }
    sql += ' ORDER BY sl.sent_at DESC LIMIT 200';
    const { rows } = await query(sql, p);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/sms/send — envoyer SMS
r.post('/send', requirePerm('send_sms'), async (req, res, next) => {
  try {
    const { recipients, message, school_id } = req.body;
    // recipients = [{student_id, parent_id, phone, name}]
    if (!recipients?.length || !message) return res.status(400).json({ error: 'recipients[] et message requis' });
    const sid = req.user.role !== 'admin' ? req.user.school_id : school_id;
    let sent = 0, failed = 0;
    const results = [];
    for (const rec of recipients) {
      if (!rec.phone) { failed++; continue; }
      const result = await sendSMS(rec.phone, message.replace('{nom}', rec.name||'').replace('{ecole}', rec.school||''));
      const status = result.status === 'sent' ? 'sent' : result.status === 'simulated' ? 'simulated' : 'failed';
      if (status !== 'failed') sent++; else failed++;
      await query(
        'INSERT INTO sms_logs(from_user_id,to_parent_id,student_id,message,status,school_id)VALUES($1,$2,$3,$4,$5,$6)',
        [req.user.id, rec.parent_id||null, rec.student_id||null, message.substring(0,500), status, sid]
      );
      results.push({ ...rec, status });
    }
    res.json({ sent, failed, total: recipients.length, results });
  } catch (e) { next(e); }
});

module.exports = r;
