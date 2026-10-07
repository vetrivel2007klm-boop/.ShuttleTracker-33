import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import LiveMap from '../../components/map/LiveMap';
import ETACard from '../../components/map/ETACard';

export const PassengerTrack = () => {
  const [shuttles, setShuttles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedShuttleId, setSelectedShuttleId] = useState(1);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const { liveLocations, socket, joinShuttle, leaveShuttle } = useSocket();

  const fetchAll = async () => {
    try {
      const [shuttleRes, routeRes] = await Promise.all([
        api.get('/shuttles'),
        api.get('/routes')
      ]);
      if (shuttleRes.data.success && shuttleRes.data.data.length > 0) {
        setShuttles(shuttleRes.data.data);
      }
      if (routeRes.data.success) {
        setRoutes(routeRes.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Join selected shuttle room for targeted high-speed socket stream
  useEffect(() => {
    if (selectedShuttleId) {
      joinShuttle(selectedShuttleId);
      return () => leaveShuttle(selectedShuttleId);
    }
  }, [selectedShuttleId, socket]);

  // Fast API Telemetry Sync (1.5s interval) guarantees resilient second-by-second auto-update
  useEffect(() => {
    const fetchFastTelemetry = async () => {
      try {
        const res = await api.get('/shuttles/live-telemetry');
        if (res.data?.success && res.data.data) {
          const telemetryMap = res.data.data;
          setShuttles((prev) =>
            prev.map((s) => {
              const live = telemetryMap[s.id];
              if (live) {
                return {
                  ...s,
                  current_lat: live.latitude,
                  current_lng: live.longitude,
                  speed: live.speed,
                  heading: live.heading,
                  status: live.status || s.status,
                  eta_minutes: live.eta_minutes !== undefined ? live.eta_minutes : s.eta_minutes,
                  next_stop_name: live.next_stop_name || s.next_stop_name,
                  distance_km: live.distance_km !== undefined ? live.distance_km : s.distance_km
                };
              }
              return s;
            })
          );
        }
      } catch (_) {}
    };

    const timer = setInterval(fetchFastTelemetry, 1500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleSync = () => fetchAll();
    socket.on('route:updated', handleSync);
    socket.on('shuttle:updated', handleSync);
    socket.on('trip:status_change', handleSync);
    return () => {
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('trip:status_change', handleSync);
    };
  }, [socket]);

  const mergedShuttles = shuttles.map((s) => {
    const live = liveLocations[s.id];
    if (live) {
      return {
        ...s,
        current_lat: live.latitude,
        current_lng: live.longitude,
        speed: live.speed,
        heading: live.heading,
        status: live.status || s.status,
        eta_minutes: live.eta_minutes || s.eta_minutes,
        next_stop_name: live.next_stop_name || s.next_stop_name,
        distance_km: live.distance_km || s.distance_km
      };
    }
    return s;
  });

  const selected = mergedShuttles.find((s) => Number(s.id) === Number(selectedShuttleId)) || mergedShuttles[0];
  const selectedRoute =
    routes.find(
      (r) =>
        Number(r.id) === Number(selected?.current_route_id) ||
        Number(r.shuttle_id) === Number(selected?.id)
    ) || routes[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Live Passenger Radar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select a Bus Number to track its live route, stops, and exact location
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mergedShuttles.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedShuttleId(s.id);
                setFocusTrigger((p) => p + 1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                Number(selectedShuttleId) === Number(s.id)
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {s.code} ({s.start_point || 'Hostel'} ➔ {s.destination || 'Campus'})
            </button>
          ))}
        </div>
      </div>

      <div className="h-[calc(100vh-210px)] min-h-[500px] w-full rounded-3xl overflow-hidden shadow-elevated border border-slate-200 dark:border-slate-800 relative">
        <LiveMap
          shuttles={mergedShuttles}
          stops={selectedRoute?.stops || []}
          selectedShuttleId={selectedShuttleId}
          focusTrigger={focusTrigger}
          onSelectShuttle={(s) => {
            setSelectedShuttleId(s.id);
            setFocusTrigger((p) => p + 1);
          }}
          className="h-full w-full"
        />

        {selected && (
          <div className="absolute bottom-4 left-4 z-20 w-80 max-w-[calc(100vw-32px)]">
            <ETACard
              shuttleCode={selected.code}
              shuttleName={selected.name}
              nextStop={selected.next_stop_name || selected.destination || 'Main Gate'}
              etaMinutes={selected.eta_minutes || 4}
              distanceKm={selected.distance_km || 1.8}
              status={selected.status === 'delayed' ? 'delayed' : 'on_time'}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PassengerTrack;
