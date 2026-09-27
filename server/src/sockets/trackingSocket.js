const db = require('../config/db');

// In-memory simulation timers for testing without manual physical driving
const activeSimulations = new Map();
// Track when a real driver is actively streaming hardware GPS so simulation yields to real GPS
const activeRealGpsDrivers = new Map();
// Track last GPS coordinate per shuttle to compute real speed (km/h) when device speed is null
const lastDriverGpsPoint = new Map();
// Cache OSRM road-following geometry by stop coordinates signature
const roadGeometryCache = new Map();
// Track last off-route alert per shuttle to prevent spamming
const lastOffRouteAlert = new Map();
// Track last destination arrival per real GPS driver
const lastDriverArrivalTime = new Map();
// Track stationary start timestamp per shuttle for 20-minute stopped emergency check
const stationaryStartTime = new Map();
// Track stops already notified for passenger traffic delay during current trip
const notifiedTrafficStopsPerShuttle = new Map();

// Helper to calculate distance in kilometers between two geo coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Calculate bearing/heading in degrees (0-360) from point A to point B
function calculateHeading(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

// Fetch real-world road path between stops from OSRM Driving API (cached)
async function fetchRoadWaypointsForStops(stops, baseSpeed = 26) {
  if (!stops || stops.length < 2) return [];
  const validStops = stops.filter((s) => s.latitude && s.longitude);
  if (validStops.length < 2) return [];

  const sig = validStops
    .map((s) => `${Number(s.latitude).toFixed(4)},${Number(s.longitude).toFixed(4)}`)
    .join(';');

  if (roadGeometryCache.has(sig)) {
    return buildPointsFromRoadSegments(validStops, roadGeometryCache.get(sig), baseSpeed);
  }

  try {
    const coordStr = validStops
      .map((s) => `${Number(s.longitude).toFixed(5)},${Number(s.latitude).toFixed(5)}`)
      .join(';');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
        const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({
          lat: Number(lat),
          lng: Number(lng)
        }));
        if (coords.length >= 2) {
          roadGeometryCache.set(sig, coords);
          return buildPointsFromRoadSegments(validStops, coords, baseSpeed);
        }
      }
    }
  } catch (_) {
    // Fallback to interpolated waypoints if offline
  }

  return buildFallbackWaypoints(validStops, baseSpeed);
}

// Map dense OSRM road coordinates to nextStop, speed, heading, and arrival flags (clamped strictly to Destination)
function buildPointsFromRoadSegments(stops, roadCoords, baseSpeed = 26) {
  const firstStop = stops[0];
  const finalStop = stops[stops.length - 1];

  // Trim any OSRM road points that overshoot past the final destination stop
  let trimmedCoords = [...roadCoords];
  if (trimmedCoords.length > 4) {
    let minDestDist = Infinity;
    let bestDestIdx = trimmedCoords.length - 1;
    for (let i = Math.floor(trimmedCoords.length * 0.65); i < trimmedCoords.length; i++) {
      const d = calculateDistance(
        trimmedCoords[i].lat,
        trimmedCoords[i].lng,
        Number(finalStop.latitude),
        Number(finalStop.longitude)
      );
      if (d <= minDestDist) {
        minDestDist = d;
        bestDestIdx = i;
      }
    }
    trimmedCoords = trimmedCoords.slice(0, bestDestIdx + 1);
  }

  // Lock exact Start and Destination endpoints
  trimmedCoords[0] = { lat: Number(firstStop.latitude), lng: Number(firstStop.longitude) };
  trimmedCoords[trimmedCoords.length - 1] = {
    lat: Number(finalStop.latitude),
    lng: Number(finalStop.longitude)
  };

  // Sample to ~42 smooth steps from Start to Destination
  const maxSteps = Math.min(44, Math.max(24, stops.length * 9));
  const sampled = [];
  if (trimmedCoords.length <= maxSteps) {
    sampled.push(...trimmedCoords);
  } else {
    for (let i = 0; i < maxSteps; i++) {
      const idx = Math.min(
        trimmedCoords.length - 1,
        Math.round((i / (maxSteps - 1)) * (trimmedCoords.length - 1))
      );
      sampled.push(trimmedCoords[idx]);
    }
  }
  sampled[0] = { lat: Number(firstStop.latitude), lng: Number(firstStop.longitude) };
  sampled[sampled.length - 1] = { lat: Number(finalStop.latitude), lng: Number(finalStop.longitude) };

  let currentStopIdx = 0;
  return sampled.map((pt, idx) => {
    const isLastPoint = idx === sampled.length - 1;
    if (currentStopIdx < stops.length - 1) {
      const nextStopCandidate = stops[currentStopIdx + 1];
      const distToCandidate = calculateDistance(
        pt.lat,
        pt.lng,
        Number(nextStopCandidate.latitude),
        Number(nextStopCandidate.longitude)
      );
      if (distToCandidate < 0.18 && currentStopIdx < stops.length - 2) {
        currentStopIdx += 1;
      }
    }

    const nextStopObj = stops[Math.min(stops.length - 1, currentStopIdx + 1)];
    const prevPt = idx > 0 ? sampled[idx - 1] : pt;
    const nextPt = idx < sampled.length - 1 ? sampled[idx + 1] : pt;
    const heading = calculateHeading(prevPt.lat, prevPt.lng, nextPt.lat, nextPt.lng);
    const liveSpeed = isLastPoint ? 0 : Math.max(18, Math.round(baseSpeed + Math.sin(idx * 0.7) * 5));

    let reachedStopName = null;
    let isStopArrival = false;
    for (let sIdx = 0; sIdx < stops.length; sIdx++) {
      const d = calculateDistance(
        pt.lat,
        pt.lng,
        Number(stops[sIdx].latitude),
        Number(stops[sIdx].longitude)
      );
      if (d <= 0.15) {
        reachedStopName = stops[sIdx].name;
        isStopArrival = true;
        break;
      }
    }

    return {
      lat: pt.lat,
      lng: pt.lng,
      nextStop: isLastPoint ? `${finalStop.name} (Destination Reached)` : nextStopObj.name,
      targetLat: Number(nextStopObj.latitude),
      targetLng: Number(nextStopObj.longitude),
      destLat: Number(finalStop.latitude),
      destLng: Number(finalStop.longitude),
      speed: liveSpeed,
      heading: heading || 65,
      isDestination: isLastPoint,
      isStopArrival,
      reachedStopName: isLastPoint ? finalStop.name : reachedStopName,
      stopIndex: isLastPoint ? stops.length - 1 : currentStopIdx,
      destinationName: finalStop.name
    };
  });
}

// Fallback smooth interpolation if OSRM is unreachable
function buildFallbackWaypoints(stops, baseSpeed = 26) {
  if (!stops || stops.length < 2) return [];
  const routePoints = [];
  const stepsPerSegment = 6;
  const finalStop = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    const current = stops[i];
    const next = stops[i + 1];
    const isFinalSegment = i === stops.length - 2;
    const segHeading = calculateHeading(
      Number(current.latitude),
      Number(current.longitude),
      Number(next.latitude),
      Number(next.longitude)
    );

    for (let s = 0; s < stepsPerSegment; s++) {
      const t = s / stepsPerSegment;
      routePoints.push({
        lat: Number(current.latitude) + (Number(next.latitude) - Number(current.latitude)) * t,
        lng: Number(current.longitude) + (Number(next.longitude) - Number(current.longitude)) * t,
        nextStop: next.name,
        targetLat: Number(next.latitude),
        targetLng: Number(next.longitude),
        destLat: Number(finalStop.latitude),
        destLng: Number(finalStop.longitude),
        speed: Math.max(18, Math.round(baseSpeed + Math.sin(s) * 4)),
        heading: segHeading || 45 + i * 35,
        isDestination: false,
        isStopArrival: s === 0,
        reachedStopName: s === 0 ? current.name : null,
        stopIndex: i
      });
    }

    if (isFinalSegment) {
      routePoints.push({
        lat: Number(next.latitude),
        lng: Number(next.longitude),
        nextStop: next.name,
        targetLat: Number(next.latitude),
        targetLng: Number(next.longitude),
        destLat: Number(finalStop.latitude),
        destLng: Number(finalStop.longitude),
        speed: Math.max(16, baseSpeed - 4),
        heading: segHeading || 65,
        isDestination: true,
        isStopArrival: true,
        reachedStopName: next.name,
        stopIndex: stops.length - 1,
        destinationName: next.name
      });
    }
  }

  return routePoints;
}

// Compute total route distance along stops in km
function computeTotalRouteDistanceKm(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return 3.2;
  let sum = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    sum += calculateDistance(
      Number(stops[i].latitude),
      Number(stops[i].longitude),
      Number(stops[i + 1].latitude),
      Number(stops[i + 1].longitude)
    );
  }
  // Road factor (~1.25x straight-line distance)
  return Math.max(1.2, Number((sum * 1.25).toFixed(2)));
}

// Function to run continuous real-road tracking along route stops with immediate zero-delay initial tick
function startAutonomousShuttle(io, sId, fallbackStops, baseSpeed = 28, startFromBeginning = false) {
  if (activeSimulations.has(sId)) {
    clearInterval(activeSimulations.get(sId));
    activeSimulations.delete(sId);
  }

  if (startFromBeginning) {
    notifiedTrafficStopsPerShuttle.set(sId, new Set());
    stationaryStartTime.delete(sId);
  } else if (!notifiedTrafficStopsPerShuttle.has(sId)) {
    notifiedTrafficStopsPerShuttle.set(sId, new Set());
  }

  let pointIndex = startFromBeginning ? 0 : Math.min(2, Math.max(0, sId - 1));
  let intervalId = null;

  const runTick = async () => {
    try {
      // If a real driver is streaming live hardware GPS for this shuttle within the last 10 seconds, yield to real GPS
      const lastRealGps = activeRealGpsDrivers.get(Number(sId));
      if (lastRealGps && Date.now() - lastRealGps < 10000) {
        return;
      }

      const currentShuttle = await db.getShuttleById(sId);
      if (!currentShuttle || currentShuttle.status === 'inactive') {
        return;
      }

      const activeStops =
        currentShuttle?.stops && currentShuttle.stops.length >= 2
          ? currentShuttle.stops
          : fallbackStops;

      const routePoints = await fetchRoadWaypointsForStops(activeStops, baseSpeed);
      if (routePoints.length === 0) return;

      if (pointIndex >= routePoints.length) {
        pointIndex = routePoints.length - 1;
      }

      const point = routePoints[pointIndex];
      const effectiveSpeed = point.isDestination
        ? 0
        : Math.max(20, Number(point.speed) || baseSpeed);
      const calcSpeedForEta = Math.max(20, Number(point.speed) || baseSpeed);

      // Distance & ETA to Next Stop (with 1.22 road curvature factor)
      const rawNextDist = calculateDistance(point.lat, point.lng, point.targetLat, point.targetLng);
      const distanceToNextKm = point.isDestination
        ? 0
        : Math.max(0.1, Number((rawNextDist * 1.22).toFixed(2)));
      const etaToNextMins = point.isDestination
        ? 0
        : Math.max(1, Math.round((distanceToNextKm / calcSpeedForEta) * 60));

      // Distance & ETA to Final Destination
      const rawDestDist = calculateDistance(
        point.lat,
        point.lng,
        point.destLat || point.targetLat,
        point.destLng || point.targetLng
      );
      const distanceToDestKm = point.isDestination
        ? 0
        : Math.max(distanceToNextKm, Number((rawDestDist * 1.25).toFixed(2)));
      const destinationEtaMins = point.isDestination
        ? 0
        : Math.max(etaToNextMins, Math.round((distanceToDestKm / calcSpeedForEta) * 60));

      const totalRouteKm = computeTotalRouteDistanceKm(activeStops);

      const currentStatus =
        currentShuttle && currentShuttle.status === 'delayed' ? 'delayed' : 'on_trip';

      // Track stop reached times for Campus Routes ETA & Reached Time view
      const stopReachedTimes = { ...(currentShuttle?.stopReachedTimes || {}) };
      const nowDate = new Date();
      const nowTimeStr = nowDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (Array.isArray(activeStops)) {
        for (let idx = 0; idx <= (point.stopIndex || 0); idx++) {
          const st = activeStops[idx];
          if (st && !stopReachedTimes[st.name]) {
            const minsAgo = Math.max(0, (point.stopIndex - idx) * 3);
            const pastDate = new Date(nowDate.getTime() - minsAgo * 60000);
            stopReachedTimes[st.name] = pastDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }
      }

      if (point.isStopArrival && point.reachedStopName) {
        stopReachedTimes[point.reachedStopName] = nowTimeStr;
      }

      // Emit passenger stop delay with traffic notification when driver reaches a stop with delay
      let trafficDelayStop = currentShuttle?.trafficDelayStop || null;
      const notifiedSet = notifiedTrafficStopsPerShuttle.get(sId) || new Set();
      const isStopDelayed =
        point.isStopArrival &&
        point.reachedStopName &&
        point.stopIndex > 0 &&
        (currentStatus === 'delayed' || calcSpeedForEta <= 20);

      if (isStopDelayed && !notifiedSet.has(point.reachedStopName)) {
        notifiedSet.add(point.reachedStopName);
        notifiedTrafficStopsPerShuttle.set(sId, notifiedSet);
        const delayMins = currentStatus === 'delayed' ? 6 : 3;
        trafficDelayStop = {
          shuttleId: sId,
          busCode: currentShuttle?.code || `S0${sId}`,
          routeName: currentShuttle?.route?.name || 'Campus Route',
          stopName: point.reachedStopName,
          reachedTime: nowTimeStr,
          delayMinutes: delayMins,
          trafficMessage: `Heavy campus traffic near ${point.reachedStopName} — Driver reached ${point.reachedStopName} at ${nowTimeStr} (+${delayMins} min traffic delay).`,
          etaMinutes: etaToNextMins + delayMins
        };
        io.emit('passenger:stop_delay_traffic', trafficDelayStop);
      }

      const startStop = Array.isArray(activeStops) && activeStops.length > 0 ? activeStops[0] : null;
      const distanceCoveredKm = startStop
        ? calculateDistance(Number(startStop.latitude), Number(startStop.longitude), point.lat, point.lng)
        : 0;

      await db.updateShuttle(sId, {
        current_lat: point.lat,
        current_lng: point.lng,
        speed: effectiveSpeed,
        heading: point.heading,
        distance_km: distanceToNextKm,
        distance_to_destination_km: distanceToDestKm,
        total_route_km: totalRouteKm,
        distance_covered_km: distanceCoveredKm,
        eta_minutes: etaToNextMins,
        destination_eta_minutes: destinationEtaMins,
        next_stop_name: point.nextStop,
        status: currentStatus,
        stop_reached_times: stopReachedTimes,
        traffic_delay_stop: trafficDelayStop
      });

      const payload = {
        shuttleId: sId,
        latitude: point.lat,
        longitude: point.lng,
        speed: effectiveSpeed,
        heading: point.heading,
        distance_km: distanceToNextKm,
        distance_to_destination_km: distanceToDestKm,
        total_route_km: totalRouteKm,
        distance_covered_km: distanceCoveredKm,
        eta_minutes: etaToNextMins,
        destination_eta_minutes: destinationEtaMins,
        next_stop_name: point.nextStop,
        isDestination: Boolean(point.isDestination),
        status: currentStatus,
        stopReachedTimes,
        trafficDelayStop,
        timestamp: new Date().toISOString()
      };

      io.emit('shuttle:location_updated', payload);
      io.emit('shuttle:quick_ping', payload);

      // When the bus reaches the Destination on the map, STOP at the Destination (never traverse past destination!)
      if (point.isDestination) {
        if (intervalId) clearInterval(intervalId);
        activeSimulations.delete(sId);

        const arrivalResult = await db.recordDriverDestinationArrival(sId);
        if (arrivalResult) {
          io.emit('schedule:updated', arrivalResult);
          if (arrivalResult.notification) {
            io.emit('notification:new', arrivalResult.notification);
          }
        }
        return;
      }

      pointIndex += 1;
    } catch (err) {
      console.error('Autonomous shuttle tick error:', err);
    }
  };

  // Emit first tick immediately so there is zero delay when trip starts!
  runTick();
  intervalId = setInterval(runTick, 1200);
  activeSimulations.set(sId, intervalId);
}

function stopAutonomousShuttle(shuttleId) {
  const sId = Number(shuttleId);
  if (activeSimulations.has(sId)) {
    clearInterval(activeSimulations.get(sId));
    activeSimulations.delete(sId);
  }
  activeRealGpsDrivers.delete(sId);
}

function setupTrackingSocket(io) {
  const routeAStops = [
    { name: 'Sri Sairam Engineering College', latitude: 12.9602, longitude: 80.0569 },
    { name: 'West Tambaram', latitude: 12.9249, longitude: 80.1000 }
  ];

  // Periodically check if any shuttle is at its scheduled time without the Driver pressing Start Trip (one-time Admin notification)
  const runScheduleNotStartedCheck = async () => {
    try {
      const notifications = await db.checkScheduledTripsNotStarted();
      if (Array.isArray(notifications) && notifications.length > 0) {
        notifications.forEach((notif) => {
          io.emit('notification:new', notif);
        });
        const schedules = await db.getAllSchedules();
        io.emit('schedule:updated', { schedules });
        const shuttles = await db.getAllShuttles();
        shuttles.forEach((sh) => io.emit('shuttle:updated', sh));
      }
    } catch (_) {}
  };

  setTimeout(runScheduleNotStartedCheck, 2500);
  setInterval(runScheduleNotStartedCheck, 10000);

  io.on('connection', (socket) => {
    socket.on('join:shuttle', (shuttleId) => {
      socket.join(`shuttle_${shuttleId}`);
    });

    socket.on('leave:shuttle', (shuttleId) => {
      socket.leave(`shuttle_${shuttleId}`);
    });

    socket.on('join:admin', () => {
      socket.join('admin_room');
    });

    socket.on('driver:start_simulation', async ({ shuttleId }) => {
      const sId = Number(shuttleId) || 1;
      activeRealGpsDrivers.delete(sId);
      const shuttle = await db.getShuttleById(sId);
      const stops =
        shuttle?.stops && shuttle.stops.length >= 2 ? shuttle.stops : routeAStops;
      const trip = await db.createTrip({
        shuttle_id: sId,
        route_id: shuttle?.current_route_id || 1,
        passenger_count: 16
      });
      const updatedShuttle = await db.getShuttleById(sId);
      const schedules = await db.getAllSchedules();
      if (updatedShuttle) {
        io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('trip:status_change', {
        type: 'started',
        trip,
        shuttleId: sId
      });
      io.emit('schedule:updated', { schedules });
      startAutonomousShuttle(io, sId, stops, 28, true);
      socket.emit('simulation:state', { running: true });
    });

    socket.on('driver:stop_simulation', async ({ shuttleId }) => {
      const sId = Number(shuttleId) || 1;
      stopAutonomousShuttle(sId);
      await db.endTrip(sId);
      const updatedShuttle = await db.getShuttleById(sId);
      const schedules = await db.getAllSchedules();
      if (updatedShuttle) {
        io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('trip:status_change', {
        type: 'ended',
        shuttleId: sId
      });
      io.emit('schedule:updated', { schedules });
      socket.emit('simulation:state', { running: false });
    });

    // Handle real-time driver GPS coordinate update from driver's phone/browser (navigator.geolocation.watchPosition)
    socket.on('driver:location_update', async (data) => {
      try {
        const { shuttleId, latitude, longitude, speed, heading, forceHardwareGps } = data;
        if (!shuttleId || latitude === undefined || longitude === undefined) return;

        const sId = Number(shuttleId);
        const now = Date.now();

        const shuttle = await db.getShuttleById(sId);
        // Only broadcast live location if the Driver has pressed Start Trip (status === 'on_trip')!
        if (!shuttle || shuttle.status === 'inactive' || shuttle.status !== 'on_trip') return;

        // Check distance from the device's physical GPS to the Admin-allocated route stops
        let minDistanceToRouteKm = 0;
        if (shuttle.stops && shuttle.stops.length > 0) {
          const distances = shuttle.stops.map((st) =>
            calculateDistance(Number(latitude), Number(longitude), Number(st.latitude), Number(st.longitude))
          );
          minDistanceToRouteKm = Math.min(...distances);
        }

        // If the driver is testing on a laptop/phone far from the route stops (> 5 km away) and didn't force off-route,
        // immediately run the road-path trip simulation along the route so the bus moves right away without delay!
        if (minDistanceToRouteKm > 5.0 && !forceHardwareGps) {
          if (!activeSimulations.has(sId)) {
            const stops = shuttle?.stops && shuttle.stops.length >= 2 ? shuttle.stops : routeAStops;
            startAutonomousShuttle(io, sId, stops, 28, true);
          }
          return;
        }

        // Mark this shuttle as controlled by real Driver GPS within the route area
        activeRealGpsDrivers.set(sId, now);

        // Calculate real speed (km/h) & heading from consecutive GPS points if device GPS speed is null/0
        let computedSpeed = Number(speed) || 0;
        let computedHeading = Number(heading) || Number(shuttle.heading) || 65;
        const prevGps = lastDriverGpsPoint.get(sId);
        if (prevGps) {
          const dtHours = Math.max(0.0005, (now - prevGps.time) / 3600000);
          const movedKm = calculateDistance(prevGps.lat, prevGps.lng, Number(latitude), Number(longitude));
          if (!computedSpeed || computedSpeed <= 0) {
            computedSpeed = movedKm > 0.005 ? Math.min(65, Math.round(movedKm / dtHours)) : 24;
          }
          if (movedKm > 0.002) {
            computedHeading = calculateHeading(prevGps.lat, prevGps.lng, Number(latitude), Number(longitude));
          }
        } else if (!computedSpeed || computedSpeed <= 0) {
          computedSpeed = 24;
        }
        lastDriverGpsPoint.set(sId, { lat: Number(latitude), lng: Number(longitude), time: now });

        let distanceToNext = 1.4;
        let distanceToDest = 2.8;
        let nextStopName = shuttle.next_stop_name || shuttle.destination || 'Main Gate';
        let calculatedEta = 3;
        let destinationEta = 6;
        let reachedDestination = false;
        const totalRouteKm = computeTotalRouteDistanceKm(shuttle.stops);

        if (shuttle.stops && shuttle.stops.length > 0) {
          const distances = shuttle.stops.map((st) =>
            calculateDistance(Number(latitude), Number(longitude), Number(st.latitude), Number(st.longitude))
          );
          minDistanceToRouteKm = Math.min(...distances);

          // Find nearest upcoming stop on the Admin-allocated route
          let nearestIdx = 0;
          let nearestDist = Infinity;
          shuttle.stops.forEach((st, idx) => {
            const d = calculateDistance(
              Number(latitude),
              Number(longitude),
              Number(st.latitude),
              Number(st.longitude)
            );
            if (d < nearestDist) {
              nearestDist = d;
              nearestIdx = idx;
            }
          });
          const targetStopIdx = Math.min(shuttle.stops.length - 1, nearestIdx + 1);
          const currentStop = shuttle.stops[targetStopIdx] || shuttle.stops[shuttle.stops.length - 1];

          const finalStop = shuttle.stops[shuttle.stops.length - 1];
          const rawDistToDest = calculateDistance(
            Number(latitude),
            Number(longitude),
            Number(finalStop.latitude),
            Number(finalStop.longitude)
          );
          distanceToDest = Math.max(0.1, Number((rawDistToDest * 1.25).toFixed(2)));

          if (rawDistToDest <= 0.18) {
            reachedDestination = true;
            nextStopName = `${finalStop.name} (Driver Arrived)`;
            distanceToNext = 0;
            calculatedEta = 0;
            destinationEta = 0;
          } else if (currentStop) {
            nextStopName = currentStop.name;
            const rawNext = calculateDistance(
              Number(latitude),
              Number(longitude),
              Number(currentStop.latitude),
              Number(currentStop.longitude)
            );
            distanceToNext = Math.max(0.2, Number((rawNext * 1.22).toFixed(2)));
            const effSpeed = Math.max(12, computedSpeed);
            calculatedEta = Math.max(1, Math.round((distanceToNext / effSpeed) * 60));
            destinationEta = Math.max(calculatedEta, Math.round((distanceToDest / effSpeed) * 60));
          }
        }

        // Check if Driver deviated > 0.85 km from all stops on allocated route (notify Admin ONLY ONE TIME per trip)
        if (minDistanceToRouteKm > 0.85) {
          const offRouteResult = await db.recordDriverOffRouteDeviation(sId, {
            latitude: Number(latitude),
            longitude: Number(longitude),
            reason: `Driver ${shuttle.driver_name || 'Operator'} on Bus ${shuttle.code} is ${minDistanceToRouteKm.toFixed(1)} km off the allocated route (${shuttle.route?.name || 'Assigned Route'}).`
          });
          if (offRouteResult.notification) {
            io.emit('notification:new', offRouteResult.notification);
          }
        }

        // Check if bus has been stopped (speed === 0) for 20 minutes or more while not yet at destination
        if (Number(speed) === 0 && !reachedDestination) {
          if (!stationaryStartTime.has(sId)) {
            stationaryStartTime.set(sId, now);
          } else {
            const stoppedMs = now - stationaryStartTime.get(sId);
            if (stoppedMs >= 20 * 60 * 1000) {
              const stoppedMins = Math.floor(stoppedMs / 60000);
              const emergencyResult = await db.recordBusStoppedEmergency(sId, {
                reportedByRole: 'system',
                reportedByName: 'Auto Telemetry Monitor',
                stoppedMinutes: stoppedMins
              });
              if (emergencyResult && !emergencyResult.alreadyNotified && emergencyResult.notification) {
                io.emit('notification:new', emergencyResult.notification);
                io.emit('shuttle:emergency_stopped', {
                  shuttleId: emergencyResult.shuttleId,
                  busCode: emergencyResult.busCode,
                  driverName: emergencyResult.driverName,
                  routeName: emergencyResult.routeName,
                  stoppedMinutes: emergencyResult.stoppedMinutes,
                  alreadyNotified: emergencyResult.alreadyNotified,
                  reportedByRole: 'system',
                  reportedByName: 'Auto Telemetry Monitor'
                });
              }
            }
          }
        } else {
          stationaryStartTime.delete(sId);
        }

        if (reachedDestination) {
          const lastArr = lastDriverArrivalTime.get(sId) || 0;
          if (now - lastArr > 20000) {
            lastDriverArrivalTime.set(sId, now);
            const arrivalResult = await db.recordDriverDestinationArrival(sId);
            if (arrivalResult) {
              io.emit('schedule:updated', arrivalResult);
              if (arrivalResult.notification) {
                io.emit('notification:new', arrivalResult.notification);
              }
            }
          }
        }

        const updatedShuttle = await db.updateShuttle(sId, {
          current_lat: Number(latitude),
          current_lng: Number(longitude),
          speed: computedSpeed,
          heading: computedHeading,
          distance_km: distanceToNext,
          distance_to_destination_km: distanceToDest,
          total_route_km: totalRouteKm,
          eta_minutes: calculatedEta,
          destination_eta_minutes: destinationEta,
          next_stop_name: nextStopName,
          status: minDistanceToRouteKm > 0.85 ? 'delayed' : shuttle.status
        });

        const updatePayload = {
          shuttleId: sId,
          latitude: Number(latitude),
          longitude: Number(longitude),
          speed: computedSpeed,
          heading: computedHeading,
          distance_km: distanceToNext,
          distance_to_destination_km: distanceToDest,
          total_route_km: totalRouteKm,
          eta_minutes: calculatedEta,
          destination_eta_minutes: destinationEta,
          next_stop_name: nextStopName,
          isDestination: reachedDestination,
          status: updatedShuttle ? updatedShuttle.status : 'on_trip',
          timestamp: new Date().toISOString()
        };

        io.emit('shuttle:location_updated', updatePayload);
        io.emit('shuttle:quick_ping', updatePayload);
      } catch (err) {
        console.error('Error handling location update:', err);
      }
    });
  });
}

module.exports = { setupTrackingSocket, startAutonomousShuttle, stopAutonomousShuttle };
