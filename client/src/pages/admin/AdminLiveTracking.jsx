import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import LiveMap from '../../components/map/LiveMap';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  Bus,
  Users2,
  Mail,
  Building2,
  LocateFixed,
  ArrowRight,
  Layers,
  MapPin,
  AlertTriangle,
  Clock,
  Radio
} from 'lucide-react';

export const AdminLiveTracking = () => {
  const [shuttles, setShuttles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedShuttleId, setSelectedShuttleId] = useState(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('all');

  const { socket, liveLocations } = useSocket();
  const { addToast } = useToast();
  const notifiedScheduleIdsRef = useRef(new Set());

  const fetchData = async () => {
    try {
      const [shuttleRes, routeRes, passRes] = await Promise.all([
        api.get('/shuttles'),
        api.get('/routes'),
        api.get('/auth/passengers')
      ]);

      if (shuttleRes.data.success) {
        const list = shuttleRes.data.data || [];
        setShuttles(list);
        // One-time client toast if any shuttle is in scheduled time and driver has not pressed Start Trip
        list.forEach((s) => {
          if (
            s.driver_not_started_at_schedule &&
            !notifiedScheduleIdsRef.current.has(s.id)
          ) {
            notifiedScheduleIdsRef.current.add(s.id);
            addToast({
              title: `Schedule Alert — Bus ${s.code} Not Started`,
              message: `Scheduled time (${s.schedule_departure_time} – ${s.schedule_arrival_time}) is active for Bus ${s.code}, but Driver (${s.driver_name || 'Assigned Driver'}) has NOT pressed Start Trip.`,
              type: 'warning'
            });
          }
        });
      }
      if (routeRes.data.success) {
        setRoutes(routeRes.data.data || []);
      }
      if (passRes.data.success) {
        setPassengers(passRes.data.data || []);
      }
    } catch (err) {
      console.warn('Error fetching live tracking telemetry:', err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleSync = () => fetchData();
    const handleNotification = (notif) => {
      if (notif && notif.title && notif.title.includes('Not Started')) {
        const key = `notif-${notif.id || notif.title}`;
        if (!notifiedScheduleIdsRef.current.has(key)) {
          notifiedScheduleIdsRef.current.add(key);
          addToast({
            title: notif.title,
            message: notif.message,
            type: 'warning'
          });
        }
        fetchData();
      }
    };
    socket.on('shuttle:updated', handleSync);
    socket.on('route:updated', handleSync);
    socket.on('driver:updated', handleSync);
    socket.on('passenger:updated', handleSync);
    socket.on('schedule:updated', handleSync);
    socket.on('trip:status_change', handleSync);
    socket.on('notification:new', handleNotification);
    return () => {
      socket.off('shuttle:updated', handleSync);
      socket.off('route:updated', handleSync);
      socket.off('driver:updated', handleSync);
      socket.off('passenger:updated', handleSync);
      socket.off('schedule:updated', handleSync);
      socket.off('trip:status_change', handleSync);
      socket.off('notification:new', handleNotification);
    };
  }, [socket]);

  // Merge live socket locations ONLY for shuttles where the driver has pressed Start Trip (status === 'on_trip')
  const mergedShuttles = shuttles.map((s) => {
    const live = liveLocations[s.id];
    const effectiveStatus = live?.status || s.status || 'idle';
    const isOnTrip = effectiveStatus === 'on_trip';
    if (live && isOnTrip) {
      return {
        ...s,
        current_lat: live.latitude,
        current_lng: live.longitude,
        speed: live.speed,
        heading: live.heading,
        status: 'on_trip',
        is_on_trip: true,
        eta_minutes: live.eta_minutes !== undefined ? live.eta_minutes : s.eta_minutes,
        next_stop_name: live.next_stop_name || s.next_stop_name,
        distance_km: live.distance_km !== undefined ? live.distance_km : s.distance_km
      };
    }
    return {
      ...s,
      status: isOnTrip ? 'on_trip' : 'idle',
      is_on_trip: isOnTrip,
      speed: isOnTrip ? s.speed : 0
    };
  });

  // Resolve currently selected shuttle (null if none selected)
  const selectedShuttle = selectedShuttleId
    ? mergedShuttles.find((s) => Number(s.id) === Number(selectedShuttleId)) || null
    : null;

  // Resolve route & stops specifically for the selected bus number
  const activeRoute = selectedShuttle
    ? routes.find(
        (r) =>
          Number(r.id) === Number(selectedShuttle.current_route_id) ||
          Number(r.shuttle_id) === Number(selectedShuttle.id)
      ) || null
    : null;

  // Filter passengers matched to the selected Bus Number
  const matchedPassengers = passengers.filter((p) => {
    if (!selectedShuttle) return true;
    if (!p.bus_number) return false;
    return p.bus_number.toUpperCase() === (selectedShuttle.code || '').toUpperCase();
  });

  const filteredShuttles = mergedShuttles.filter((s) => {
    if (activeTab === 'active') return s.status === 'on_trip';
    if (activeTab === 'delayed') return Boolean(s.driver_not_started_at_schedule);
    return true;
  });

  const handleSelectBus = (shuttle) => {
    if (Number(selectedShuttleId) === Number(shuttle.id)) {
      setSelectedShuttleId(null);
    } else {
      setSelectedShuttleId(shuttle.id);
      setFocusTrigger((prev) => prev + 1);
    }
  };

  const handleDeselectAll = () => {
    setSelectedShuttleId(null);
  };

  // STRICT VISIBILITY RULES FOR ADMIN LIVE TRACKING MAP:
  // 1. If Driver has NOT pressed Start Trip (status !== 'on_trip'):
  //    - Admin CANNOT view live tracking of that bus on the map.
  // 2. If Driver HAS pressed Start Trip (status === 'on_trip'):
  //    - At scheduled time (is_scheduled_time_now === true): Admin views BOTH route/stops AND live tracking.
  //    - At non-schedule time (!is_scheduled_time_now): Admin views ONLY current live tracking (no scheduled route/stops polyline).
  const onTripShuttles = mergedShuttles.filter((s) => s.status === 'on_trip');

  const mapShuttles = selectedShuttle
    ? selectedShuttle.status === 'on_trip'
      ? [selectedShuttle]
      : []
    : onTripShuttles;

  const mapStops = selectedShuttle
    ? activeRoute?.stops || selectedShuttle?.stops || []
    : (() => {
        const firstShuttle = onTripShuttles[0] || mergedShuttles[0];
        if (firstShuttle) {
          const r = routes.find(
            (rt) =>
              Number(rt.id) === Number(firstShuttle.current_route_id) ||
              Number(rt.shuttle_id) === Number(firstShuttle.id)
          );
          if (r?.stops?.length > 0) return r.stops;
          if (firstShuttle.stops?.length > 0) return firstShuttle.stops;
        }
        return routes[0]?.stops || [];
      })();

  const mapAllRoutes = selectedShuttle ? [] : routes;

  // Shuttles currently in scheduled time window where driver has NOT pressed Start Trip
  const unstartedScheduledShuttles = mergedShuttles.filter(
    (s) => s.status !== 'on_trip' && Boolean(s.is_scheduled_time_now)
  );

  return (
    <div className="space-y-5">
      {/* Header Bar + High-Contrast Bus Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
              Admin Live Fleet Tracking
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              {onTripShuttles.length} On Trip
            </span>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
            Live tracking activates only when the Driver presses <b>Start Trip</b>. At scheduled times, both route &amp; live tracking are shown; during non-schedule times, only current live tracking is shown.
          </p>
        </div>

        {/* High-Contrast Bus Number Selector Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDeselectAll}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 border ${
              !selectedShuttleId
                ? 'bg-brand-600 text-white border-brand-600 shadow-md ring-2 ring-brand-500/30'
                : 'bg-navy-900 dark:bg-slate-800 text-white border-navy-900 dark:border-slate-700 hover:bg-brand-600 hover:border-brand-600 shadow-sm'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All Buses ({mergedShuttles.length})</span>
          </button>

          {mergedShuttles.map((s) => {
            const isSelected = Number(s.id) === Number(selectedShuttleId);
            const isOnTrip = s.status === 'on_trip';
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectBus(s)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-brand-600 text-white border-brand-600 shadow-md ring-2 ring-brand-500/30 scale-[1.03]'
                    : 'bg-navy-900 dark:bg-slate-800 text-white border-navy-900 dark:border-slate-700 hover:bg-brand-600 hover:border-brand-600 shadow-sm'
                }`}
              >
                <Bus className={`w-3.5 h-3.5 ${isOnTrip ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{s.code}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnTrip
                      ? 'bg-emerald-400 animate-ping'
                      : s.is_scheduled_time_now
                      ? 'bg-rose-400'
                      : 'bg-slate-500'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* One-Time Schedule Alert Banner when a Shuttle is in its Scheduled Time Window but Driver has NOT pressed Start Trip */}
      {unstartedScheduledShuttles.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Scheduled Time Alert — Driver Has Not Pressed Start Trip
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-200 mt-0.5">
                {unstartedScheduledShuttles.map((s) => (
                  <span key={s.id} className="mr-3">
                    <b>Bus {s.code}</b> (Driver: <b>{s.driver_name || 'Assigned Driver'}</b>, Scheduled:{' '}
                    <b>
                      {s.schedule_departure_time} – {s.schedule_arrival_time}
                    </b>
                    ) has not started the trip. Live tracking is unavailable until the driver presses Start Trip.
                  </span>
                ))}
              </p>
            </div>
          </div>
          <Badge status="danger">Admin Notified (1x)</Badge>
        </div>
      )}

      {/* Selected Shuttle Tracking Mode Banner */}
      {selectedShuttle && (
        <div
          className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
            selectedShuttle.status === 'on_trip'
              ? selectedShuttle.is_scheduled_time_now
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200'
              : selectedShuttle.is_scheduled_time_now
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 font-bold">
            {selectedShuttle.status === 'on_trip' ? (
              <Radio className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>
              {selectedShuttle.status === 'on_trip'
                ? selectedShuttle.is_scheduled_time_now
                  ? `Bus ${selectedShuttle.code} is ON TRIP during Scheduled Time (${selectedShuttle.schedule_departure_time} – ${selectedShuttle.schedule_arrival_time}): Showing BOTH Assigned Route/Stops & Live GPS Tracking.`
                  : `Bus ${selectedShuttle.code} is ON TRIP during Non-Schedule Time: Showing Current Live GPS Tracking ONLY (Route polyline hidden outside schedule window).`
                : selectedShuttle.is_scheduled_time_now
                ? `Bus ${selectedShuttle.code} is within Scheduled Time (${selectedShuttle.schedule_departure_time} – ${selectedShuttle.schedule_arrival_time}), but Driver (${selectedShuttle.driver_name || 'Assigned Driver'}) has NOT pressed Start Trip. Live tracking cannot be viewed.`
                : `Bus ${selectedShuttle.code} (Non-Schedule Time): Driver (${selectedShuttle.driver_name || 'Assigned Driver'}) has not pressed Start Trip. No alert required outside schedule hours; live tracking is paused.`}
            </span>
          </div>
          <Badge status={selectedShuttle.status === 'on_trip' ? 'on_trip' : 'idle'}>
            {selectedShuttle.status === 'on_trip' ? 'On Trip' : 'Trip Not Started'}
          </Badge>
        </div>
      )}

      {/* Main Grid: Interactive Map + Right High-Contrast Fleet Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Large Interactive Map — Clean layout with zero overlapping components */}
        <div className="lg:col-span-8 rounded-2xl overflow-hidden shadow-premium relative h-[560px] flex flex-col border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <LiveMap
            shuttles={mapShuttles}
            stops={mapStops}
            allRoutes={mapAllRoutes}
            selectedShuttleId={selectedShuttle?.status === 'on_trip' ? selectedShuttleId : null}
            focusTrigger={focusTrigger}
            onSelectShuttle={(s) => handleSelectBus(s)}
            onShowAllBuses={handleDeselectAll}
            showAllFitOnLoad={true}
            className="w-full flex-1 h-full rounded-none border-none"
          />
        </div>

        {/* Right-side Panel: Crisp, High-Contrast Fleet Bus Units List */}
        <div className="lg:col-span-4 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden h-[560px]">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white shrink-0">
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Fleet Bus Units ({filteredShuttles.length})
              </h3>
              <p className="text-[11px] text-slate-300">
                {selectedShuttleId
                  ? 'Click selected bus again to show all active buses'
                  : 'Click any bus to inspect its live trip status'}
              </p>
            </div>

            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg text-[11px] font-bold border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeTab === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('active')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeTab === 'active' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                On Trip
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('delayed')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeTab === 'delayed' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                Alert
              </button>
            </div>
          </div>

          {/* High-Contrast Bus Cards List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-100/70 dark:bg-slate-950/60 min-h-0">
            {filteredShuttles.map((shuttle) => {
              const isSelected = Number(shuttle.id) === Number(selectedShuttleId);
              const isOnTrip = shuttle.status === 'on_trip';
              const isScheduledNow = Boolean(shuttle.is_scheduled_time_now);

              return (
                <div
                  key={shuttle.id}
                  onClick={() => handleSelectBus(shuttle)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/80 shadow-lg ring-2 ring-brand-500/30'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-500 dark:hover:border-brand-500 shadow-sm'
                  }`}
                >
                  {/* Top Row: Solid Bus Code Badge + Plate & Driver + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-md ${
                          isSelected
                            ? 'bg-brand-600 text-white ring-2 ring-brand-300'
                            : 'bg-navy-900 dark:bg-brand-600 text-white'
                        }`}
                      >
                        {shuttle.code}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-navy-900 dark:text-white truncate">
                          {shuttle.vehicle_number}
                        </h4>
                        <span className="text-[11px] font-bold text-brand-600 dark:text-blue-400 block truncate">
                          Driver: {shuttle.driver_name || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                    {isOnTrip ? (
                      <Badge status="on_trip">On Trip</Badge>
                    ) : isScheduledNow ? (
                      <Badge status="delayed">Not Started (Scheduled)</Badge>
                    ) : (
                      <Badge status="idle">Trip Not Started</Badge>
                    )}
                  </div>

                  {/* Route Box: High-Contrast Dark/Solid Strip */}
                  <div className="mt-3 px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 font-bold truncate">
                      <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{shuttle.start_point || 'Start'}</span>
                      <span className="text-blue-400 font-black shrink-0">➔</span>
                      <span className="truncate">{shuttle.destination || 'Destination'}</span>
                    </div>
                    <span className="font-extrabold text-emerald-400 shrink-0 text-[11px]">
                      {isOnTrip ? `${shuttle.eta_minutes || 4} min` : 'Offline'}
                    </span>
                  </div>

                  {/* Bottom Telemetry Footer */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
                      {isOnTrip
                        ? isScheduledNow
                          ? 'Route + Live GPS Active'
                          : 'Live GPS Only (Non-Schedule)'
                        : isScheduledNow
                        ? `Scheduled (${shuttle.schedule_departure_time}) — Not Started`
                        : 'Waiting for Driver Start Trip'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-extrabold px-2 py-0.5 rounded-md shrink-0 ${
                        isSelected
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-900 dark:bg-slate-800 text-white'
                      }`}
                    >
                      <LocateFixed className="w-3 h-3" />
                      {isSelected ? 'Selected' : 'Inspect'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Details Row for Selected Bus:
          - Route & Stops card is shown ONLY when Driver is On Trip during Scheduled Time
          - Matched Passengers card is always shown for the selected bus */}
      {selectedShuttle && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Card className="lg:col-span-7 p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-premium">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 dark:text-blue-400">
                  Selected Bus {selectedShuttle.code} ({selectedShuttle.vehicle_number}) • Driver: {selectedShuttle.driver_name || 'Unassigned'}
                </span>
                <h3 className="text-base font-black text-navy-900 dark:text-white mt-0.5">
                  {activeRoute?.name || `${selectedShuttle.start_point} ➔ ${selectedShuttle.destination}`}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-white bg-navy-900 dark:bg-slate-800 px-3.5 py-1.5 rounded-xl shadow-sm">
                <span>{selectedShuttle.start_point || activeRoute?.start_point || 'Start'}</span>
                <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                <span>{selectedShuttle.destination || activeRoute?.end_point || 'Destination'}</span>
              </div>
            </div>

            {selectedShuttle.status !== 'on_trip' ? (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-1.5">
                <p className="text-xs font-extrabold text-navy-900 dark:text-white">
                  Live Tracking Unavailable — Driver Has Not Pressed Start Trip
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedShuttle.is_scheduled_time_now
                    ? `Bus ${selectedShuttle.code} is currently in its scheduled slot (${selectedShuttle.schedule_departure_time} – ${selectedShuttle.schedule_arrival_time}), and Admin has been notified once.`
                    : `Bus ${selectedShuttle.code} is currently outside its scheduled slot. Live tracking will appear when Driver (${selectedShuttle.driver_name || 'Assigned Driver'}) starts the trip.`}
                </p>
              </div>
            ) : !selectedShuttle.is_scheduled_time_now ? (
              <div className="p-6 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center space-y-1.5">
                <p className="text-xs font-extrabold text-blue-900 dark:text-blue-200">
                  Non-Schedule Time Active — Viewing Current Live GPS Tracking Only
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Because Bus {selectedShuttle.code} is operating outside its scheduled time window, only the live moving bus location ({Number(selectedShuttle.current_lat).toFixed(4)}, {Number(selectedShuttle.current_lng).toFixed(4)}) is shown on the map.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(activeRoute?.stops || []).map((stop, idx) => (
                  <div
                    key={stop.id || idx}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-start gap-2.5 shadow-subtle"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-navy-900 dark:text-white truncate">
                        {stop.name}
                      </div>
                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                        {stop.landmark || 'Transit Stop'}
                      </div>
                      <div className="text-[10px] font-mono font-semibold text-brand-600 dark:text-blue-400 mt-0.5">
                        {Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Matched Passengers for Selected Bus Number */}
          <Card className="lg:col-span-5 p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-premium">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
                  <Users2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                    Passengers on Bus {selectedShuttle.code}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    AI ID-verified passengers assigned to {selectedShuttle.code}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-extrabold shadow-sm">
                {matchedPassengers.length} Matched
              </span>
            </div>

            {matchedPassengers.length === 0 ? (
              <div className="py-8 text-center text-xs font-medium text-slate-500">
                No passengers currently registered specifically for Bus {selectedShuttle.code}.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {matchedPassengers.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-subtle"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-navy-900 dark:text-white flex items-center gap-1.5">
                        <span>{p.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-brand-600 text-white text-[10px] font-bold">
                          {p.bus_number || selectedShuttle.code}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-0.5 truncate">
                        <Mail className="w-3 h-3 text-brand-500 shrink-0" />
                        <span className="truncate">{p.email}</span>
                      </div>
                      {p.organization_name && (
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{p.organization_name}</span>
                        </div>
                      )}
                    </div>
                    <Badge status="active">Verified ID</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminLiveTracking;
