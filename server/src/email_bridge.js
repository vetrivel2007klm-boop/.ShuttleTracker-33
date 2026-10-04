/**
 * Standalone 24/7 Resilient Email Bridge Worker
 * - Runs completely independent of web server port (no EADDRINUSE possible)
 * - Polls Supabase PostgreSQL pending_email_relays every 1 second
 * - Dispatches queued cloud OTP and operational emails via Gmail SMTP (cleancodeuniverse@gmail.com)
 * - Auto-reconnects on network disconnects
 */

require('dotenv').config();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres.pydhjrtkvqxzkpvpodod:Vetrivel%4002@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres';
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 30000
});

const DEFAULT_EMAIL_USER = 'cleancodeuniverse@gmail.com';
const DEFAULT_EMAIL_PASS = 'cetikgbausymfhnj';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || DEFAULT_EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD || DEFAULT_EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

const recentSentCache = new Map(); // key -> timestamp

console.log('🚀 [Email Bridge Worker] Started. Polling Supabase for pending emails...');

async function processQueue() {
  try {
    // 1. Fetch oldest pending email
    const queryRes = await pool.query(`
      SELECT relay_id, recipient, subject, payload_json, created_at
      FROM pending_email_relays
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 5
    `);

    if (!queryRes.rows || queryRes.rows.length === 0) return;

    for (const row of queryRes.rows) {
      const { relay_id, recipient, subject, payload_json } = row;

      // Lock row to prevent duplicate processing
      const lockRes = await pool.query(
        `UPDATE pending_email_relays SET status = 'processing' WHERE relay_id = $1 AND status = 'pending'`,
        [relay_id]
      );
      if (lockRes.rowCount === 0) continue; // another worker picked it up

      let payload = {};
      try {
        payload = JSON.parse(payload_json || '{}');
      } catch (_) {}

      console.log(`📬 [Email Bridge] Delivering ${relay_id} to ${recipient}...`);

      const mailOptions = {
        from: `"Shuttle Tracker" <${process.env.EMAIL_USER || DEFAULT_EMAIL_USER}>`,
        to: recipient,
        subject: subject,
        html: payload.htmlContent || `<p>${payload.textContent || 'Your Shuttle Tracker verification code.'}</p>`,
        text: payload.textContent || 'Your Shuttle Tracker verification code.'
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        recentSentCache.set(cacheKey, now);
        console.log(`✅ [Email Bridge] Successfully sent to ${recipient} (${info.messageId})`);

        await pool.query(
          `UPDATE pending_email_relays SET status = 'delivered', delivered_at = NOW() WHERE relay_id = $1`,
          [relay_id]
        );
      } catch (sendErr) {
        console.error(`❌ [Email Bridge] Send error for ${recipient}:`, sendErr.message);
        await pool.query(
          `UPDATE pending_email_relays SET status = 'failed' WHERE relay_id = $1`,
          [relay_id]
        );
      }
    }
  } catch (err) {
    if (!err.message.includes('Connection terminated') && !err.message.includes('timeout')) {
      console.warn('⚠️ [Email Bridge Poll Warning]:', err.message);
    }
  }
}

// Poll every 1 second continuously
setInterval(processQueue, 1000);
processQueue();
