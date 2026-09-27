import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import {
  Bus,
  Star,
  MessageSquarePlus,
  CheckCircle2,
  ArrowRight,
  Phone,
  Mail,
  Image as ImageIcon,
  Eye,
  Calendar,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

export const PassengerDriverDetails = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { addToast } = useToast();

  const [shuttles, setShuttles] = useState([]);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isLicensePreviewOpen, setIsLicensePreviewOpen] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const passengerBusCode = String(user?.bus_number || 'S01').trim().toUpperCase();

  const fetchShuttles = async () => {
    try {
      const res = await api.get('/shuttles');
      if (res.data.success && res.data.data.length > 0) {
        setShuttles(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching driver details:', err);
    }
  };

  useEffect(() => {
    fetchShuttles();
  }, [passengerBusCode]);

  useEffect(() => {
    if (!socket) return;
    const handleSync = () => fetchShuttles();
    const handleFeedbackUpdated = (payload) => {
      if (payload && payload.driverId) {
        setShuttles((prev) =>
          prev.map((s) =>
            Number(s.driver_id) === Number(payload.driverId) ||
            Number(s.id) === Number(payload.shuttleId)
              ? {
                  ...s,
                  driver_rating: payload.updatedRating ?? s.driver_rating,
                  driver_feedback_count: payload.feedbackCount ?? s.driver_feedback_count,
                  driver_feedbacks: Array.isArray(payload.feedbacks)
                    ? payload.feedbacks
                    : payload.feedback
                    ? [payload.feedback, ...(s.driver_feedbacks || [])]
                    : s.driver_feedbacks
                }
              : s
          )
        );
      }
      fetchShuttles();
    };

    socket.on('route:updated', handleSync);
    socket.on('shuttle:updated', handleSync);
    socket.on('driver:updated', handleSync);
    socket.on('driver:feedback_updated', handleFeedbackUpdated);
    return () => {
      socket.off('route:updated', handleSync);
      socket.off('shuttle:updated', handleSync);
      socket.off('driver:updated', handleSync);
      socket.off('driver:feedback_updated', handleFeedbackUpdated);
    };
  }, [socket]);

  // Show ONLY the passenger's entered/registered bus and its respective driver
  const currentShuttle =
    shuttles.find((s) => String(s.code).trim().toUpperCase() === passengerBusCode) ||
    shuttles[0];

  const feedbacks = currentShuttle?.driver_feedbacks || [];

  // Calculate average driver rating from all passenger ratings
  const averageRating =
    feedbacks.length > 0
      ? Number(
          (
            feedbacks.reduce((sum, item) => sum + (Number(item.rating) || 5), 0) /
            feedbacks.length
          ).toFixed(2)
        )
      : Number(currentShuttle?.driver_rating || 5.0).toFixed(2);

  // Check 30-day rolling feedback window for this passenger (persisted in PostgreSQL + localStorage)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const feedbackStorageKey = `shuttle_feedback_${user?.id || user?.email || 'guest'}_${passengerBusCode}`;
  let localStoredFeedback = null;
  try {
    const raw = localStorage.getItem(feedbackStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const createdTime = parsed?.created_at ? new Date(parsed.created_at).getTime() : 0;
      if (createdTime > 0 && nowMs - createdTime < thirtyDaysMs) {
        localStoredFeedback = parsed;
      } else {
        localStorage.removeItem(feedbackStorageKey);
      }
    }
  } catch (_) {}

  const serverFeedbackWithin30Days = feedbacks.find((f) => {
    const samePassenger =
      (user?.id && Number(f.passenger_id) === Number(user.id)) ||
      (user?.name &&
        f.passenger_name &&
        String(f.passenger_name).trim().toLowerCase() === String(user.name).trim().toLowerCase());
    if (!samePassenger) return false;
    const createdTime = f.created_at ? new Date(f.created_at).getTime() : 0;
    return createdTime > 0 && nowMs - createdTime < thirtyDaysMs;
  });

  // If server has no feedbacks at all (e.g. fresh DB), clear stale local cache
  if (!serverFeedbackWithin30Days && feedbacks.length === 0 && localStoredFeedback) {
    try {
      localStorage.removeItem(feedbackStorageKey);
      localStoredFeedback = null;
    } catch (_) {}
  }

  const myFeedbackWithin30Days = serverFeedbackWithin30Days || localStoredFeedback;
  const daysUntilReset = myFeedbackWithin30Days
    ? Math.max(
        1,
        Math.ceil(
          (thirtyDaysMs - (nowMs - new Date(myFeedbackWithin30Days.created_at).getTime())) /
            (24 * 60 * 60 * 1000)
        )
      )
    : 0;

  const handleSubmitFeedback = async (e) => {
    e.preventDefault();
    if (!descriptionInput.trim()) {
      addToast({
        title: 'Description Required',
        message: 'Please enter a brief feedback description for the driver.',
        type: 'warning'
      });
      return;
    }

    setSubmittingFeedback(true);
    try {
      const res = await api.post('/drivers/feedback', {
        driver_id: currentShuttle?.driver_id,
        shuttle_id: currentShuttle?.id,
        rating: ratingInput,
        performance_type: ratingInput >= 4 ? 'Good Performance' : 'Bad Performance',
        description: descriptionInput.trim()
      });

      if (res.data.success) {
        const resultData = res.data.data || {};
        const savedFeedback = resultData.feedback || {
          passenger_id: user?.id,
          passenger_name: user?.name,
          rating: ratingInput,
          created_at: new Date().toISOString()
        };
        try {
          localStorage.setItem(feedbackStorageKey, JSON.stringify(savedFeedback));
        } catch (_) {}

        setShuttles((prev) =>
          prev.map((s) =>
            Number(s.id) === Number(currentShuttle?.id)
              ? {
                  ...s,
                  driver_rating: resultData.updatedRating ?? s.driver_rating,
                  driver_feedback_count: resultData.feedbackCount ?? (s.driver_feedback_count || 0) + 1,
                  driver_feedbacks: Array.isArray(resultData.feedbacks)
                    ? resultData.feedbacks
                    : resultData.feedback
                    ? [resultData.feedback, ...(s.driver_feedbacks || [])]
                    : s.driver_feedbacks
                }
              : s
          )
        );
        addToast({
          title: 'Driver Feedback Sent!',
          message: 'Your feedback has been sent (resets after 30 days).',
          type: 'success'
        });
        setDescriptionInput('');
        setIsFeedbackModalOpen(false);
        fetchShuttles();
      }
    } catch (err) {
      addToast({
        title: 'Feedback Resets After 30 Days',
        message:
          err.response?.data?.message ||
          'You can submit driver feedback once every 30 days.',
        type: 'warning'
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header showing ONLY the passenger's entered bus and its respective driver */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-subtle">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Driver Details — Bus {currentShuttle?.code || passengerBusCode}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span>{currentShuttle?.start_point || 'Hostel Complex'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-brand-500" />
            <span>{currentShuttle?.destination || 'Sports Ground'}</span>
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-bold flex items-center gap-2 shadow-sm shrink-0">
          <Bus className="w-4 h-4" />
          <span>Bus {currentShuttle?.code || passengerBusCode}</span>
        </div>
      </div>

      {/* Selected Bus Driver Details Card (Phone, Email, Bus Number, Feedback Option) */}
      {currentShuttle && (
        <>
          <Card className="p-6 space-y-6 border border-slate-200 dark:border-slate-800 shadow-subtle">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
                <img
                  src={
                    currentShuttle.driver_avatar ||
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentShuttle.driver_name || 'Driver')}`
                  }
                  alt={currentShuttle.driver_name || 'Assigned Driver'}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-brand-500 shadow-sm shrink-0"
                />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-navy-900 dark:bg-brand-600 text-white font-mono font-black text-xs">
                      {currentShuttle.driver_code || `DRV-10${currentShuttle.id || 1}`}
                    </span>
                    <h3 className="text-xl font-black text-navy-900 dark:text-white">
                      {currentShuttle.driver_name || 'Assigned Driver'}
                    </h3>
                    <Badge status="active">Assigned Driver</Badge>
                  </div>
                </div>
              </div>

              {/* Feedback Button (Once Used, Locks & Resets After 30 Days) */}
              <div className="flex justify-center sm:justify-end shrink-0">
                {myFeedbackWithin30Days ? (
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Feedback Sent (Resets in {daysUntilReset} days)
                    </span>
                  </div>
                ) : (
                  <Button
                    size="md"
                    icon={MessageSquarePlus}
                    onClick={() => setIsFeedbackModalOpen(true)}
                  >
                    Give Driver Feedback
                  </Button>
                )}
              </div>
            </div>

            {/* Driver Phone Number, Email, and Bus Number Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs items-stretch">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-brand-500" />
                  <span>Driver Phone Number</span>
                </span>
                <span className="text-sm font-black text-navy-900 dark:text-white">
                  {currentShuttle.driver_phone || '+91 98765 43210'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-brand-500" />
                  <span>Driver Email</span>
                </span>
                <span className="text-sm font-black text-navy-900 dark:text-white truncate">
                  {currentShuttle.driver_email || 'driver@shuttletrack.com'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex flex-col justify-between space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                  <Bus className="w-3.5 h-3.5 text-brand-500" />
                  <span>Bus Number</span>
                </span>
                <span className="text-sm font-black text-brand-600 dark:text-accent-blue">
                  Bus {currentShuttle.code} ({currentShuttle.vehicle_number || currentShuttle.name})
                </span>
              </div>
            </div>
          </Card>

          {/* Admin-Uploaded Driving License Card */}
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
                    License No: <b className="font-mono text-slate-700 dark:text-slate-200">{currentShuttle.driver_license_number || 'DL-9948201'}</b>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified by Admin</span>
                </span>
                {currentShuttle.driver_license_photo_url && (
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

            {currentShuttle.driver_license_photo_url ? (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
                <img
                  src={currentShuttle.driver_license_photo_url}
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
        </>
      )}

      {/* Driver Feedback Modal */}
      <Modal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        title={`Driver Feedback — ${currentShuttle?.driver_name || 'Assigned Driver'}`}
        subtitle={`Bus ${currentShuttle?.code || passengerBusCode} • Feedback can be submitted once every 30 days`}
      >
        <form onSubmit={handleSubmitFeedback} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Select Driver Rating (1 to 5 Stars)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingInput(star)}
                  className={`flex-1 py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 transition ${
                    ratingInput >= star
                      ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  <Star
                    className={`w-4 h-4 ${
                      ratingInput >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{star}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Performance Type
            </label>
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <button
                type="button"
                onClick={() => setRatingInput(5)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  ratingInput >= 4
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                👍 Good Performance (4–5 ★)
              </button>
              <button
                type="button"
                onClick={() => setRatingInput(2)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                  ratingInput < 4
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-700 dark:text-rose-400'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                👎 Bad Performance (1–3 ★)
              </button>
            </div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Description ({new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })})
            </label>
            <textarea
              rows={3}
              required
              placeholder="Write description about good or bad performance of the driver..."
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsFeedbackModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingFeedback}>
              {submittingFeedback ? 'Submitting...' : 'Send Feedback'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Full Driving License Preview Modal */}
      <Modal
        isOpen={isLicensePreviewOpen}
        onClose={() => setIsLicensePreviewOpen(false)}
        title="Driving License"
        subtitle={currentShuttle?.driver_name || ''}
      >
        {currentShuttle?.driver_license_photo_url && (
          <div className="rounded-2xl overflow-hidden bg-slate-950 p-3 flex items-center justify-center">
            <img
              src={currentShuttle.driver_license_photo_url}
              alt="Driving License"
              className="mx-auto max-h-[420px] w-auto object-contain rounded-xl"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PassengerDriverDetails;
