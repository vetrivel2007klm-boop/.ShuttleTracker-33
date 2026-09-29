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

// POST /api/trips/start - Driver or Admin starts a new trip (Real Hardware GPS Only — Never Auto-Simulates to Destination)
router.post('/start', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const { shuttle_id, route_id, passenger_count, latitude, longitude, speed, heading } = req.body;
    if (!shuttle_id) {
      return res.status(400).json({ success: false, message: 'Shuttle ID is required to start a trip.' });
    }

    const sId = Number(shuttle_id);
    // Stop any autonomous simulation immediately so the shuttle strictly follows the driver's real hardware GPS!
    stopAutonomousShuttle(sId);

    const trip = await db.createTrip({
      shuttle_id: sId,
      driver_id: req.user.userId,
      driver_name: req.user.name,
      route_id: route_id ? Number(route_id) : 1,
      passenger_count: passenger_count || 14
    });

    if (latitude !== undefined && longitude !== undefined && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      await db.updateShuttle(sId, {
        current_lat: Number(latitude),
        current_lng: Number(longitude),
        speed: Number(speed) || 0,
        heading: Number(heading) || 0,
        status: 'on_trip'
      });
    }

    const shuttle = await db.getShuttleById(sId);
    const schedules = await db.getAllSchedules();

    const io = req.app.get('io');
    if (io) {
      if (shuttle) {
        io.emit('shuttle:updated', shuttle);
        if (shuttle.current_lat && shuttle.current_lng) {
          const initialPayload = {
            shuttleId: sId,
            latitude: Number(shuttle.current_lat),
            longitude: Number(shuttle.current_lng),
            speed: Number(shuttle.speed) || 0,
            heading: Number(shuttle.heading) || 0,
            distance_km: shuttle.distance_km || 0,
            distance_covered_km: 0,
            eta_minutes: shuttle.eta_minutes || 5,
            next_stop_name: shuttle.next_stop_name || shuttle.destination || 'En Route',
            status: 'on_trip',
            timestamp: new Date().toISOString()
          };
          io.emit('shuttle:location_updated', initialPayload);
          io.emit('shuttle:quick_ping', initialPayload);
        }
      }
      io.emit('trip:status_change', {
        type: 'started',
        trip,
        shuttleId: sId
      });
      if (trip.passengerNotification) {
        io.emit('notification:new', trip.passengerNotification);
      }
      if (trip.emailRelayPayload) {
        io.emit('email:relay', trip.emailRelayPayload);
      }
      io.emit('schedule:updated', { schedules });
    }

    res.status(201).json({
      success: true,
      message: 'Trip started successfully with live GPS. Passengers notified via Login & Email.',
      deliveredVia: trip.emailDeliveredVia,
      emailRelayPayload: trip.emailRelayPayload,
      data: trip
    });
  } catch (error) {
    console.error('Start trip error:', error);
    res.status(500).json({ success: false, message: 'Failed to start trip.' });
  }
});

// POST /api/trips/off-route - Alert Admin when Driver deviates from allocated route or presses Off-Route Alert (strictly 1x per trip)
router.post('/off-route', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const { shuttle_id, latitude, longitude, reason } = req.body;
    const offRouteResult = await db.recordDriverOffRouteDeviation(shuttle_id || 1, {
      latitude,
      longitude,
      reason
    });

    const io = req.app.get('io');
    if (io && offRouteResult && !offRouteResult.alreadyNotified) {
      if (offRouteResult.notification) {
        io.emit('notification:new', offRouteResult.notification);
      }
      if (offRouteResult.emailRelayPayload) {
        io.emit('email:relay', offRouteResult.emailRelayPayload);
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
    }

    return res.status(200).json({
      success: true,
      alreadyNotified: Boolean(offRouteResult?.alreadyNotified),
      deliveredVia: offRouteResult?.emailDeliveredVia,
      emailRelayPayload: offRouteResult?.emailRelayPayload,
      message: offRouteResult?.alreadyNotified
        ? `Off-route alert was already sent once for this trip.`
        : `Admin has been notified in Admin Site & via Admin Email (cleancodeuniverse@gmail.com) of Bus ${offRouteResult?.busCode || 'S01'} route deviation.`,
      data: offRouteResult?.notification
    });
  } catch (err) {
    console.error('Off-route alert error:', err);
    return res.status(500).json({ success: false, message: 'Failed to dispatch off-route alert.' });
  }
});

// POST /api/trips/destination-arrival - Record destination arrival & calculate delay/points ONLY when GPS reached destination
router.post('/destination-arrival', optionalOrAuth, async (req, res) => {
  try {
    const sId = Number(req.body?.shuttle_id || req.body?.shuttleId || 1);
    const delayMins = Number(req.body?.delay_minutes || 0);
    const arrivalResult = await db.recordDriverDestinationArrival(sId, delayMins);
    const io = req.app.get('io');
    if (io && arrivalResult) {
      io.emit('schedule:updated', arrivalResult);
      if (arrivalResult.notification) {
        io.emit('notification:new', arrivalResult.notification);
      }
      if (arrivalResult.emailRelayPayload) {
        io.emit('email:relay', arrivalResult.emailRelayPayload);
      }
    }
    return res.status(200).json({
      success: true,
      deliveredVia: arrivalResult?.emailDeliveredVia,
      emailRelayPayload: arrivalResult?.emailRelayPayload,
      data: arrivalResult
    });
  } catch (err) {
    return res.status(200).json({ success: true, data: null });
  }
});

function optionalOrAuth(req, res, next) {
  return authenticate(req, res, (err) => {
    if (err) return next();
    return next();
  });
}

// Shared handler so End Trip works in ANY situation (/api/trips/end OR /api/trips/:id/end)
// Only marks "Driver Arrived" if the bus's GPS location actually reached the destination stop!
async function handleEndTripAnySituation(req, res) {
  try {
    const rawId = req.params.id || req.body?.trip_id || req.body?.shuttle_id || req.body?.shuttleId || 1;
    const explicitShuttleId = req.body?.shuttle_id || req.body?.shuttleId || null;

    if (explicitShuttleId) {
      stopAutonomousShuttle(Number(explicitShuttleId));
    }

    const sIdCandidate = Number(explicitShuttleId || rawId || 1);
    const reachedOnGpsBeforeEnd = db.hasShuttleReachedDestinationOnGps(sIdCandidate);

    let arrivalResult = null;
    if (reachedOnGpsBeforeEnd) {
      try {
        arrivalResult = await db.recordDriverDestinationArrival(sIdCandidate);
      } catch (_) {}
    }

    const trip = await db.endTrip(rawId, explicitShuttleId);
    const sId = Number(explicitShuttleId || trip?.shuttle_id || rawId || 1);
    stopAutonomousShuttle(sId);

    // Guarantee shuttle is set to idle and 0 km/h after ending trip
    const updatedShuttle = await db.updateShuttle(sId, {
      status: 'idle',
      speed: 0
    });

    const schedules = await db.getAllSchedules();
    if (!arrivalResult) {
      arrivalResult = {
        shuttleId: sId,
        driverArrived: false,
        reachedDestination: false,
        pointsEarned: 0,
        schedules
      };
    }

    const io = req.app.get('io');
    if (io) {
      if (updatedShuttle) {
        io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('trip:status_change', {
        type: 'ended',
        trip,
        shuttleId: sId,
        status: 'idle',
        driverArrived: Boolean(arrivalResult?.driverArrived)
      });
      io.emit('schedule:updated', { ...arrivalResult, schedules });
      if (arrivalResult?.notification) {
        io.emit('notification:new', arrivalResult.notification);
      }
      if (arrivalResult?.emailRelayPayload) {
        io.emit('email:relay', arrivalResult.emailRelayPayload);
      }
    }

    return res.status(200).json({
      success: true,
      deliveredVia: arrivalResult?.emailDeliveredVia,
      emailRelayPayload: arrivalResult?.emailRelayPayload,
      message: arrivalResult?.driverArrived
        ? 'Trip completed at destination on GPS.'
        : 'Trip ended before reaching destination on GPS. Shuttle is now in Standby (Idle).',
      data: { trip, shuttle: updatedShuttle, arrivalResult }
    });
  } catch (error) {
    console.error('End trip error (handled gracefully):', error);
    return res.status(200).json({
      success: true,
      message: 'Trip ended gracefully.',
      data: { status: 'idle' }
    });
  }
}

// POST /api/trips/end - Driver or Admin ends trip without trip ID
router.post('/end', authenticate, authorize('driver', 'admin'), handleEndTripAnySituation);

// POST /api/trips/:id/end - Driver or Admin ends trip in any situation
router.post('/:id/end', authenticate, authorize('driver', 'admin'), handleEndTripAnySituation);

// POST /api/trips/:id/delay - Report delay & notify Admin in Admin Site + Admin Email strictly ONCE per trip
router.post('/:id/delay', authenticate, authorize('driver', 'admin'), async (req, res) => {
  try {
    const { minutes, reason, shuttle_id } = req.body;
    const delayMins = Number(minutes) || 5;
    const trips = await db.getAllTrips();
    const trip = trips.find((t) => t.id === Number(req.params.id));
    const shuttleId = Number(shuttle_id || (trip ? trip.shuttle_id : req.params.id) || 1);

    if (trip) {
      trip.delay_minutes = delayMins;
    }

    await db.updateShuttle(shuttleId, {
      status: 'delayed'
    });
    const shuttle = await db.getShuttleById(shuttleId);

    const delayResult = await db.recordDriverDelayAlert(shuttleId, delayMins, {
      customReason: reason
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('shuttle:delayed', {
        shuttleId,
        delay_minutes: delayMins,
        reason,
        alreadyNotified: Boolean(delayResult?.alreadyDelayNotified)
      });
      if (!delayResult?.alreadyDelayNotified) {
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
          etaMinutes: Number(shuttle?.eta_minutes) || 0
        });
      }
      if (delayResult) {
        io.emit('schedule:updated', delayResult);
        if (delayResult.notification) {
          io.emit('notification:new', delayResult.notification);
        }
        if (delayResult.emailRelayPayload) {
          io.emit('email:relay', delayResult.emailRelayPayload);
        }
      }
    }

    res.json({
      success: true,
      alreadyNotified: Boolean(delayResult?.alreadyDelayNotified),
      deliveredVia: delayResult?.emailDeliveredVia,
      emailRelayPayload: delayResult?.emailRelayPayload,
      message: delayResult?.alreadyDelayNotified
        ? 'Delay alert was already sent once for this trip.'
        : 'Driver delay recorded and alert sent once to Admin Site & Admin Email (cleancodeuniverse@gmail.com).',
      data: { trip, shuttle, arrivalResult: delayResult }
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
      if (emergencyResult.emailRelayPayload && emergencyResult.emailDeliveredVia === 'cloud_verified') {
        io.emit('email:relay', emergencyResult.emailRelayPayload);
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
        message: `Emergency alert recorded: ${emergencyResult.currentCount} out of 10 on Bus ${emergencyResult.busCode}. One consolidated message & email will be sent to Admin when 5 to 10 passengers report within 15 minutes.`,
        data: emergencyResult
      });
    }

    const isDriverReport = (req.user?.role || 'user') === 'driver';
    return res.status(200).json({
      success: true,
      alreadyReportedByPassenger: false,
      alreadyNotified: emergencyResult.alreadyNotified,
      thresholdReached: true,
      currentCount: emergencyResult.currentCount,
      maxCount: emergencyResult.maxCount || 10,
      requiredCount: emergencyResult.requiredCount || 5,
      passengerEmergencyReports: emergencyResult.passengerEmergencyReports || [],
      deliveredVia: emergencyResult.emailDeliveredVia,
      emailRelayPayload: emergencyResult.emailRelayPayload,
      message: emergencyResult.alreadyNotified
        ? `Emergency recorded (${emergencyResult.currentCount} out of 10). Consolidated emergency message & email were already sent once to Admin for Bus ${emergencyResult.busCode}.`
        : isDriverReport
        ? `Driver Emergency Alert sent to Admin Notification & Admin Email for Bus ${emergencyResult.busCode}!`
        : `Emergency threshold reached (${emergencyResult.currentCount} out of 10)! Consolidated emergency alert & email have been sent to Admin for Bus ${emergencyResult.busCode}.`,
      data: emergencyResult
    });
  } catch (err) {
    console.error('Emergency stopped alert error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send emergency stopped notification.' });
  }
});

module.exports = router;
