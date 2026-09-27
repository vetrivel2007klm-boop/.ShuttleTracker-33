import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input, { Select } from '../../components/common/Input';
import { MapPin, Plus, Navigation } from 'lucide-react';

export const AdminStops = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    latitude: 12.9750,
    longitude: 77.6000,
    landmark: '',
    sequence_order: 1
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

  const activeRoute = routes.find(r => r.id === Number(selectedRouteId)) || routes[0];

  const handleAddStop = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/routes/${activeRoute.id}/stops`, formData);
      addToast({ title: 'Stop Added', message: `${formData.name} added to route`, type: 'success' });
      setIsModalOpen(false);
      setFormData({
        name: '',
        latitude: 12.9750,
        longitude: 77.6000,
        landmark: '',
        sequence_order: (activeRoute?.stops?.length || 0) + 1
      });
      fetchRoutes();
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to add stop', type: 'danger' });
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
            Geographic coordinates, passenger boarding shelters and sequential markers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold py-2 px-3 text-slate-800 dark:text-white"
          >
            {routes.map(r => (
              <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
            ))}
          </select>
          <Button onClick={() => setIsModalOpen(true)} icon={Plus} size="sm">
            Add Waypoint Stop
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeRoute?.stops?.map((stop, index) => (
          <Card key={stop.id} hover className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-brand-500 text-white font-black text-xs flex items-center justify-center">
                #{index + 1}
              </span>
              <Badge status="active">Active Stop</Badge>
            </div>

            <div>
              <h4 className="text-sm font-bold text-navy-900 dark:text-white">
                {stop.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stop.landmark || 'Designated Campus Bus Shelter'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-brand-500" />
                {stop.latitude?.toFixed(4)}, {stop.longitude?.toFixed(4)}
              </span>
              <span className="text-slate-500 font-sans">Stop {index + 1} of {activeRoute.stops.length}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Stop Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add Stop to ${activeRoute?.name || 'Route'}`}
        subtitle="Specify waypoint name and GPS coordinates"
      >
        <form onSubmit={handleAddStop} className="space-y-4">
          <Input
            label="Stop / Station Name"
            id="stopName"
            required
            placeholder="e.g. Science Auditorium Plaza"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Latitude"
              id="lat"
              type="number"
              step="0.0001"
              required
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
            />
            <Input
              label="Longitude"
              id="lng"
              type="number"
              step="0.0001"
              required
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
            />
          </div>

          <Input
            label="Landmark Description"
            id="landmark"
            placeholder="e.g. Near Building 4 Entrance"
            value={formData.landmark}
            onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Stop
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminStops;
