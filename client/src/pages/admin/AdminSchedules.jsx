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

// Pure Haversine GPS distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (
    !Number.isFinite(nLat1) ||
    !Number.isFinite(nLon1) ||
    !Number.isFinite(nLat2) ||
    !Number.isFinite(nLon2) ||
    (nLat1 === 0 && nLon1 === 0) ||
    (nLat2 === 0 && nLon2 === 0)
  ) {
    return null;
  }
  const R = 6371;
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

// Parse any time string ("08:30 AM", "8.30 pm", "23:13:00", "11:15 P", "11 PM", "11:5 AM", etc.) into minutes since midnight
function parseAnyTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = String(timeStr)
    .trim()
    .toUpperCase()
    .replace(/[.;,]/g, ':')
    .replace(/\s+/g, ' ');
  if (!clean) return null;

  // 1. Match HH:MM(:SS) with AM/PM/A/P (also allows trailing colon while typing e.g. "11:15 PM")
  const match12 = clean.match(/^(\d{1,2})\s*:\s*(\d{0,2})(?::\d{0,2})?\s*(AM|PM|A|P)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = match12[2] ? Math.min(59, Math.max(0, parseInt(match12[2], 10))) : 0;
    const period = match12[3].startsWith('P') ? 'PM' : 'AM';
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return ((hours % 24) * 60) + mins;
  }

  // 2. Match Hour-only with AM/PM/A/P (e.g. "11 PM", "8 AM", "11P")
  const matchHour12 = clean.match(/^(\d{1,2})\s*(AM|PM|A|P)$/);
  if (matchHour12) {
    let hours = parseInt(matchHour12[1], 10);
    const period = matchHour12[2].startsWith('P') ? 'PM' : 'AM';
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return (hours % 24) * 60;
  }

  // 3. Match 3 or 4 digits with optional AM/PM (e.g. "830 AM", "1115 PM", "1115")
  const matchCompact = clean.match(/^(\d{1,2})(\d{2})\s*(AM|PM|A|P)?$/);
  if (matchCompact) {
    let hours = parseInt(matchCompact[1], 10);
    const mins = Math.min(59, Math.max(0, parseInt(matchCompact[2], 10)));
    const pRaw = matchCompact[3] || '';
    if (pRaw) {
      const period = pRaw.startsWith('P') ? 'PM' : 'AM';
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    }
    return ((hours % 24) * 60) + mins;
  }

  // 4. Match 24-hour or partial HH:MM(:SS) (e.g. "23:13:00", "08:30", "11:5", "11:")
  const match24 = clean.match(/^(\d{1,2})\s*:\s*(\d{0,2})(?::\d{0,2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10) % 24;
    const mins = match24[2] ? Math.min(59, Math.max(0, parseInt(match24[2], 10))) : 0;
    return hours * 60 + mins;
  }

  // 5. Match plain hour while typing (e.g. "8" or "11")
  const matchPlainHour = clean.match(/^(\d{1,2})$/);
  if (matchPlainHour) {
    const hours = parseInt(matchPlainHour[1], 10) % 24;
    return hours * 60;
  }

  return null;
}

function formatMinutesAs12Hr(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || !Number.isFinite(Number(totalMinutes))) {
    return '—';
  }
  const normalized = ((Math.round(Number(totalMinutes)) % 1440) + 1440) % 1440;
  const arrHours24 = Math.floor(normalized / 60) % 24;
  const arrMins = normalized % 60;
  const period = arrHours24 >= 12 ? 'PM' : 'AM';
  const arrHours12 = arrHours24 % 12 === 0 ? 12 : arrHours24 % 12;
  return `${String(arrHours12).padStart(2, '0')}:${String(arrMins).padStart(2, '0')} ${period}`;
}

function formatTime12Hr(timeStr) {
  const mins = parseAnyTimeToMinutes(timeStr);
  if (mins === null) return String(timeStr || '').trim() || '—';
  return formatMinutesAs12Hr(mins);
}

// Helper to add GPS-calculated minutes to a departure time string like "08:30 AM", "11.15 PM", or "23:13:00"
function calculateExactArrivalTime(departureStr, durationMinutes = 0) {
  const baseMins = parseAnyTimeToMinutes(departureStr);
  if (baseMins === null) return '—';
  const addMins = Math.max(1, Math.round(Number(durationMinutes) || 0));
  return formatMinutesAs12Hr(baseMins + addMins);
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

  const { socket, liveLocations, relayCloudEmail } = useSocket();
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
    socket.on('trip:status_change', handleSync);

    return () => {
      socket.off('schedule:updated', handleScheduleUpdated);
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('driver:updated', handleSync);
      socket.off('trip:status_change', handleSync);
    };
  }, [socket]);

  const selectedBusObj =
    shuttles.find((s) => Number(s.id) === Number(formData.shuttle_id)) || shuttles[0] || null;
  const selectedRouteObj =
    routes.find((r) => Number(r.id) === Number(formData.route_id)) ||
    routes.find(
      (r) =>
        Number(r.shuttle_id) === Number(selectedBusObj?.id) ||
        Number(r.id) === Number(selectedBusObj?.current_route_id)
    ) ||
    routes[0] ||
    null;

  // Compute GPS distance from stops if needed
  const modalStops = selectedRouteObj?.stops || selectedBusObj?.stops || [];
  let modalStopsGpsKm = 0;
  for (let i = 1; i < modalStops.length; i++) {
    const seg = haversineKm(
      modalStops[i - 1].latitude,
      modalStops[i - 1].longitude,
      modalStops[i].latitude,
      modalStops[i].longitude
    );
    if (seg !== null) modalStopsGpsKm += seg * 1.24;
  }

  const selectedRouteDistKm = Number(
    Number(
      selectedRouteObj?.distance_km ||
        selectedBusObj?.distance_km ||
        (modalStopsGpsKm > 0 ? modalStopsGpsKm : 0)
    ).toFixed(2)
  );
  const calculatedDuration = Math.max(
    1,
    Number(selectedRouteObj?.estimated_time_minutes) ||
      (selectedRouteDistKm > 0 ? Math.round((selectedRouteDistKm / 25) * 60) : 0) ||
      Number(selectedBusObj?.eta_minutes) ||
      15
  );
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
    const normalizedDeparture = formatTime12Hr(formData.departure_time);
    const computedArrival = calculateExactArrivalTime(normalizedDeparture, calculatedDuration);
    const routeStart = selectedRouteObj?.start_point || selectedBusObj?.start_point || '';
    const routeDest = selectedRouteObj?.end_point || selectedBusObj?.destination || '';
    const resolvedRouteName =
      selectedRouteObj?.name ||
      (routeStart && routeDest ? `${routeStart} - ${routeDest}` : 'Assigned Route');
    const tempId = Date.now();

    const optimisticSlot = {
      id: tempId,
      shuttle_id: Number(formData.shuttle_id || selectedBusObj?.id),
      shuttle_code: selectedBusObj?.code || 'S01',
      shuttle_vehicle_number: selectedBusObj?.vehicle_number || '',
      driver_name: selectedBusObj?.driver_name || 'Assigned Driver',
      route_id: Number(formData.route_id || selectedRouteObj?.id),
      route_name: resolvedRouteName,
      start_point: routeStart || 'Start',
      destination: routeDest || 'Destination',
      departure_time: normalizedDeparture,
      arrival_time: computedArrival,
      days: formData.days,
      distance_km: selectedRouteDistKm,
      estimated_time_minutes: calculatedDuration,
      eta_minutes: calculatedDuration,
      status: 'On Time'
    };

    // Instant 0ms UI reflex: close modal, add schedule to top (pushing first-added to last), and show toast immediately
    setSchedules((prev) => [optimisticSlot, ...prev]);
    setIsModalOpen(false);
    addToast({
      title: 'Schedule Set • Driver Notified Once via Login & Email',
      message: `Notified ${selectedBusObj?.driver_name || 'Assigned Driver'} (Bus ${selectedBusObj?.code || 'S01'}): "${normalizedDeparture} – ${computedArrival} • Your schedule time is on, ready to ride safely!"`,
      type: 'success'
    });

    try {
      const res = await api.post('/stats/schedules', {
        shuttle_id: optimisticSlot.shuttle_id,
        route_id: optimisticSlot.route_id,
        route_name: resolvedRouteName,
        departure_time: normalizedDeparture,
        arrival_time: computedArrival,
        days: formData.days,
        driver_name: selectedBusObj?.driver_name || '',
        driver_email: selectedBusObj?.driver_email || ''
      });

      if (res.data?.data) {
        setSchedules((prev) =>
          prev.map((item) => (item.id === tempId ? res.data.data : item))
        );
      }
      fetchData();
    } catch (err) {
      setSchedules((prev) => prev.filter((item) => item.id !== tempId));
      addToast({ title: 'Error', message: 'Failed to create schedule slot', type: 'danger' });
    }
  };

  const handleDeleteSchedule = async (scheduleId, busCode, routeTitle) => {
    const previousSchedules = schedules;
    // Instant 0ms UI reflex: remove immediately
    setSchedules((prev) => prev.filter((s) => Number(s.id) !== Number(scheduleId)));
    addToast({
      title: 'Scheduled Route Deleted',
      message: `Deleted scheduled route "${routeTitle}" for Bus ${busCode}.`,
      type: 'info'
    });

    setDeletingId(scheduleId);
    try {
      const res = await api.delete(`/stats/schedules/${scheduleId}`);
      if (res.data?.data && Array.isArray(res.data.data)) {
        setSchedules(res.data.data);
      }
    } catch (err) {
      setSchedules(previousSchedules);
      addToast({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to delete scheduled route',
        type: 'danger'
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Sort so newly added schedules appear first and the first-added schedule goes to the LAST of the list
  const orderedSchedules = [...schedules].sort(
    (a, b) => Number(b.id || 0) - Number(a.id || 0)
  );

  return (
    <div className="space-y-6">
      {/* Page Header Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-premium flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Master Timetable & Scheduled Routes
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            All Speed, Distance, ETA, and Arrival Times are calculated strictly from real GPS coordinates. Arrival is recorded only when the bus physically reaches the destination on GPS.
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
                <th className="py-4 px-5 whitespace-nowrap">Schedule No.</th>
                <th className="py-4 px-5 whitespace-nowrap">Bus Number & Allocated Driver</th>
                <th className="py-4 px-5 whitespace-nowrap">Assigned Route (Start ➔ Destination)</th>
                <th className="py-4 px-5 whitespace-nowrap">Scheduled Departure</th>
                <th className="py-4 px-5 whitespace-nowrap">GPS Telemetry (Speed • Distance • ETA)</th>
                <th className="py-4 px-5 whitespace-nowrap">Calculated Arrival Time</th>
                <th className="py-4 px-5 whitespace-nowrap">GPS Trip / Arrival Status</th>
                <th className="py-4 px-5 whitespace-nowrap">Trip Points (This Schedule)</th>
                <th className="py-4 px-5 text-right whitespace-nowrap">Status & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {orderedSchedules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 px-5 text-center text-slate-400 text-xs">
                    No timetable slots configured yet. Click &ldquo;Add Timetable Slot&rdquo; above to schedule a bus and driver.
                  </td>
                </tr>
              ) : (
                orderedSchedules.map((item, idx) => {
                  const scheduleSerialNumber = idx + 1;
                  const matchedBus = shuttles.find((s) => Number(s.id) === Number(item.shuttle_id));
                  const matchedRoute =
                    routes.find((r) => Number(r.id) === Number(item.route_id)) ||
                    routes.find((r) => Number(r.shuttle_id) === Number(item.shuttle_id));
                  const liveLoc = liveLocations[item.shuttle_id] || null;

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

                  const hasArrived = Boolean(item.driver_arrived);
                  const isOnTrip =
                    Boolean(item.is_on_trip) ||
                    matchedBus?.status === 'on_trip' ||
                    matchedBus?.status === 'delayed' ||
                    liveLoc?.status === 'on_trip';

                  // Calculate GPS distance, speed, ETA, and arrival time strictly from GPS coordinates
                  const stops = Array.isArray(matchedBus?.stops) ? matchedBus.stops : [];
                  const destStop = stops.length > 0 ? stops[stops.length - 1] : null;
                  const curLat = Number(liveLoc?.latitude ?? item.current_lat ?? matchedBus?.current_lat);
                  const curLng = Number(liveLoc?.longitude ?? item.current_lng ?? matchedBus?.current_lng);

                  const routeDistKm = Number(
                    Number(item.distance_km || matchedRoute?.distance_km || matchedBus?.distance_km || 0).toFixed(2)
                  );
                  const remainingGpsKm =
                    isOnTrip && destStop && Number.isFinite(curLat) && Number.isFinite(curLng)
                      ? haversineKm(curLat, curLng, destStop.latitude, destStop.longitude) ?? routeDistKm
                      : Number(item.remaining_distance_km ?? routeDistKm);

                  const gpsSpeedKmh = isOnTrip
                    ? Math.max(0, Math.round(Number(liveLoc?.speed ?? item.speed ?? matchedBus?.speed ?? 0)))
                    : 0;

                  const routeDurationFromGps = Math.max(
                    1,
                    Number(item.estimated_time_minutes) ||
                      Number(matchedRoute?.estimated_time_minutes) ||
                      (routeDistKm > 0 ? Math.round((routeDistKm / 25) * 60) : 15)
                  );

                  let gpsEtaMinutes = 0;
                  if (hasArrived) {
                    gpsEtaMinutes = 0;
                  } else if (isOnTrip) {
                    if (gpsSpeedKmh >= 1 && remainingGpsKm > 0) {
                      gpsEtaMinutes = Math.max(1, Math.round((remainingGpsKm / gpsSpeedKmh) * 60));
                    } else if (remainingGpsKm > 0) {
                      gpsEtaMinutes = Math.max(1, Math.round((remainingGpsKm / 25) * 60));
                    } else {
                      gpsEtaMinutes = Number(item.eta_minutes) || 0;
                    }
                  } else {
                    gpsEtaMinutes = routeDurationFromGps;
                  }

                  const formattedDeparture = formatTime12Hr(item.departure_time);
                  const rawFormattedArrival = item.arrival_time ? formatTime12Hr(item.arrival_time) : '';
                  const scheduledArrival =
                    rawFormattedArrival &&
                    rawFormattedArrival !== '—' &&
                    rawFormattedArrival !== formattedDeparture
                      ? rawFormattedArrival
                      : calculateExactArrivalTime(formattedDeparture, routeDurationFromGps);

                  const liveGpsArrivalTime =
                    isOnTrip && gpsEtaMinutes > 0
                      ? new Date(Date.now() + gpsEtaMinutes * 60000).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : null;

                  const isScheduledNow = Boolean(item.is_scheduled_time_now);
                  const notStartedAtSchedule =
                    Boolean(item.driver_not_started_at_schedule) || (isScheduledNow && !isOnTrip && !hasArrived);

                  const delayMins = Number(item.delay_minutes) || 0;
                  const isDelayed = delayMins > 0;
                  const rawTripPts = Number(item.trip_points ?? item.last_points_earned) || 0;
                  const tripPoints =
                    rawTripPts > 0
                      ? rawTripPts
                      : hasArrived
                      ? isDelayed
                        ? Math.max(1, 10 - delayMins)
                        : 10
                      : isDelayed
                      ? Math.max(1, 10 - delayMins)
                      : 0;

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
                      {/* 1. Proper Sequential Schedule Number (1, 2, 3, 4...) */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap font-extrabold text-navy-900 dark:text-white">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-navy-900 dark:text-white font-black text-xs border border-slate-200 dark:border-slate-700">
                          {scheduleSerialNumber}
                        </span>
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
                          {formattedDeparture}
                        </span>
                      </td>

                      {/* 5. Live GPS Telemetry (Speed, Distance, ETA) */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-blue-400 font-mono font-bold text-[11px] border border-blue-200/60 dark:border-blue-800/60">
                            {gpsSpeedKmh} km/h
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[11px]">
                            {isOnTrip ? `${remainingGpsKm} km left` : `${routeDistKm} km`}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono font-bold text-[11px] border border-emerald-200/60 dark:border-emerald-800/60">
                            ETA: {hasArrived ? '0 min' : `${gpsEtaMinutes} min`}
                          </span>
                        </div>
                        {Number.isFinite(curLat) && Number.isFinite(curLng) && (
                          <div className="text-[10px] text-slate-400 font-mono mt-1">
                            GPS: {curLat.toFixed(4)}°N, {curLng.toFixed(4)}°E
                          </div>
                        )}
                      </td>

                      {/* 6. Calculated Arrival Time */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                          <Clock className="w-3 h-3 text-brand-500" />
                          {liveGpsArrivalTime ? `${liveGpsArrivalTime} (Live GPS)` : scheduledArrival}
                        </span>
                        {liveGpsArrivalTime && (
                          <div className="text-[10px] text-slate-400 mt-1 font-medium">
                            Scheduled: {scheduledArrival}
                          </div>
                        )}
                      </td>

                      {/* 7. GPS Trip / Destination Arrival Status */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        {hasArrived && item.actual_arrival_time ? (
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
                              {isDelayed ? `Delayed by +${delayMins} min • Admin Notified` : `Reached ${destination} on Time`}
                            </div>
                          </div>
                        ) : isOnTrip ? (
                          <div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-xs border ${
                                isDelayed
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                                  : 'bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60'
                              }`}
                            >
                              <Navigation className="w-3 h-3 animate-pulse shrink-0" />
                              <span>
                                {isDelayed ? `Delayed (+${delayMins}m) to ${destination}` : `On Trip to ${destination}`}
                              </span>
                            </span>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                              {gpsSpeedKmh} km/h • {remainingGpsKm} km to destination • ETA {gpsEtaMinutes} min
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
                              <span>Trip Not Started (Not Arrived)</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium">
                              Scheduled at {formattedDeparture} • {routeDistKm} km route
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 8. Points for This Particular Trip (On-Time Full 10 Pts or Delay-Based Points) */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl font-black text-xs border ${
                              tripPoints >= 10
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : tripPoints > 0
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            }`}
                          >
                            <Award
                              className={`w-3.5 h-3.5 shrink-0 ${
                                tripPoints >= 10
                                  ? 'text-emerald-500'
                                  : tripPoints > 0
                                  ? 'text-amber-500'
                                  : 'text-purple-500'
                              }`}
                            />
                            <span>{tripPoints > 0 ? `+${tripPoints} pts` : '0 pts'}</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                          {hasArrived && !isDelayed
                            ? 'On-Time Arrival (Full 10 Pts)'
                            : isDelayed
                            ? `Delay-Based (+${delayMins}m Delay)`
                            : 'This Trip Only (10 Pts On-Time)'}
                        </div>
                      </td>

                      {/* 9. Status & Delete Scheduled Route Button */}
                      <td className="py-4 px-5 align-middle text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2.5">
                          {hasArrived && item.actual_arrival_time ? (
                            isDelayed ? (
                              <Badge status="delayed">Driver Delayed</Badge>
                            ) : (
                              <Badge status="active">Driver Arrived</Badge>
                            )
                          ) : isOnTrip ? (
                            isDelayed ? (
                              <Badge status="delayed">Delayed (+{delayMins}m)</Badge>
                            ) : (
                              <Badge status="on_trip">On Trip</Badge>
                            )
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
              const busObj = shuttles.find((s) => Number(s.id) === sId);
              const matchedRoute =
                routes.find(
                  (r) =>
                    Number(r.shuttle_id) === sId ||
                    Number(r.id) === Number(busObj?.current_route_id)
                ) || routes[0];
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
            onChange={(e) => setFormData({ ...formData, route_id: Number(e.target.value) })}
            options={routes.map((r) => ({
              label: `${r.code}: ${r.start_point} ➔ ${r.end_point} (${r.distance_km} km • ~${r.estimated_time_minutes} min)`,
              value: r.id
            }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                label="Exact Departure Time"
                id="depTime"
                required
                placeholder="e.g. 08:30 AM or 11:15 PM"
                value={formData.departure_time}
                onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
              />
              <div className="flex items-center gap-2 mt-1.5">
                {['AM', 'PM'].map((period) => {
                  const isCurrent = String(formData.departure_time || '')
                    .toUpperCase()
                    .includes(period);
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => {
                        const base = String(formData.departure_time || '08:30')
                          .replace(/\s*(AM|PM|A|P)\s*$/i, '')
                          .trim();
                        setFormData({ ...formData, departure_time: `${base} ${period}` });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition ${
                        isCurrent
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {period}
                    </button>
                  );
                })}
                <span className="text-[10px] text-slate-400">
                  Route: {selectedRouteDistKm} km (~{calculatedDuration} min)
                </span>
              </div>
            </div>

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
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-semibold">
                {formatTime12Hr(formData.departure_time)} + {calculatedDuration} mins = {exactArrivalPreview}
              </p>
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
