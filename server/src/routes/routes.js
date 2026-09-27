const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const { startAutonomousShuttle } = require('../sockets/trackingSocket');

// GET /api/routes - List all routes (optionally filtered by ?shuttle_id= and ?organization_name=)
router.get('/', optionalAuthenticate, async (req, res) => {
  try {
    const orgName = req.query.organization_name || req.user?.organization_name || null;
    let routes = await db.getAllRoutes(orgName);
    if (req.query.shuttle_id) {
      const sId = Number(req.query.shuttle_id);
      const shuttle = await db.getShuttleById(sId);
      routes = routes.filter(
        (r) => Number(r.shuttle_id) === sId || (shuttle && Number(shuttle.current_route_id) === Number(r.id))
      );
    }
    res.json({ success: true, count: routes.length, data: routes });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve routes.' });
  }
});

// GET /api/routes/:id - Single route with stops
router.get('/:id', async (req, res) => {
  try {
    const route = await db.getRouteById(req.params.id);
    if (!route) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }
    res.json({ success: true, data: route });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve route details.' });
  }
});

// POST /api/routes - Admin create route (with Bus Number assignment & real geocoding)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      code,
      start_point,
      end_point,
      landmark,
      shuttle_id,
      distance_km,
      estimated_time_minutes,
      color,
      description,
      stops,
      organization_name
    } = req.body;

    if (!name || !start_point || !end_point) {
      return res.status(400).json({ success: false, message: 'Route name, starting point, and destination are required.' });
    }

    const orgName = organization_name || req.user?.organization_name || null;

    const newRoute = await db.createRoute({
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : undefined,
      start_point: start_point.trim(),
      end_point: end_point.trim(),
      landmark: landmark ? landmark.trim() : '',
      shuttle_id: shuttle_id ? Number(shuttle_id) : null,
      distance_km,
      estimated_time_minutes,
      color,
      description,
      stops,
      organization_name: orgName
    });

    const io = req.app.get('io');
    if (io) {
      if (newRoute.shuttle_id && newRoute.stops && newRoute.stops.length >= 2) {
        const assignedShuttle = await db.getShuttleById(newRoute.shuttle_id);
        if (assignedShuttle && assignedShuttle.status === 'on_trip') {
          startAutonomousShuttle(io, Number(newRoute.shuttle_id), newRoute.stops, 25);
        }
        if (assignedShuttle) io.emit('shuttle:updated', assignedShuttle);
      }
      io.emit('route:updated', newRoute);
    }

    res.status(201).json({ success: true, message: 'Route created and synced to Driver & Passenger portals.', data: newRoute });
  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({ success: false, message: 'Failed to create route.' });
  }
});

// PUT /api/routes/:id - Admin update route
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const updated = await db.updateRoute(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      if (updated.shuttle_id && updated.stops && updated.stops.length >= 2) {
        const assignedShuttle = await db.getShuttleById(updated.shuttle_id);
        if (assignedShuttle && assignedShuttle.status === 'on_trip') {
          startAutonomousShuttle(io, Number(updated.shuttle_id), updated.stops, 25);
        }
        if (assignedShuttle) io.emit('shuttle:updated', assignedShuttle);
      }
      io.emit('route:updated', updated);
    }

    res.json({ success: true, message: 'Route updated successfully.', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update route.' });
  }
});

// DELETE /api/routes/:id - Admin delete route
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deleted = await db.deleteRoute(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }
    res.json({ success: true, message: 'Route deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete route.' });
  }
});

// POST /api/routes/:id/stops - Add a stop to a route (auto-geocodes if lat/lng omitted)
router.post('/:id/stops', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, latitude, longitude, landmark, sequence_order } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Stop name is required.' });
    }
    const newStop = await db.addStop({
      route_id: req.params.id,
      name: name.trim(),
      latitude,
      longitude,
      landmark: landmark ? landmark.trim() : '',
      sequence_order
    });

    const updatedRoute = await db.getRouteById(req.params.id);
    const io = req.app.get('io');
    if (io && updatedRoute) {
      if (updatedRoute.shuttle_id) {
        const updatedShuttle = await db.getShuttleById(updatedRoute.shuttle_id);
        if (updatedShuttle && updatedShuttle.status === 'on_trip' && updatedRoute.stops?.length >= 2) {
          startAutonomousShuttle(io, Number(updatedRoute.shuttle_id), updatedRoute.stops, 25);
        }
        if (updatedShuttle) io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('route:updated', updatedRoute);
    }

    res.status(201).json({
      success: true,
      message: 'Stop added and synced to Passenger & Driver websites.',
      data: newStop,
      route: updatedRoute
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add stop.' });
  }
});

// DELETE /api/routes/:id/stops/:stopId - Remove a stop from a route
router.delete('/:id/stops/:stopId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deleted = await db.deleteStop(req.params.stopId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Stop not found.' });
    }

    const updatedRoute = await db.getRouteById(req.params.id);
    const io = req.app.get('io');
    if (io && updatedRoute) {
      if (updatedRoute.shuttle_id) {
        const updatedShuttle = await db.getShuttleById(updatedRoute.shuttle_id);
        if (updatedShuttle && updatedShuttle.status === 'on_trip' && updatedRoute.stops?.length >= 2) {
          startAutonomousShuttle(io, Number(updatedRoute.shuttle_id), updatedRoute.stops, 25);
        }
        if (updatedShuttle) io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('route:updated', updatedRoute);
    }

    res.json({
      success: true,
      message: 'Stop removed and synced across all portals.',
      route: updatedRoute
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete stop.' });
  }
});

module.exports = router;
