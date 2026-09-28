import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import LiveMap from '../../components/map/LiveMap';
import { MapPin, Plus, Crosshair, Trash2, Navigation2 } from 'lucide-react';

export const AdminStops = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dropPinLocation, setDropPinLocation] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    latitude: '',
    longitude: '',
    landmark: ''
  });

  const { addToast } = useToast();

  const fetchRoutes = async () => {
    try {
      const res = await api.get('/routes');
      if (res.data.success) {
        setRoutes(res.data.data);
        if (res.data.data.length > 0 && !selectedRouteId) {
          setSelectedRouteId(res.data.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const activeRoute = routes.find((r) => r.id === Number(selectedRouteId)) || routes[0];

  const handleActivateDropPin = () => {
    const rStops = activeRoute?.stops || [];
    let defaultLat = 12.9592;
    let defaultLng = 80.0597;
    if (rStops.length >= 2) {
      const prev = rStops[rStops.length - 2];
      const dest = rStops[rStops.length - 1];
      defaultLat = Number(((Number(prev.latitude) + Number(dest.latitude)) / 2).toFixed(5));
      defaultLng = Number(((Number(prev.longitude) + Number(dest.longitude)) / 2).toFixed(5));
    }
    setDropPinLocation({
      lat: defaultLat,
      lng: defaultLng,
      label: formData.name?.trim() || 'Drag Pin to Locate Stop'
    });
    setFormData((prev) => ({
      ...prev,
      latitude: defaultLat,
      longitude: defaultLng
    }));
    addToast({
      title: '📍 Drop Location Pin Active',
      message: 'Drag the glowing amber pin on the map (or click on the map) to set the stop location.',
      type: 'info'
    });
  };

  const handleDropPinMoved = (lat, lng) => {
    setDropPinLocation((prev) => ({
      ...(prev || {}),
      lat,
      lng,
      label: formData.name?.trim() || 'Dropped Stop Location'
    }));
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng
    }));
  };

  const handleStopDragEnd = async (stop, newLat, newLng) => {
    if (!activeRoute || !stop?.id) return;
    try {
      await api.put(`/routes/${activeRoute.id}/stops/${stop.id}`, {
        latitude: newLat,
        longitude: newLng
      });
      addToast({
        title: '📍 Stop Location Updated',
        message: `"${stop.name}" moved to (${newLat.toFixed(4)}, ${newLng.toFixed(4)}) and connected path recalculated.`,
        type: 'success'
      });
      fetchRoutes();
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to relocate stop', type: 'danger' });
    }
  };

  const handleAddStop = async (e) => {
    e.preventDefault();
    if (!activeRoute) return;
    try {
      const payload = {
        name: formData.name.trim(),
        landmark: (formData.landmark || '').trim()
      };
      if (
        formData.latitude !== '' &&
        formData.longitude !== '' &&
        Number.isFinite(Number(formData.latitude)) &&
        Number.isFinite(Number(formData.longitude))
      ) {
        payload.latitude = Number(formData.latitude);
        payload.longitude = Number(formData.longitude);
      }
      await api.post(`/routes/${activeRoute.id}/stops`, payload);
      addToast({
        title: 'Stop Added & Connected',
        message: `${formData.name} added to ${activeRoute.name}`,
        type: 'success'
      });
      setIsModalOpen(false);
      setDropPinLocation(null);
      setFormData({
        name: '',
        latitude: '',
        longitude: '',
        landmark: ''
      });
      fetchRoutes();
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to add stop', type: 'danger' });
    }
  };

  const handleDeleteStop = async (stopId, stopName) => {
    if (!activeRoute) return;
    try {
      await api.delete(`/routes/${activeRoute.id}/stops/${stopId}`);
      addToast({ title: 'Stop Removed', message: `${stopName} removed from route`, type: 'info' });
      fetchRoutes();
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to remove stop', type: 'danger' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Campus Stop Waypoints Registry
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Drag stop pins directly on the map or click "Drop Location on Map" to assign exact stop coordinates along the shortest connected route path.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedRouteId}
            onChange={(e) => {
              setSelectedRouteId(e.target.value);
              setDropPinLocation(null);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold py-2 px-3 text-slate-800 dark:text-white"
          >
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} - {r.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={
              dropPinLocation
                ? () => {
                    setDropPinLocation(null);
                    setFormData((p) => ({ ...p, latitude: '', longitude: '' }));
                  }
                : handleActivateDropPin
            }
            className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition ${
              dropPinLocation
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-500 hover:text-slate-950'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>
              {dropPinLocation
                ? `📍 Dropped (${Number(dropPinLocation.lat).toFixed(4)}, ${Number(dropPinLocation.lng).toFixed(4)})`
                : '📍 Drop Location on Map'}
            </span>
          </button>

          <Button onClick={() => setIsModalOpen(true)} icon={Plus} size="sm">
            Add Waypoint Stop
          </Button>
        </div>
      </div>

      {/* Interactive Route & Stop Map with Draggable Pins */}
      <Card className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800 shadow-premium">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <span className="text-xs font-extrabold text-navy-900 dark:text-white flex items-center gap-2">
            <Navigation2 className="w-4 h-4 text-brand-500" />
            <span>
              {activeRoute?.name || 'Route'} — Connected Shortest Path ({activeRoute?.stops?.length || 0} Stops • {activeRoute?.distance_km || 0} km)
            </span>
          </span>
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
            ✋ Drag any stop pin on the map to relocate it
          </span>
        </div>
        <div className="h-[420px] w-full">
          <LiveMap
            stops={activeRoute?.stops || []}
            shuttles={[]}
            dropPinLocation={dropPinLocation}
            onDropPinChange={handleDropPinMoved}
            editableStops={true}
            onStopDragEnd={handleStopDragEnd}
            showAllFitOnLoad={true}
            className="h-full w-full rounded-none border-none"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeRoute?.stops?.map((stop, index) => (
          <Card key={stop.id} hover className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-brand-500 text-white font-black text-xs flex items-center justify-center">
                #{index + 1}
              </span>
              <div className="flex items-center gap-2">
                <Badge status="active">
                  {index === 0
                    ? 'Start #1'
                    : index === activeRoute.stops.length - 1
                    ? `Destination #${index + 1}`
                    : `Stop #${index + 1}`}
                </Badge>
                <button
                  type="button"
                  onClick={() => handleDeleteStop(stop.id, stop.name)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Delete Stop"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-navy-900 dark:text-white">{stop.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stop.landmark || 'Designated Campus Bus Shelter'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-brand-500" />
                {Number(stop.latitude || 0).toFixed(4)}, {Number(stop.longitude || 0).toFixed(4)}
              </span>
              <span className="text-slate-500 font-sans">
                Stop {index + 1} of {activeRoute.stops.length}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Stop Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add Stop to ${activeRoute?.name || 'Route'}`}
        subtitle="Leave coordinates blank for automatic shortest-path placement, or use the Dropped Map Pin coordinates."
      >
        <form onSubmit={handleAddStop} className="space-y-4">
          <Input
            label="Stop / Station Name"
            id="stopName"
            required
            placeholder="e.g. Chromepet / Erumaiyur / Camp Road"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude (Optional / From Dropped Pin)"
              id="lat"
              type="number"
              step="0.00001"
              required={false}
              placeholder="Auto-calculated if blank"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
            />
            <Input
              label="Longitude (Optional / From Dropped Pin)"
              id="lng"
              type="number"
              step="0.00001"
              required={false}
              placeholder="Auto-calculated if blank"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
            />
          </div>

          <Input
            label="Landmark Description (Optional)"
            id="landmark"
            required={false}
            placeholder="Optional — e.g. Near Bus Stand"
            value={formData.landmark}
            onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Stop</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminStops;
