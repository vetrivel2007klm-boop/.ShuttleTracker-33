const db = require('../config/db');

// In-memory simulation timers for testing without manual physical driving
const activeSimulations = new Map();
// Track when a real driver is actively streaming hardware GPS so simulation yields to real GPS
const activeRealGpsDrivers = new Map();
// Track last GPS coordinate per shuttle to compute real speed (km/h) when device speed is null
const lastDriverGpsPoint = new Map();
// Rolling 6-second GPS history per shuttle for accurate real speed calculation across 1-second ticks
const driverGpsHistory = new Map();
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

// Helper to calculate exact distance in kilometers between two geo coordinates (Haversine formula, 0.1m precision)
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
  return Number((R * c).toFixed(6));
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

// Function to run continuous real-road tracking along route stops (Disabled in favor of 100% Real Hardware GPS)
function startAutonomousShuttle(io, sId, fallbackStops, baseSpeed = 28, startFromBeginning = false) {
  const idNum = Number(sId);
  if (activeSimulations.has(idNum)) {
    clearInterval(activeSimulations.get(idNum));
    activeSimulations.delete(idNum);
  }
  // Autonomous waypoint marching is permanently disabled:
  // Shuttle position is driven 100% by the Driver's real GPS device.
}

function stopAutonomousShuttle(shuttleId) {
  const sId = Number(shuttleId);
  if (activeSimulations.has(sId)) {
    clearInterval(activeSimulations.get(sId));
    activeSimulations.delete(sId);
  }
  activeRealGpsDrivers.delete(sId);
  lastDriverGpsPoint.delete(sId);
  stationaryStartTime.delete(sId);
}

// In-memory latest telemetry state per shuttle for instant < 1ms Fast API reads
const liveTelemetryStore = new Map();

function getLiveTelemetry(shuttleId) {
  return liveTelemetryStore.get(Number(shuttleId)) || null;
}

function getAllLiveTelemetry() {
  const result = {};
  for (const [id, data] of liveTelemetryStore.entries()) {
    result[id] = data;
  }
  return result;
}

// Helper to project point P onto segment A-B and return { lat, lng, distKm, t }
function projectOntoSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = bLng - aLng;
  const dy = bLat - aLat;
  if (dx === 0 && dy === 0) {
    return {
      lat: aLat,
      lng: aLng,
      distKm: calculateDistance(pLat, pLng, aLat, aLng),
      t: 0
    };
  }
  const t = Math.max(0, Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)));
  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;
  return {
    lat: projLat,
    lng: projLng,
    distKm: calculateDistance(pLat, pLng, projLat, projLng),
    t
  };
}

// Process real-time hardware GPS telemetry from driver device (Dual Transport: Socket.IO & Fast REST API)
async function processDriverLocationUpdate(io, data) {
  try {
    const { shuttleId, latitude, longitude, speed, heading, accuracy, driverId, tripId } = data;
    if (!shuttleId || latitude === undefined || longitude === undefined) return null;

    const sId = Number(shuttleId);
    const now = Date.now();

    // Stop any autonomous simulation immediately when real hardware GPS arrives
    if (activeSimulations.has(sId)) {
      clearInterval(activeSimulations.get(sId));
      activeSimulations.delete(sId);
    }

    let shuttle = await db.getShuttleById(sId);
    if (!shuttle || shuttle.status === 'inactive') {
      return null;
    }

    // Auto-promote to on_trip when driver sends live GPS (never drop initial GPS packets while trip starts!)
    if (shuttle.status === 'idle') {
      await db.updateShuttle(sId, { status: 'on_trip' });
      shuttle = await db.getShuttleById(sId);
    }

    // Mark this shuttle as controlled by real Driver GPS
    activeRealGpsDrivers.set(sId, now);

    const rawLat = Number(latitude);
    const rawLng = Number(longitude);
    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return null;
    const accuracyMeters = Number(accuracy) > 0 ? Number(accuracy) : 25;

    // Maintain rolling 5-second GPS history for this shuttle to compute accurate real moving speed
    const history = (driverGpsHistory.get(sId) || []).filter((pt) => now - pt.time <= 5500);
    history.push({ lat: rawLat, lng: rawLng, time: now, speed: Number(speed) || 0 });
    driverGpsHistory.set(sId, history);

    // Keep coordinates 100% true to real hardware GPS — NEVER snap to route corridor or freeze
    const effectiveLat = rawLat;
    const effectiveLng = rawLng;

    const clientSpeed = typeof speed === 'number' && Number(speed) >= 0.8 ? Math.round(Number(speed)) : 0;
    let computedSpeed = clientSpeed;
    let computedHeading = Number(heading) || Number(shuttle.heading) || 0;
    let cumulativeMovedKm = Number(shuttle.distance_covered_km) || 0;

    const prevGps = lastDriverGpsPoint.get(sId);
    if (prevGps) {
      const dtHours = Math.max(0.00014, (now - prevGps.time) / 3600000);
      const movedKm = calculateDistance(prevGps.lat, prevGps.lng, rawLat, rawLng);

      // Rolling window displacement across the last 1s - 5s
      let windowMovedKm = movedKm;
      let windowDtHours = dtHours;
      if (history.length >= 2) {
        let anchorPt = history[0];
        for (let i = 0; i < history.length - 1; i++) {
          if (now - history[i].time >= 1000) {
            anchorPt = history[i];
          }
        }
        windowMovedKm = calculateDistance(anchorPt.lat, anchorPt.lng, rawLat, rawLng);
        windowDtHours = Math.max(0.000277, (now - anchorPt.time) / 3600000);
      }

      const isStationary = movedKm < 0.0006 && windowMovedKm < 0.0012 && clientSpeed < 1;

      if (isStationary) {
        computedSpeed = 0;
        cumulativeMovedKm = prevGps.cumulativeMovedKm || 0;
        lastDriverGpsPoint.set(sId, {
          lat: effectiveLat,
          lng: effectiveLng,
          time: now,
          lastMoveTime: prevGps.lastMoveTime || now,
          speed: 0,
          cumulativeMovedKm
        });
      } else {
        cumulativeMovedKm = Number(((prevGps.cumulativeMovedKm || 0) + movedKm).toFixed(4));
        if (computedSpeed < 1) {
          const rollingCalcSpeed =
            windowMovedKm >= 0.001
              ? Math.round(windowMovedKm / windowDtHours)
              : Math.round(movedKm / dtHours);
          computedSpeed = Math.min(95, Math.max(1, rollingCalcSpeed));
        }
        if (movedKm >= 0.0008) {
          computedHeading = calculateHeading(prevGps.lat, prevGps.lng, effectiveLat, effectiveLng);
        }
        lastDriverGpsPoint.set(sId, {
          lat: effectiveLat,
          lng: effectiveLng,
          time: now,
          lastMoveTime: now,
          speed: computedSpeed,
          cumulativeMovedKm
        });
      }
    } else {
      lastDriverGpsPoint.set(sId, {
        lat: effectiveLat,
        lng: effectiveLng,
        time: now,
        lastMoveTime: now,
        speed: computedSpeed,
        cumulativeMovedKm: 0
      });
    }

    let distanceToNext = 0;
    let distanceToDest = 0;
    let nextStopName = shuttle.next_stop_name || shuttle.destination || 'Destination';
    let calculatedEta = 1;
    let destinationEta = 2;
    let reachedDestination = false;
    const totalRouteKm = computeTotalRouteDistanceKm(shuttle.stops);

    const speedForEta = computedSpeed >= 3 ? computedSpeed : 22;

    if (shuttle.stops && shuttle.stops.length > 0) {
      const finalStop = shuttle.stops[shuttle.stops.length - 1];

      // Find nearest stop and closest route segment
      let nearestIdx = 0;
      let nearestDist = Infinity;
      shuttle.stops.forEach((st, idx) => {
        const d = calculateDistance(effectiveLat, effectiveLng, Number(st.latitude), Number(st.longitude));
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = idx;
        }
      });

      let minRouteCorridorDistKm = nearestDist;
      let bestSegmentIdx = Math.min(nearestIdx, Math.max(0, shuttle.stops.length - 2));

      if (shuttle.stops.length >= 2) {
        for (let i = 0; i < shuttle.stops.length - 1; i++) {
          const sA = shuttle.stops[i];
          const sB = shuttle.stops[i + 1];
          const proj = projectOntoSegment(
            effectiveLat,
            effectiveLng,
            Number(sA.latitude),
            Number(sA.longitude),
            Number(sB.latitude),
            Number(sB.longitude)
          );
          if (proj.distKm < minRouteCorridorDistKm) {
            minRouteCorridorDistKm = proj.distKm;
            bestSegmentIdx = i;
          }
        }
      }

      // If driver travels > 0.45 km outside route corridor with high accuracy while moving, notify Admin
      const lastOffAlertTime = lastOffRouteAlert.get(sId) || 0;
      if (
        minRouteCorridorDistKm > 0.45 &&
        accuracyMeters <= 90 &&
        (cumulativeMovedKm >= 0.05 || computedSpeed >= 10) &&
        now - lastOffAlertTime > 60000
      ) {
        lastOffRouteAlert.set(sId, now);
        const offRouteResult = await db.recordDriverOffRouteDeviation(sId, {
          latitude: effectiveLat,
          longitude: effectiveLng,
          reason: `Map GPS Route Deviation Detected (${minRouteCorridorDistKm.toFixed(2)} km off allocated route corridor)`
        });
        if (offRouteResult && !offRouteResult.alreadyNotified) {
          if (offRouteResult.notification && io) {
            io.emit('notification:new', offRouteResult.notification);
          }
          if (io) {
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
        }
      }

      // Determine next target stop along route
      let targetStopIdx = Math.min(shuttle.stops.length - 1, bestSegmentIdx + 1);
      const candidateStop = shuttle.stops[targetStopIdx];
      if (candidateStop) {
        const distToCandidate = calculateDistance(
          effectiveLat,
          effectiveLng,
          Number(candidateStop.latitude),
          Number(candidateStop.longitude)
        );
        if (distToCandidate <= 0.04 && targetStopIdx < shuttle.stops.length - 1) {
          targetStopIdx += 1;
        }
      }
      const currentStop = shuttle.stops[targetStopIdx] || finalStop;

      const rawDistToDest = calculateDistance(
        effectiveLat,
        effectiveLng,
        Number(finalStop.latitude),
        Number(finalStop.longitude)
      );

      const rawNext = currentStop
        ? calculateDistance(effectiveLat, effectiveLng, Number(currentStop.latitude), Number(currentStop.longitude))
        : rawDistToDest;
      distanceToNext = Number((rawNext * 1.2).toFixed(2));

      let remainingAfterTargetKm = 0;
      for (let i = targetStopIdx; i < shuttle.stops.length - 1; i++) {
        remainingAfterTargetKm +=
          calculateDistance(
            Number(shuttle.stops[i].latitude),
            Number(shuttle.stops[i].longitude),
            Number(shuttle.stops[i + 1].latitude),
            Number(shuttle.stops[i + 1].longitude)
          ) * 1.2;
      }
      distanceToDest = Number((distanceToNext + remainingAfterTargetKm).toFixed(2));

      // STRICT Destination Arrival: ONLY when at destination stop (<= 35m) AND vehicle has actually travelled significant distance (>= 0.5 km) AND stopped
      const isAtDestinationStop =
        targetStopIdx === shuttle.stops.length - 1 &&
        rawDistToDest <= 0.035 &&
        cumulativeMovedKm >= 0.5 &&
        computedSpeed === 0;

      if (isAtDestinationStop) {
        reachedDestination = true;
        nextStopName = `${finalStop.name} (Driver Arrived)`;
        distanceToNext = 0;
        distanceToDest = 0;
        calculatedEta = 0;
        destinationEta = 0;
      } else if (currentStop) {
        nextStopName = currentStop.name;
        calculatedEta = Math.max(1, Math.round((Math.max(0.05, distanceToNext) / speedForEta) * 60));
        destinationEta = Math.max(calculatedEta, Math.round((Math.max(0.05, distanceToDest) / speedForEta) * 60));
      }
    }

    // Check stationary 20-min emergency
    if (computedSpeed === 0 && !reachedDestination) {
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
          if (emergencyResult && !emergencyResult.alreadyNotified && emergencyResult.notification && io) {
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
        if (arrivalResult && io) {
          io.emit('schedule:updated', arrivalResult);
          io.emit('driver:updated', {
            shuttleId: sId,
            pointsEarned: arrivalResult.pointsEarned,
            totalDriverPoints: arrivalResult.totalDriverPoints,
            totalTripsCompleted: arrivalResult.totalTripsCompleted
          });
          if (arrivalResult.notification) {
            io.emit('notification:new', arrivalResult.notification);
          }
        }
      }
    }

    // Re-check shuttle status before saving
    const latestShuttleCheck = await db.getShuttleById(sId);
    if (!latestShuttleCheck || latestShuttleCheck.status === 'inactive') {
      return null;
    }

    const updatedShuttle = await db.updateShuttle(sId, {
      current_lat: effectiveLat,
      current_lng: effectiveLng,
      speed: computedSpeed,
      heading: computedHeading,
      distance_km: distanceToNext,
      distance_to_destination_km: distanceToDest,
      distance_covered_km: cumulativeMovedKm,
      total_route_km: totalRouteKm,
      eta_minutes: calculatedEta,
      destination_eta_minutes: destinationEta,
      next_stop_name: nextStopName,
      status: latestShuttleCheck.status === 'delayed' ? 'delayed' : 'on_trip'
    });

    const updatePayload = {
      shuttleId: sId,
      latitude: effectiveLat,
      longitude: effectiveLng,
      speed: computedSpeed,
      heading: computedHeading,
      distance_km: distanceToNext,
      distance_to_destination_km: distanceToDest,
      distance_covered_km: cumulativeMovedKm,
      total_route_km: totalRouteKm,
      eta_minutes: calculatedEta,
      destination_eta_minutes: destinationEta,
      next_stop_name: nextStopName,
      isDestination: reachedDestination,
      status: updatedShuttle ? updatedShuttle.status : 'on_trip',
      timestamp: new Date().toISOString()
    };

    // Cache in-memory for instant REST reads
    liveTelemetryStore.set(sId, updatePayload);

    if (io) {
      io.emit('shuttle:location_updated', updatePayload);
      io.emit('shuttle:quick_ping', updatePayload);
    }

    return updatePayload;
  } catch (err) {
    console.error('Error handling location update:', err);
    return null;
  }
}

function setupTrackingSocket(io) {
  // Periodically check if any shuttle is at its scheduled time without the Driver pressing Start Trip
  const runScheduleNotStartedCheck = async () => {
    try {
      const notifications = await db.checkScheduledTripsNotStarted();
      if (Array.isArray(notifications) && notifications.length > 0) {
        notifications.forEach((notif) => {
          io.emit('notification:new', notif);
        });
        const schedules = await db.getAllSchedules();
        io.emit('schedule:updated', { schedules });
        io.emit('driver:updated', { schedules });
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
      stopAutonomousShuttle(sId);
      socket.emit('simulation:state', { running: false });
    });

    socket.on('driver:stop_simulation', async ({ shuttleId }) => {
      const sId = Number(shuttleId) || 1;
      stopAutonomousShuttle(sId);
      await db.endTrip(sId, sId);
      const updatedShuttle = await db.updateShuttle(sId, { status: 'idle', speed: 0 });
      const schedules = await db.getAllSchedules();
      if (updatedShuttle) {
        io.emit('shuttle:updated', updatedShuttle);
      }
      io.emit('trip:status_change', {
        type: 'ended',
        shuttleId: sId,
        status: 'idle'
      });
      io.emit('schedule:updated', { schedules });
      socket.emit('simulation:state', { running: false });
    });

    // Handle real-time driver GPS coordinate update from driver's phone/browser (second-by-second live GPS)
    socket.on('driver:location_update', async (data) => {
      await processDriverLocationUpdate(io, data);
    });
  });
}

module.exports = {
  setupTrackingSocket,
  startAutonomousShuttle,
  stopAutonomousShuttle,
  processDriverLocationUpdate,
  getLiveTelemetry,
  getAllLiveTelemetry
};
