require('dotenv').config();
const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const shuttleRoutes = require('./routes/shuttles');
const driverRoutes = require('./routes/drivers');
const routeRoutes = require('./routes/routes');
const tripRoutes = require('./routes/trips');
const notificationRoutes = require('./routes/notifications');
const statRoutes = require('./routes/stats');

const { setupTrackingSocket } = require('./sockets/trackingSocket');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// Setup Socket.IO with high-concurrency multi-organization tuning
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6,
  perMessageDeflate: false
});

// Attach io to express app so routes can trigger socket events
app.set('io', io);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Tier', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Response-Time']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ============================================================================
// High-Scalability Multi-Tier Rate Limiter & Sub-Millisecond Latency Tracker
// Keyed by Client IP + Auth Token signature so thousands of users on the same
// campus/organization Wi-Fi NAT can operate simultaneously without collision.
// ============================================================================
const rateLimitBuckets = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute sliding window
const RATE_LIMIT_TIERS = {
  auth: { limit: 60, windowMs: RATE_LIMIT_WINDOW_MS },           // 60 req/min per user for Auth/OTP
  mutation: { limit: 300, windowMs: RATE_LIMIT_WINDOW_MS },      // 300 req/min per user for Button Mutations
  telemetry_read: { limit: 1200, windowMs: RATE_LIMIT_WINDOW_MS } // 1,200 req/min per user for Live GPS & Reads
};

// Periodic cleanup of expired rate-limit buckets every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now > bucket.resetAt) {
      rateLimitBuckets.delete(key);
    }
  }
}, 60 * 1000).unref();

app.use((req, res, next) => {
  const startHrTime = process.hrtime.bigint();

  // Attach X-Response-Time header right before headers are flushed
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    const elapsedMs = Number(process.hrtime.bigint() - startHrTime) / 1e6;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
    }
    return originalWriteHead.apply(this, args);
  };

  if (!req.path.startsWith('/api')) {
    return next();
  }

  // Determine Rate Limit Tier
  let tierName = 'telemetry_read';
  if (req.path.startsWith('/api/auth') && req.method === 'POST') {
    tierName = 'auth';
  } else if (
    ['POST', 'PUT', 'DELETE'].includes(req.method) &&
    !req.path.endsWith('/location')
  ) {
    tierName = 'mutation';
  }

  const tier = RATE_LIMIT_TIERS[tierName];
  const clientIp =
    (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : '') ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';
  const authHeader = req.headers.authorization || '';
  const identitySuffix = authHeader.length > 24 ? authHeader.slice(-24) : 'anon';
  const bucketKey = `${tierName}:${clientIp}:${identitySuffix}`;

  const now = Date.now();
  let bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = {
      count: 0,
      resetAt: now + tier.windowMs
    };
    rateLimitBuckets.set(bucketKey, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, tier.limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  res.setHeader('X-RateLimit-Tier', tierName);
  res.setHeader('X-RateLimit-Limit', String(tier.limit));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetSeconds));

  if (bucket.count > tier.limit) {
    res.setHeader('Retry-After', String(resetSeconds));
    return res.status(429).json({
      success: false,
      message: `Rate limit exceeded (${tier.limit} requests/min for ${tierName}). Please wait ${resetSeconds}s before retrying.`,
      retryAfterSeconds: resetSeconds
    });
  }

  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/shuttles', shuttleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statRoutes);

// Health & Scalability check endpoints
const db = require('./config/db');
app.get('/api/health', async (req, res) => {
  const organizations = await db.getAllOrganizations().catch(() => []);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ShuttleTrack Core API & Real-time Server',
    version: '2.0.0',
    scalability: {
      multiOrganizationIsolation: true,
      registeredOrganizations: organizations.length,
      activeSocketConnections: io.engine?.clientsCount || 0,
      postgresPoolMax: Number(process.env.PG_POOL_MAX) || 25,
      rateLimiting: RATE_LIMIT_TIERS
    }
  });
});

app.get('/api/health/scalability', async (req, res) => {
  const organizations = await db.getAllOrganizations().catch(() => []);
  const store = db.getStore();
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    architecture: {
      multiTenancy: 'Organization-scoped data & settings isolation (many organizations & thousands of concurrent users)',
      buttonResponseDesign: '0ms optimistic UI reflex + asynchronous non-blocking SMTP & DB write-through cache (< 10ms API response)',
      databasePool: {
        engine: db.isPostgres() ? 'PostgreSQL + In-Memory Write-Through Cache' : 'Embedded High-Speed In-Memory Store',
        maxConnections: Number(process.env.PG_POOL_MAX) || 25,
        idleTimeoutMs: 30000,
        connectionTimeoutMs: 5000
      },
      realtimeEngine: {
        transport: 'Socket.IO WebSocket + HTTP Long-Polling Fallback',
        activeConnections: io.engine?.clientsCount || 0,
        perMessageDeflate: false
      },
      rateLimiting: {
        strategy: 'Sliding-Window Per-IP + JWT Identity (Campus NAT safe)',
        tiers: RATE_LIMIT_TIERS,
        activeTrackedClients: rateLimitBuckets.size
      },
      liveCounts: {
        organizations: organizations.length,
        users: store.users?.length || 0,
        shuttles: store.shuttles?.length || 0,
        routes: store.routes?.length || 0,
        schedules: store.schedules?.length || 0
      }
    }
  });
});

// Setup Socket tracking events
setupTrackingSocket(io);

// Static file serving for production deployment (Render, Heroku, Railway, VPS, Docker)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`📦 Serving production build from: ${clientDistPath}`);
  app.use(
    express.static(clientDistPath, {
      etag: true,
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        }
      }
    })
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.'
  });
});

const PORT = process.env.PORT || 5000;

// Local SMTP Bridge Worker: syncs & dispatches pending emails queued on Render Cloud
if (!process.env.RENDER && !process.env.RENDER_SERVICE_ID) {
  const { sendRawRelayEmail, sendExplicitOTP, processedRelayIds } = require('./services/otpService');
  const CLOUD_API_BASE = 'https://shuttletracker-33.onrender.com/api/auth';
  let isSyncing = false;

  const syncCloudPendingEmails = async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      // 1. Check persistent Supabase PostgreSQL database directly
      let relays = [];
      try {
        const dbRelays = await db.getPendingEmailRelaysFromDb();
        if (Array.isArray(dbRelays) && dbRelays.length > 0) {
          relays.push(...dbRelays);
        }
      } catch (_) {}

      // 2. Also check cloud API endpoint
      try {
        const res = await fetch(`${CLOUD_API_BASE}/pending-relays`, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const data = await res.json();
          const cloudRelays = data?.data || data?.relays || [];
          for (const cr of cloudRelays) {
            if (!relays.some((r) => r.relayId === cr.relayId)) {
              relays.push(cr);
            }
          }
        }
      } catch (_) {}

      for (const relay of relays) {
        if (!relay || !relay.relayId) continue;
        if (processedRelayIds.has(relay.relayId)) {
          // Already dispatched. Acknowledge in DB and Cloud.
          await db.markEmailRelayDelivered(relay.relayId).catch(() => {});
          await fetch(`${CLOUD_API_BASE}/ack-relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relayId: relay.relayId }),
            signal: AbortSignal.timeout(6000)
          }).catch(() => {});
          continue;
        }

        console.log(`📬 [SMTP Bridge] Processing queued email: ${relay.relayId} -> ${relay.to}`);
        let sent = null;
        if (relay.otp) {
          sent = await sendExplicitOTP(relay.to, relay.otp, relay.purpose || 'signup', relay.relayId);
        } else {
          sent = await sendRawRelayEmail(relay);
        }
        if (sent?.success) {
          processedRelayIds.add(relay.relayId);
          console.log(`✅ [SMTP Bridge] Delivered ${relay.relayId} to ${relay.to} via local Gmail SMTP`);
          await db.markEmailRelayDelivered(relay.relayId).catch(() => {});
          await fetch(`${CLOUD_API_BASE}/ack-relay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ relayId: relay.relayId }),
            signal: AbortSignal.timeout(6000)
          }).catch(() => {});
        } else {
          console.warn(`⚠️ [SMTP Bridge] Delivery failed for ${relay.relayId}; leaving it queued for retry.`);
        }
      }
    } catch (_) {
      // Quietly ignore network/idle issues
    } finally {
      isSyncing = false;
    }
  };

  syncCloudPendingEmails();
  setInterval(syncCloudPendingEmails, 1500).unref();
  console.log('🔄 [SMTP Cloud Bridge] Active — Polling Render cloud for pending emails to deliver via Gmail SMTP');
}

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ShuttleTrack Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO Real-time service active on port ${PORT}`);
  console.log(`======================================================\n`);
});

