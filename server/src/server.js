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
const server = http.createServer(app);

// Setup Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Attach io to express app so routes can trigger socket events
app.set('io', io);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request logger
app.use((req, res, next) => {
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ShuttleTrack Core API & Real-time Server',
    version: '1.0.0'
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
      etag: false,
      lastModified: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ShuttleTrack Server running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO Real-time service active on port ${PORT}`);
  console.log(`======================================================\n`);
});
