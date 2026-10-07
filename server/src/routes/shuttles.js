const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const { sendDriverCredentialsEmail } = require('../services/otpService');
const {
  startAutonomousShuttle,
  processDriverLocationUpdate,
  getLiveTelemetry,
  getAllLiveTelemetry
} = require('../sockets/trackingSocket');

// GET /api/shuttles/live-telemetry - Fast API endpoint for instant memory-cached live locations (< 1ms)
router.get('/live-telemetry', async (req, res) => {
  try {
    const liveMap = getAllLiveTelemetry();
    res.json({ success: true, data: liveMap });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve live telemetry.' });
  }
});

// GET /api/shuttles - List all shuttles (optionally scoped by ?organization_name= or active user's organization)
router.get('/', optionalAuthenticate, async (req, res) => {
  try {
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    const shuttles = await db.getAllShuttles(orgName);
    res.json({ success: true, count: shuttles.length, data: shuttles });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve shuttles.' });
  }
});

// GET /api/shuttles/:id/live-telemetry - Fast API endpoint for single shuttle live telemetry (< 1ms)
router.get('/:id/live-telemetry', async (req, res) => {
  try {
    const sId = Number(req.params.id);
    const telemetry = getLiveTelemetry(sId);
    if (!telemetry) {
      return res.status(404).json({ success: false, message: 'No live telemetry found for this shuttle.' });
    }
    res.json({ success: true, data: telemetry });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve live telemetry.' });
  }
});

// POST /api/shuttles/:id/telemetry - Fast API ingestion endpoint for second-by-second driver hardware GPS
router.post('/:id/telemetry', async (req, res) => {
  try {
    const io = req.app.get('io');
    const sId = Number(req.params.id || req.body?.shuttleId || req.body?.shuttle_id);
    const result = await processDriverLocationUpdate(io, {
      ...req.body,
      shuttleId: sId
    });
    if (!result) {
      return res.status(400).json({ success: false, message: 'Invalid GPS coordinates or inactive shuttle.' });
    }
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to ingest telemetry.' });
  }
});

// GET /api/shuttles/:id - Single shuttle with route details and registered passengers
router.get('/:id', optionalAuthenticate, async (req, res) => {
  try {
    const shuttle = await db.getShuttleById(req.params.id);
    if (!shuttle) {
      return res.status(404).json({ success: false, message: 'Shuttle not found.' });
    }
    const passengers = await db.getPassengersByBus(shuttle.code, shuttle.organization_name);
    res.json({ success: true, data: { ...shuttle, passengers } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve shuttle details.' });
  }
});

// POST /api/shuttles - Admin create shuttle (+ auto-create Route + auto-create Driver + email password)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      vehicle_number,
      code,
      capacity,
      current_route_id,
      current_driver_id,
      status,
      start_point,
      destination,
      route_name,
      landmark,
      driver_name,
      driver_email,
      driver_experience,
      driver_phone,
      driver_license,
      organization_name
    } = req.body;

    const orgName = organization_name || req.user?.organization_name || null;
    const resolvedCode = (code || `S0${db.getStore().shuttles.length + 1}`).trim().toUpperCase();
    const resolvedName = (name || `Shuttle ${resolvedCode}`).trim();

    if (!vehicle_number) {
      return res.status(400).json({ success: false, message: 'Bus Plate Number is required.' });
    }

    let resolvedRouteId = current_route_id ? Number(current_route_id) : null;
    let resolvedDriverUserId = current_driver_id ? Number(current_driver_id) : null;
    let createdRoute = null;
    let createdDriver = null;
    let generatedPassword = null;

    // 1. If starting point and destination are provided, create or resolve a real geocoded route
    if (start_point && destination) {
      createdRoute = await db.createRoute({
        code: `RT-${resolvedCode.replace(/[^0-9A-Z]/gi, '')}`,
        name: route_name || `${start_point.trim()} - ${destination.trim()} Express`,
        start_point: start_point.trim(),
        end_point: destination.trim(),
        landmark: landmark || `${start_point.trim()} Transit Corridor`,
        description: `Direct transit route connecting ${start_point.trim()} and ${destination.trim()}`,
        organization_name: orgName
      });
      resolvedRouteId = createdRoute.id;
    }

    // 2. Optional: If Driver Name & Driver Email are provided, auto-generate password, create Driver account, and email credentials
    if (driver_name && driver_email) {
      generatedPassword = `Shuttle@${Math.floor(1000 + Math.random() * 9000)}`;
      createdDriver = await db.createDriver({
        name: driver_name.trim(),
        email: driver_email.trim().toLowerCase(),
        password: generatedPassword,
        experience_years: Number(driver_experience) || 3,
        phone: driver_phone || '+91 98765 43210',
        license_number: driver_license || `DL-${Math.floor(1000000 + Math.random() * 9000000)}`,
        status: status === 'inactive' ? 'inactive' : 'on_duty',
        organization_name: orgName
      });
      resolvedDriverUserId = createdDriver.user_id;
    }

    // 3. Create the Shuttle with real geocoded start_point & destination (status defaults to 'idle' until Driver presses Start Trip)
    const newShuttle = await db.createShuttle({
      name: resolvedName,
      vehicle_number: vehicle_number.trim(),
      code: resolvedCode,
      capacity: Number(capacity) || 36,
      start_point: start_point ? start_point.trim() : '',
      destination: destination ? destination.trim() : '',
      current_route_id: resolvedRouteId,
      current_driver_id: resolvedDriverUserId,
      status: 'idle',
      organization_name: orgName
    });

    // 4. Link shuttle_id back to createdDriver and createdRoute
    if (createdDriver) {
      await db.updateDriver(createdDriver.id, { assigned_shuttle_id: newShuttle.id });
    }
    if (createdRoute) {
      await db.updateRoute(createdRoute.id, { shuttle_id: newShuttle.id });
    }

    // 5. Broadcast shuttle creation (DO NOT auto-start trip until Driver presses Start Trip!)
    const io = req.app.get('io');
    const enrichedShuttle = await db.getShuttleById(newShuttle.id);
    if (io && enrichedShuttle) {
      io.emit('shuttle:updated', enrichedShuttle);
    }

    // 6. Automatically send email to Driver with their auto-generated password if driver was included
    let emailDelivery = null;
    if (driver_email && generatedPassword) {
      emailDelivery = await sendDriverCredentialsEmail({
        email: driver_email.trim(),
        name: driver_name.trim(),
        password: generatedPassword,
        shuttleCode: newShuttle.code,
        shuttleName: newShuttle.name,
        vehicleNumber: newShuttle.vehicle_number,
        startPoint: newShuttle.start_point,
        destination: newShuttle.destination,
        routeName: createdRoute ? createdRoute.name : route_name || `${newShuttle.start_point} ➔ ${newShuttle.destination}`
      });
    }

    res.status(201).json({
      success: true,
      message: generatedPassword
        ? `Shuttle ${newShuttle.code} created and login password (${generatedPassword}) emailed to ${driver_email}!`
        : `Shuttle ${newShuttle.code} created successfully. You can now assign a driver to it in the Drivers section.`,
      data: enrichedShuttle || newShuttle,
      driverCredentials: generatedPassword
        ? {
            email: driver_email.trim().toLowerCase(),
            password: generatedPassword,
            deliveredVia: emailDelivery?.deliveredVia || 'email'
          }
        : null
    });
  } catch (error) {
    console.error('Create shuttle error:', error);
    res.status(500).json({ success: false, message: 'Failed to create shuttle.' });
  }
});

// PUT /api/shuttles/:id - Admin edit shuttle (propagates changes across routes, stops, schedules, drivers, and live tracking)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const updated = await db.updateShuttle(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Shuttle not found.' });
    }

    // Only update simulation waypoints if the driver is ALREADY on a live trip (status === 'on_trip')
    const io = req.app.get('io');
    if (io && updated.status === 'on_trip' && (req.body.start_point !== undefined || req.body.destination !== undefined)) {
      const route = await db.getRouteById(updated.current_route_id);
      if (route && route.stops && route.stops.length >= 2) {
        startAutonomousShuttle(io, updated.id, route.stops, 25);
      }
    }

    const enriched = await db.getShuttleById(updated.id);
    if (io && enriched) {
      io.emit('shuttle:updated', enriched);
    }

    res.json({
      success: true,
      message: `Shuttle ${updated.code} updated across all routes, schedules, drivers, and live tracking.`,
      data: enriched || updated
    });
  } catch (error) {
    console.error('Update shuttle error:', error);
    res.status(500).json({ success: false, message: 'Failed to update shuttle.' });
  }
});

// DELETE /api/shuttles/:id - Admin delete shuttle
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deleted = await db.deleteShuttle(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Shuttle not found.' });
    }
    res.json({ success: true, message: 'Shuttle deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete shuttle.' });
  }
});

module.exports = router;
