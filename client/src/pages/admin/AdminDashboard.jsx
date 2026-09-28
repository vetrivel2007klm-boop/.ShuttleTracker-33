import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import StatCard from '../../components/common/StatCard';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { CardSkeleton } from '../../components/common/LoadingSkeleton';
import LiveMap from '../../components/map/LiveMap';
import {
  Bus,
  Radio,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  ShieldCheck
} from 'lucide-react';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [shuttles, setShuttles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedShuttleId, setSelectedShuttleId] = useState(null);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const { socket, liveLocations } = useSocket();

  const fetchData = async () => {
    try {
      const [statsRes, shuttlesRes, routesRes] = await Promise.all([
        api.get('/stats/dashboard'),
        api.get('/shuttles'),
        api.get('/routes')
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data);
      if (shuttlesRes.data.success) setShuttles(shuttlesRes.data.data);
      if (routesRes.data.success) setRoutes(routesRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleSync = () => fetchData();
    socket.on('shuttle:updated', handleSync);
    socket.on('driver:updated', handleSync);
    socket.on('driver:feedback_updated', handleSync);
    socket.on('route:updated', handleSync);
    socket.on('schedule:updated', handleSync);
    socket.on('shuttle:emergency_stopped', handleSync);
    socket.on('trip:status_change', handleSync);
    return () => {
      socket.off('shuttle:updated', handleSync);
      socket.off('driver:updated', handleSync);
      socket.off('driver:feedback_updated', handleSync);
      socket.off('route:updated', handleSync);
      socket.off('schedule:updated', handleSync);
      socket.off('shuttle:emergency_stopped', handleSync);
      socket.off('trip:status_change', handleSync);
    };
  }, [socket]);

  // Merge real-time socket locations ONLY for shuttles where Driver has pressed Start Trip (status === 'on_trip')
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
        eta_minutes: live.eta_minutes || s.eta_minutes,
        next_stop_name: live.next_stop_name || s.next_stop_name
      };
    }
    return {
      ...s,
      status: isOnTrip ? 'on_trip' : 'idle',
      is_on_trip: isOnTrip
    };
  });

  const onTripShuttles = useMemo(
    () => mergedShuttles.filter((s) => s.status === 'on_trip'),
    [mergedShuttles]
  );

  const unstartedScheduledShuttles = useMemo(
    () => mergedShuttles.filter((s) => s.status !== 'on_trip' && Boolean(s.is_scheduled_time_now)),
    [mergedShuttles]
  );

  // Always show connected route stops and paths on the Admin Dashboard map
  const activeMapStops = useMemo(() => {
    if (selectedShuttleId) {
      const selShuttle = mergedShuttles.find((s) => Number(s.id) === Number(selectedShuttleId));
      const selRoute = routes.find(
        (r) =>
          Number(r.id) === Number(selShuttle?.current_route_id) ||
          Number(r.shuttle_id) === Number(selectedShuttleId)
      );
      return selRoute && selRoute.stops?.length > 0 ? selRoute.stops : selShuttle?.stops || [];
    }
    const firstActive = onTripShuttles[0] || mergedShuttles[0];
    if (firstActive) {
      const firstRoute = routes.find(
        (r) =>
          Number(r.id) === Number(firstActive.current_route_id) ||
          Number(r.shuttle_id) === Number(firstActive.id)
      );
      if (firstRoute?.stops?.length > 0) return firstRoute.stops;
      if (firstActive.stops?.length > 0) return firstActive.stops;
    }
    return routes[0]?.stops || [];
  }, [routes, selectedShuttleId, onTripShuttles, mergedShuttles]);

  const activeMapRoutes = useMemo(() => routes, [routes]);

  const handleFocusShuttle = (shuttleId) => {
    if (Number(selectedShuttleId) === Number(shuttleId)) {
      setSelectedShuttleId(null);
    } else {
      setSelectedShuttleId(shuttleId);
      setFocusTrigger((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Welcome back, Admin 👋
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Campus transit operations overview and unified multi-bus fleet map
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/live-tracking">
            <Button size="sm" icon={Radio} className="shadow-subtle">
              Live Map View
            </Button>
          </Link>
          <Link to="/admin/shuttles">
            <Button variant="outline" size="sm" icon={Bus}>
              Manage Fleet
            </Button>
          </Link>
        </div>
      </div>

      {/* Scheduled Time Alert Banner if any shuttle is in scheduled time and Driver has NOT pressed Start Trip */}
      {unstartedScheduledShuttles.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
                Schedule Time Alert — Driver Has Not Pressed Start Trip
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-200 mt-0.5">
                {unstartedScheduledShuttles.map((s) => (
                  <span key={s.id} className="mr-3">
                    <b>Bus {s.code}</b> (Driver: <b>{s.driver_name || 'Assigned Driver'}</b>, Scheduled:{' '}
                    <b>
                      {s.schedule_departure_time} – {s.schedule_arrival_time}
                    </b>
                    ) has not started the trip.
                  </span>
                ))}
              </p>
            </div>
          </div>
          <Link
            to="/admin/schedules"
            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
          >
            View Schedule
          </Link>
        </div>
      )}

      {/* 4 Balanced KPI Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Shuttles"
            value={stats?.totalShuttles ?? mergedShuttles.length}
            icon={Bus}
            color="blue"
            trend={{ value: 'Fleet Ready', isPositive: true }}
            subtitle="Registered campus buses"
          />
          <StatCard
            title="On Trip Shuttles"
            value={stats?.activeShuttles ?? onTripShuttles.length}
            icon={Radio}
            color="green"
            trend={{ value: 'Driver Started Trip', isPositive: true }}
            subtitle="Live GPS active"
          />
          <StatCard
            title="Active Drivers"
            value={stats?.activeDrivers ?? 0}
            icon={UserCheck}
            color="purple"
            trend={{ value: 'Logged In', isPositive: true }}
            subtitle="Logged into Driver portal"
          />
          <StatCard
            title="Schedule Alerts"
            value={stats?.delayedShuttles ?? unstartedScheduledShuttles.length}
            icon={AlertTriangle}
            color="amber"
            trend={{ value: 'Schedule monitor', isPositive: false }}
            subtitle="Not started at schedule time"
          />
        </div>
      )}

      {/* Full-Width Unified Multi-Bus Fleet Map */}
      <div className="w-full">
        <Card className="p-0 overflow-hidden flex flex-col h-[560px] border border-slate-200 dark:border-slate-800 shadow-premium">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <div>
                <h3 className="text-sm font-bold text-navy-900 dark:text-white">
                  Unified Multi-Bus Fleet Map ({onTripShuttles.length} On Trip / {mergedShuttles.length} Total)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Shows live tracking only when Driver presses Start Trip (with full route at scheduled times, and current live tracking only during non-schedule times)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {selectedShuttleId && (
                <button
                  type="button"
                  onClick={() => setSelectedShuttleId(null)}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition shadow-sm"
                >
                  Show All Buses
                </button>
              )}
              <Link
                to="/admin/live-tracking"
                className="text-xs text-brand-600 dark:text-accent-blue font-bold flex items-center gap-1 hover:underline"
              >
                <span>Open Full Live Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="flex-1 w-full relative min-h-0">
            <LiveMap
              shuttles={onTripShuttles}
              stops={activeMapStops}
              allRoutes={activeMapRoutes}
              selectedShuttleId={selectedShuttleId}
              focusTrigger={focusTrigger}
              onSelectShuttle={(s) => handleFocusShuttle(s.id)}
              onShowAllBuses={() => setSelectedShuttleId(null)}
              showAllFitOnLoad={true}
              className="h-full w-full rounded-none border-none"
            />
          </div>
        </Card>
      </div>

      {/* Operational Metrics Bar (Properly Aligned 3-Column Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/50 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">On-Time Performance</div>
            <div className="text-xl font-bold text-navy-900 dark:text-white">{stats?.onTimeRate || '94.2%'}</div>
            <span className="text-[11px] text-emerald-600 font-medium">+1.8% over last week</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-brand-500 flex items-center justify-center border border-blue-100 dark:border-blue-900/50 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Average Wait Time</div>
            <div className="text-xl font-bold text-navy-900 dark:text-white">{stats?.averageWaitTime || '4.8 min'}</div>
            <span className="text-[11px] text-blue-500 font-medium">Under campus 6-min target</span>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center border border-sky-100 dark:border-sky-900/50 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase">Fleet Health Score</div>
            <div className="text-xl font-bold text-navy-900 dark:text-white">{stats?.fleetHealth || '98.5%'}</div>
            <span className="text-[11px] text-sky-600 font-medium">All vehicle telemetry OK</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
