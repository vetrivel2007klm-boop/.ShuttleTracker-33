import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import LiveMap from '../../components/map/LiveMap';
import EmptyState from '../../components/common/EmptyState';
import {
  Navigation2,
  Plus,
  MapPin,
  Trash2,
  ArrowRight,
  Bus,
  Landmark,
  Edit2,
  CheckCircle2,
  Crosshair
} from 'lucide-react';

export const AdminRoutes = () => {
  const [routes, setRoutes] = useState([]);
  const [shuttles, setShuttles] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingRoute, setSubmittingRoute] = useState(false);
  const [submittingStop, setSubmittingStop] = useState(false);

  // Configure / Add Route Modal for Selected Bus
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    shuttle_id: '',
    code: '',
    name: '',
    start_point: '',
    end_point: '',
    landmark: '',
    distance_km: 4.5,
    estimated_time_minutes: 18
  });

  // Inline / Map-Click / Drag-Pin Add Stop with Landmark Form
  const [stopForm, setStopForm] = useState({
    name: '',
    landmark: '',
    latitude: '',
    longitude: ''
  });
  const [dropPinLocation, setDropPinLocation] = useState(null);

  const { addToast } = useToast();

  const fetchData = async (preferredBusId = null) => {
    try {
      const [routesRes, shuttlesRes] = await Promise.all([
        api.get('/routes'),
        api.get('/shuttles')
      ]);

      const loadedRoutes = routesRes.data.success ? routesRes.data.data : [];
      const loadedShuttles = shuttlesRes.data.success ? shuttlesRes.data.data : [];
      setRoutes(loadedRoutes);
      setShuttles(loadedShuttles);

      const targetBusId = preferredBusId || selectedBusId || loadedShuttles[0]?.id || null;
      if (targetBusId) {
        setSelectedBusId(Number(targetBusId));
      }
    } catch (err) {
      console.error('Failed to load routes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [mapMetrics, setMapMetrics] = useState({
    distanceKm: null,
    durationMins: null,
    legDistancesKm: []
  });

  // Resolve the currently selected Bus and its exclusive Route
  const selectedBus =
    shuttles.find((s) => Number(s.id) === Number(selectedBusId)) || shuttles[0] || null;

  const selectedRoute = selectedBus
    ? routes.find(
        (r) =>
          Number(r.shuttle_id) === Number(selectedBus.id) ||
          Number(r.id) === Number(selectedBus.current_route_id)
      ) || null
    : null;

  const exactDistanceKm = Number(
    mapMetrics.distanceKm || selectedRoute?.distance_km || 0
  ).toFixed(2);
  const exactDurationMins =
    mapMetrics.durationMins || selectedRoute?.estimated_time_minutes || 0;

  const handleSelectBus = (busId) => {
    setSelectedBusId(Number(busId));
    setMapMetrics({ distanceKm: null, durationMins: null, legDistancesKm: [] });
    setStopForm({ name: '', landmark: '', latitude: '', longitude: '' });
    setDropPinLocation(null);
  };

  // When user does NOT press Drop Pin button and directly enters a Stop Name,
  // automatically resolve its latitude & longitude based on the Stop Name
  useEffect(() => {
    if (dropPinLocation) return;
    const cleanName = (stopForm.name || '').trim();
    if (cleanName.length < 2) {
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/routes/geocode/lookup', {
          params: { q: cleanName, route_id: selectedRoute?.id }
        });
        if (res.data?.success && res.data.latitude && res.data.longitude) {
          setStopForm((prev) => ({
            ...prev,
            latitude: res.data.latitude,
            longitude: res.data.longitude
          }));
        }
      } catch (_) {}
    }, 320);
    return () => clearTimeout(timer);
  }, [stopForm.name, dropPinLocation, selectedRoute?.id]);

  // Activate "Drop Pin" draggable marker along the current route corridor
  const handleActivateDropLocation = () => {
    const rStops = selectedRoute?.stops || [];
    let defaultLat =
      stopForm.latitude !== '' && Number.isFinite(Number(stopForm.latitude))
        ? Number(stopForm.latitude)
        : 12.9592;
    let defaultLng =
      stopForm.longitude !== '' && Number.isFinite(Number(stopForm.longitude))
        ? Number(stopForm.longitude)
        : 80.0597;

    if (
      (stopForm.latitude === '' || !Number.isFinite(Number(stopForm.latitude))) &&
      rStops.length >= 2
    ) {
      const prevStop = rStops[rStops.length - 2];
      const destStop = rStops[rStops.length - 1];
      defaultLat = Number(((Number(prevStop.latitude) + Number(destStop.latitude)) / 2).toFixed(5));
      defaultLng = Number(((Number(prevStop.longitude) + Number(destStop.longitude)) / 2).toFixed(5));
    } else if (
      (stopForm.latitude === '' || !Number.isFinite(Number(stopForm.latitude))) &&
      rStops.length === 1
    ) {
      defaultLat = Number((Number(rStops[0].latitude) + 0.005).toFixed(5));
      defaultLng = Number((Number(rStops[0].longitude) + 0.005).toFixed(5));
    }

    const pinObj = {
      lat: defaultLat,
      lng: defaultLng,
      label: stopForm.name?.trim() || 'Marked Stop Position'
    };
    setDropPinLocation(pinObj);
    setStopForm((prev) => ({
      ...prev,
      latitude: defaultLat,
      longitude: defaultLng
    }));
    addToast({
      title: '📍 Drop Pin Placed on Map',
      message: 'Place or drag the pin to your desired location on the map, then enter the Stop Name and optional Landmark.',
      type: 'info'
    });
  };

  const handleDropPinMoved = (lat, lng) => {
    if (!dropPinLocation) return;
    setDropPinLocation((prev) => ({
      ...(prev || {}),
      lat,
      lng,
      label: stopForm.name?.trim() || 'Marked Stop Position'
    }));
    setStopForm((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
  };

  const handleClearDropLocation = () => {
    setDropPinLocation(null);
    setStopForm((prev) => ({
      ...prev,
      latitude: '',
      longitude: ''
    }));
  };

  // Persist dragged stop marker coordinates directly from the map
  const handleStopDragEnd = async (stop, newLat, newLng) => {
    if (!selectedRoute || !stop?.id) return;
    try {
      const res = await api.put(`/routes/${selectedRoute.id}/stops/${stop.id}`, {
        latitude: newLat,
        longitude: newLng
      });
      if (res.data?.route) {
        setMapMetrics({
          distanceKm: res.data.route.distance_km,
          durationMins: res.data.route.estimated_time_minutes,
          legDistancesKm: []
        });
      } else {
        setMapMetrics({ distanceKm: null, durationMins: null, legDistancesKm: [] });
      }
      addToast({
        title: '📍 Stop Location Updated on Map',
        message: `"${stop.name}" moved to (${newLat.toFixed(4)}, ${newLng.toFixed(4)}) and connected shortest path recalculated.`,
        type: 'success'
      });
      await fetchData(selectedBus?.id);
    } catch (err) {
      addToast({
        title: 'Error',
        message: 'Failed to update dragged stop coordinates',
        type: 'danger'
      });
    }
  };

  const handleRouteCalculatedFromMap = ({ distanceKm, durationMins, legDistancesKm = [] }) => {
    if (!distanceKm) return;
    setMapMetrics({ distanceKm, durationMins, legDistancesKm });
    if (selectedRoute && Math.abs(Number(selectedRoute.distance_km || 0) - distanceKm) >= 0.05) {
      setRoutes((prev) =>
        prev.map((r) =>
          Number(r.id) === Number(selectedRoute.id)
            ? { ...r, distance_km: distanceKm, estimated_time_minutes: durationMins }
            : r
        )
      );
      api
        .put(`/routes/${selectedRoute.id}`, {
          distance_km: distanceKm,
          estimated_time_minutes: durationMins
        })
        .catch(() => {});
    }
  };

  const openConfigureRouteModal = () => {
    if (!selectedBus) return;
    setFormData({
      shuttle_id: selectedBus.id,
      code: selectedRoute?.code || `RT-${selectedBus.code}`,
      name:
        selectedRoute?.name ||
        `${selectedBus.start_point || 'Start'} - ${selectedBus.destination || 'Destination'} Express`,
      start_point: selectedRoute?.start_point || selectedBus.start_point || '',
      end_point: selectedRoute?.end_point || selectedBus.destination || '',
      landmark: selectedRoute?.landmark || '',
      distance_km: Number(exactDistanceKm) || selectedRoute?.distance_km || 4.5,
      estimated_time_minutes: exactDurationMins || selectedRoute?.estimated_time_minutes || 18
    });
    setIsModalOpen(true);
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();
    setSubmittingRoute(true);
    try {
      await api.post('/routes', {
        ...formData,
        landmark: (formData.landmark || '').trim(),
        shuttle_id: Number(formData.shuttle_id || selectedBus?.id)
      });
      addToast({
        title: 'Bus Route Saved & Synced',
        message: `Route for Bus ${selectedBus?.code} updated across Passenger & Driver portals.`,
        type: 'success'
      });
      setIsModalOpen(false);
      setMapMetrics({ distanceKm: null, durationMins: null, legDistancesKm: [] });
      await fetchData(selectedBus?.id);
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to save route for bus',
        type: 'danger'
      });
    } finally {
      setSubmittingRoute(false);
    }
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!selectedRoute) {
      addToast({
        title: 'Create Route First',
        message: `Please configure the route for Bus ${selectedBus?.code} first.`,
        type: 'warning'
      });
      return;
    }
    setSubmittingStop(true);
    try {
      const cleanName = stopForm.name.trim();
      const cleanLandmark = (stopForm.landmark || '').trim();
      const payload = {
        name: cleanName,
        landmark: cleanLandmark
      };
      if (
        stopForm.latitude !== '' &&
        stopForm.longitude !== '' &&
        Number.isFinite(Number(stopForm.latitude)) &&
        Number.isFinite(Number(stopForm.longitude))
      ) {
        payload.latitude = Number(stopForm.latitude);
        payload.longitude = Number(stopForm.longitude);
      }

      const res = await api.post(`/routes/${selectedRoute.id}/stops`, payload);
      if (res.data?.route) {
        setMapMetrics({
          distanceKm: res.data.route.distance_km,
          durationMins: res.data.route.estimated_time_minutes,
          legDistancesKm: []
        });
      } else {
        setMapMetrics({ distanceKm: null, durationMins: null, legDistancesKm: [] });
      }
      addToast({
        title: 'Stop Added & Connected on Shortest Path',
        message: `"${cleanName}"${cleanLandmark ? ` (${cleanLandmark})` : ''} added and linked along the shortest road path to destination on Bus ${selectedBus?.code}!`,
        type: 'success'
      });
      setStopForm({ name: '', landmark: '', latitude: '', longitude: '' });
      setDropPinLocation(null);
      await fetchData(selectedBus?.id);
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to add stop to bus route', type: 'danger' });
    } finally {
      setSubmittingStop(false);
    }
  };

  const handleDeleteStop = async (stopId, stopName) => {
    if (!selectedRoute) return;
    try {
      const res = await api.delete(`/routes/${selectedRoute.id}/stops/${stopId}`);
      if (res.data?.route) {
        setMapMetrics({
          distanceKm: res.data.route.distance_km,
          durationMins: res.data.route.estimated_time_minutes,
          legDistancesKm: []
        });
      } else {
        setMapMetrics({ distanceKm: null, durationMins: null, legDistancesKm: [] });
      }
      addToast({
        title: 'Stop Removed',
        message: `"${stopName}" removed from Bus ${selectedBus?.code} route.`,
        type: 'info'
      });
      await fetchData(selectedBus?.id);
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to remove stop', type: 'danger' });
    }
  };

  // Helper to compute exact road leg distance between consecutive stops (prefers OSRM leg distance from map)
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
    <div className="space-y-8 pb-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Bus Route & Stop Landmark Configuration
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Select an Assigned Bus Route below to view its exact shortest multi-stop road path, drag stop pins or use "Drop Location on Map", and calculate exact road distance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={dropPinLocation ? handleClearDropLocation : handleActivateDropLocation}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition shadow-sm ${
              dropPinLocation
                ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-400/40'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-500 hover:text-slate-950'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>
              {dropPinLocation
                ? `📍 Pin Active (${Number(dropPinLocation.lat).toFixed(4)}, ${Number(dropPinLocation.lng).toFixed(4)})`
                : '📍 Drop Location on Map (Drag to Locate)'}
            </span>
          </button>

          <Button onClick={openConfigureRouteModal} icon={selectedRoute ? Edit2 : Plus} size="sm" className="shrink-0">
            {selectedRoute
              ? `Update Route for Bus ${selectedBus?.code || ''}`
              : `Add Route for Bus ${selectedBus?.code || ''}`}
          </Button>
        </div>
      </div>

      {/* SECTION 1: Dedicated Assigned Routes Cards Grid (Cleanly aligned at top, never merged with Map) */}
      <Card className="p-5 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-premium">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-navy-900 dark:text-white flex items-center gap-2">
              <Bus className="w-4 h-4 text-brand-500" />
              <span>Assigned Bus Routes ({shuttles.length} Active Buses)</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any assigned bus card below to inspect or edit its route, intermediate stops, and live map distance.
            </p>
          </div>
          {selectedBus && (
            <Badge status="active">
              Currently Viewing: Bus {selectedBus.code} ({selectedBus.driver_name || 'Assigned Driver'})
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shuttles.map((s) => {
            const isSelected = Number(selectedBus?.id) === Number(s.id);
            const busRoute =
              routes.find(
                (r) => Number(r.shuttle_id) === Number(s.id) || Number(r.id) === Number(s.current_route_id)
              ) || null;
            const rStops = busRoute?.stops || s.stops || [];
            const rDist =
              isSelected && exactDistanceKm
                ? exactDistanceKm
                : busRoute?.distance_km || s.distance_km || 4.2;
            const rTime =
              isSelected && exactDurationMins
                ? exactDurationMins
                : busRoute?.estimated_time_minutes || s.eta_minutes || 15;

            return (
              <div
                key={s.id}
                onClick={() => handleSelectBus(s.id)}
                className={`cursor-pointer rounded-2xl p-4 transition-all border flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-brand-50/80 dark:bg-slate-800/90 border-brand-500 ring-2 ring-brand-500/30 shadow-md'
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs shrink-0 ${
                          isSelected
                            ? 'bg-brand-600 text-white'
                            : 'bg-navy-900 dark:bg-slate-700 text-white'
                        }`}
                      >
                        Bus {s.code}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-navy-900 dark:text-white truncate">
                          {busRoute?.name || `${s.start_point || 'Start'} - ${s.destination || 'Destination'}`}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                          Driver: <b className="text-slate-700 dark:text-slate-200">{s.driver_name || 'Assigned Driver'}</b>
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] shrink-0">
                      {rDist} km
                    </span>
                  </div>

                  {/* Start -> Destination Bar */}
                  <div className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-[11px] font-bold text-navy-900 dark:text-white">
                    <span className="truncate text-emerald-600 dark:text-emerald-400">
                      🟢 {busRoute?.start_point || s.start_point || 'Start'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-rose-600 dark:text-rose-400">
                      🏁 {busRoute?.end_point || s.destination || 'Destination'}
                    </span>
                  </div>

                  {/* Ordered Stops Pills */}
                  {rStops.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5">
                      {rStops.map((st, idx) => (
                        <React.Fragment key={st.id || idx}>
                          <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {idx + 1}. {st.name}
                          </span>
                          {idx < rStops.length - 1 && (
                            <span className="text-[10px] text-slate-400 font-bold">➔</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  <span>{rStops.length} Stops Configured</span>
                  <span className="text-brand-600 dark:text-blue-400">
                    Est. Time: ~{rTime} min
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* SECTION 2: 12-Column Configuration & Isolated Interactive Route Map */}
      {!selectedBus ? (
        <EmptyState
          icon="route"
          title="No shuttles available"
          description="Create a shuttle in the Shuttles page first to configure its route and stops."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 cols): Selected Assigned Bus Route Details + Add Stop Form */}
            <div className="lg:col-span-5 space-y-6">
              {/* Selected Bus Route Overview Card */}
              <Card className="p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-premium">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-brand-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                      {selectedBus.code}
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 dark:text-blue-400 block">
                        {selectedRoute?.code || `RT-${selectedBus.code}`} • {selectedBus.vehicle_number} • Driver: {selectedBus.driver_name || 'Assigned'}
                      </span>
                      <h3 className="text-base font-black text-navy-900 dark:text-white">
                        {selectedRoute?.name || `${selectedBus.start_point} - ${selectedBus.destination} Express`}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openConfigureRouteModal}
                    className="px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-blue-400 border border-brand-200 dark:border-brand-800 text-xs font-bold hover:bg-brand-600 hover:text-white transition flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Route</span>
                  </button>
                </div>

                {/* Start -> Destination Banner */}
                <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-bold truncate">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-[9px] font-black uppercase shrink-0">
                      Start
                    </span>
                    <span className="truncate">{selectedRoute?.start_point || selectedBus.start_point}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="flex items-center gap-2 font-bold truncate">
                    <span className="truncate">{selectedRoute?.end_point || selectedBus.destination}</span>
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-[9px] font-black uppercase shrink-0">
                      Dest
                    </span>
                  </div>
                </div>

                {/* Full Route Path Sequence Preview */}
                {selectedRoute?.stops?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-slate-800/80 border border-blue-200/70 dark:border-slate-700">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-600 dark:text-blue-400 block mb-2">
                      Assigned Shortest Connected Path ({selectedRoute.stops.length} Stops):
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-navy-900 dark:text-white">
                      {selectedRoute.stops.map((st, idx) => (
                        <React.Fragment key={st.id || idx}>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[11px] ${
                              idx === 0
                                ? 'bg-emerald-600 text-white'
                                : idx === selectedRoute.stops.length - 1
                                ? 'bg-rose-600 text-white'
                                : 'bg-white dark:bg-slate-900 text-brand-600 dark:text-blue-300 border border-blue-200 dark:border-slate-700'
                            }`}
                          >
                            {idx + 1}. {st.name}
                          </span>
                          {idx < selectedRoute.stops.length - 1 && (
                            <span className="text-slate-400 font-black">➔</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}

                {/* Route Metadata Grid (Synced with Exact Map Road Distance & Time) */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Stops</span>
                    <span className="text-sm font-black text-navy-900 dark:text-white">
                      {selectedRoute?.stops?.length || 0} Stops
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
                      Exact Map Distance
                    </span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {exactDistanceKm} km
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/60">
                    <span className="text-[10px] font-bold uppercase text-brand-600 dark:text-blue-400 block">
                      Est. Road Time
                    </span>
                    <span className="text-sm font-black text-brand-600 dark:text-blue-400">
                      ~{exactDurationMins} min
                    </span>
                  </div>
                </div>

                {selectedRoute?.landmark && (
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 px-3.5 py-2.5 rounded-xl font-semibold">
                    <Landmark className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      Corridor Landmark: <b>{selectedRoute.landmark}</b>
                    </span>
                  </div>
                )}
              </Card>

              {/* Add Stop Form: Supports BOTH Drop Pin on Map AND Direct Stop Name + Latitude/Longitude */}
              <Card className="p-5 space-y-4 border border-slate-200 dark:border-slate-800 shadow-premium relative z-10">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-navy-900 dark:text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-brand-500" />
                      <span>Add Intermediate Stop for Bus {selectedBus.code}</span>
                    </h3>
                    <button
                      type="button"
                      onClick={dropPinLocation ? handleClearDropLocation : handleActivateDropLocation}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1 border transition ${
                        dropPinLocation
                          ? 'bg-brand-600 text-white border-brand-500 shadow-sm'
                          : 'bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-blue-400 border-brand-200 dark:border-slate-700 hover:bg-brand-600 hover:text-white'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>{dropPinLocation ? 'Clear Drop Pin' : '📍 Drop Pin on Map'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {dropPinLocation
                      ? '📍 Drop Pin Mode: Place/drag the pin on the map, then enter the Stop Name and optional Landmark.'
                      : 'Direct Mode: Enter the Stop Name directly (Latitude & Longitude auto-set from Stop Name) and optional Landmark.'}
                  </p>
                </div>

                <form onSubmit={handleAddStop} className="space-y-3.5">
                  <Input
                    label="Stop Name / Marked Position Name"
                    id="stopName"
                    required
                    placeholder="e.g. Chromepet / Erumaiyur / Camp Road"
                    value={stopForm.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStopForm((prev) => ({
                        ...prev,
                        name: val,
                        ...(val.trim() === '' && !dropPinLocation ? { latitude: '', longitude: '' } : {})
                      }));
                      if (dropPinLocation) {
                        setDropPinLocation((prev) =>
                          prev ? { ...prev, label: val || 'Marked Stop Position' } : null
                        );
                      }
                    }}
                  />

                  <Input
                    label="Stop Landmark (Optional)"
                    id="stopLandmark"
                    required={false}
                    placeholder="Optional — e.g. Near Bus Stand / Main Arch"
                    value={stopForm.landmark}
                    onChange={(e) => setStopForm({ ...stopForm, landmark: e.target.value })}
                  />

                  {/* Latitude & Longitude Fields (Auto-set from Stop Name OR from Dropped Pin) */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label={dropPinLocation ? 'Marked Pin Latitude' : 'Latitude (Auto / Custom)'}
                      id="stopLat"
                      type="number"
                      step="0.00001"
                      required={false}
                      placeholder="Auto from Stop Name"
                      value={stopForm.latitude}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStopForm({ ...stopForm, latitude: val });
                        if (dropPinLocation && val !== '' && !isNaN(Number(val))) {
                          setDropPinLocation((prev) => (prev ? { ...prev, lat: Number(val) } : null));
                        }
                      }}
                    />
                    <Input
                      label={dropPinLocation ? 'Marked Pin Longitude' : 'Longitude (Auto / Custom)'}
                      id="stopLng"
                      type="number"
                      step="0.00001"
                      required={false}
                      placeholder="Auto from Stop Name"
                      value={stopForm.longitude}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStopForm({ ...stopForm, longitude: val });
                        if (dropPinLocation && val !== '' && !isNaN(Number(val))) {
                          setDropPinLocation((prev) => (prev ? { ...prev, lng: Number(val) } : null));
                        }
                      }}
                    />
                  </div>

                  {/* Drop Pin Toggle Bar */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <span>
                        {dropPinLocation
                          ? 'Using Dropped Pin Location on Map'
                          : 'Using Stop Name, Latitude & Longitude'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={dropPinLocation ? handleClearDropLocation : handleActivateDropLocation}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition shrink-0 ${
                        dropPinLocation
                          ? 'bg-rose-600 text-white hover:bg-rose-700'
                          : 'bg-brand-600 text-white hover:bg-brand-500 shadow-sm'
                      }`}
                    >
                      {dropPinLocation ? 'Use Stop Name Auto' : '📍 Drop Pin Button'}
                    </button>
                  </div>

                  <Button type="submit" disabled={submittingStop} icon={Plus} className="w-full">
                    {submittingStop
                      ? 'Adding Stop & Connecting Shortest Path...'
                      : dropPinLocation
                      ? `Add Stop at Marked Pin (${Number(stopForm.latitude).toFixed(4)}, ${Number(stopForm.longitude).toFixed(4)})`
                      : `Add Stop to Bus ${selectedBus.code} Route`}
                  </Button>
                </form>
              </Card>
            </div>

            {/* Right Column (7 cols): Dedicated Isolated Interactive Google Map Card */}
            <div className="lg:col-span-7 relative z-0">
              <Card
                className="p-0 overflow-hidden shadow-premium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 isolate"
                style={{ isolation: 'isolate' }}
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 relative z-10">
                  <div>
                    <h3 className="text-sm font-extrabold text-navy-900 dark:text-white flex items-center gap-2">
                      <Navigation2 className="w-4 h-4 text-brand-500" />
                      <span>
                        Bus {selectedBus.code} Google Route Map ({selectedRoute?.stops?.length || 0} Stops • {exactDistanceKm} km)
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Shortest connected road path from <b>{selectedRoute?.start_point || selectedBus.start_point}</b> through all stops to <b>{selectedRoute?.end_point || selectedBus.destination}</b>. <b>Tip:</b> You can drag any stop pin on the map to relocate it!
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={dropPinLocation ? handleClearDropLocation : handleActivateDropLocation}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition ${
                        dropPinLocation
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-500 hover:text-slate-950'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>{dropPinLocation ? 'Dragging Pin Active (Click to Clear)' : '📍 Drop Location on Map'}</span>
                    </button>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Shortest Road Distance: {exactDistanceKm} km (~{exactDurationMins} min)</span>
                    </span>
                  </div>
                </div>

                <div className="h-[520px] w-full overflow-hidden relative z-0 isolate">
                  <LiveMap
                    stops={selectedRoute?.stops || []}
                    shuttles={selectedBus.status === 'on_trip' ? [selectedBus] : []}
                    selectedShuttleId={selectedBus.status === 'on_trip' ? selectedBus.id : null}
                    onRouteCalculated={handleRouteCalculatedFromMap}
                    dropPinLocation={dropPinLocation}
                    onDropPinChange={handleDropPinMoved}
                    editableStops={true}
                    onStopDragEnd={handleStopDragEnd}
                    showAllFitOnLoad={true}
                    className="h-full w-full rounded-none border-none"
                  />
                </div>
              </Card>
            </div>
          </div>

          {/* SECTION 3: Full-Width Standalone Assigned Route Stops Card (Cleanly separated below Map) */}
          <Card className="p-6 space-y-5 shadow-premium border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base font-black uppercase tracking-wider text-navy-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  <span>
                    Assigned Route Stops — Bus {selectedBus.code} ({selectedRoute?.name || `${selectedBus.start_point} ➔ ${selectedBus.destination}`})
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Start: <b className="text-emerald-600 dark:text-emerald-400">{selectedRoute?.start_point || selectedBus.start_point}</b> ➔ Final Destination: <b className="text-rose-600 dark:text-rose-400">{selectedRoute?.end_point || selectedBus.destination}</b> • Exact Total Road Distance Calculated from Map: <b className="text-brand-600 dark:text-blue-400">{exactDistanceKm} km</b> (~{exactDurationMins} min)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold border border-emerald-200 dark:border-emerald-800">
                  Total Map Distance: {exactDistanceKm} km
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-blue-400 text-xs font-extrabold border border-brand-200 dark:border-slate-700">
                  {selectedRoute?.stops?.length || 0} Ordered Stops
                </span>
              </div>
            </div>

            {!selectedRoute?.stops || selectedRoute.stops.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No stops configured yet for Bus {selectedBus.code}. Use the form above to add stops.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  let cumulativeKm = 0;
                  return selectedRoute.stops.map((stop, index) => {
                    const isStart = index === 0;
                    const isEnd = index === selectedRoute.stops.length - 1 && selectedRoute.stops.length > 1;
                    const prevStop = index > 0 ? selectedRoute.stops[index - 1] : null;
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
                        className="flex items-start justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700 shadow-sm"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                              isStart
                                ? 'bg-emerald-600'
                                : isEnd
                                ? 'bg-rose-600'
                                : 'bg-brand-600'
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0 space-y-1">
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
                              <h5 className="text-sm font-extrabold text-navy-900 dark:text-white truncate">
                                {stop.name}
                              </h5>
                            </div>
                            {hasLandmark && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 truncate">
                                <Landmark className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{stop.landmark}</span>
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              <span>
                                GPS: {Number(stop.latitude).toFixed(4)}, {Number(stop.longitude).toFixed(4)}
                              </span>
                              {index > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-sans font-bold text-brand-600 dark:text-blue-400">
                                  +{legKm.toFixed(2)} km (Total: {cumulativeKm.toFixed(2)} km)
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 font-sans font-bold text-emerald-700 dark:text-emerald-300">
                                  0.00 km (Origin)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteStop(stop.id, stop.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                          title="Remove Stop"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </Card>
        </>
      )}

      {/* Modal: Configure / Update Route for Selected Bus (Landmark is Optional) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Configure Route for Bus ${selectedBus?.code || ''}`}
        subtitle="Landmark is optional. Changes automatically update on the Passenger and Driver websites."
      >
        <form onSubmit={handleSaveRoute} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Route Code"
              id="routeCode"
              required
              placeholder="e.g. RT-S01"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
            <Input
              label="Route Name"
              id="routeName"
              required
              placeholder="e.g. Tambaram - Sairam Express"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Starting Point"
              id="start_point"
              required
              placeholder="e.g. Tambaram"
              value={formData.start_point}
              onChange={(e) => setFormData({ ...formData, start_point: e.target.value })}
            />
            <Input
              label="Destination"
              id="end_point"
              required
              placeholder="e.g. Sairam Engineering College"
              value={formData.end_point}
              onChange={(e) => setFormData({ ...formData, end_point: e.target.value })}
            />
          </div>

          <Input
            label="Primary Route Landmark (Optional)"
            id="landmark"
            required={false}
            placeholder="Optional — e.g. Kishkinta Junction / Main Arch"
            value={formData.landmark}
            onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Distance (km — Auto-Calculated from Map)"
              id="dist"
              type="number"
              step="0.01"
              value={formData.distance_km}
              onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
            />
            <Input
              label="Est. Duration (mins)"
              id="estTime"
              type="number"
              value={formData.estimated_time_minutes}
              onChange={(e) => setFormData({ ...formData, estimated_time_minutes: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingRoute}>
              {submittingRoute ? 'Saving & Syncing...' : 'Save & Sync Bus Route'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminRoutes;
