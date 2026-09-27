const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { startAutonomousShuttle, stopAutonomousShuttle } = require('../sockets/trackingSocket');

// GET /api/trips - List trips
router.get('/', authenticate, async (req, res) => {
  try {
    const trips = await db.getAllTrips();
    res.json({ success: true, count: trips.length, data: trips });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve trips.' });
  }
});

// POST /api/trips/start - Driver or Admin starts a new trip
router.post('/start', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const { shuttle_id, route_id, passenger_count } = req.body;
    if (!shuttle_id) {
      return res.status(400).json({ success: false, message: 'Shuttle ID is required to start a trip.' });
    }

    const sId = Number(shuttle_id);
    const trip = await db.createTrip({
      shuttle_id: sId,
      driver_id: req.user.userId,
      driver_name: req.user.name,
      route_id: route_id ? Number(route_id) : 1,
      passenger_count: passenger_count || 14
    });

    const shuttle = await db.getShuttleById(sId);
    const schedules = await db.getAllSchedules();

    const io = req.app.get('io');
    if (io) {
      if (shuttle) {
        io.emit('shuttle:updated', shuttle);
      }
      io.emit('trip:status_change', {
        type: 'started',
        trip,
        shuttleId: sId
      });
      io.emit('schedule:updated', { schedules });
      if (shuttle?.stops && shuttle.stops.length >= 2) {
        startAutonomousShuttle(io, sId, shuttle.stops, 26, true);
      }
    }

    res.status(201).json({ success: true, message: 'Trip started successfully.', data: trip });
  } catch (error) {
    console.error('Start trip error:', error);
    res.status(500).json({ success: false, message: 'Failed to start trip.' });
  }
});

// POST /api/trips/off-route - Alert Admin when Driver deviates from allocated route (once per trip)
router.post('/off-route', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const { shuttle_id, latitude, longitude, reason } = req.body;
    const offRouteResult = await db.recordDriverOffRouteDeviation(shuttle_id || 1, {
      latitude,
      longitude,
      reason
    });

    const io = req.app.get('io');
    if (io) {
      if (offRouteResult.notification) {
        io.emit('notification:new', offRouteResult.notification);
      }
      io.emit('shuttle:off_route', {
        shuttleId: offRouteResult.shuttleId,
        code: offRouteResult.busCode,
        driverName: offRouteResult.driverName,
        routeName: offRouteResult.routeName,
        latitude: offRouteResult.deviatedLat,
        longitude: offRouteResult.deviatedLng,
        alreadyNotified: offRouteResult.alreadyNotified,
        notification: offRouteResult.notification
      });
      io.emit('shuttle:quick_ping', {
        shuttleId: offRouteResult.shuttleId,
        latitude: offRouteResult.deviatedLat,
        longitude: offRouteResult.deviatedLng,
        speed: 18,
        heading: 140,
        status: 'delayed',
        next_stop_name: 'OFF-ROUTE DEVIATION'
      });
    }

    return res.status(200).json({
      success: true,
      alreadyNotified: offRouteResult.alreadyNotified,
      message: offRouteResult.alreadyNotified
        ? `Off-route notification was already sent once to Admin for this trip (Bus ${offRouteResult.busCode}).`
        : `Admin has been notified (1 time for this trip) of Bus ${offRouteResult.busCode} route deviation.`,
      data: offRouteResult.notification
    });
  } catch (err) {
    console.error('Off-route alert error:', err);
    return res.status(500).json({ success: false, message: 'Failed to dispatch off-route alert.' });
  }
});

// POST /api/trips/:id/end - Driver or Admin ends trip upon reaching destination
router.post('/:id/end', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const trip = await db.endTrip(req.params.id);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found.' });
    }

    const sId = Number(trip.shuttle_id) || Number(req.params.id);
    stopAutonomousShuttle(sId);

    const arrivalResult = await db.recordDriverDestinationArrival(
      sId,
      trip.delay_minutes || 0
    );
    const updatedShuttle = await db.getShuttleById(sId);

    const io = req.app.get('io');
    if (io) {
      if (updatedShuttle) {
        io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('trip:status_change', {
        type: 'ended',
        trip,
        shuttleId: sId
      });
      if (arrivalResult) {
        io.emit('schedule:updated', arrivalResult);
        if (arrivalResult.notification) {
          io.emit('notification:new', arrivalResult.notification);
        }
      }
    }

    res.json({
      success: true,
      message: 'Trip ended at destination. Arrival time and daily trip points updated.',
      data: { trip, arrivalResult }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to end trip.' });
  }
});

// POST /api/trips/:id/delay - Report delay & notify Admin that driver is delayed (once per trip per bus)
router.post('/:id/delay', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const { minutes, reason } = req.body;
    const delayMins = Number(minutes) || 5;
    const trips = await db.getAllTrips();
    const trip = trips.find((t) => t.id === Number(req.params.id));
    const shuttleId = trip ? trip.shuttle_id : Number(req.params.id) || 1;

    if (trip) {
      trip.delay_minutes = delayMins;
    }

    const shuttle = await db.updateShuttle(shuttleId, {
      status: 'delayed',
      eta_minutes: delayMins + 4
    });

    const arrivalResult = await db.recordDriverDestinationArrival(shuttleId, delayMins);

    const io = req.app.get('io');
    if (io) {
      io.emit('shuttle:delayed', {
        shuttleId,
        delay_minutes: delayMins,
        reason,
        alreadyNotified: Boolean(arrivalResult?.alreadyDelayNotified)
      });
      io.emit('passenger:stop_delay_traffic', {
        shuttleId,
        busCode: shuttle?.code || `S0${shuttleId}`,
        routeName: shuttle?.route?.name || 'Assigned Campus Route',
        stopName: (shuttle?.next_stop_name || 'Current Stop').replace(' (Driver Arrived)', ''),
        reachedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        delayMinutes: delayMins,
        trafficMessage:
          reason ||
          `Traffic congestion near ${(shuttle?.next_stop_name || 'Current Stop').replace(' (Driver Arrived)', '')} — Bus delayed by +${delayMins} mins`,
        etaMinutes: delayMins + 4
      });
      if (arrivalResult) {
        io.emit('schedule:updated', arrivalResult);
        if (arrivalResult.notification) {
          io.emit('notification:new', arrivalResult.notification);
        }
      }
    }

    res.json({
      success: true,
      alreadyNotified: Boolean(arrivalResult?.alreadyDelayNotified),
      message: arrivalResult?.alreadyDelayNotified
        ? 'Delay notification was already sent once to Admin for this trip.'
        : 'Driver delay recorded, points adjusted by delay, and notification sent to Admin (1 time for this trip).',
      data: { trip, shuttle, arrivalResult }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to report delay.' });
  }
});

// POST /api/trips/emergency-stopped - Send Emergency Notification to Admin
// - Same bus passengers only
// - 1 time per passenger (resets after 15 minutes)
// - Broadcasts X out of 10 counter to all passengers on that bus
// - Sends ONE consolidated emergency message to Admin when 5 to 10 passengers press within 15 minutes
router.post('/emergency-stopped', authenticate, authorize('driver', 'user', 'admin'), async (req, res) => {
  try {
    const { shuttle_id, stopped_minutes, reason } = req.body;
    const sId = Number(shuttle_id) || 1;
    const stoppedMins = Math.max(20, Number(stopped_minutes) || 20);

    const emergencyResult = await db.recordBusStoppedEmergency(sId, {
      reportedByRole: req.user?.role || 'user',
      reportedById: req.user?.userId || req.user?.id || null,
      reportedByName: req.user?.name || 'Campus User',
      stoppedMinutes: stoppedMins,
      reason
    });

    if (!emergencyResult) {
      return res.status(404).json({ success: false, message: 'Shuttle not found.' });
    }

    if (emergencyResult.notSameBus) {
      return res.status(403).json({
        success: false,
        notSameBus: true,
        message: `Only passengers registered on Bus ${emergencyResult.busCode} can give an emergency alert for this bus.`
      });
    }

    if (emergencyResult.alreadyReportedByPassenger) {
      return res.status(200).json({
        success: true,
        alreadyReportedByPassenger: true,
        remainingMinutes: emergencyResult.remainingMinutes,
        alreadyNotified: emergencyResult.alreadyNotified,
        thresholdReached: emergencyResult.thresholdReached,
        currentCount: emergencyResult.currentCount,
        maxCount: emergencyResult.maxCount || 10,
        requiredCount: emergencyResult.requiredCount || 5,
        passengerEmergencyReports: emergencyResult.passengerEmergencyReports || [],
        message: `You have already given an emergency alert (${emergencyResult.currentCount} out of 10). Your emergency button will reset in ${emergencyResult.remainingMinutes} min(s).`,
        data: emergencyResult
      });
    }

    const io = req.app.get('io');
    if (io) {
      if (emergencyResult.thresholdReached && !emergencyResult.alreadyNotified && emergencyResult.notification) {
        io.emit('notification:new', emergencyResult.notification);
      }
      io.emit('shuttle:emergency_stopped', {
        shuttleId: emergencyResult.shuttleId,
        busCode: emergencyResult.busCode,
        driverName: emergencyResult.driverName,
        routeName: emergencyResult.routeName,
        stoppedMinutes: emergencyResult.stoppedMinutes,
        alreadyNotified: emergencyResult.alreadyNotified,
        thresholdReached: emergencyResult.thresholdReached,
        currentCount: emergencyResult.currentCount,
        maxCount: emergencyResult.maxCount || 10,
        requiredCount: emergencyResult.requiredCount || 5,
        passengerEmergencyReports: emergencyResult.passengerEmergencyReports || [],
        reportedByRole: req.user?.role || 'user',
        reportedById: req.user?.userId || req.user?.id || null,
        reportedByName: req.user?.name || 'Campus User'
      });
    }

    if (!emergencyResult.thresholdReached) {
      return res.status(200).json({
        success: true,
        alreadyReportedByPassenger: false,
        alreadyNotified: false,
        thresholdReached: false,
        currentCount: emergencyResult.currentCount,
        maxCount: emergencyResult.maxCount || 10,
        requiredCount: emergencyResult.requiredCount || 5,
        passengerEmergencyReports: emergencyResult.passengerEmergencyReports || [],
        message: `Emergency alert recorded: ${emergencyResult.currentCount} out of 10 on Bus ${emergencyResult.busCode}. One consolidated message will be sent to Admin when 5 to 10 passengers report within 15 minutes.`,
        data: emergencyResult
      });
    }

    return res.status(200).json({
      success: true,
      alreadyReportedByPassenger: false,
      alreadyNotified: emergencyResult.alreadyNotified,
      thresholdReached: true,
      currentCount: emergencyResult.currentCount,
      maxCount: emergencyResult.maxCount || 10,
      requiredCount: emergencyResult.requiredCount || 5,
      passengerEmergencyReports: emergencyResult.passengerEmergencyReports || [],
      message: emergencyResult.alreadyNotified
        ? `Emergency recorded (${emergencyResult.currentCount} out of 10). Consolidated emergency message was already sent once to Admin for Bus ${emergencyResult.busCode}.`
        : `Emergency threshold reached (${emergencyResult.currentCount} out of 10)! One consolidated emergency alert has been sent to Admin for Bus ${emergencyResult.busCode}.`,
      data: emergencyResult
    });
  } catch (err) {
    console.error('Emergency stopped alert error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send emergency stopped notification.' });
  }
});

module.exports = router;
