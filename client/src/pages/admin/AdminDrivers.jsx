import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useToast as useAppToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input, { Select } from '../../components/common/Input';
import { TableSkeleton } from '../../components/common/LoadingSkeleton';
import EmptyState from '../../components/common/EmptyState';
import {
  Plus,
  Phone,
  Star,
  Mail,
  Eye,
  Image as ImageIcon,
  Power,
  CheckCircle2,
  Bus,
  Upload,
  Edit2,
  UserCheck,
  ShieldAlert,
  Users,
  MessageSquareQuote,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Clock,
  UserPlus,
  Award
} from 'lucide-react';

export const AdminDrivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [shuttles, setShuttles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewLicenseDriver, setPreviewLicenseDriver] = useState(null);
  const [previewFeedbackDriver, setPreviewFeedbackDriver] = useState(null);

  // Add / Edit Driver Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    experience_years: 4,
    assigned_shuttle_id: '',
    license_photo_url: ''
  });

  // Deactivate Driver Modal state (Temporary vs Permanent with Replacement Driver)
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateMode, setDeactivateMode] = useState('temporary'); // 'temporary' | 'permanent'
  const [replaceSubmitting, setReplaceSubmitting] = useState(false);
  const [replaceForm, setReplaceForm] = useState({
    name: '',
    email: '',
    phone: '',
    license_number: '',
    experience_years: 4,
    license_photo_url: ''
  });

  const { addToast } = useAppToast();
  const { socket } = useSocket();

  const fetchData = async () => {
    try {
      const [driversRes, shuttlesRes] = await Promise.all([
        api.get('/drivers'),
        api.get('/shuttles')
      ]);

      if (driversRes.data.success) {
        const list = driversRes.data.data || [];
        setDrivers(list);
        setPreviewFeedbackDriver((prev) =>
          prev ? list.find((d) => Number(d.id) === Number(prev.id)) || prev : null
        );
      }
      if (shuttlesRes.data.success) setShuttles(shuttlesRes.data.data || []);
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time sync when Driver edits profile image, points/trips update, Passenger submits feedback, or Driver is replaced
  useEffect(() => {
    if (!socket) return;
    const handleSync = (payload) => {
      if (
        payload &&
        payload.shuttleId &&
        (payload.totalDriverPoints !== undefined || payload.totalTripsCompleted !== undefined)
      ) {
        setDrivers((prev) =>
          prev.map((d) =>
            Number(d.assigned_shuttle_id) === Number(payload.shuttleId)
              ? {
                  ...d,
                  driver_points: payload.totalDriverPoints ?? d.driver_points,
                  driverPoints: payload.totalDriverPoints ?? d.driverPoints,
                  monthly_points: payload.totalDriverPoints ?? d.monthly_points,
                  yearly_points: payload.totalDriverPoints ?? d.yearly_points,
                  total_trips: payload.totalTripsCompleted ?? d.total_trips,
                  totalTripsCompleted: payload.totalTripsCompleted ?? d.totalTripsCompleted,
                  last_points_earned: payload.pointsEarned ?? d.last_points_earned
                }
              : d
          )
        );
      }
      fetchData();
    };
    const handleFeedbackUpdated = (payload) => {
      if (payload && payload.driverId) {
        setDrivers((prev) =>
          prev.map((d) =>
            Number(d.id) === Number(payload.driverId)
              ? {
                  ...d,
                  rating: payload.updatedRating ?? d.rating,
                  feedback_count: payload.feedbackCount ?? d.feedback_count,
                  feedbacks: Array.isArray(payload.feedbacks)
                    ? payload.feedbacks
                    : payload.feedback
                    ? [payload.feedback, ...(d.feedbacks || [])]
                    : d.feedbacks
                }
              : d
          )
        );
        setPreviewFeedbackDriver((prev) =>
          prev && Number(prev.id) === Number(payload.driverId)
            ? {
                ...prev,
                rating: payload.updatedRating ?? prev.rating,
                feedback_count: payload.feedbackCount ?? prev.feedback_count,
                feedbacks: Array.isArray(payload.feedbacks)
                  ? payload.feedbacks
                  : payload.feedback
                  ? [payload.feedback, ...(prev.feedbacks || [])]
                  : prev.feedbacks
              }
            : prev
        );
      }
      fetchData();
    };
    socket.on('driver:updated', handleSync);
    socket.on('schedule:updated', handleSync);
    socket.on('passenger:updated', handleSync);
    socket.on('driver:feedback_updated', handleFeedbackUpdated);
    socket.on('shuttle:updated', handleSync);
    return () => {
      socket.off('driver:updated', handleSync);
      socket.off('schedule:updated', handleSync);
      socket.off('passenger:updated', handleSync);
      socket.off('driver:feedback_updated', handleFeedbackUpdated);
      socket.off('shuttle:updated', handleSync);
    };
  }, [socket]);

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      license_number: '',
      experience_years: 4,
      assigned_shuttle_id: '',
      license_photo_url: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (driver) => {
    setEditingDriver(driver);
    setFormData({
      name: driver.name || '',
      email: driver.email || '',
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      experience_years: driver.experience_years || 4,
      assigned_shuttle_id: driver.assigned_shuttle_id || '',
      license_photo_url: driver.license_photo_url || ''
    });
    setIsModalOpen(true);
  };

  // Admin-only Driver License Photo file reader
  const handleAdminLicenseFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({
        ...prev,
        license_photo_url: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceLicenseFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setReplaceForm((prev) => ({
        ...prev,
        license_photo_url: reader.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDriver = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingDriver) {
        const res = await api.put(`/drivers/${editingDriver.id}`, formData);
        addToast({
          title: 'Driver Updated',
          message: res.data.message || `${formData.name} details, shuttle assignment, and license updated.`,
          type: 'success'
        });
      } else {
        const res = await api.post('/drivers', formData);
        addToast({
          title: 'Driver Assigned & Credentials Emailed',
          message:
            res.data.message ||
            `${formData.name} registered, license uploaded, and login password emailed!`,
          type: 'success'
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      addToast({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to save driver details',
        type: 'danger'
      });
    } finally {
      setSubmitting(false);
    }
  };

  // When Admin clicks Activate on a deactivated driver -> immediately activate
  // When Admin clicks Deactivate on an active driver -> open modal asking Temporary vs Permanent
  const handleDriverActionClick = async (driver) => {
    const isDeactivated = driver.is_active === false || driver.status === 'inactive';
    if (isDeactivated) {
      try {
        const res = await api.put(`/drivers/${driver.id}`, { is_active: true });
        addToast({
          title: 'Driver Activated',
          message: res.data.message || `${driver.name} is now Active and can log in to the website.`,
          type: 'success'
        });
        fetchData();
      } catch (err) {
        addToast({ title: 'Error', message: 'Failed to activate driver', type: 'danger' });
      }
    } else {
      setDeactivateTarget(driver);
      setDeactivateMode('temporary');
      setReplaceForm({
        name: '',
        email: '',
        phone: '',
        license_number: '',
        experience_years: 4,
        license_photo_url: ''
      });
    }
  };

  // Confirm Temporary Deactivation
  const handleConfirmTemporaryDeactivate = async () => {
    if (!deactivateTarget) return;
    setReplaceSubmitting(true);
    try {
      const res = await api.put(`/drivers/${deactivateTarget.id}`, { is_active: false });
      addToast({
        title: 'Driver Temporarily Deactivated',
        message:
          res.data.message ||
          `${deactivateTarget.name} has been temporarily deactivated. You can click Activate at any time.`,
        type: 'warning'
      });
      setDeactivateTarget(null);
      fetchData();
    } catch (err) {
      addToast({ title: 'Error', message: 'Failed to deactivate driver', type: 'danger' });
    } finally {
      setReplaceSubmitting(false);
    }
  };

  // Confirm Permanent Deactivation -> Delete old driver & create replacement driver on same shuttle + email password
  const handleConfirmPermanentReplace = async (e) => {
    e.preventDefault();
    if (!deactivateTarget) return;
    setReplaceSubmitting(true);
    try {
      const res = await api.post(`/drivers/${deactivateTarget.id}/replace`, {
        ...replaceForm,
        assigned_shuttle_id: deactivateTarget.assigned_shuttle_id || null
      });
      addToast({
        title: 'Permanent Deactivation & Driver Replaced',
        message:
          res.data.message ||
          `${deactivateTarget.name} was permanently removed and replaced by ${replaceForm.name}. Login password emailed to ${replaceForm.email}!`,
        type: 'success'
      });
      setDeactivateTarget(null);
      fetchData();
    } catch (err) {
      addToast({
        title: 'Replacement Error',
        message: err.response?.data?.message || 'Failed to replace driver',
        type: 'danger'
      });
    } finally {
      setReplaceSubmitting(false);
    }
  };

  const activeDriversCount = drivers.filter(
    (d) => d.is_active !== false && d.status !== 'inactive' && Boolean(d.has_logged_in) === true
  ).length;
  const pendingLoginDriversCount = drivers.filter(
    (d) => d.is_active !== false && d.status !== 'inactive' && !d.has_logged_in
  ).length;
  const deactivatedDriversCount = drivers.filter(
    (d) => d.is_active === false || d.status === 'inactive'
  ).length;

  const formatFeedbackDate = (fb) => {
    if (fb.formatted_date) return fb.formatted_date;
    if (!fb.created_at) return fb.month_key || 'Recent';
    const d = new Date(fb.created_at);
    if (isNaN(d.getTime())) return fb.month_key || 'Recent';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Drivers Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage drivers, driving licenses, shuttle assignments, and passenger feedback ratings (Login Status becomes Active after the driver logs into the Driver portal)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button onClick={openAddModal} icon={Plus} size="sm">
            Assign / Register New Driver
          </Button>
        </div>
      </div>

      {/* Aligned 3-Column Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-4 flex items-center gap-4 border border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Drivers
            </span>
            <span className="text-xl font-black text-navy-900 dark:text-white">
              {drivers.length} Operators
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Active (Logged In)
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {activeDriversCount} Active
            </span>
            {pendingLoginDriversCount > 0 && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 block">
                {pendingLoginDriversCount} awaiting 1st login
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 border border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Deactivated
            </span>
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
              {deactivatedDriversCount} Deactivated
            </span>
          </div>
        </Card>
      </div>

      {/* Properly Aligned Driver Data Table */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : drivers.length === 0 ? (
        <EmptyState
          icon="default"
          title="No drivers registered"
          description="Assign a new driver to your created shuttles and upload their driving license photo."
          actionLabel="Assign New Driver"
          onAction={openAddModal}
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-5 whitespace-nowrap">Driver Profile (Name & Rating)</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Driver Email</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Driving License</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Assigned Shuttle</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Overall Points & Trips</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Login Status</th>
                  <th className="py-3.5 px-5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {drivers.map((driver) => {
                  const isDeactivated = driver.is_active === false || driver.status === 'inactive';
                  const avatarUrl =
                    driver.avatar_url ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driver.name || 'Driver')}`;
                  const feedbacks = driver.feedbacks || [];
                  const overallPoints = Number(
                    driver.driver_points ??
                      driver.driverPoints ??
                      driver.monthly_points ??
                      driver.yearly_points ??
                      0
                  );
                  const totalTrips = Number(
                    driver.total_trips ?? driver.totalTripsCompleted ?? 0
                  );
                  const lastTripPts = Number(driver.last_points_earned ?? 0);

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* 1. Driver Profile Image, Name & Passenger-Calculated Rating (DRV-xxx removed) */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-3.5">
                          <img
                            src={avatarUrl}
                            alt={driver.name}
                            className="w-11 h-11 rounded-xl object-cover border-2 border-brand-500 shadow-sm shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-navy-900 dark:text-white flex items-center gap-2">
                              <span className="text-sm">{driver.name}</span>
                              <button
                                type="button"
                                onClick={() => setPreviewFeedbackDriver(driver)}
                                title="Click to view passenger feedback & rating"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-[11px] text-amber-600 dark:text-amber-400 font-extrabold border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition"
                              >
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                <span>{driver.rating || '5.0'}</span>
                                <span className="text-[10px] text-slate-400">
                                  ({feedbacks.length})
                                </span>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{driver.phone || 'Not provided'}</span>
                              </span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => setPreviewFeedbackDriver(driver)}
                                className="text-brand-600 dark:text-blue-400 font-bold hover:underline inline-flex items-center gap-1"
                              >
                                <MessageSquareQuote className="w-3 h-3" />
                                <span>Feedback</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Driver Email Only (Password display removed) */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-navy-900 dark:text-white">
                          <Mail className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                          <span>{driver.email}</span>
                        </div>
                      </td>

                      {/* 3. Driving License */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {driver.license_photo_url ? (
                            <img
                              src={driver.license_photo_url}
                              alt="Driving License"
                              onClick={() => setPreviewLicenseDriver(driver)}
                              className="w-12 h-9 rounded-lg object-cover border-2 border-emerald-500 cursor-pointer hover:opacity-85 transition shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                              <ImageIcon className="w-4 h-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-mono font-bold text-navy-900 dark:text-white text-xs">
                              {driver.license_number || 'DL-VERIFIED'}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {driver.experience_years || 4} yrs exp
                              </span>
                              <span>•</span>
                              {driver.license_photo_url ? (
                                <button
                                  type="button"
                                  onClick={() => setPreviewLicenseDriver(driver)}
                                  className="text-[11px] font-bold text-brand-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Driving License</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(driver)}
                                  className="text-[11px] font-bold text-brand-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Upload License</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 4. Assigned Shuttle */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        {driver.assigned_shuttle_code ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-navy-900 dark:bg-brand-600 text-white font-extrabold text-xs shadow-sm">
                              <Bus className="w-3.5 h-3.5 text-blue-300" />
                              <span>Bus {driver.assigned_shuttle_code}</span>
                            </span>
                            {driver.assigned_route_start && (
                              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                {driver.assigned_route_start} ➔ {driver.assigned_route_dest}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditModal(driver)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold text-xs hover:bg-blue-100 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Assign Shuttle</span>
                          </button>
                        )}
                      </td>

                      {/* 5. Cumulative Overall Points & Number of Trips */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-black text-xs border border-amber-200 dark:border-amber-800">
                            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>{overallPoints} pts</span>
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[11px] border border-purple-200 dark:border-purple-800">
                            {totalTrips} {totalTrips === 1 ? 'Trip' : 'Trips'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                          Overall Cumulative Points{lastTripPts > 0 ? ` • Last: +${lastTripPts} pts` : ''}
                        </div>
                      </td>

                      {/* 6. Login Status — Shows "Active" ONLY after driver logs into Driver Portal */}
                      <td className="py-4 px-5 align-middle whitespace-nowrap">
                        {isDeactivated ? (
                          <div>
                            <Badge status="inactive">Deactivated</Badge>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Login disabled by Admin
                            </span>
                          </div>
                        ) : Boolean(driver.has_logged_in) ? (
                          <div>
                            <Badge status="live">Active</Badge>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                              Logged into Driver Portal
                            </span>
                          </div>
                        ) : (
                          <div>
                            <Badge status="pending">Not Logged In Yet</Badge>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block mt-0.5">
                              Active after driver&apos;s 1st login
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. Actions Column (Delete button removed; Deactivate opens Temporary vs Permanent modal) */}
                      <td className="py-4 px-5 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(driver)}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-600 text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm"
                            title="Edit Driver / Assign Shuttle / Upload License"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDriverActionClick(driver)}
                            className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold transition-colors inline-flex items-center gap-1 shadow-sm ${
                              isDeactivated
                                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white'
                                : 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>{isDeactivated ? 'Activate' : 'Deactivate'}</span>
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

      {/* Deactivate Driver Modal: Temporary vs Permanent (Delete & Replace Driver) */}
      <Modal
        isOpen={!!deactivateTarget}
        onClose={() => !replaceSubmitting && setDeactivateTarget(null)}
        title={`Deactivate Driver — ${deactivateTarget?.name || ''}`}
        subtitle="Select whether this deactivation is Temporary or Permanent"
      >
        {deactivateTarget && (
          <div className="space-y-4">
            {/* Mode Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeactivateMode('temporary')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  deactivateMode === 'temporary'
                    ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs text-navy-900 dark:text-white">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Temporary Deactivation</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Temporarily blocks login for <b>{deactivateTarget.name}</b>. You can click <b>Activate</b> at any time to restore access.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDeactivateMode('permanent')}
                className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                  deactivateMode === 'permanent'
                    ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/40 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-400'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-xs text-navy-900 dark:text-white">
                  <UserPlus className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Permanent (Replace Driver)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Permanently deletes <b>{deactivateTarget.name}</b> and assigns a new replacement driver to{' '}
                  <b>{deactivateTarget.assigned_shuttle_code ? `Bus ${deactivateTarget.assigned_shuttle_code}` : 'their shuttle'}</b>.
                </p>
              </button>
            </div>

            {deactivateMode === 'temporary' ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-slate-700 dark:text-slate-200">
                  <p className="font-bold text-amber-700 dark:text-amber-400">
                    Temporary Deactivation Selected
                  </p>
                  <p className="mt-1">
                    <b>{deactivateTarget.name}</b> will be marked as <b>Deactivated</b> and unable to log in until you click the <b>Activate</b> button.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setDeactivateTarget(null)}
                    disabled={replaceSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmTemporaryDeactivate}
                    disabled={replaceSubmitting}
                  >
                    {replaceSubmitting ? 'Deactivating...' : 'Confirm Temporary Deactivation'}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmPermanentReplace} className="space-y-3.5 pt-1">
                <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs">
                  <span className="font-bold text-rose-700 dark:text-rose-400 block">
                    Replacing {deactivateTarget.name}{' '}
                    {deactivateTarget.assigned_shuttle_code
                      ? `on Bus ${deactivateTarget.assigned_shuttle_code}`
                      : ''}
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    Old driver details will be permanently deleted, the new driver will be updated across Passenger, Driver & Admin logins, and their login password will be emailed automatically.
                  </span>
                </div>

                <Input
                  label="New Replacement Driver Full Name"
                  id="replaceDriverName"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={replaceForm.name}
                  onChange={(e) => setReplaceForm({ ...replaceForm, name: e.target.value })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="New Driver Email (Password sent here)"
                    id="replaceDriverEmail"
                    type="email"
                    required
                    placeholder="newdriver@example.com"
                    value={replaceForm.email}
                    onChange={(e) => setReplaceForm({ ...replaceForm, email: e.target.value })}
                  />
                  <Input
                    label="New Driver Phone Number"
                    id="replaceDriverPhone"
                    required
                    placeholder="+91 98765 43210"
                    value={replaceForm.phone}
                    onChange={(e) => setReplaceForm({ ...replaceForm, phone: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <Input
                    label="Driving License Number"
                    id="replaceDriverLicense"
                    required
                    placeholder="e.g. TN-09-202200491"
                    value={replaceForm.license_number}
                    onChange={(e) => setReplaceForm({ ...replaceForm, license_number: e.target.value })}
                  />
                  <Input
                    label="Experience (Years)"
                    id="replaceDriverExp"
                    type="number"
                    min="0"
                    value={replaceForm.experience_years}
                    onChange={(e) => setReplaceForm({ ...replaceForm, experience_years: e.target.value })}
                  />
                </div>

                {/* Driving License Photo Upload for Replacement Driver */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-brand-500" />
                        <span>New Driver License Photo</span>
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Upload the driving license photo for the replacement driver.
                      </p>
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{replaceForm.license_photo_url ? 'Change License' : 'Upload License'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReplaceLicenseFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {replaceForm.license_photo_url && (
                    <div className="pt-1 flex items-center gap-3">
                      <img
                        src={replaceForm.license_photo_url}
                        alt="Replacement License Preview"
                        className="h-16 w-auto rounded-lg border border-emerald-400 object-contain bg-slate-900 p-1"
                      />
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        License Uploaded
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setDeactivateTarget(null)}
                    disabled={replaceSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={replaceSubmitting}>
                    {replaceSubmitting
                      ? 'Replacing & Emailing Password...'
                      : 'Delete Old Driver & Assign New Driver'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Modal to Preview Passenger Feedback & Rating with Date & Month */}
      <Modal
        isOpen={!!previewFeedbackDriver}
        onClose={() => setPreviewFeedbackDriver(null)}
        title={`Feedback & Rating — ${previewFeedbackDriver?.name || ''}`}
        subtitle={`Average Rating: ${previewFeedbackDriver?.rating || '5.0'} ★`}
      >
        {previewFeedbackDriver && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={
                    previewFeedbackDriver.avatar_url ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(previewFeedbackDriver.name || 'D')}`
                  }
                  alt={previewFeedbackDriver.name}
                  className="w-12 h-12 rounded-xl object-cover border border-amber-400"
                />
                <div>
                  <span className="text-xs font-black text-navy-900 dark:text-white block">
                    {previewFeedbackDriver.name}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Bus {previewFeedbackDriver.assigned_shuttle_code || 'Assigned'} • {(previewFeedbackDriver.feedbacks || []).length} Reviews
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-lg font-black text-amber-600 dark:text-amber-400">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                  <span>{previewFeedbackDriver.rating || '5.0'}</span>
                </span>
                <span className="text-[10px] text-slate-400 block">Overall Rating</span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              {(previewFeedbackDriver.feedbacks || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No passenger feedback submitted yet.
                </p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3">Passenger</th>
                      <th className="py-2.5 px-3">Performance</th>
                      <th className="py-2.5 px-3 text-center">Rating</th>
                      <th className="py-2.5 px-3">Date & Month</th>
                      <th className="py-2.5 px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700/80 bg-white dark:bg-slate-900">
                    {(previewFeedbackDriver.feedbacks || []).map((fb) => {
                      const isGood = Number(fb.rating) >= 4;
                      const perfLabel =
                        fb.performance_type || (isGood ? 'Good Performance' : 'Bad Performance');
                      const dateAndMonth = formatFeedbackDate(fb);

                      return (
                        <tr
                          key={fb.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition align-middle"
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-xs font-extrabold text-navy-900 dark:text-white">
                              {fb.passenger_name || 'Passenger'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                isGood
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              {isGood ? (
                                <ThumbsUp className="w-3 h-3 shrink-0" />
                              ) : (
                                <ThumbsDown className="w-3 h-3 shrink-0" />
                              )}
                              <span>{perfLabel}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{fb.rating} / 5</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <Calendar className="w-3 h-3 text-brand-500 shrink-0" />
                              <span>{dateAndMonth}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 min-w-[160px]">
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {fb.description || '—'}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal to Preview Driving License Photo */}
      <Modal
        isOpen={!!previewLicenseDriver}
        onClose={() => setPreviewLicenseDriver(null)}
        title={`Driving License — ${previewLicenseDriver?.name || ''}`}
        subtitle={`License ID: ${previewLicenseDriver?.license_number || 'Verified'}`}
      >
        {previewLicenseDriver && (
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center p-2 max-h-[420px]">
              <img
                src={previewLicenseDriver.license_photo_url}
                alt="Driving License"
                className="max-h-[390px] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Assign / Register / Edit Driver Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDriver ? `Edit Driver — ${editingDriver.name}` : 'Assign / Register New Driver'}
        subtitle={
          editingDriver
            ? 'Update assigned shuttle, driving license photo, and driver details'
            : 'Assign a driver to a created shuttle, upload their driving license photo, and auto-email their login password'
        }
      >
        <form onSubmit={handleSaveDriver} className="space-y-4">
          <Input
            label="Driver Full Name"
            id="driverName"
            required
            placeholder="e.g. Karthik Raja"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Driver Email (Login password sent here)"
              id="driverEmail"
              type="email"
              required
              disabled={!!editingDriver}
              placeholder="driver@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Phone Number"
              id="driverPhone"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Driving License Number"
              id="driverLicense"
              required
              placeholder="e.g. DL-8849201"
              value={formData.license_number}
              onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
            />
            <Input
              label="Experience (Years)"
              id="experience"
              type="number"
              min="0"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
            />
          </div>

          {/* Assign Created Shuttle */}
          <Select
            label="Assign to Shuttle (Bus Number)"
            id="assigned_shuttle"
            value={formData.assigned_shuttle_id}
            onChange={(e) => setFormData({ ...formData, assigned_shuttle_id: e.target.value })}
            options={[
              { label: 'Select a Shuttle to Assign', value: '' },
              ...shuttles.map((s) => ({
                label: `Bus ${s.code} — ${s.vehicle_number} (${s.start_point || 'Start'} ➔ ${s.destination || 'Destination'})`,
                value: s.id
              }))
            ]}
          />

          {/* Driving License Photo Upload */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-navy-900 dark:text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-brand-500" />
                  <span>Driving License</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Upload the real driving license image verified by Admin.
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{formData.license_photo_url ? 'Change License' : 'Upload License'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAdminLicenseFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {formData.license_photo_url && (
              <div className="pt-2 flex items-center gap-3">
                <img
                  src={formData.license_photo_url}
                  alt="Driving License Preview"
                  className="h-20 w-auto rounded-xl border border-emerald-400 object-contain bg-slate-900 p-1"
                />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Driving License Uploaded
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Saving...'
                : editingDriver
                ? 'Save Driver Changes'
                : 'Assign Driver & Email Password'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDrivers;
