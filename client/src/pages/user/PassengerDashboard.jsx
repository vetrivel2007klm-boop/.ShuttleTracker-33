import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import LiveMap from '../../components/map/LiveMap';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import {
  Bus,
  Gauge,
  Route,
  CheckCircle2,
  Siren,
  AlertTriangle,
  ArrowRight,
  Clock
} from 'lucide-react';

// Haversine helper to compute distance covered in km from starting point
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
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

export const PassengerDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [shuttles, setShuttles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trafficAlert, setTrafficAlert] = useState(null);
  const [sendingEmergency, setSendingEmergency] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  const { socket, liveLocations, joinShuttle, leaveShuttle } = useSocket();

  const passengerBusCode = String(user?.bus_number || 'S01').trim().toUpperCase();

  const fetchShuttles = async () => {
    try {
      const [shuttlesRes, routesRes] = await Promise.all([
        api.get('/shuttles'),
        api.get('/routes')
      ]);
      if (shuttlesRes.data.success && shuttlesRes.data.data.length > 0) {
        setShuttles(shuttlesRes.data.data);
      }
      if (routesRes.data.success && routesRes.data.data.length > 0) {
        setRoutes(routesRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching shuttles:', err);
    }
  };

  useEffect(() => {
    fetchShuttles();
    // Tick every 30s so 15-minute emergency window auto-resets in the UI
    const timer = setInterval(() => {
      setNowTick(Date.now());
      fetchShuttles();
    }, 30000);
    return () => clearInterval(timer);
  }, [passengerBusCode]);

  // Match ONLY the passenger's entered/selected bus
  const matchedBaseShuttle =
    shuttles.find((s) => String(s.code).trim().toUpperCase() === passengerBusCode) ||
    shuttles[0];
  const selectedShuttleId = matchedBaseShuttle?.id || 1;

  // Real-time socket synchronization for the passenger's bus
  useEffect(() => {
    if (!socket) return;
    const handleSync = () => fetchShuttles();

    const handleEmergencyStopped = (payload) => {
      if (!payload) return;
      setShuttles((prev) =>
        prev.map((s) =>
          Number(s.id) === Number(payload.shuttleId)
            ? {
                ...s,
                passengerEmergencyCount: payload.currentCount ?? s.passengerEmergencyCount,
                passengerEmergencyReports:
                  payload.passengerEmergencyReports || s.passengerEmergencyReports || [],
                emergencyStoppedNotifiedForTrip: Boolean(payload.thresholdReached)
              }
            : s
        )
      );
    };

    const handleStopDelayTraffic = (payload) => {
      if (!payload) return;
      const isMyBus =
        Number(payload.shuttleId) === Number(selectedShuttleId) ||
        String(payload.busCode || '').toUpperCase() === passengerBusCode;
      if (isMyBus) {
        setTrafficAlert(payload);
        addToast({
          title: `Bus ${payload.busCode || passengerBusCode} Delayed at ${payload.stopName}`,
          message: payload.trafficMessage,
          type: 'warning',
          duration: 6000
        });
      }
    };

    socket.on('route:updated', handleSync);
    socket.on('shuttle:updated', handleSync);
    socket.on('driver:updated', handleSync);
    socket.on('trip:status_change', handleSync);
    socket.on('shuttle:emergency_stopped', handleEmergencyStopped);
    socket.on('passenger:stop_delay_traffic', handleStopDelayTraffic);

    return () => {
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('driver:updated', handleSync);
      socket.off('trip:status_change', handleSync);
      socket.off('shuttle:emergency_stopped', handleEmergencyStopped);
      socket.off('passenger:stop_delay_traffic', handleStopDelayTraffic);
    };
  }, [socket, selectedShuttleId, passengerBusCode]);

  // Subscribe to passenger's shuttle socket room
  useEffect(() => {
    if (selectedShuttleId) {
      joinShuttle(selectedShuttleId);
      return () => leaveShuttle(selectedShuttleId);
    }
  }, [selectedShuttleId]);

  // Merge real-time coordinates for passenger's bus
  const live = matchedBaseShuttle ? liveLocations[matchedBaseShuttle.id] : null;
  const currentShuttle = matchedBaseShuttle
    ? live
      ? {
          ...matchedBaseShuttle,
          current_lat: live.latitude,
          current_lng: live.longitude,
          speed: live.speed,
          heading: live.heading,
          status: live.status || matchedBaseShuttle.status,
          eta_minutes: live.eta_minutes !== undefined ? live.eta_minutes : matchedBaseShuttle.eta_minutes,
          next_stop_name: live.next_stop_name || matchedBaseShuttle.next_stop_name,
          distance_km: live.distance_km !== undefined ? live.distance_km : matchedBaseShuttle.distance_km,
          distance_covered_km:
            live.distance_covered_km !== undefined
              ? live.distance_covered_km
              : matchedBaseShuttle.distance_covered_km,
          stopReachedTimes: live.stopReachedTimes || matchedBaseShuttle.stopReachedTimes || {},
          trafficDelayStop: live.trafficDelayStop || matchedBaseShuttle.trafficDelayStop || null
        }
      : matchedBaseShuttle
    : null;

  const matchedRoute = currentShuttle
    ? routes.find(
        (r) =>
          Number(r.shuttle_id) === Number(currentShuttle.id) ||
          Number(r.id) === Number(currentShuttle.current_route_id)
      ) || null
    : routes[0] || null;

  const activeStops =
    matchedRoute?.stops?.length > 0
      ? matchedRoute.stops
      : currentShuttle?.stops?.length > 0
      ? currentShuttle.stops
      : [];
  const startingPlace =
    matchedRoute?.start_point || currentShuttle?.start_point || activeStops[0]?.name || 'Starting Point';

  const [mapRouteKm, setMapRouteKm] = useState(null);

  // Calculate live distance covered from starting place
  const computedDistanceCovered =
    currentShuttle?.distance_covered_km !== undefined
      ? Number(currentShuttle.distance_covered_km).toFixed(2)
      : activeStops[0] && currentShuttle?.current_lat && currentShuttle?.current_lng
      ? calculateHaversineKm(
          Number(activeStops[0].latitude),
          Number(activeStops[0].longitude),
          Number(currentShuttle.current_lat),
          Number(currentShuttle.current_lng)
        ).toFixed(2)
      : '1.20';

  const vehicleSpeed =
    Number(currentShuttle?.speed) >= 15 ? Math.round(Number(currentShuttle.speed)) : 30;
  const totalRouteKm = Number(
    mapRouteKm || matchedRoute?.distance_km || currentShuttle?.distance_km || 4.5
  ).toFixed(2);
  const exactRouteEtaMins = Math.max(
    2,
    Math.round((Number(totalRouteKm) / vehicleSpeed) * 60)
  );

  const emergencyStorageKey = `shuttle_emergency_${user?.id || user?.email || 'guest'}_${passengerBusCode}`;
  let localStoredEmergency = null;
  try {
    const raw = localStorage.getItem(emergencyStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && nowTick - Number(parsed.timestamp || 0) <= 15 * 60 * 1000) {
        localStoredEmergency = parsed;
      } else {
        localStorage.removeItem(emergencyStorageKey);
      }
    }
  } catch (_) {}

  // Filter active emergency reports within 15 minutes for this bus
  const activeEmergencyReports = (currentShuttle?.passengerEmergencyReports || []).filter(
    (r) => nowTick - Number(r.timestamp || 0) <= 15 * 60 * 1000
  );
  const myServerReport = activeEmergencyReports.find(
    (r) =>
      (user?.id && Number(r.passengerId) === Number(user.id)) ||
      (user?.name &&
        r.passengerName &&
        String(r.passengerName).trim().toLowerCase() === String(user.name).trim().toLowerCase())
  );
  const myEmergencyReport = myServerReport || localStoredEmergency;

  const emergencyCount = Math.min(
    10,
    Math.max(
      myEmergencyReport ? 1 : 0,
      Number(localStoredEmergency?.currentCount || 0),
      activeEmergencyReports.length,
      Number(currentShuttle?.passengerEmergencyCount || 0)
    )
  );
  const myRemainingResetMins = myEmergencyReport
    ? Math.max(
        1,
        Math.ceil((15 * 60 * 1000 - (nowTick - Number(myEmergencyReport.timestamp || nowTick))) / 60000)
      )
    : 0;

  // Emergency Alert Handler (1 time per passenger, resets after 15 mins; shows X out of 10 to all passengers on this bus; sends ONE message to Admin at 5-10 passengers)
  const handleEmergencyAlert = async () => {
    if (!currentShuttle) return;
    if (myEmergencyReport) {
      addToast({
        title: `Already Reported (${emergencyCount} out of 10)`,
        message: `You can give an emergency alert only 1 time. Resets in ${myRemainingResetMins} min(s).`,
        type: 'info'
      });
      return;
    }

    setSendingEmergency(true);
    try {
      const res = await api.post('/trips/emergency-stopped', {
        shuttle_id: currentShuttle.id,
        stopped_minutes: 20
      });

      if (res.data.success) {
        const updatedCount = Number(res.data.currentCount || 1);
        const updatedReports = res.data.passengerEmergencyReports || [
          ...activeEmergencyReports,
          {
            passengerId: user?.id || 0,
            passengerName: user?.name || 'Passenger',
            busCode: passengerBusCode,
            timestamp: Date.now()
          }
        ];
        const myMatchingReport = updatedReports.find(
          (r) =>
            (user?.id && Number(r.passengerId) === Number(user.id)) ||
            (user?.name &&
              r.passengerName &&
              String(r.passengerName).trim().toLowerCase() === String(user.name).trim().toLowerCase())
        );
        try {
          localStorage.setItem(
            emergencyStorageKey,
            JSON.stringify({
              passengerId: user?.id || 0,
              passengerName: user?.name || 'Passenger',
              busCode: passengerBusCode,
              timestamp: myMatchingReport?.timestamp || Date.now(),
              currentCount: updatedCount
            })
          );
        } catch (_) {}

        setNowTick(Date.now());
        setShuttles((prev) =>
          prev.map((s) =>
            Number(s.id) === Number(currentShuttle.id)
              ? {
                  ...s,
                  passengerEmergencyCount: updatedCount,
                  passengerEmergencyReports: updatedReports,
                  emergencyStoppedNotifiedForTrip: Boolean(res.data.thresholdReached)
                }
              : s
          )
        );
        addToast({
          title: `${updatedCount} out of 10 Emergency Alert`,
          message: res.data.message,
          type: res.data.thresholdReached ? 'danger' : 'warning'
        });
      }
    } catch (err) {
      addToast({
        title: 'Emergency Alert Notice',
        message: err.response?.data?.message || 'Failed to submit emergency alert.',
        type: 'danger'
      });
    } finally {
      setSendingEmergency(false);
    }
  };

  const activeTrafficNotice = trafficAlert || currentShuttle?.trafficDelayStop;
  const driverAvatar =
    currentShuttle?.driver_avatar ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentShuttle?.driver_name || 'Driver')}`;
  const driverCode = currentShuttle?.driver_code || `DRV-10${currentShuttle?.id || 1}`;
  const passengerCode = user?.passenger_code || `PASS-${1000 + Number(user?.id || 1)}`;
  const passengerAvatar =
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'Passenger')}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header showing ONLY the passenger's entered/selected bus & its respective driver */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Passenger Dashboard
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>
              Shuttle:{' '}
              <b className="text-brand-600 dark:text-accent-blue">
                Bus {currentShuttle?.code || passengerBusCode} ({currentShuttle?.vehicle_number || currentShuttle?.name || 'Shuttle'})
              </b>
            </span>
            <span>•</span>
            <span>
              Driver: <b className="text-navy-900 dark:text-white">{currentShuttle?.driver_name || 'Assigned Driver'}</b> ({driverCode})
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              {currentShuttle?.start_point || 'Hostel Complex'}
              <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
              {currentShuttle?.destination || 'Sports Ground'}
            </span>
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm shrink-0">
          <Bus className="w-4 h-4" />
          <span>Shuttle {currentShuttle?.code || passengerBusCode}</span>
        </div>
      </div>

      {/* Allocated Driver Profile, Name, ID & Shuttle Number Card */}
      <Card className="p-5 border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
          {/* Allocated Driver Details (Driver Profile, Name, ID, Shuttle Number) */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <img
              src={driverAvatar}
              alt={currentShuttle?.driver_name || 'Assigned Driver'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-brand-500 shadow-sm shrink-0"
            />
            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 dark:text-accent-blue">
                  Allocated Driver Profile
                </span>
                <span className="px-2 py-0.5 rounded-md bg-navy-900 dark:bg-brand-600 text-white font-mono font-black text-[11px]">
                  Driver ID: {driverCode}
                </span>
              </div>
              <h3 className="text-base font-black text-navy-900 dark:text-white truncate">
                {currentShuttle?.driver_name || 'Assigned Driver'}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-blue-300 font-extrabold border border-brand-200 dark:border-brand-800">
                  Shuttle No: Bus {currentShuttle?.code || passengerBusCode} ({currentShuttle?.vehicle_number || 'TN-01-AB-1234'})
                </span>
                {currentShuttle?.driver_license_number && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                    License: {currentShuttle.driver_license_number}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Allocated Passenger Profile, Name, ID & Shuttle Number */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <img
              src={passengerAvatar}
              alt={user?.name || 'Passenger'}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm shrink-0"
            />
            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Allocated Passenger Profile
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono font-black text-[11px]">
                  Passenger ID: {passengerCode}
                </span>
              </div>
              <h3 className="text-base font-black text-navy-900 dark:text-white truncate">
                {user?.name || 'Passenger'}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-200 dark:border-emerald-800">
                  Allocated Shuttle: Bus {currentShuttle?.code || passengerBusCode}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                  Stop: {user?.destination || currentShuttle?.destination || 'Campus'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Live Stop Delay Notification Banner for Passengers in this Bus */}
      {activeTrafficNotice && Number(activeTrafficNotice.shuttleId || currentShuttle?.id) === Number(currentShuttle?.id) && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Stop Delay Notification — Bus {currentShuttle?.code || passengerBusCode}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                  +{activeTrafficNotice.delayMinutes || 4} min delay
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mt-0.5">
                {activeTrafficNotice.trafficMessage}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
            Stop: {activeTrafficNotice.stopName} ({activeTrafficNotice.reachedTime})
          </span>
        </div>
      )}

      {/* Top Row: Bus Speed + Route Distance & Covered KM + Exact ETA Time Estimate + Emergency (with X out of 10 counter) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        {/* 1. Bus Speed Card */}
        <Card className="p-5 flex flex-col justify-between border border-slate-200 dark:border-slate-800 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bus Speed
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-accent-blue flex items-center justify-center">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-navy-900 dark:text-white">
                {vehicleSpeed}
              </span>
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                km/h
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Bus {currentShuttle?.code || passengerBusCode} Cruising Speed
            </p>
          </div>
        </Card>

        {/* 2. Route Distance & Covered KM Card */}
        <Card className="p-5 flex flex-col justify-between border border-slate-200 dark:border-slate-800 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Route Distance (KM)
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Route className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                {totalRouteKm}
              </span>
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                km
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Covered: <b>{computedDistanceCovered} km</b> from {startingPlace}
            </p>
          </div>
        </Card>

        {/* 3. Exact ETA Time Estimate Card */}
        <Card className="p-5 flex flex-col justify-between border border-slate-200 dark:border-slate-800 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ETA Time Estimate
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-brand-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-brand-600 dark:text-blue-400">
                {exactRouteEtaMins}
              </span>
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                mins
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalRouteKm} km @ {vehicleSpeed} km/h
            </p>
          </div>
        </Card>

        {/* 4. Emergency Card with Live Shared Counter (X out of 10) for Same-Bus Passengers */}
        <Card className="p-5 flex flex-col justify-between border border-rose-200 dark:border-rose-900/60 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Emergency ({emergencyCount} out of 10)
            </span>
            <div className="px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-black text-xs border border-rose-200 dark:border-rose-800">
              {emergencyCount} / 10
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Button
              variant={myEmergencyReport ? 'secondary' : 'danger'}
              size="md"
              icon={myEmergencyReport ? CheckCircle2 : Siren}
              disabled={Boolean(myEmergencyReport) || sendingEmergency}
              onClick={handleEmergencyAlert}
              className="w-full justify-center"
            >
              {myEmergencyReport
                ? `Emergency Given (${emergencyCount} out of 10 • Resets in ${myRemainingResetMins}m)`
                : sendingEmergency
                ? 'Sending...'
                : `Emergency (${emergencyCount} out of 10)`}
            </Button>
          </div>
        </Card>
      </div>

      {/* Passenger Selected Shuttle Live Route & Stop Path Map */}
      <Card className="p-4 space-y-3 border border-slate-200 dark:border-slate-800 shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black text-navy-900 dark:text-white flex items-center gap-2">
              <Route className="w-4 h-4 text-brand-500" />
              <span>
                Live Connected Route Map — Bus {currentShuttle?.code || passengerBusCode} ({activeStops.length} Stops • {totalRouteKm} km • ETA {exactRouteEtaMins} mins)
              </span>
            </h3>
            {activeStops.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {activeStops.map((st, idx) => (
                  <React.Fragment key={st.id || idx}>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        idx === 0
                          ? 'bg-emerald-600 text-white'
                          : idx === activeStops.length - 1
                          ? 'bg-rose-600 text-white'
                          : 'bg-blue-50 dark:bg-slate-800 text-brand-600 dark:text-blue-400 border border-blue-200 dark:border-slate-700'
                      }`}
                    >
                      {idx + 1}. {st.name}
                    </span>
                    {idx < activeStops.length - 1 && (
                      <span className="text-slate-400 font-black">➔</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold border border-emerald-200 dark:border-emerald-800">
            Speed: {vehicleSpeed} km/h • Distance: {totalRouteKm} km • ETA: {exactRouteEtaMins} mins
          </span>
        </div>

        <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative">
          <LiveMap
            shuttles={currentShuttle ? [currentShuttle] : []}
            stops={activeStops}
            selectedShuttleId={currentShuttle?.id || selectedShuttleId}
            onRouteCalculated={({ distanceKm }) => {
              if (distanceKm) {
                setMapRouteKm(distanceKm);
              }
            }}
            showAllFitOnLoad={true}
            className="h-full w-full min-h-[500px]"
          />
        </div>
      </Card>
    </div>
  );
};

export default PassengerDashboard;

