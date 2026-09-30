import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import {
  Star,
  Image as ImageIcon,
  Camera,
  MessageSquareQuote,
  Calendar,
  Eye,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2
} from 'lucide-react';

export const DriverProfile = () => {
  const { user, updateUser } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();
  const [driver, setDriver] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isLicensePreviewOpen, setIsLicensePreviewOpen] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/drivers/me');
      if (res.data.success) {
        setDriver(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Real-time sync when Admin uploads/updates license photo, points update, or Passenger submits feedback
  useEffect(() => {
    if (!socket) return;
    const handleSync = (payload) => {
      if (payload && (payload.totalDriverPoints !== undefined || payload.totalTripsCompleted !== undefined)) {
        setDriver((prev) =>
          prev
            ? {
                ...prev,
                driver_points: payload.totalDriverPoints ?? prev.driver_points,
                driverPoints: payload.totalDriverPoints ?? prev.driverPoints,
                monthly_points: payload.totalDriverPoints ?? prev.monthly_points,
                yearly_points: payload.totalDriverPoints ?? prev.yearly_points,
                total_trips: payload.totalTripsCompleted ?? prev.total_trips,
                totalTripsCompleted: payload.totalTripsCompleted ?? prev.totalTripsCompleted,
                last_points_earned: payload.pointsEarned ?? prev.last_points_earned,
                lastPointsEarned: payload.pointsEarned ?? prev.lastPointsEarned,
                delay_minutes: payload.delayMinutes ?? prev.delay_minutes,
                delayMinutes: payload.delayMinutes ?? prev.delayMinutes
              }
            : prev
        );
      }
      fetchProfile();
    };
    const handleFeedbackUpdated = (payload) => {
      if (payload && payload.driverId) {
        setDriver((prev) =>
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
      fetchProfile();
    };
    socket.on('driver:updated', handleSync);
    socket.on('passenger:updated', handleSync);
    socket.on('driver:feedback_updated', handleFeedbackUpdated);
    socket.on('shuttle:updated', handleSync);
    socket.on('schedule:updated', handleSync);
    socket.on('driver:schedule_assigned', handleSync);
    return () => {
      socket.off('driver:updated', handleSync);
      socket.off('passenger:updated', handleSync);
      socket.off('driver:feedback_updated', handleFeedbackUpdated);
      socket.off('shuttle:updated', handleSync);
      socket.off('schedule:updated', handleSync);
      socket.off('driver:schedule_assigned', handleSync);
    };
  }, [socket]);

  // Edit Driver Profile Image (synced to Admin & Passenger portals)
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      setUploadingAvatar(true);
      try {
        const res = await api.put('/drivers/me/avatar', {
          avatar_url: reader.result
        });
        if (res.data.success) {
          setDriver(res.data.data);
          if (updateUser) {
            updateUser({ avatar_url: reader.result });
          }
          addToast({
            title: 'Profile Image Updated',
            message: 'Your profile image is now displayed across Driver, Admin, and Passenger portals.',
            type: 'success'
          });
        }
      } catch (err) {
        addToast({
          title: 'Upload Failed',
          message: 'Could not update profile photo.',
          type: 'danger'
        });
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const shuttle = driver?.assignedShuttle;
  const driverCode = driver?.driver_code || `DRV-${100 + Number(driver?.id || 1)}`;
  const overallPoints = Number(
    driver?.driverPoints ??
      driver?.driver_points ??
      driver?.monthlyPoints ??
      driver?.monthly_points ??
      0
  );
  const totalTripsCompleted = Number(
    driver?.totalTripsCompleted ?? driver?.total_trips ?? 0
  );
  const lastPointsEarned = Number(
    driver?.lastPointsEarned ?? driver?.last_points_earned ?? 0
  );
  const delayMins = Number(driver?.delayMinutes ?? driver?.delay_minutes ?? 0);
  const avatarUrl =
    driver?.avatar_url ||
    user?.avatar_url ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(driver?.name || user?.name || 'Driver')}`;
  const feedbacks = driver?.feedbacks || [];

  const formatFeedbackDate = (fb) => {
    if (fb.formatted_date) return fb.formatted_date;
    if (!fb.created_at) return fb.month_key || '26 September';
    const d = new Date(fb.created_at);
    if (isNaN(d.getTime())) return fb.month_key || '26 September';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Title Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Driver Profile
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            View your profile details, driving license, cumulative overall points with number of trips, and passenger feedback history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-extrabold">
            Overall Points: {overallPoints} pts ({totalTripsCompleted} {totalTripsCompleted === 1 ? 'Trip' : 'Trips'})
          </span>
          <Badge status="active">Verified Operator</Badge>
        </div>
      </div>

      {/* Driver Profile Details Card */}
      <Card className="p-6 space-y-6 border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group shrink-0">
              <img
                src={avatarUrl}
                alt={driver?.name || user?.name || 'Driver'}
                className="w-24 h-24 rounded-2xl object-cover border-2 border-brand-500 shadow-glow"
              />
              <label
                title="Edit Profile Image"
                className="absolute -bottom-2 -right-2 px-2.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[11px] font-bold shadow-md cursor-pointer flex items-center gap-1 transition"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadingAvatar ? '...' : 'Edit'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="text-center sm:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-xl font-black text-navy-900 dark:text-white">
                  {driver?.name || user?.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg bg-brand-50 dark:bg-brand-950/70 text-brand-600 dark:text-accent-blue text-xs font-black border border-brand-200 dark:border-brand-800">
                  ID: {driverCode}
                </span>
              </div>
              <p className="text-xs text-slate-400">{driver?.email || user?.email}</p>
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <Badge status="active">Active</Badge>
              </div>
            </div>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-slate-700 dark:text-slate-200 text-xs font-bold transition shadow-sm shrink-0">
            <Camera className="w-4 h-4" />
            <span>{uploadingAvatar ? 'Uploading...' : 'Edit Profile Image'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Aligned Driver Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs items-stretch">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
              Driver Name & ID
            </span>
            <span className="font-bold text-navy-900 dark:text-white text-sm">
              {driver?.name || user?.name} ({driverCode})
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
              Driving License Number
            </span>
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {driver?.license_number || 'DL-9948201'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex flex-col justify-between space-y-1">
            <span className="text-amber-700 dark:text-amber-400 block font-bold uppercase tracking-wider text-[10px]">
              Overall Points & Number of Trips
            </span>
            <span className="font-black text-amber-700 dark:text-amber-300 text-sm">
              Overall Points: {overallPoints} pts ({totalTripsCompleted} {totalTripsCompleted === 1 ? 'Trip' : 'Trips'})
            </span>
            <span className="text-[11px] font-semibold text-amber-700/80 dark:text-amber-400/80">
              {lastPointsEarned > 0
                ? delayMins > 0
                  ? `Last Trip: +${lastPointsEarned} pts (+${delayMins}m delay)`
                  : `Last Trip: +${lastPointsEarned} pts (On-Time)`
                : '10 pts On-Time • Delay-Based Points on Late Arrival'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1">
            <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
              Assigned Shuttle Number
            </span>
            <span className="font-bold text-brand-600 dark:text-accent-blue text-sm">
              {shuttle ? `Bus ${shuttle.code} (${shuttle.vehicle_number || shuttle.name})` : 'Bus S01'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1 sm:col-span-2">
            <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">
              Assigned Route
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {shuttle ? `${shuttle.start_point || 'Hostel'} ➔ ${shuttle.destination || 'Campus'}` : 'Campus Loop'}
            </span>
          </div>
        </div>
      </Card>

      {/* Dedicated, Cleanly Aligned & Centered Driving License Component */}
      <Card className="p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-accent-blue flex items-center justify-center shrink-0">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-navy-900 dark:text-white">
                Driving License
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                License No: <b className="font-mono text-slate-700 dark:text-slate-200">{driver?.license_number || 'DL-9948201'}</b>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
            {driver?.license_photo_url && (
              <button
                type="button"
                onClick={() => setIsLicensePreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold shadow-sm transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Full Image</span>
              </button>
            )}
          </div>
        </div>

        {driver?.license_photo_url ? (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
            <img
              src={driver.license_photo_url}
              alt="Driving License"
              onClick={() => setIsLicensePreviewOpen(true)}
              className="mx-auto max-h-80 w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-white dark:bg-slate-900 p-2 shadow-md cursor-pointer hover:opacity-95 transition"
            />
          </div>
        ) : (
          <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
            No driving license image uploaded yet.
          </div>
        )}
      </Card>

      {/* Feedback History (Properly Aligned Table) */}
      <Card className="p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-black text-navy-900 dark:text-white flex items-center gap-2">
              <MessageSquareQuote className="w-4 h-4 text-amber-500" />
              <span>Feedback History</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Passenger feedback messages with performance status, date, and month
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-brand-600 dark:text-accent-blue text-xs font-extrabold shrink-0">
            {feedbacks.length} {feedbacks.length === 1 ? 'Feedback' : 'Feedbacks'}
          </span>
        </div>

        {feedbacks.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-center text-xs text-slate-400">
            No passenger feedback submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Passenger</th>
                  <th className="py-3 px-4">Performance</th>
                  <th className="py-3 px-4 text-center">Rating</th>
                  <th className="py-3 px-4">Date & Month</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {feedbacks.map((fb) => {
                  const isGood = Number(fb.rating) >= 4;
                  const perfLabel =
                    fb.performance_type || (isGood ? 'Good Performance' : 'Bad Performance');
                  const dateAndMonth = formatFeedbackDate(fb);

                  return (
                    <tr
                      key={fb.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors align-middle"
                    >
                      <td className="py-3.5 px-4 font-extrabold text-navy-900 dark:text-white whitespace-nowrap">
                        {fb.passenger_name || 'Passenger'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            isGood
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {isGood ? (
                            <ThumbsUp className="w-3 h-3" />
                          ) : (
                            <ThumbsDown className="w-3 h-3" />
                          )}
                          <span>{perfLabel}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold text-[11px]">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{fb.rating} / 5</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3 h-3 text-brand-500" />
                          <span>{dateAndMonth}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-200 leading-relaxed min-w-[200px]">
                        {fb.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Full Driving License Preview Modal */}
      <Modal
        isOpen={isLicensePreviewOpen}
        onClose={() => setIsLicensePreviewOpen(false)}
        title="Driving License"
        subtitle={driver?.name || user?.name || ''}
      >
        {driver?.license_photo_url && (
          <div className="rounded-2xl overflow-hidden bg-slate-950 p-3 flex items-center justify-center">
            <img
              src={driver.license_photo_url}
              alt="Driving License"
              className="mx-auto max-h-[420px] w-auto object-contain rounded-xl"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DriverProfile;
