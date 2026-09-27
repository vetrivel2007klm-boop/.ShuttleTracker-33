import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  Plus,
  Edit2,
  MapPin,
  ArrowRight,
  Mail,
  Users2,
  UserCheck,
  Eye,
  IdCard
} from 'lucide-react';

export const AdminShuttles = () => {
  const [shuttles, setShuttles] = useState([]);
  const [passengers, setPassengers] = useState([]);
  const [selectedBusForPassengers, setSelectedBusForPassengers] = useState(null);
  const [previewPassengerIdCard, setPreviewPassengerIdCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShuttle, setEditingShuttle] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    vehicle_number: '',
    capacity: 36,
    start_point: '',
    destination: ''
  });

  const { addToast } = useToast();
  const { socket } = useSocket();

  const fetchData = async () => {
    try {
      const [shuttlesRes, passRes] = await Promise.all([
        api.get('/shuttles'),
        api.get('/auth/passengers')
      ]);

      if (shuttlesRes.data.success) setShuttles(shuttlesRes.data.data);
      if (passRes.data.success) setPassengers(passRes.data.data || []);
    } catch (err) {
      console.error('Failed to load fleet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handlePassengerUpdated = (updatedPassenger) => {
      if (updatedPassenger && updatedPassenger.id) {
        setPassengers((prev) => {
          const exists = prev.some((p) => Number(p.id) === Number(updatedPassenger.id));
          if (exists) {
            return prev.map((p) =>
              Number(p.id) === Number(updatedPassenger.id) ? { ...p, ...updatedPassenger } : p
            );
          }
          return [...prev, updatedPassenger];
        });
      }
      fetchData();
    };
    socket.on('passenger:updated', handlePassengerUpdated);
    socket.on('driver:updated', fetchData);
    socket.on('shuttle:updated', fetchData);
    return () => {
      socket.off('passenger:updated', handlePassengerUpdated);
      socket.off('driver:updated', fetchData);
      socket.off('shuttle:updated', fetchData);
    };
  }, [socket]);

  const openAddModal = () => {
    setEditingShuttle(null);
    setFormData({
      code: `S0${shuttles.length + 1}`,
      vehicle_number: '',
      capacity: 36,
      start_point: '',
      destination: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (shuttle) => {
    setEditingShuttle(shuttle);
    setFormData({
      code: shuttle.code || '',
      vehicle_number: shuttle.vehicle_number || '',
      capacity: shuttle.capacity || 36,
      start_point: shuttle.start_point || '',
      destination: shuttle.destination || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: `Shuttle ${formData.code.trim().toUpperCase()}`,
        vehicle_number: formData.vehicle_number.trim(),
        capacity: Number(formData.capacity) || 36,
        start_point: formData.start_point.trim(),
        destination: formData.destination.trim()
      };

      if (editingShuttle) {
        const res = await api.put(`/shuttles/${editingShuttle.id}`, payload);
        addToast({
          title: 'Shuttle Updated Across System',
          message:
            res.data.message ||
            `Bus ${payload.code} updated across all routes, stops, schedules, drivers, and live tracking.`,
          type: 'success'
        });
      } else {
        const res = await api.post('/shuttles', payload);
        addToast({
          title: 'New Shuttle Created',
          message:
            res.data.message ||
            `Shuttle ${payload.code} created! You can now assign a driver to it in the Drivers page.`,
          type: 'success'
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      addToast({
        title: 'Operation Failed',
        message: err.response?.data?.message || 'Unable to save shuttle details',
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const busPassengers = selectedBusForPassengers
    ? passengers.filter(
        (p) => (p.bus_number || '').toUpperCase() === (selectedBusForPassengers.code || '').toUpperCase()
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Shuttle Fleet Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Create and edit campus shuttles, plate numbers, seat capacities, starting points, and destinations (Status shows On Trip only after Driver presses Start Trip)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/drivers">
            <Button variant="outline" size="sm" icon={UserCheck}>
              Assign Drivers
            </Button>
          </Link>
          <Button onClick={openAddModal} icon={Plus} size="sm">
            Add New Shuttle
          </Button>
        </div>
      </div>

      {/* Fleet Table View */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : shuttles.length === 0 ? (
        <EmptyState
          icon="shuttle"
          title="No shuttles in fleet"
          description="Create your first campus transit shuttle, then assign a driver to it."
          actionLabel="Add New Shuttle"
          onAction={openAddModal}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Bus Number</th>
                  <th className="py-3.5 px-4">Bus Details</th>
                  <th className="py-3.5 px-4">Starting Point</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Assigned Driver</th>
                  <th className="py-3.5 px-4">Passengers</th>
                  <th className="py-3.5 px-4">Trip Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {shuttles.map((shuttle) => {
                  const matchedCount = passengers.filter(
                    (p) => (p.bus_number || '').toUpperCase() === (shuttle.code || '').toUpperCase()
                  ).length;
                  const isOnTrip = shuttle.status === 'on_trip';
                  return (
                    <tr
                      key={shuttle.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Bus Number shown only ONCE */}
                      <td className="py-4 px-4">
                        <div className="w-10 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                          {shuttle.code}
                        </div>
                      </td>

                      {/* Bus Details Column: ONLY Bus Plate Number and Capacity of Seats */}
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-navy-900 dark:text-white font-mono text-xs">
                          {shuttle.vehicle_number}
                        </div>
                        <div className="text-[11px] font-semibold text-brand-600 dark:text-blue-400 mt-0.5">
                          {shuttle.capacity || 36} Seats
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <MapPin className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                          <span>{shuttle.start_point || 'Not Set'}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{shuttle.destination || 'Not Set'}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        {shuttle.driver_name ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {shuttle.driver_name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {shuttle.driver_email || shuttle.driver_phone || 'Assigned Operator'}
                            </div>
                          </div>
                        ) : (
                          <Link
                            to="/admin/drivers"
                            className="inline-flex items-center gap-1 text-brand-600 dark:text-blue-400 font-bold hover:underline"
                          >
                            <span>+ Assign Driver</span>
                          </Link>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedBusForPassengers(shuttle)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-blue-400 font-bold text-[11px] hover:bg-blue-100 transition"
                        >
                          <Users2 className="w-3.5 h-3.5" />
                          <span>{matchedCount} Passengers</span>
                        </button>
                      </td>

                      <td className="py-4 px-4">
                        {isOnTrip ? (
                          <Badge status="on_trip">On Trip</Badge>
                        ) : shuttle.driver_not_started_at_schedule ? (
                          <Badge status="delayed">Not Started (Scheduled Time)</Badge>
                        ) : (
                          <Badge status="idle">Trip Not Started</Badge>
                        )}
                      </td>

                      {/* Actions Column: ONLY Edit option kept (Deactivate & Delete removed) */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => openEditModal(shuttle)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-600 dark:text-blue-400 hover:bg-brand-600 hover:text-white font-bold text-xs transition-all shadow-sm"
                            title="Edit Shuttle Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: View Registered Passengers for Selected Bus Number (Profile Photo, Name & Passenger ID) */}
      <Modal
        isOpen={!!selectedBusForPassengers}
        onClose={() => setSelectedBusForPassengers(null)}
        title={`Registered Passengers — Bus ${selectedBusForPassengers?.code || ''}`}
        subtitle={`Passenger Profile Photo, Passenger Name & Passenger ID • Route: ${selectedBusForPassengers?.start_point || 'Start'} ➔ ${selectedBusForPassengers?.destination || 'Destination'}`}
      >
        {busPassengers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No passengers have registered for Bus {selectedBusForPassengers?.code} yet.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {busPassengers.map((p, idx) => {
              const passengerIdCode = p.passenger_code || `PSG-${100 + Number(p.id || idx + 1)}`;
              const avatarSrc =
                p.avatar_url ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name || 'Passenger')}`;
              const idCardSrc = p.id_card_url || avatarSrc;

              return (
                <div
                  key={p.id || idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 text-xs"
                >
                  {/* Left: Profile Photo + Passenger Name + Passenger ID */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={avatarSrc}
                      alt={p.name}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-brand-500 shadow-sm shrink-0 bg-slate-900"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-navy-900 dark:bg-brand-600 text-white font-mono font-black text-[10px]">
                          {passengerIdCode}
                        </span>
                        <span className="font-extrabold text-navy-900 dark:text-white text-sm truncate">
                          {p.name}
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                        <IdCard className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                        <span>
                          Passenger ID: <b className="text-navy-900 dark:text-white font-mono">{passengerIdCode}</b>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Passenger ID Photo Thumbnail + View ID Button */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <img
                      src={idCardSrc}
                      alt={`${p.name} ID Card`}
                      onClick={() => setPreviewPassengerIdCard(p)}
                      className="w-14 h-10 rounded-lg object-cover border border-emerald-500 cursor-pointer hover:opacity-85 transition bg-slate-900 shrink-0"
                      title="Click to view Passenger ID Card"
                    />
                    <button
                      type="button"
                      onClick={() => setPreviewPassengerIdCard(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs transition shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View ID</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Modal: Full Passenger ID Card & Profile Photo Preview */}
      <Modal
        isOpen={!!previewPassengerIdCard}
        onClose={() => setPreviewPassengerIdCard(null)}
        title={`Passenger Details & ID — ${previewPassengerIdCard?.name || ''}`}
        subtitle={`Passenger ID: ${previewPassengerIdCard?.passenger_code || `PSG-${100 + Number(previewPassengerIdCard?.id || 1)}`} • Bus ${previewPassengerIdCard?.bus_number || selectedBusForPassengers?.code || 'S01'}`}
      >
        {previewPassengerIdCard && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <img
                src={
                  previewPassengerIdCard.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewPassengerIdCard.name || 'Passenger')}`
                }
                alt={previewPassengerIdCard.name}
                className="w-14 h-14 rounded-xl object-cover border-2 border-brand-500 shrink-0 bg-slate-900"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-navy-900 dark:bg-brand-600 text-white font-mono font-black text-[10px]">
                    {previewPassengerIdCard.passenger_code || `PSG-${100 + Number(previewPassengerIdCard.id || 1)}`}
                  </span>
                  <span className="font-black text-navy-900 dark:text-white text-sm">
                    {previewPassengerIdCard.name}
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">
                  Bus {previewPassengerIdCard.bus_number || selectedBusForPassengers?.code || 'S01'}
                </span>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center p-3 max-h-[420px]">
              <img
                src={
                  previewPassengerIdCard.id_card_url ||
                  previewPassengerIdCard.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewPassengerIdCard.name || 'Passenger')}`
                }
                alt={`${previewPassengerIdCard.name} ID Card`}
                className="max-h-[380px] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Shuttle Modal (Shuttle details only; Driver is assigned in Drivers page after shuttle creation) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingShuttle ? `Edit Shuttle ${editingShuttle.code}` : 'Create New Shuttle'}
        subtitle={
          editingShuttle
            ? 'Changes made here automatically update across all routes, stops, schedules, drivers, and live tracking'
            : 'Enter the bus number, plate number, seat capacity, starting point, and destination. Once created, assign a driver in the Drivers section.'
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Bus Number"
              id="code"
              required
              placeholder="e.g. S04"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
            <Input
              label="Bus Plate Number"
              id="vehicle_number"
              required
              placeholder="e.g. KA-01-EQ-4424"
              value={formData.vehicle_number}
              onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
            />
            <Input
              label="Capacity of Seats"
              id="capacity"
              type="number"
              required
              min="1"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            />
          </div>

          {/* Starting Point & Destination */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="text-xs font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-brand-500" />
              <span>Bus Route: Starting Point & Destination</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                id="destination"
                required
                placeholder="e.g. Sairam Engineering College"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Saving & Syncing...'
                : editingShuttle
                ? 'Save Changes Everywhere'
                : 'Create Shuttle'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminShuttles;
