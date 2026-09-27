import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { History, Clock, User, Bus, AlertCircle } from 'lucide-react';

export const AdminTrips = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const res = await api.get('/trips');
        if (res.data.success) {
          setTrips(res.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrips();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
          Trip Logs & Real-Time Runs
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Audit trail of campus loops, passenger loads, departure timestamps, and route delays
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Trip ID</th>
                <th className="py-3.5 px-4">Shuttle Unit</th>
                <th className="py-3.5 px-4">Operator</th>
                <th className="py-3.5 px-4">Route Name</th>
                <th className="py-3.5 px-4">Passengers</th>
                <th className="py-3.5 px-4">Started At</th>
                <th className="py-3.5 px-4">Delay State</th>
                <th className="py-3.5 px-4">Trip Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-4 px-4 font-bold text-navy-900 dark:text-white font-mono">
                    #TRIP-{trip.id}
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-bold text-brand-600 dark:text-accent-blue">
                      Shuttle S0{trip.shuttle_id}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200">
                    {trip.driver_name || 'Assigned Driver'}
                  </td>
                  <td className="py-4 px-4 text-slate-700 dark:text-slate-300">
                    {trip.route_name || 'Campus Loop'}
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-800 dark:text-slate-200">
                    {trip.passenger_count || 18} on board
                  </td>
                  <td className="py-4 px-4 text-slate-500 text-[11px]">
                    {new Date(trip.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-4 px-4">
                    {trip.delay_minutes > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold text-xs inline-flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        +{trip.delay_minutes} min delay
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        On Schedule
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <Badge status={trip.status === 'in_progress' ? 'live' : 'active'}>
                      {trip.status === 'in_progress' ? 'IN TRANSIT' : 'COMPLETED'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminTrips;
