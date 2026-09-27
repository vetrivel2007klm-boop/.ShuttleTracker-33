import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  ArrowRight,
  Bus,
  Landmark,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  Gauge
} from 'lucide-react';

export const PassengerRoutes = () => {
  const { user } = useAuth();
  const { socket, liveLocations } = useSocket();
  const { addToast } = useToast();

  const [routes, setRoutes] = useState([]);
  const [shuttles, setShuttles] = useState([]);
  const [trafficAlertsByShuttle, setTrafficAlertsByShuttle] = useState({});

  const passengerBusCode = String(user?.bus_number || 'S01').trim().toUpperCase();

  const fetchRoutesAndShuttles = async () => {
    try {
      const [routeRes, shuttleRes] = await Promise.all([
        api.get('/routes'),
        api.get('/shuttles')
      ]);
      if (routeRes.data.success) {
        setRoutes(routeRes.data.data || []);
      }
      if (shuttleRes.data.success) {
        setShuttles(shuttleRes.data.data || []);
      }
    } catch (err) {
      console.error('Error loading campus routes:', err);
    }
  };

  useEffect(() => {
    fetchRoutesAndShuttles();
  }, [passengerBusCode]);

  // Merge live socket telemetry with shuttles
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
        eta_minutes: live.eta_minutes !== undefined ? live.eta_minutes : s.eta_minutes,
        next_stop_name: live.next_stop_name || s.next_stop_name,
        distance_km: live.distance_km !== undefined ? live.distance_km : s.distance_km,
        stopReachedTimes: live.stopReachedTimes || s.stopReachedTimes || {},
        trafficDelayStop: live.trafficDelayStop || s.trafficDelayStop || null
      };
    }
    return s;
  });

  // Match ONLY the passenger's entered/selected bus and its route
  const selectedShuttle =
    mergedShuttles.find((s) => String(s.code).trim().toUpperCase() === passengerBusCode) ||
    mergedShuttles[0];

  const activeRoute =
    routes.find(
      (r) =>
        String(r.shuttle_code || '').trim().toUpperCase() === passengerBusCode ||
        Number(r.id) === Number(selectedShuttle?.current_route_id) ||
        Number(r.shuttle_id) === Number(selectedShuttle?.id)
    ) || routes[0];

  useEffect(() => {
    if (!socket) return;

    const handleSync = () => fetchRoutesAndShuttles();

    const handleStopDelayTraffic = (payload) => {
      if (!payload) return;
      const isMyBus =
        Number(payload.shuttleId) === Number(selectedShuttle?.id) ||
        String(payload.busCode || '').trim().toUpperCase() === passengerBusCode;
      if (isMyBus) {
        setTrafficAlertsByShuttle((prev) => ({
          ...prev,
          [payload.shuttleId]: payload
        }));
      }
    };

    socket.on('route:updated', handleSync);
    socket.on('shuttle:updated', handleSync);
    socket.on('passenger:stop_delay_traffic', handleStopDelayTraffic);

    return () => {
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('passenger:stop_delay_traffic', handleStopDelayTraffic);
    };
  }, [socket, selectedShuttle?.id, passengerBusCode]);

  // Compute per-stop Driver Reached Time or ETA Estimation
  const buildStopScheduleInfo = (route, shuttle) => {
    const stops = route?.stops || shuttle?.stops || [];
    if (stops.length === 0) return [];

    const rawNextStop = (shuttle?.next_stop_name || route?.next_stop_name || '').replace(
      ' (Driver Arrived)',
      ''
    );
    const isArrivedAtFinal = (shuttle?.next_stop_name || '').includes('(Driver Arrived)');
    const nextIdx = stops.findIndex((st) => st.name === rawNextStop);
    const activeNextIndex = isArrivedAtFinal
      ? stops.length
      : nextIdx > -1
      ? nextIdx
      : Math.min(2, stops.length - 1);

    const baseEtaMins = Number(shuttle?.eta_minutes ?? route?.eta_minutes ?? 3);
    const stopReachedMap = {
      ...(route?.stopReachedTimes || {}),
      ...(shuttle?.stopReachedTimes || {})
    };
    const now = Date.now();
    const isDelayed = shuttle?.status === 'delayed' || route?.shuttle_status === 'delayed';
    const trafficNotice =
      trafficAlertsByShuttle[shuttle?.id] ||
      shuttle?.trafficDelayStop ||
      route?.trafficDelayStop;

    return stops.map((stop, idx) => {
      const isPassed = idx < activeNextIndex || isArrivedAtFinal;
      const isNext = !isArrivedAtFinal && idx === activeNextIndex;

      if (isPassed) {
        const fallbackMinsAgo = Math.max(1, (activeNextIndex - idx) * 3);
        const fallbackTime = new Date(now - fallbackMinsAgo * 60000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        const reachedTime = stopReachedMap[stop.name] || fallbackTime;
        const hadTrafficDelay =
          (trafficNotice && trafficNotice.stopName === stop.name) ||
          (isDelayed && idx === activeNextIndex - 1);

        return {
          ...stop,
          state: 'reached',
          reachedTime,
          etaMinutes: 0,
          etaClock: reachedTime,
          hadTrafficDelay,
          delayMinutes: hadTrafficDelay ? trafficNotice?.delayMinutes || 4 : 0,
          trafficText: hadTrafficDelay
            ? trafficNotice?.trafficMessage ||
              `Reached ${stop.name} at ${reachedTime} (+4 min traffic delay)`
            : null
        };
      }

      const segmentsAhead = Math.max(0, idx - activeNextIndex);
      const stopEtaMinutes = Math.max(1, baseEtaMins + segmentsAhead * 4 + (isDelayed ? 3 : 0));
      const etaClock = new Date(now + stopEtaMinutes * 60000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      return {
        ...stop,
        state: isNext ? 'next' : 'upcoming',
        reachedTime: null,
        etaMinutes: stopEtaMinutes,
        etaClock,
        hadTrafficDelay: isDelayed && isNext,
        delayMinutes: isDelayed ? 4 : 0,
        trafficText:
          isDelayed && isNext
            ? `Moderate traffic ahead of ${stop.name} (+4 min delay included in ETA)`
            : null
      };
    });
  };

  const selectedStopTimeline = buildStopScheduleInfo(activeRoute, selectedShuttle);
  const activeTrafficAlert =
    (selectedShuttle && trafficAlertsByShuttle[selectedShuttle.id]) ||
    selectedShuttle?.trafficDelayStop ||
    activeRoute?.trafficDelayStop;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header showing ONLY the Passenger's Bus Route */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Campus Route — Bus {selectedShuttle?.code || passengerBusCode}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Driver: <b className="text-navy-900 dark:text-white">{selectedShuttle?.driver_name || 'Assigned Driver'}</b> • Stop reached times & ETA estimation
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm shrink-0">
          <Bus className="w-4 h-4" />
          <span>Bus {selectedShuttle?.code || passengerBusCode}</span>
        </div>
      </div>

      {/* Live Stop Delay + Traffic Notification Banner for Passengers in this Bus */}
      {activeTrafficAlert && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                  Stop Delay Notification — Bus {selectedShuttle?.code || passengerBusCode}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                  +{activeTrafficAlert.delayMinutes || 3} Min Delay
                </span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mt-0.5">
                {activeTrafficAlert.trafficMessage}
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-amber-800 dark:text-amber-300 shrink-0">
            Reached {activeTrafficAlert.stopName} at {activeTrafficAlert.reachedTime}
          </div>
        </div>
      )}

      {/* Selected Bus Route Detailed Stop Reached Time & ETA Estimation Card */}
      {activeRoute && (
        <Card className="p-6 border border-slate-200 dark:border-slate-800 shadow-elevated space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-brand-500 text-white font-black text-xs">
                  {activeRoute.code}
                </span>
                <span className="px-3 py-1 rounded-xl bg-navy-900 dark:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5">
                  <Bus className="w-3.5 h-3.5 text-sky-400" />
                  <span>Bus {selectedShuttle?.code || passengerBusCode}</span>
                </span>
                <Badge status={selectedShuttle?.status === 'delayed' ? 'delayed' : 'live'}>
                  {selectedShuttle?.status === 'delayed' ? 'DELAYED' : 'ON ROUTE'}
                </Badge>
              </div>
              <h3 className="text-xl font-black text-navy-900 dark:text-white">
                {activeRoute.name}
              </h3>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span>{activeRoute.start_point}</span>
                <ArrowRight className="w-4 h-4 text-brand-500" />
                <span>{activeRoute.end_point}</span>
              </p>
              {activeRoute.landmark && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Landmark: {activeRoute.landmark}</span>
                </p>
              )}
            </div>

            {/* Summary Telemetry Box for Passenger's Bus Route */}
            <div className="grid grid-cols-3 gap-3 sm:min-w-[360px]">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Bus Speed
                </span>
                <span className="text-lg font-black text-navy-900 dark:text-white flex items-center justify-center gap-1 mt-0.5">
                  <Gauge className="w-4 h-4 text-brand-500" />
                  {Math.round(Number(selectedShuttle?.speed ?? 24))} km/h
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">
                  Next Stop ETA
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {selectedShuttle?.eta_minutes ?? 3} mins
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Route Distance
                </span>
                <span className="text-lg font-black text-navy-900 dark:text-white block mt-0.5">
                  {activeRoute.distance_km} km
                </span>
              </div>
            </div>
          </div>

          {/* Stop-by-Stop Driver Reached Time & ETA Estimation List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-brand-500" />
                <span>Route Stops — Driver Reached Time & ETA Estimation</span>
              </h4>
              <span className="text-xs font-bold text-slate-400">
                {selectedStopTimeline.length} Stops
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {selectedStopTimeline.map((stop, idx) => {
                const isReached = stop.state === 'reached';
                const isNext = stop.state === 'next';

                return (
                  <div
                    key={stop.id || idx}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isNext
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-brand-400 dark:border-brand-600 shadow-sm'
                        : isReached
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-xl text-xs font-black flex items-center justify-center shrink-0 ${
                          isReached
                            ? 'bg-emerald-500 text-white'
                            : isNext
                            ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isReached ? '✓' : idx + 1}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-navy-900 dark:text-white">
                            {stop.name}
                          </span>
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                              Start Point
                            </span>
                          )}
                          {idx === selectedStopTimeline.length - 1 && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] font-bold">
                              Final Destination
                            </span>
                          )}
                          {isNext && (
                            <span className="px-2 py-0.5 rounded-md bg-brand-500 text-white text-[10px] font-bold">
                              Approaching Next
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                            <Landmark className="w-3.5 h-3.5 shrink-0" />
                            <span>{stop.landmark || activeRoute.landmark || `Stop #${idx + 1}`}</span>
                          </span>

                          {stop.hadTrafficDelay && (
                            <span className="text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>{stop.trafficText}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Driver Reached Time OR ETA Estimation */}
                    <div className="flex items-center sm:justify-end shrink-0">
                      {isReached ? (
                        <div className="px-3.5 py-2 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-right">
                          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>Driver Reached at {stop.reachedTime}</span>
                          </div>
                          <span className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {stop.hadTrafficDelay
                              ? `Delayed by +${stop.delayMinutes} mins (Notified)`
                              : 'Completed on Route'}
                          </span>
                        </div>
                      ) : (
                        <div
                          className={`px-3.5 py-2 rounded-xl border text-right ${
                            isNext
                              ? 'bg-white dark:bg-slate-900 border-brand-300 dark:border-brand-700'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center sm:justify-end gap-1.5 text-brand-600 dark:text-accent-blue text-xs font-black">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>
                              ETA: in {stop.etaMinutes} {stop.etaMinutes === 1 ? 'min' : 'mins'} ({stop.etaClock})
                            </span>
                          </div>
                          <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            Estimated Driver Arrival Time
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PassengerRoutes;
