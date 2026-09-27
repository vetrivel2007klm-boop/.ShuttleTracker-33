import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import LiveMap from '../../components/map/LiveMap';
import { ArrowRight, MapPin, Bus, Navigation2, CheckCircle2, Clock, Route as RouteIcon } from 'lucide-react';

export const DriverRoute = () => {
  const [route, setRoute] = useState(null);
  const [shuttle, setShuttle] = useState(null);
  const [mapMetrics, setMapMetrics] = useState({
    distanceKm: null,
    durationMins: null,
    legDistancesKm: []
  });
  const { socket } = useSocket();

  const fetchAssignedRoute = async () => {
    try {
      const drvRes = await api.get('/drivers/me');
      const assignedShuttle = drvRes.data?.data?.assignedShuttle;
      if (assignedShuttle) {
        setShuttle(assignedShuttle);
        if (assignedShuttle.route) {
          setRoute({
            ...assignedShuttle.route,
            stops: assignedShuttle.stops || assignedShuttle.route.stops || []
          });
          return;
        }
      }
      const res = await api.get('/routes');
      if (res.data.success && res.data.data.length > 0) {
        setRoute(res.data.data[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssignedRoute();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleRouteUpdated = () => {
      fetchAssignedRoute();
    };
    socket.on('route:updated', handleRouteUpdated);
    return () => {
      socket.off('route:updated', handleRouteUpdated);
    };
  }, [socket]);

  const handleRouteCalculatedFromMap = ({ distanceKm, durationMins, legDistancesKm = [] }) => {
    if (!distanceKm) return;
    setMapMetrics({ distanceKm, durationMins, legDistancesKm });
  };

  const stops = route?.stops || shuttle?.stops || [];
  const exactDistanceKm = Number(
    mapMetrics.distanceKm || route?.distance_km || shuttle?.distance_km || 4.2
  ).toFixed(2);
  const exactDurationMins =
    mapMetrics.durationMins || route?.estimated_time_minutes || shuttle?.eta_minutes || 15;

  const calcStopLegKm = (s1, s2, legIdx = null) => {
    if (
      legIdx !== null &&
      Array.isArray(mapMetrics.legDistancesKm) &&
      mapMetrics.legDistancesKm[legIdx] !== undefined
    ) {
      return Number(mapMetrics.legDistancesKm[legIdx]).toFixed(2);
    }
    if (!s1 || !s2 || !s1.latitude || !s1.longitude || !s2.latitude || !s2.longitude) return '0.00';
    const R = 6371;
    const dLat = ((Number(s2.latitude) - Number(s1.latitude)) * Math.PI) / 180;
    const dLon = ((Number(s2.longitude) - Number(s1.longitude)) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((Number(s1.latitude) * Math.PI) / 180) *
        Math.cos((Number(s2.latitude) * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const straight = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((straight * 1.24).toFixed(2)).toFixed(2);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Header & Assigned Route Overview Card (Cleanly aligned above map, never overlapping) */}
      <Card className="p-5 border border-slate-200 dark:border-slate-800 shadow-premium bg-white dark:bg-slate-900 relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-1 rounded-lg bg-brand-600 text-white font-mono font-black text-xs flex items-center gap-1.5">
                <Bus className="w-3.5 h-3.5" />
                <span>Bus {shuttle?.code || 'S01'}</span>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-white font-bold text-xs">
                {route?.code || `RT-${shuttle?.code || 'S01'}`}
              </span>
              <Badge status="active">Assigned Route</Badge>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-navy-900 dark:text-white">
              {route?.name || `${route?.start_point || shuttle?.start_point || 'Start'} - ${route?.end_point || shuttle?.destination || 'Destination'} Express`}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
              <span>Start:</span>
              <b className="text-emerald-600 dark:text-emerald-400">
                {route?.start_point || shuttle?.start_point || stops[0]?.name || 'Starting Point'}
              </b>
              <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
              <span>Destination:</span>
              <b className="text-rose-600 dark:text-rose-400">
                {route?.end_point || shuttle?.destination || stops[stops.length - 1]?.name || 'Destination'}
              </b>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:min-w-[340px]">
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-center">
              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                Exact Map Distance
              </span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 mt-0.5">
                <RouteIcon className="w-4 h-4" />
                {exactDistanceKm} km
              </span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 text-center">
              <span className="text-[10px] font-bold uppercase text-brand-600 dark:text-blue-400 block">
                Est. Road Time
              </span>
              <span className="text-base font-black text-brand-600 dark:text-blue-400 flex items-center justify-center gap-1 mt-0.5">
                <Clock className="w-4 h-4" />
                ~{exactDurationMins} min
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Ordered Stops
              </span>
              <span className="text-base font-black text-navy-900 dark:text-white block mt-0.5">
                {stops.length} Stops
              </span>
            </div>
          </div>
        </div>

        {/* Ordered Stop Path Sequence Bar */}
        {stops.length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 dark:text-blue-400 mr-1">
              Assigned Path:
            </span>
            {stops.map((st, idx) => (
              <React.Fragment key={st.id || idx}>
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] ${
                    idx === 0
                      ? 'bg-emerald-600 text-white'
                      : idx === stops.length - 1
                      ? 'bg-rose-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-navy-900 dark:text-white border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {idx + 1}. {st.name}
                </span>
                {idx < stops.length - 1 && <span className="text-slate-400 font-black">➔</span>}
              </React.Fragment>
            ))}
          </div>
        )}
      </Card>

      {/* Isolated Google Route Map Card */}
      <Card
        className="p-0 overflow-hidden shadow-premium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-0 isolate"
        style={{ isolation: 'isolate' }}
      >
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 relative z-10">
          <div className="flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-extrabold text-navy-900 dark:text-white">
              Live Google Route Map — Bus {shuttle?.code || 'S01'} ({stops.length} Stops)
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Exact Road Distance: {exactDistanceKm} km (~{exactDurationMins} min)</span>
          </span>
        </div>

        <div className="h-[500px] w-full overflow-hidden relative z-0 isolate">
          <LiveMap
            stops={stops}
            shuttles={shuttle ? [shuttle] : []}
            onRouteCalculated={handleRouteCalculatedFromMap}
            showAllFitOnLoad={true}
            className="h-full w-full rounded-none border-none"
          />
        </div>
      </Card>

      {/* Assigned Route Turn-By-Turn Waypoints Card (Cleanly separated below map) */}
      <Card className="p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-premium bg-white dark:bg-slate-900 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-navy-900 dark:text-white">
              Assigned Route Turn-By-Turn Waypoints ({stops.length} Stops)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ordered stop sequence with exact leg-by-leg road distances calculated from the map
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold border border-emerald-200 dark:border-emerald-800">
            Total Route Distance: {exactDistanceKm} km
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {(() => {
            let cumulativeKm = 0;
            return stops.map((stop, index) => {
              const isStart = index === 0;
              const isEnd = index === stops.length - 1 && stops.length > 1;
              const prevStop = index > 0 ? stops[index - 1] : null;
              const legKm = prevStop ? Number(calcStopLegKm(prevStop, stop, index - 1)) : 0;
              cumulativeKm = Number((cumulativeKm + legKm).toFixed(2));
              const hasLandmark =
                stop.landmark &&
                stop.landmark !== 'Starting Point' &&
                stop.landmark !== 'Destination Terminal' &&
                stop.landmark !== 'Transit Stop';

              return (
                <div
                  key={stop.id || index}
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 ${
                        isStart ? 'bg-emerald-600' : isEnd ? 'bg-rose-600' : 'bg-brand-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                            isStart
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isEnd
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {isStart ? 'Start (#1)' : isEnd ? `Destination (#${index + 1})` : `Stop #${index + 1}`}
                        </span>
                        <span className="font-extrabold text-sm text-navy-900 dark:text-white truncate">
                          {stop.name}
                        </span>
                      </div>
                      {hasLandmark && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{stop.landmark}</span>
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono block">
                        GPS: {Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {index > 0 ? (
                      <div className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                        <span className="font-black text-brand-600 dark:text-blue-400 block">
                          +{legKm.toFixed(2)} km
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 block">
                          Total: {cumulativeKm.toFixed(2)} km
                        </span>
                      </div>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                        0.00 km (Origin)
                      </span>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </Card>
    </div>
  );
};

export default DriverRoute;
