import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  Landmark,
  Bus,
  ArrowRight,
  CheckCircle2,
  Route as RouteIcon,
  Users,
  UserCheck
} from 'lucide-react';

export const DriverTrip = () => {
  const [driverData, setDriverData] = useState(null);
  const [shuttle, setShuttle] = useState(null);
  const [stops, setStops] = useState([]);
  const { socket } = useSocket();

  const fetchDriverRouteStops = async () => {
    try {
      const res = await api.get('/drivers/me');
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setDriverData(d);
        const assigned = d.assignedShuttle;
        if (assigned) {
          setShuttle(assigned);
          const routeStops = assigned.stops || assigned.route?.stops || [];
          setStops(routeStops);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDriverRouteStops();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('route:updated', fetchDriverRouteStops);
    socket.on('shuttle:updated', fetchDriverRouteStops);
    socket.on('schedule:updated', fetchDriverRouteStops);
    socket.on('shuttle:location_updated', fetchDriverRouteStops);
    return () => {
      socket.off('route:updated', fetchDriverRouteStops);
      socket.off('shuttle:updated', fetchDriverRouteStops);
      socket.off('schedule:updated', fetchDriverRouteStops);
      socket.off('shuttle:location_updated', fetchDriverRouteStops);
    };
  }, [socket]);

  const nextIdx = stops.findIndex((s) => s.name === shuttle?.next_stop_name);
  const isDestinationReached =
    Boolean(shuttle?.driverArrived) ||
    (shuttle?.next_stop_name && String(shuttle.next_stop_name).includes('Driver Arrived'));

  const completedStopsCount = isDestinationReached
    ? stops.length
    : nextIdx > -1
    ? nextIdx
    : 1;

  const routePassengers = driverData?.routePassengers || [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Current & Completed Route Status {shuttle ? `— Bus ${shuttle.code}` : ''}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span>Allocated Route:</span>
            <b>{shuttle?.start_point || 'Hostel Complex'}</b>
            <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
            <b>{shuttle?.destination || 'Sports Ground'}</b>
          </p>
        </div>

        {shuttle && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-blue-400 font-extrabold text-xs border border-brand-200 dark:border-brand-800">
            <Bus className="w-3.5 h-3.5" />
            <span>Bus {shuttle.code} • {shuttle.route?.code || 'RT-01'}</span>
          </span>
        )}
      </div>

      {/* Currently Completed Route & Stops Summary (Seat count removed as requested) */}
      <Card className="p-5 space-y-4 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <RouteIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Currently Assigned & Completed Route Corridor
              </span>
              <h3 className="text-base font-black text-navy-900 dark:text-white flex items-center gap-2">
                <span>{shuttle?.route?.name || `${shuttle?.start_point || 'Hostel Complex'} ➔ ${shuttle?.destination || 'Sports Ground'}`}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {shuttle?.start_point || 'Hostel Complex'} ➔ {shuttle?.destination || 'Sports Ground'} ({shuttle?.route?.distance_km || 4.2} km)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-center">
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                Stops Completed
              </span>
              <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                {completedStopsCount} / {stops.length || 1}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-center">
              <span className="text-[10px] font-bold uppercase text-brand-600 dark:text-blue-400 block">
                Routes Completed
              </span>
              <span className="text-lg font-black text-brand-600 dark:text-blue-300">
                {driverData?.dailyTripsCompleted || (isDestinationReached ? 1 : 0)} Today
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stops checklist showing which route stops are completed vs current */}
      <Card className="p-5 space-y-3 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Completed & Current Route Stops Progression</span>
          </h3>
          <span className="text-xs font-bold text-brand-600 dark:text-accent-blue">
            {completedStopsCount} of {stops.length} Completed
          </span>
        </div>

        <div className="space-y-2.5">
          {stops.map((stop, idx) => {
            const isCurrent =
              !isDestinationReached &&
              (stop.name === shuttle?.next_stop_name || (!shuttle?.next_stop_name && idx === 0));
            const isPassed =
              isDestinationReached ||
              (nextIdx > -1 ? idx < nextIdx : idx === 0 && shuttle?.next_stop_name);

            return (
              <div
                key={stop.id || idx}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  isCurrent
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-brand-500 shadow-sm'
                    : isPassed
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                      isPassed
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-brand-500 text-white animate-pulse'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600'
                    }`}
                  >
                    {isPassed ? '✓' : idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span
                      className={`font-bold block truncate ${
                        isCurrent
                          ? 'text-brand-600 dark:text-accent-blue text-sm'
                          : 'text-navy-900 dark:text-white'
                      }`}
                    >
                      {stop.name}
                    </span>
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 mt-0.5">
                      <Landmark className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {stop.landmark || shuttle?.route?.landmark || 'Campus Stop'}
                      </span>
                    </span>
                  </div>
                </div>

                {isCurrent ? (
                  <Badge status="live">Current Stop</Badge>
                ) : isPassed ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </span>
                ) : (
                  <span className="text-slate-400 font-semibold">Upcoming</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default DriverTrip;
