import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import LiveMap from '../../components/map/LiveMap';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import {
  Play,
  Square,
  MapPin,
  Clock,
  AlertTriangle,
  Sparkles,
  Compass,
  CheckCircle2,
  NavigationOff,
  Star,
  Siren,
  ArrowRight,
  Calendar,
  Mail,
  Users2,
  IdCard,
  Award,
  Eye
} from 'lucide-react';

function calcHaversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const DriverDashboard = () => {
  const { user } = useAuth();
  const {
    socket,
    liveLocations,
    sendDriverLocation,
    stopSimulation,
    simulationActive,
    relayCloudEmail,
    clearShuttleLiveLocation
  } = useSocket();
  const { addToast } = useToast();

  const [driverData, setDriverData] = useState(null);
  const [tripStatus, setTripStatus] = useState('NOT_STARTED');
  const [activeTripId, setActiveTripId] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('Standby');
  const [mapFocusTrigger, setMapFocusTrigger] = useState(0);
  const [previewPassengerIdCard, setPreviewPassengerIdCard] = useState(null);
  const [currentCoords, setCurrentCoords] = useState({
    lat: null,
    lng: null,
    speed: 0,
    heading: 0
  });

  // Per-trip notification status indicators
  const [delayNotifiedForTrip, setDelayNotifiedForTrip] = useState(false);
  const [offRouteNotifiedForTrip, setOffRouteNotifiedForTrip] = useState(false);
  const [emergencyStoppedNotifiedForTrip, setEmergencyStoppedNotifiedForTrip] = useState(false);

  // Delay reporting modal
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [delayMinutes, setDelayMinutes] = useState(5);
  const [delayReason, setDelayReason] = useState('Heavy campus traffic near current stop');

  const watchIdRef = useRef(null);
  const latestGpsRef = useRef(null);
  const gpsSecondTimerRef = useRef(null);
  const isTripActiveRef = useRef(false);
  const endingTripCooldownRef = useRef(0);

  const fetchDriver = async () => {
    try {
      const res = await api.get('/drivers/me');
      if (res.data.success && res.data.data) {
        const d = res.data.data;
        const recentlyEnded = Date.now() - endingTripCooldownRef.current < 6000;
        if (recentlyEnded && d.assignedShuttle) {
          d.assignedShuttle.status = 'idle';
          d.assignedShuttle.speed = 0;
        }
        setDriverData(d);
        if (!recentlyEnded && (d.assignedShuttle?.status === 'on_trip' || d.assignedShuttle?.status === 'delayed')) {
          setTripStatus('LIVE');
          isTripActiveRef.current = true;
          setGpsStatus('Connected (Live Hardware GPS)');
        } else {
          setTripStatus('NOT_STARTED');
          isTripActiveRef.current = false;
          setGpsStatus('Standby (Press Start Trip)');
        }
        if (d.delayNotifiedForTrip !== undefined) {
          setDelayNotifiedForTrip(Boolean(d.delayNotifiedForTrip));
        }
        if (d.offRouteNotifiedForTrip !== undefined) {
          setOffRouteNotifiedForTrip(Boolean(d.offRouteNotifiedForTrip));
        }
        if (d.emergencyStoppedNotifiedForTrip !== undefined) {
          setEmergencyStoppedNotifiedForTrip(Boolean(d.emergencyStoppedNotifiedForTrip));
        }
      }
    } catch (err) {
      console.error('Error fetching driver:', err);
    }
  };

  useEffect(() => {
    fetchDriver();
    return () => {
      isTripActiveRef.current = false;
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (gpsSecondTimerRef.current) {
        clearInterval(gpsSecondTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const sId = driverData?.assignedShuttle?.id || 1;

    const handleSync = () => fetchDriver();
    const handleScheduleUpdate = (payload) => {
      fetchDriver();
      if (payload && Number(payload.shuttleId) === Number(sId) && payload.delayMinutes > 0) {
        setDelayNotifiedForTrip(true);
      }
    };
    const handleDriverScheduleAssigned = () => {
      fetchDriver();
    };
    const handleOffRoute = (payload) => {
      if (payload && Number(payload.shuttleId) === Number(sId)) {
        setOffRouteNotifiedForTrip(true);
      }
    };
    const handleEmergencyStopped = (payload) => {
      if (
        payload &&
        Number(payload.shuttleId) === Number(sId) &&
        (payload.thresholdReached || payload.reportedByRole === 'driver' || payload.reportedByRole === 'system')
      ) {
        setEmergencyStoppedNotifiedForTrip(true);
      }
    };

    socket.on('route:updated', handleSync);
    socket.on('shuttle:updated', handleSync);
    socket.on('driver:updated', handleSync);
    socket.on('driver:feedback_updated', handleSync);
    socket.on('schedule:updated', handleScheduleUpdate);
    socket.on('driver:schedule_assigned', handleDriverScheduleAssigned);
    socket.on('shuttle:off_route', handleOffRoute);
    socket.on('shuttle:emergency_stopped', handleEmergencyStopped);

    return () => {
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('driver:updated', handleSync);
      socket.off('driver:feedback_updated', handleSync);
      socket.off('schedule:updated', handleScheduleUpdate);
      socket.off('driver:schedule_assigned', handleDriverScheduleAssigned);
      socket.off('shuttle:off_route', handleOffRoute);
      socket.off('shuttle:emergency_stopped', handleEmergencyStopped);
    };
  }, [socket, driverData?.assignedShuttle?.id]);

  const baseShuttle = driverData?.assignedShuttle || {
    id: 1,
    code: 'BUS',
    name: 'Assigned Shuttle',
    start_point: 'Start',
    destination: 'Destination',
    route_name: 'Assigned Route',
    next_stop_name: 'Start',
    eta_minutes: 0,
    distance_km: 0,
    current_lat: 12.9249,
    current_lng: 80.1275,
    speed: 0,
    heading: 0,
    status: 'idle',
    stops: []
  };

  const live = liveLocations[baseShuttle.id];
  const assignedShuttle =
    tripStatus === 'LIVE'
      ? {
          ...baseShuttle,
          current_lat: currentCoords.lat ?? live?.latitude ?? baseShuttle.current_lat,
          current_lng: currentCoords.lng ?? live?.longitude ?? baseShuttle.current_lng,
          speed: live?.speed !== undefined ? live.speed : (currentCoords.speed ?? 0),
          heading: live?.heading ?? currentCoords.heading ?? baseShuttle.heading ?? 0,
          status: 'on_trip',
          eta_minutes: live?.eta_minutes !== undefined ? live.eta_minutes : baseShuttle.eta_minutes,
          next_stop_name: live?.next_stop_name || baseShuttle.next_stop_name,
          distance_km: live?.distance_km !== undefined ? live.distance_km : baseShuttle.distance_km,
          distance_covered_km:
            live?.distance_covered_km !== undefined
              ? live.distance_covered_km
              : baseShuttle.distance_covered_km
        }
      : {
          ...baseShuttle,
          status: 'idle',
          speed: 0
        };

  const driverAvatar =
    driverData?.avatar_url ||
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driverData?.name || user?.name || 'Driver')}`;
  const driverCode = driverData?.driver_code || `DRV-${100 + Number(driverData?.id || 1)}`;
  const routePassengers = driverData?.routePassengers || [];
  const activeStops = assignedShuttle.stops?.length > 0 ? assignedShuttle.stops : [];

  // Process hardware GPS coordinates with 3-meter jitter lock:
  // If driver does not move, shuttle stays at exact same location with 0 km/h.
  // If driver moves >= 3 meters, shuttle moves that exact distance and calculates real speed.
  const applyHardwareGpsReading = (coords, shuttleIdToUse, tripIdToUse) => {
    if (!isTripActiveRef.current) return;
    const rawLat = Number(coords?.latitude);
    const rawLng = Number(coords?.longitude);
    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) return;

    const nowMs = Date.now();
    const rawSpeedKmh =
      typeof coords.speed === 'number' && !Number.isNaN(coords.speed) && coords.speed >= 0
        ? coords.speed * 3.6
        : null;
    const rawHeading =
      typeof coords.heading === 'number' && !Number.isNaN(coords.heading) ? coords.heading : 0;

    const prev = latestGpsRef.current;
    if (!prev) {
      const firstFix = {
        lat: rawLat,
        lng: rawLng,
        speed: 0,
        heading: rawHeading,
        lastMoveMs: nowMs,
        timestamp: nowMs
      };
      latestGpsRef.current = firstFix;
      setCurrentCoords({
        lat: rawLat,
        lng: rawLng,
        speed: 0,
        heading: rawHeading
      });
      setGpsStatus('Connected (Exact Hardware GPS)');
      sendDriverLocation({
        shuttleId: shuttleIdToUse,
        tripId: tripIdToUse,
        latitude: rawLat,
        longitude: rawLng,
        speed: 0,
        heading: rawHeading,
        driverId: user?.id
      });
      setMapFocusTrigger((c) => c + 1);
      return;
    }

    const movedKm = calcHaversineKm(prev.lat, prev.lng, rawLat, rawLng);
    const dtHours = Math.max(0.000277, (nowMs - (prev.lastMoveMs || prev.timestamp || nowMs)) / 3600000);

    // Stationary filter: ignore < 3 meters (0.003 km) GPS noise when standing still
    if (movedKm < 0.003 && (rawSpeedKmh === null || rawSpeedKmh < 1.5)) {
      const stationaryFix = {
        ...prev,
        speed: 0,
        timestamp: nowMs
      };
      latestGpsRef.current = stationaryFix;
      setCurrentCoords({
        lat: prev.lat,
        lng: prev.lng,
        speed: 0,
        heading: prev.heading
      });
      setGpsStatus('Connected (Exact Hardware GPS)');
      sendDriverLocation({
        shuttleId: shuttleIdToUse,
        tripId: tripIdToUse,
        latitude: prev.lat,
        longitude: prev.lng,
        speed: 0,
        heading: prev.heading,
        driverId: user?.id
      });
      return;
    }

    // Driver moved physically >= 3 meters: move exact distance & calculate real speed
    const computedSpeedKmh =
      rawSpeedKmh !== null && rawSpeedKmh >= 1
        ? Math.round(rawSpeedKmh)
        : Math.min(90, Math.max(1, Math.round(movedKm / dtHours)));

    const movedFix = {
      lat: rawLat,
      lng: rawLng,
      speed: computedSpeedKmh,
      heading: rawHeading || prev.heading || 0,
      lastMoveMs: nowMs,
      timestamp: nowMs
    };
    latestGpsRef.current = movedFix;
    setCurrentCoords({
      lat: rawLat,
      lng: rawLng,
      speed: computedSpeedKmh,
      heading: movedFix.heading
    });
    setGpsStatus('Connected (Exact Hardware GPS)');
    sendDriverLocation({
      shuttleId: shuttleIdToUse,
      tripId: tripIdToUse,
      latitude: rawLat,
      longitude: rawLng,
      speed: computedSpeedKmh,
      heading: movedFix.heading,
      driverId: user?.id
    });
  };

  // Start hardware GPS watcher + second-by-second (1000ms) live location broadcast
  const startHardwareGpsTracking = (shuttleIdToUse, tripIdToUse) => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS Not Supported on Browser');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        applyHardwareGpsReading(position.coords, shuttleIdToUse, tripIdToUse);
      },
      (err) => {
        console.warn('Hardware GPS watch notice:', err.message);
        // Retry high-accuracy GPS without ever starting fake route simulation
        navigator.geolocation.getCurrentPosition(
          (pos) => applyHardwareGpsReading(pos.coords, shuttleIdToUse, tripIdToUse),
          () => {},
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    if (gpsSecondTimerRef.current) {
      clearInterval(gpsSecondTimerRef.current);
    }

    // Second-by-second (1000ms) exact hardware GPS heartbeat
    gpsSecondTimerRef.current = setInterval(() => {
      if (!isTripActiveRef.current) return;
      const latest = latestGpsRef.current;
      if (!latest) return;
      const idleMs = Date.now() - (latest.lastMoveMs || latest.timestamp || Date.now());
      const effectiveSpeed = idleMs > 3000 ? 0 : latest.speed;
      if (effectiveSpeed !== latest.speed) {
        latest.speed = 0;
        setCurrentCoords((prev) => ({ ...prev, speed: 0 }));
      }
      sendDriverLocation({
        shuttleId: shuttleIdToUse,
        tripId: tripIdToUse,
        latitude: latest.lat,
        longitude: latest.lng,
        speed: effectiveSpeed,
        heading: latest.heading || 0,
        driverId: user?.id
      });
    }, 1000);
  };

  // Resume hardware GPS tracking automatically if page is refreshed while tripStatus === 'LIVE'
  useEffect(() => {
    if (tripStatus === 'LIVE' && !simulationActive && watchIdRef.current === null && assignedShuttle?.id) {
      isTripActiveRef.current = true;
      startHardwareGpsTracking(assignedShuttle.id, activeTripId);
    }
    if (tripStatus !== 'LIVE') {
      isTripActiveRef.current = false;
      if (gpsSecondTimerRef.current) {
        clearInterval(gpsSecondTimerRef.current);
        gpsSecondTimerRef.current = null;
      }
    }
  }, [tripStatus, simulationActive, assignedShuttle?.id]);

  // Start Trip & Hardware Geolocation Watcher (NEVER runs fake autonomous route simulation when Driver presses Start Trip)
  const handleStartTrip = async () => {
    try {
      endingTripCooldownRef.current = 0;
      setGpsStatus('Acquiring Exact Hardware GPS...');
      stopSimulation(assignedShuttle.id);
      latestGpsRef.current = null;

      // Acquire initial hardware GPS position if user clicks Allow
      let initialPosition = null;
      if (navigator.geolocation) {
        initialPosition = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            () => {
              navigator.geolocation.getCurrentPosition(
                (posFallback) => resolve(posFallback),
                () => resolve(null),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
              );
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          );
        });
      }

      const initLat = initialPosition?.coords?.latitude;
      const initLng = initialPosition?.coords?.longitude;
      const initHeading = initialPosition?.coords?.heading || 0;

      const res = await api.post('/trips/start', {
        shuttle_id: assignedShuttle.id,
        route_id: assignedShuttle.current_route_id || 1,
        passenger_count: routePassengers.length || 14,
        latitude: initLat,
        longitude: initLng,
        speed: 0,
        heading: initHeading
      });

      if (res.data?.emailRelayPayload) {
        relayCloudEmail?.(res.data.emailRelayPayload);
      }

      if (res.data.success) {
        const startedTripId = res.data.data.id;
        isTripActiveRef.current = true;
        setActiveTripId(startedTripId);
        setTripStatus('LIVE');
        setDelayNotifiedForTrip(false);
        setOffRouteNotifiedForTrip(false);
        setEmergencyStoppedNotifiedForTrip(false);

        if (initialPosition?.coords) {
          applyHardwareGpsReading(initialPosition.coords, assignedShuttle.id, startedTripId);
        } else {
          setMapFocusTrigger((c) => c + 1);
        }

        // Start continuous second-by-second real hardware GPS tracking
        startHardwareGpsTracking(assignedShuttle.id, startedTripId);

        addToast({
          title: 'Trip Started — Passengers Notified (Login & Email)',
          message: `Bus ${assignedShuttle.code} is now tracking your exact GPS location second-by-second and passengers have been notified via Login & Email.`,
          type: 'success'
        });
      }
    } catch (err) {
      addToast({
        title: 'Error',
        message: 'Failed to initiate trip on server',
        type: 'danger'
      });
    }
  };

  // End Trip — Works in ANY situation (whether activeTripId exists or not, whether schedule exists or not)
  const handleEndTrip = async () => {
    const sId = assignedShuttle?.id || baseShuttle?.id || 1;
    const tId = activeTripId || sId;

    // 1. Immediately halt all GPS watchers, timers, and simulation
    isTripActiveRef.current = false;
    endingTripCooldownRef.current = Date.now();
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (gpsSecondTimerRef.current) {
      clearInterval(gpsSecondTimerRef.current);
      gpsSecondTimerRef.current = null;
    }
    latestGpsRef.current = null;
    try {
      stopSimulation(sId);
      clearShuttleLiveLocation?.(sId);
    } catch (_) {}

    // 2. Immediately transition UI state to NOT_STARTED so End Trip always works visually & functionally
    setTripStatus('NOT_STARTED');
    setActiveTripId(null);
    setGpsStatus('Standby (Trip Ended)');
    setCurrentCoords({ lat: null, lng: null, speed: 0, heading: 0 });
    setDriverData((prev) =>
      prev
        ? {
            ...prev,
            assignedShuttle: prev.assignedShuttle
              ? { ...prev.assignedShuttle, status: 'idle', speed: 0 }
              : prev.assignedShuttle
          }
        : prev
    );

    const currentDelay = Number(driverData?.delayMinutes || 0);
    let endData = null;

    // 3. Notify backend to end trip & record arrival (resilient in any situation)
    try {
      const endRes = await api.post(`/trips/${tId}/end`, {
        shuttle_id: sId,
        trip_id: activeTripId || sId,
        delay_minutes: currentDelay
      });
      endData = endRes.data?.data?.arrivalResult || endRes.data?.data || null;
      if (endRes.data?.emailRelayPayload) {
        relayCloudEmail?.(endRes.data.emailRelayPayload);
      }
    } catch (_) {
      try {
        await api.post('/trips/end', { shuttle_id: sId });
      } catch (__) {}
    }

    fetchDriver();

    const ptsEarned = endData?.pointsEarned ?? (currentDelay > 0 ? Math.max(2, 10 - currentDelay) : 10);
    const monthlyPts =
      endData?.monthlyPoints ??
      endData?.driverPoints ??
      (Number(driverData?.monthlyPoints ?? driverData?.driver_points ?? 10) + ptsEarned);
    const yearlyPts =
      endData?.yearlyPoints ??
      (Number(driverData?.yearlyPoints ?? driverData?.yearly_points ?? monthlyPts));

    if (currentDelay > 0) {
      addToast({
        title: `Trip Ended (+${currentDelay}m Delayed • +${ptsEarned} Pts)`,
        message: `Trip ended with +${currentDelay} min delay. Admin notified & points added to score (Monthly: ${monthlyPts} pts • Yearly: ${yearlyPts} pts).`,
        type: 'warning'
      });
    } else {
      addToast({
        title: `Trip Ended Successfully (+${ptsEarned} Pts)`,
        message: `Trip ended and Bus ${assignedShuttle.code} is now in Standby! +${ptsEarned} points added to score (Monthly: ${monthlyPts} pts • Yearly: ${yearlyPts} pts).`,
        type: 'success'
      });
    }
  };

  // Report Delay (Notifies Admin in Admin Site + Admin Email cleancodeuniverse@gmail.com & notifies passengers)
  const handleReportDelay = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/trips/${activeTripId || assignedShuttle.id}/delay`, {
        shuttle_id: assignedShuttle.id,
        minutes: delayMinutes,
        reason: delayReason
      });
      if (res.data?.emailRelayPayload) {
        relayCloudEmail?.(res.data.emailRelayPayload);
      }
      setDelayNotifiedForTrip(true);
      fetchDriver();
      addToast({
        title: 'Delay Alert Sent to Admin (Site & Email)',
        message:
          res.data?.message ||
          `Admin (cleancodeuniverse@gmail.com) and passengers notified of +${delayMinutes} min delay on Bus ${assignedShuttle.code}.`,
        type: 'warning'
      });
      setIsDelayModalOpen(false);
    } catch (err) {
      addToast({ title: 'Error', message: 'Could not report delay', type: 'danger' });
    }
  };

  // Off-Route Deviation Alert to Admin (Notifies Admin in Admin Site + Admin Email cleancodeuniverse@gmail.com)
  const handleTriggerOffRouteAlert = async () => {
    try {
      const res = await api.post('/trips/off-route', {
        shuttle_id: assignedShuttle.id,
        latitude: Number(assignedShuttle.current_lat || currentCoords.lat || 12.9249) + 0.012,
        longitude: Number(assignedShuttle.current_lng || currentCoords.lng || 80.1275) - 0.011,
        reason: `Driver ${driverData?.name || user?.name || ''} deviated from allocated route (${assignedShuttle.start_point || 'Start'} ➔ ${assignedShuttle.destination || 'Destination'}) on Bus ${assignedShuttle.code}.`
      });
      if (res.data?.emailRelayPayload) {
        relayCloudEmail?.(res.data.emailRelayPayload);
      }
      if (res.data.success) {
        setOffRouteNotifiedForTrip(true);
        addToast({
          title: 'Off-Route Alert Sent to Admin (Site & Email)',
          message:
            res.data.message ||
            `Admin (cleancodeuniverse@gmail.com) has been notified via Admin Site & Email that Bus ${assignedShuttle.code} deviated from its allocated route.`,
          type: 'warning'
        });
      }
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to send off-route alert', type: 'danger' });
    }
  };

  // Direct Driver Emergency Alert to Admin (Sends immediate Notification + Email to Admin)
  const handleEmergencyStoppedAlert = async () => {
    try {
      const res = await api.post('/trips/emergency-stopped', {
        shuttle_id: assignedShuttle.id,
        stopped_minutes: 20,
        reported_by_role: 'driver',
        reason: `Emergency reported directly by Driver (${driverData?.name || user?.name || 'Driver'}): Bus ${assignedShuttle.code} on route ${assignedShuttle.start_point || 'Start'} ➔ ${assignedShuttle.destination || 'Destination'} requires immediate emergency assistance.`
      });

      if (res.data?.emailRelayPayload) {
        relayCloudEmail?.(res.data.emailRelayPayload);
      }

      if (res.data.success) {
        setEmergencyStoppedNotifiedForTrip(true);
        addToast({
          title: 'Emergency Alert Sent to Admin (Login & Email)',
          message:
            res.data.message ||
            `Admin (cleancodeuniverse@gmail.com) has been notified immediately via Dashboard and Email about the emergency on Bus ${assignedShuttle.code}.`,
          type: 'danger'
        });
      }
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to send emergency alert to Admin', type: 'danger' });
    }
  };

  const displaySpeed = Math.max(0, Math.round(Number(assignedShuttle.speed ?? currentCoords.speed ?? 0)));
  const assignedSchedules = Array.isArray(driverData?.schedules) ? driverData.schedules : [];
  const monthlyPoints = driverData?.monthlyPoints ?? driverData?.monthly_points ?? driverData?.driver_points ?? driverData?.dailyPoints ?? 10;
  const yearlyPoints = driverData?.yearlyPoints ?? driverData?.yearly_points ?? driverData?.driver_points ?? monthlyPoints;
  const totalTripsCompleted = driverData?.totalTripsCompleted ?? driverData?.total_trips ?? 1;
  const lastPointsEarned = driverData?.lastPointsEarned ?? driverData?.last_points_earned ?? 10;
  const driverDelayMins = Number(driverData?.delayMinutes ?? driverData?.delay_minutes ?? 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Section: Driver Profile Image, ID, Name & Assigned Bus/Route */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-premium flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <img
            src={driverAvatar}
            alt={driverData?.name || user?.name || 'Driver'}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500 shadow-glow shrink-0"
          />
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-black text-navy-900 dark:text-white">
                {driverData?.name || user?.name || 'Driver Cockpit'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/70 text-brand-600 dark:text-accent-blue text-[11px] font-black border border-brand-200 dark:border-brand-800">
                ID: {driverCode}
              </span>
              <Badge status={tripStatus === 'LIVE' ? 'on_trip' : 'idle'}>
                {tripStatus === 'LIVE' ? 'ON TRIP' : 'TRIP NOT STARTED'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Assigned Bus:{' '}
              <b className="text-brand-600 dark:text-accent-blue">{assignedShuttle.code}</b> ({assignedShuttle.name})
            </p>
            <p className="text-xs text-slate-400">
              Allocated Route:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {assignedShuttle.start_point || 'Hostel'} ➔ {assignedShuttle.destination || 'Campus'}
              </span>
            </p>
          </div>
        </div>

        {/* GPS Status, All-Trips Points (Monthly & Yearly) & Admin-Verified License Badge */}
        <div className="flex flex-col items-center sm:items-end gap-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-extrabold text-amber-700 dark:text-amber-300">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Monthly: {monthlyPoints} pts • Yearly: {yearlyPoints} pts</span>
              <span className="text-[10px] font-bold opacity-80">
                ({totalTripsCompleted} Trips • {driverDelayMins > 0 ? `+${lastPointsEarned} pts after ${driverDelayMins}m delay` : '+10 pts On-Time'})
              </span>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  gpsStatus.includes('Connected')
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-slate-400'
                }`}
              />
              <span>
                GPS: <b className="text-navy-900 dark:text-white">{gpsStatus}</b>
              </span>
            </div>
          </div>

          {driverData?.license_photo_url && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Driving License Verified</span>
            </span>
          )}
        </div>
      </div>

      {/* Admin Schedule Notification Banner in Driver Login */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/80 to-emerald-50/70 dark:from-slate-900 dark:via-blue-950/40 dark:to-emerald-950/30 border border-brand-200 dark:border-brand-800/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-navy-900 dark:text-white">
                  Admin Assigned Schedule & Safe Ride Notice
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  <Mail className="w-3 h-3" />
                  Email & Login Notified
                </span>
              </div>
              {assignedSchedules.length > 0 ? (
                <div className="mt-1.5 space-y-1">
                  {assignedSchedules.map((sc, idx) => (
                    <p
                      key={sc.id || idx}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex flex-wrap items-center gap-2"
                    >
                      <span className="px-2 py-0.5 rounded-md bg-brand-600 text-white font-mono text-[11px] font-bold">
                        {sc.departure_time} – {sc.arrival_time}
                      </span>
                      <span>
                        Bus <b>{sc.shuttle_code || assignedShuttle.code}</b> •{' '}
                        <b>{sc.route_name || `${assignedShuttle.start_point} ➔ ${assignedShuttle.destination}`}</b>
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                        — Your schedule time is on, so be ready to ride safely!
                      </span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  When Admin sets your schedule time, you will be notified here earlier and receive an email from Admin (<i>"Your schedule time is on — ready to ride safely"</i>).
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* LARGE TRIP CONTROL BUTTON & DELAY / OFF-ROUTE / EMERGENCY CONTROLS */}
      <div className="space-y-4">
        {tripStatus === 'NOT_STARTED' ? (
          <button
            type="button"
            onClick={handleStartTrip}
            className="w-full py-5 sm:py-6 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xl sm:text-2xl shadow-glow flex items-center justify-center gap-3 transition-transform active:scale-[0.99]"
          >
            <Play className="w-7 h-7 fill-white" />
            <span>START TRIP</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleEndTrip}
            className="w-full py-5 sm:py-6 rounded-3xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-black text-xl sm:text-2xl shadow-elevated flex items-center justify-center gap-3 transition-transform active:scale-[0.99]"
          >
            <Square className="w-7 h-7 fill-white" />
            <span>END TRIP</span>
          </button>
        )}

        {/* Driver Action Controls: Report Route Delay, Off-Route Alert, & Emergency (Simulated GPS Removed) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            variant="outline"
            size="lg"
            icon={delayNotifiedForTrip ? CheckCircle2 : AlertTriangle}
            onClick={() => setIsDelayModalOpen(true)}
            className={`w-full justify-center ${
              delayNotifiedForTrip
                ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
            }`}
          >
            {delayNotifiedForTrip ? 'Delay Sent (Report Again)' : 'Report Route Delay'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            icon={offRouteNotifiedForTrip ? CheckCircle2 : NavigationOff}
            onClick={handleTriggerOffRouteAlert}
            className={`w-full justify-center ${
              offRouteNotifiedForTrip
                ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20'
            }`}
          >
            {offRouteNotifiedForTrip ? 'Off-Route Sent (Resend)' : 'Off-Route Alert'}
          </Button>

          <Button
            variant="outline"
            size="lg"
            icon={emergencyStoppedNotifiedForTrip ? CheckCircle2 : Siren}
            onClick={handleEmergencyStoppedAlert}
            className={`w-full justify-center ${
              emergencyStoppedNotifiedForTrip
                ? 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-red-400 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30'
            }`}
          >
            {emergencyStoppedNotifiedForTrip ? 'Emergency Sent (Resend)' : 'Emergency'}
          </Button>
        </div>
      </div>

      {/* Operational Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <Card className="p-6 text-center flex flex-col justify-between border-brand-200 dark:border-brand-900/60 shadow-premium">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-brand-600 dark:text-accent-blue mx-auto flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="my-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
              Next Stop / Destination
            </span>
            <h3 className="text-xl font-black text-navy-900 dark:text-white mt-1">
              {assignedShuttle.next_stop_name || assignedShuttle.destination || 'Academic Block'}
            </h3>
          </div>
          <span className="text-xs font-semibold text-brand-600 dark:text-accent-blue">
            Allocated Corridor
          </span>
        </Card>

        <Card className="p-6 text-center flex flex-col justify-between border-emerald-200 dark:border-emerald-900/60 shadow-premium">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 mx-auto flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div className="my-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
              Estimated Arrival (ETA)
            </span>
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {assignedShuttle.eta_minutes ?? 3} min
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Distance: {assignedShuttle.distance_km ?? 1.8} km
          </span>
        </Card>

        <Card className="p-6 text-center flex flex-col justify-between border-slate-200 dark:border-slate-800 shadow-premium">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mx-auto flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <div className="my-2">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block">
              Vehicle Speed
            </span>
            <h3 className="text-3xl font-black text-navy-900 dark:text-white mt-1">
              {displaySpeed} km/h
            </h3>
          </div>
          <span className="text-xs text-slate-400">Heading: North-East</span>
        </Card>
      </div>

      {/* Live Map Embedded Directly in Driver Dashboard */}
      <Card className="p-4 border border-slate-200 dark:border-slate-800 shadow-elevated space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-sm font-black text-navy-900 dark:text-white flex items-center gap-2">
              <span>Live Route Map — Bus {assignedShuttle.code}</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                ({assignedShuttle.start_point || 'Hostel'}
                <ArrowRight className="w-3 h-3 text-brand-500" />
                {assignedShuttle.destination || 'Campus'})
              </span>
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
              GPS: {Number(assignedShuttle.current_lat || 12.9745).toFixed(5)}°N, {Number(assignedShuttle.current_lng || 77.5992).toFixed(5)}°E
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 font-bold text-brand-600 dark:text-accent-blue">
              {activeStops.length} Route Stops • {displaySpeed} km/h • ETA {assignedShuttle.eta_minutes ?? 3}m
            </span>
          </div>
        </div>

        <div className="h-[460px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative">
          <LiveMap
            shuttles={tripStatus === 'LIVE' ? [assignedShuttle] : []}
            stops={activeStops}
            selectedShuttleId={tripStatus === 'LIVE' ? assignedShuttle.id : null}
            focusTrigger={mapFocusTrigger}
            className="h-full w-full"
          />
        </div>
      </Card>

      {/* Allocated Passengers on Driver's Bus (Passenger Name, Profile Photo & Passenger ID) */}
      <Card className="p-5 border border-slate-200 dark:border-slate-800 shadow-premium space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-accent-blue flex items-center justify-center">
              <Users2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-navy-900 dark:text-white">
                Allocated Passengers — Bus {assignedShuttle.code} ({routePassengers.length} Passengers)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Passenger Name, Profile Photo & Verified Passenger ID for your allocated route ({assignedShuttle.start_point || 'Start'} ➔ {assignedShuttle.destination || 'Destination'})
              </p>
            </div>
          </div>
          <Badge status="active">Bus {assignedShuttle.code} Manifest</Badge>
        </div>

        {routePassengers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No passengers currently allocated to Bus {assignedShuttle.code}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {routePassengers.map((p, idx) => {
              const passengerCode = p.passenger_code || `PASS-${1000 + Number(p.id || idx + 1)}`;
              const passengerAvatar =
                p.avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name || 'Passenger')}`;

              return (
                <div
                  key={p.id || idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-start justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={passengerAvatar}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-brand-500/70 shrink-0"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-black text-navy-900 dark:text-white truncate">
                        {p.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-blue-300 text-[10px] font-extrabold border border-brand-200 dark:border-brand-800">
                          <IdCard className="w-3 h-3" />
                          ID: {passengerCode}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                          Bus {p.bus_number || assignedShuttle.code}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        Stop: <b className="text-slate-700 dark:text-slate-200">{p.destination || assignedShuttle.destination}</b>
                      </p>
                      {p.organization_name && (
                        <p className="text-[10px] text-slate-400 truncate">{p.organization_name}</p>
                      )}
                    </div>
                  </div>

                  {p.id_card_url && (
                    <button
                      type="button"
                      onClick={() => setPreviewPassengerIdCard(p)}
                      className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 transition flex items-center gap-1 shrink-0"
                      title="View Passenger ID Card"
                    >
                      <Eye className="w-3 h-3" />
                      <span>ID Card</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Passenger ID Card Preview Modal */}
      {previewPassengerIdCard && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewPassengerIdCard(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={
                    previewPassengerIdCard.avatar_url ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewPassengerIdCard.name || 'P')}`
                  }
                  alt={previewPassengerIdCard.name}
                  className="w-9 h-9 rounded-lg object-cover border border-brand-400"
                />
                <div>
                  <h4 className="text-sm font-black text-navy-900 dark:text-white">
                    {previewPassengerIdCard.name}
                  </h4>
                  <p className="text-[11px] font-bold text-brand-600 dark:text-brand-400">
                    Passenger ID: {previewPassengerIdCard.passenger_code || `PASS-${1000 + Number(previewPassengerIdCard.id || 1)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPassengerIdCard(null)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Close
              </button>
            </div>
            <img
              src={previewPassengerIdCard.id_card_url}
              alt={`${previewPassengerIdCard.name} ID Card`}
              className="w-full max-h-80 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      )}

      {/* Delay Reporting Modal */}
      <Modal
        isOpen={isDelayModalOpen}
        onClose={() => setIsDelayModalOpen(false)}
        title="Report Route Delay & Traffic Alert (Once Per Trip)"
        subtitle="Notifies Admin once per trip and sends a Stop Delay + Traffic Alert to passengers on this route"
      >
        <form onSubmit={handleReportDelay} className="space-y-4">
          <Input
            label="Estimated Delay (Minutes)"
            id="delayMins"
            type="number"
            required
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(e.target.value)}
          />

          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Traffic / Delay Reason
            </label>
            <select
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm py-2.5 px-3.5"
            >
              <option value="Heavy campus traffic near current stop">Heavy campus traffic near current stop</option>
              <option value="Campus pedestrian crowd near Gate 2">Campus pedestrian crowd near Gate 2</option>
              <option value="Construction detour at North Circle">Construction detour at North Circle</option>
              <option value="Weather / heavy rain traffic slowdown">Weather / heavy rain traffic slowdown</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsDelayModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Send Delay & Traffic Alert
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DriverDashboard;

