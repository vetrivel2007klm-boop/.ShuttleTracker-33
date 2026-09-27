# 🚌 ShuttleTrack — Institutional Shuttle Tracking & Fleet Management Platform

A modern, production-grade institutional/campus shuttle tracking platform built with **React.js, Vite, Tailwind CSS, Node.js, Express, PostgreSQL + PostGIS, Socket.IO, Google Maps API, and Leaflet GIS mapping**.

---

## 🌟 Key Features

1. **Dual-Engine Real-Time GIS Mapping**:
   - **Official Google Maps JavaScript API**: Real-time interactive map, custom SVG shuttle markers with directional heading and live pulsing status halos, route polylines connecting campus stops, custom InfoWindows, live Google traffic conditions (`TrafficLayer`), and Satellite/Roadmap switcher.
   - **Vector Transit Mode (Leaflet + CartoDB)**: Ultra-fast fallback and offline-friendly vector map that works seamlessly without requiring billing keys.
   - **Map Provider Toggle**: Pinned switcher on top of every map view (`[ 🗺️ Google Maps | ⚡ Vector Transit ]`).
2. **3-Role Dynamic Authentication System**:
   - **Admin**: Fleet control, live radar, driver roster, route sequence manager, timetables, real-time broadcast alerts.
   - **Passenger / Student**: Prioritized live map, real-time ETA engine, interactive sequential stop timeline, arrival notifications.
   - **Driver Cockpit**: Mobile-optimized, glancable cockpit with large **START TRIP / END TRIP** controls, browser GPS tracking (`navigator.geolocation.watchPosition`), delay reporting, and realistic GPS route simulation.
3. **Sub-Second Real-Time Telemetry**:
   - WebSockets powered by **Socket.IO** with room channels (`shuttle_${id}`, `admin_room`).
   - Marker updates position smoothly (`marker.setPosition({ lat, lng })`) without reloading the map!
4. **Adaptive Database Architecture**:
   - Full **PostgreSQL + PostGIS** schema (`schema.sql`) and seed script (`seeds.sql`).
   - Resilient embedded fallback with pre-seeded data so you can test immediately with zero initial database setup.
5. **Production Deployment Ready**:
   - Integrated single-port full-stack serving (`server.js` hosts `client/dist`).
   - Dynamic IP & origin detection (works locally, across local Wi-Fi LAN on smartphones, and in cloud environments like Render, Railway, Vercel, Heroku, Docker).

---

## 🚀 Quick Start Guide

### 1. Installation

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..

# Install server dependencies
cd server
npm install
cd ..
```

---

### 2. Environment Variables

Create `.env` in `server/.env`:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=shuttletrack-super-secret-production-key-2026

# Optional: PostgreSQL + PostGIS configuration (if omitted, operates in resilient embedded mode)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shuttletrack
```

In `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000

# Optional: Google Maps API Key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```
*(You can also set your Google Maps API Key directly from the UI using the "Set API Key" button on any map!)*

---

### 3. Running Locally

#### Development Mode (with Hot Reloading):
```bash
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:5000
```

#### Production Mode (Single Port 5000):
```bash
npm run client:build
npm run server:start
# Open http://localhost:5000
```

---

## ☁️ Production Deployment Guide

### Deploy to Render / Railway / Heroku / VPS:
1. **Build Command**:
   ```bash
   npm install && npm --prefix client install && npm --prefix client run build && npm --prefix server install
   ```
2. **Start Command**:
   ```bash
   node server/src/server.js
   ```
3. **Environment Variables on Cloud Host**:
   - `NODE_ENV=production`
   - `PORT=5000` (or provided by host dynamically)
   - `JWT_SECRET=your_production_secret`
   - `VITE_GOOGLE_MAPS_API_KEY=your_key` (optional)
   - `DATABASE_URL=postgresql://...` (optional)

### Docker Deployment:
```bash
docker build -t shuttletrack .
docker run -p 5000:5000 shuttletrack
```

---

## 🔑 Demo Login Credentials

| Role | Email | Password | Direct Dashboard |
| :--- | :--- | :--- | :--- |
| **👨‍💼 Admin** | `admin@shuttletrack.com` | `password123` | `/admin/dashboard` |
| **👤 Passenger** | `passenger@shuttletrack.com` | `password123` | `/user/dashboard` |
| **🚌 Driver** | `driver.john@shuttletrack.com` | `password123` | `/driver/dashboard` |
