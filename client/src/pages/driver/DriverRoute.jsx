import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Card from '../../components/common/Card';
import LiveMap from '../../components/map/LiveMap';
import { ArrowRight, MapPin } from 'lucide-react';

export const DriverRoute = () => {
  const [route, setRoute] = useState(null);
  const [shuttle, setShuttle] = useState(null);
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
          Assigned Route & Waypoints Map {shuttle ? `— Bus ${shuttle.code}` : ''}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
          <span>{route?.code || 'RT-01'}:</span>
          <b>{route?.start_point || shuttle?.start_point || 'Hostel Complex'}</b>
          <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
          <b>{route?.end_point || shuttle?.destination || 'Sports Ground'}</b>
        </p>
      </div>

      <div className="h-96 w-full rounded-2xl overflow-hidden shadow-elevated border border-slate-200 dark:border-slate-800">
        <LiveMap
          stops={route?.stops || []}
          shuttles={shuttle ? [shuttle] : []}
          showAllFitOnLoad={true}
          className="h-full w-full"
        />
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="text-sm font-bold text-navy-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
          Allocated Route Turn-By-Turn Waypoints ({route?.stops?.length || 0} Stops)
        </h3>
        <div className="space-y-2">
          {route?.stops?.map((stop, index) => (
            <div
              key={stop.id || index}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-brand-500 text-white font-bold text-[10px] flex items-center justify-center">
                  {index + 1}
                </span>
                <div>
                  <span className="font-bold text-navy-900 dark:text-white block">{stop.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)}
                  </span>
                </div>
              </div>
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-brand-500" />
                {stop.landmark || route?.landmark || 'Transit Stop'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DriverRoute;
