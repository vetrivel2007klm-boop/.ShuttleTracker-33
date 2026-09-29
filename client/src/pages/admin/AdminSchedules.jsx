import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input, { Select } from '../../components/common/Input';
import {
  Clock,
  Plus,
  Bus,
  ArrowRight,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Award,
  Navigation,
  Trash2
} from 'lucide-react';

// Helper to add minutes to a time string like "08:30 AM" or "14:15"
function calculateExactArrivalTime(departureStr, durationMinutes = 18) {
  if (!departureStr) return '08:25 AM';
  try {
    const clean = departureStr.trim().toUpperCase();
    const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    let hours = 8;
    let mins = 0;

    if (match12) {
      hours = parseInt(match12[1], 10);
      mins = parseInt(match12[2], 10);
      const period = match12[3];
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    } else {
      const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
      if (match24) {
        hours = parseInt(match24[1], 10);
        mins = parseInt(match24[2], 10);
      }
    }

    const totalMinutes = hours * 60 + mins + Number(durationMinutes || 18);
    const arrHours24 = Math.floor(totalMinutes / 60) % 24;
    const arrMins = totalMinutes % 60;
    const period = arrHours24 >= 12 ? 'PM' : 'AM';
    const arrHours12 = arrHours24 % 12 === 0 ? 12 : arrHours24 % 12;

    return `${String(arrHours12).padStart(2, '0')}:${String(arrMins).padStart(2, '0')} ${period}`;
  } catch (_) {
    return '08:30 AM';
  }
}

export const AdminSchedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [shuttles, setShuttles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState({
    shuttle_id: '',
    route_id: '',
    departure_time: '08:30 AM',
    days: 'Mon - Fri'
  });

  const { socket } = useSocket();
  const { addToast } = useToast();

  const fetchData = async () => {
    try {
      const [schedRes, shuttlesRes, routesRes] = await Promise.all([
        api.get('/stats/schedules'),
        api.get('/shuttles'),
        api.get('/routes')
      ]);
      const loadedSchedules = schedRes.data.success ? schedRes.data.data : [];
      const loadedShuttles = shuttlesRes.data.success ? shuttlesRes.data.data : [];
      const loadedRoutes = routesRes.data.success ? routesRes.data.data : [];

      setSchedules(loadedSchedules);
      setShuttles(loadedShuttles);
      setRoutes(loadedRoutes);

      if (loadedShuttles.length > 0 && !formData.shuttle_id) {
        const firstBus = loadedShuttles[0];
        const matchedRoute =
          loadedRoutes.find(
            (r) =>
              Number(r.shuttle_id) === Number(firstBus.id) ||
              Number(r.id) === Number(firstBus.current_route_id)
          ) || loadedRoutes[0];
        setFormData((prev) => ({
          ...prev,
          shuttle_id: firstBus.id,
          route_id: matchedRoute ? matchedRoute.id : ''
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleScheduleUpdated = (payload) => {
      if (payload?.schedules && Array.isArray(payload.schedules)) {
        setSchedules(payload.schedules);
      } else {
        fetchData();
      }
    };

    const handleSync = () => fetchData();

    socket.on('schedule:updated', handleScheduleUpdated);
    socket.on('route:updated', handleSync);
    socket.on('shuttle:updated', handleSync);
    socket.on('driver:updated', handleSync);

    return () => {
      socket.off('schedule:updated', handleScheduleUpdated);
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('driver:updated', handleSync);
    };
  }, [socket]);

  const selectedBusObj =
    shuttles.find((s) => Number(s.id) === Number(formData.shuttle_id)) || shuttles[0] || null;
  const selectedRouteObj =
    routes.find((r) => Number(r.id) === Number(formData.route_id)) ||
    routes.find((r) => Number(r.shuttle_id) === Number(selectedBusObj?.id)) ||
    routes[0] ||
    null;

  const calculatedDuration = selectedRouteObj
    ? Number(selectedRouteObj.estimated_time_minutes) ||
      Math.max(8, Math.round(((Number(selectedRouteObj.distance_km) || 4.2) / 24) * 60))
    : 18;
  const exactArrivalPreview = calculateExactArrivalTime(formData.departure_time, calculatedDuration);

  const openScheduleModal = () => {
    const firstBus = selectedBusObj || shuttles[0];
    const matchedRoute =
      routes.find(
        (r) =>
          Number(r.shuttle_id) === Number(firstBus?.id) ||
          Number(r.id) === Number(firstBus?.current_route_id)
      ) || routes[0];
    setFormData({
      shuttle_id: firstBus?.id || '',
      route_id: matchedRoute?.id || '',
      departure_time: '08:30 AM',
      days: 'Mon - Fri'
    });
    setIsModalOpen(true);
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    try {
      const routeStart = selectedRouteObj?.start_point || selectedBusObj?.start_point || '';
      const routeDest = selectedRouteObj?.end_point || selectedBusObj?.destination || '';
      const res = await api.post('/stats/schedules', {
        shuttle_id: Number(formData.shuttle_id),
        route_id: Number(formData.route_id),
        route_name:
          selectedRouteObj?.name ||
          (routeStart && routeDest ? `${routeStart} - ${routeDest}` : 'Assigned Route'),
        departure_time: formData.departure_time,
        arrival_time: exactArrivalPreview,
        days: formData.days
      });

      if (
        res.data?.emailRelayPayload &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        fetch('http://localhost:5000/api/auth/relay-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(res.data.emailRelayPayload)
        }).catch(() => {});
      }

      addToast({
        title: 'Schedule Set • Driver Notified via Login & Email',
        message: `Notified ${selectedBusObj?.driver_name || 'Assigned Driver'} (Bus ${selectedBusObj?.code || 'S01'}): "${formData.departure_time} – ${exactArrivalPreview} • Your schedule time is on, ready to ride safely!"`,
        type: 'success'
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to create schedule slot', type: 'danger' });
    }
  };

  const handleDeleteSchedule = async (scheduleId, busCode, routeTitle) => {
    setDeletingId(scheduleId);
    try {
      const res = await api.delete(`/stats/schedules/${scheduleId}`);
      if (res.data?.data && Array.isArray(res.data.data)) {
        setSchedules(res.data.data);
      } else {
        setSchedules((prev) => prev.filter((s) => Number(s.id) !== Number(scheduleId)));
      }
      addToast({
        title: 'Scheduled Route Deleted',
        message: `Deleted scheduled route "${routeTitle}" for Bus ${busCode}.`,
        type: 'info'
      });
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to delete scheduled route',
        type: 'danger'
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-premium flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Master Timetable & Scheduled Routes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Displays Bus Number, allocated Driver Name, assigned Route, cumulative All-Trips Driver Points (Monthly / Yearly), and option to delete any scheduled route
          </p>
        </div>

        <Button
          icon={Plus}
          size="md"
          onClick={openScheduleModal}
          className="shrink-0 shadow-glow"
        >
          Add Timetable Slot
        </Button>
      </div>

      {/* Master Schedule Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-5 whitespace-nowrap">Slot ID</th>
                <th className="py-4 px-5 whitespace-nowrap">Bus Number & Allocated Driver</th>
                <th className="py-4 px-5 whitespace-nowrap">Assigned Route (Start ➔ Destination)</th>
                <th className="py-4 px-5 whitespace-nowrap">Scheduled Departure</th>
                <th className="py-4 px-5 whitespace-nowrap">Scheduled Arrival</th>
                <th className="py-4 px-5 whitespace-nowrap">Trip / Arrival Status</th>
                <th className="py-4 px-5 whitespace-nowrap">All-Trips Points (Monthly / Yearly)</th>
                <th className="py-4 px-5 text-right whitespace-nowrap">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-5 text-center text-slate-400 text-xs">
                    No timetable slots configured yet. Click &ldquo;Add Timetable Slot&rdquo; above to schedule a bus and driver.
                  </td>
                </tr>
              ) : (
                schedules.map((item) => {
                  const matchedBus = shuttles.find((s) => Number(s.id) === Number(item.shuttle_id));
                  const matchedRoute =
                    routes.find((r) => Number(r.id) === Number(item.route_id)) ||
                    routes.find((r) => Number(r.shuttle_id) === Number(item.shuttle_id));

                  const busNumber =
                    item.shuttle_code || matchedBus?.code || matchedBus?.vehicle_number || `#${item.shuttle_id}`;
                  const vehiclePlate =
                    item.shuttle_vehicle_number || matchedBus?.vehicle_number || '';
                  const driverName =
                    item.driver_name || matchedBus?.driver_name || 'Unassigned Driver';

                  const startPoint =
                    item.start_point || matchedRoute?.start_point || matchedBus?.start_point || 'Start';
                  const destination =
                    item.destination || matchedRoute?.end_point || matchedBus?.destination || 'Destination';
                  const routeTitle =
                    item.route_name || matchedRoute?.name || `${startPoint} - ${destination}`;

                  const durationMins =
                    item.estimated_time_minutes || matchedRoute?.estimated_time_minutes || 18;
                  const scheduledArrival =
                    item.arrival_time || calculateExactArrivalTime(item.departure_time, durationMins);

                  const hasArrived = Boolean(item.driver_arrived);
                  const isOnTrip =
                    Boolean(item.is_on_trip) || matchedBus?.status === 'on_trip';
                  const isScheduledNow = Boolean(item.is_scheduled_time_now);
                  const notStartedAtSchedule =
                    Boolean(item.driver_not_started_at_schedule) || (isScheduledNow && !isOnTrip && !hasArrived);

                  const delayMins = Number(item.delay_minutes) || 0;
                  const isDelayed = hasArrived && delayMins > 0;
                  const monthlyPoints =
                    Number(item.monthly_points) || Number(item.driver_points) || 0;
                  const yearlyPoints =
                    Number(item.yearly_points) || monthlyPoints;
                  const totalTrips =
                    Number(item.total_trips) || Number(item.daily_trips) || 0;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        notStartedAtSchedule
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70'
                          : isDelayed
                          ? 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/60 dark:hover:bg-amber-950/25'
                          : hasArrived
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* 1. Slot ID */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap font-extrabold text-navy-900 dark:text-white">
                        #{item.id}
                      </td>

                      {/* 2. Exact Bus Number & Allocated Driver Name */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/70 text-brand-600 dark:text-blue-400 font-extrabold text-xs border border-brand-200/60 dark:border-brand-800/60">
                            <Bus className="w-3.5 h-3.5 shrink-0" />
                            <span>{busNumber}</span>
                          </span>
                          <div>
                            <div className="font-extrabold text-navy-900 dark:text-white text-xs">
                              Driver: {driverName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {vehiclePlate ? `${vehiclePlate} • ` : ''}
                              {item.days}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Exact Assigned Route & Destination */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="font-bold text-navy-900 dark:text-white text-xs">
                          {routeTitle}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5 font-semibold">
                          <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{startPoint}</span>
                          <ArrowRight className="w-3 h-3 text-brand-500 shrink-0" />
                          <span className="font-extrabold text-navy-900 dark:text-white">
                            {destination}
                          </span>
                        </div>
                      </td>

                      {/* 4. Scheduled Departure */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-900 dark:text-white">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {item.departure_time}
                        </span>
                      </td>

                      {/* 5. Scheduled Arrival */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                          <Clock className="w-3 h-3 text-brand-500" />
                          {scheduledArrival}
                        </span>
                      </td>

                      {/* 6. Trip / Destination Arrival Status */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        {hasArrived ? (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-mono font-extrabold text-xs border ${
                                isDelayed
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {isDelayed ? (
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span>Driver Arrived • {item.actual_arrival_time}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium">
                              {isDelayed ? `Delayed by ${delayMins} min` : `Reached ${destination}`}
                            </div>
                          </div>
                        ) : isOnTrip ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-blue-400 font-bold text-xs border border-blue-200/60 dark:border-blue-800/60">
                              <Navigation className="w-3 h-3 animate-pulse shrink-0" />
                              <span>On Trip to {destination}</span>
                            </span>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                              Driver started trip • Live GPS active
                            </div>
                          </div>
                        ) : notStartedAtSchedule ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-800">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Driver Has Not Started Trip</span>
                            </span>
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-semibold">
                              Scheduled time active • Admin notified
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>Awaiting Driver Start Trip</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium">
                              Scheduled at {item.departure_time}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 7. Cumulative All-Trips Driver Points (Monthly / Yearly) */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-black text-xs border border-purple-200 dark:border-purple-800">
                            <Award className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                            <span>Monthly: {monthlyPoints} pts</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200 dark:border-indigo-800">
                            <span>Yearly: {yearlyPoints} pts</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                          Cumulative All Trips ({totalTrips} {totalTrips === 1 ? 'Trip' : 'Trips'} Completed)
                        </div>
                      </td>

                      {/* 8. Status & Delete Scheduled Route Button */}
                      <td className="py-4 px-5 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2.5">
                          {hasArrived ? (
                            isDelayed ? (
                              <Badge status="delayed">Driver Delayed</Badge>
                            ) : (
                              <Badge status="active">Driver Arrived</Badge>
                            )
                          ) : isOnTrip ? (
                            <Badge status="on_trip">On Trip</Badge>
                          ) : notStartedAtSchedule ? (
                            <Badge status="delayed">Not Started (Scheduled Now)</Badge>
                          ) : (
                            <Badge status="idle">Trip Not Started</Badge>
                          )}

                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDeleteSchedule(item.id, busNumber, routeTitle)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-200 dark:border-rose-800 text-[11px] font-extrabold transition"
                            title="Delete Scheduled Route"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingId === item.id ? 'Deleting...' : 'Delete'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Timetable Slot Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Exact Timetable Schedule"
        subtitle="Select the Bus (with its allocated Driver) and its assigned Route"
      >
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <Select
            label="Select Bus Number & Allocated Driver"
            id="schedShuttle"
            value={formData.shuttle_id}
            onChange={(e) => {
              const sId = Number(e.target.value);
              const matchedRoute = routes.find((r) => Number(r.shuttle_id) === sId);
              setFormData({
                ...formData,
                shuttle_id: sId,
                route_id: matchedRoute ? matchedRoute.id : formData.route_id
              });
            }}
            options={shuttles.map((s) => ({
              label: `${s.code} (${s.vehicle_number || s.name}) — Driver: ${s.driver_name || 'Unassigned'}`,
              value: s.id
            }))}
          />

          <Select
            label="Select Assigned Route"
            id="schedRoute"
            value={formData.route_id}
            onChange={(e) => setFormData({ ...formData, route_id: e.target.value })}
            options={routes.map((r) => ({
              label: `${r.code}: ${r.start_point} ➔ ${r.end_point} (${r.distance_km} km • ~${r.estimated_time_minutes} min)`,
              value: r.id
            }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Exact Departure Time"
              id="depTime"
              required
              placeholder="e.g. 08:30 AM"
              value={formData.departure_time}
              onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Auto-Calculated Scheduled Arrival
              </label>
              <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>{exactArrivalPreview}</span>
                <span className="text-[10px] font-sans font-semibold">
                  (+{calculatedDuration}m)
                </span>
              </div>
            </div>
          </div>

          <Input
            label="Operating Days"
            id="schedDays"
            value={formData.days}
            onChange={(e) => setFormData({ ...formData, days: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Schedule Slot</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminSchedules;
