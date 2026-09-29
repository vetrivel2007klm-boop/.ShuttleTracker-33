import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Sun,
  Moon,
  Menu,
  Wifi,
  WifiOff,
  NavigationOff,
  Clock,
  AlertTriangle,
  Calendar,
  Mail
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../common/Toast';
import Badge from '../common/Badge';
import api from '../../services/api';

export const Topbar = ({ onMenuClick, title = 'Fleet Command Center' }) => {
  const { user } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { socket, isConnected, realtimeNotifications, unreadCount, latestAlert, clearUnread } =
    useSocket();
  const { addToast } = useToast();
  const [showNotifications, setShowNotifications] = useState(false);
  const [passengerDelayNotifications, setPassengerDelayNotifications] = useState([]);
  const [passengerUnreadCount, setPassengerUnreadCount] = useState(0);
  const [driverNotifications, setDriverNotifications] = useState([]);
  const [driverUnreadCount, setDriverUnreadCount] = useState(0);
  const [driverBusCode, setDriverBusCode] = useState('');
  const lastAlertRef = useRef(null);

  const passengerBusCode = (user?.bus_number || 'S01').trim().toUpperCase();

  // Load driver's existing schedule notifications when logged in as driver
  useEffect(() => {
    if (user?.role !== 'driver') return;
    let mounted = true;
    const loadDriverNotifs = async () => {
      try {
        const res = await api.get('/drivers/me');
        if (!mounted || !res.data?.success || !res.data.data) return;
        const d = res.data.data;
        if (d.shuttle?.code) setDriverBusCode(String(d.shuttle.code).toUpperCase());
        const existingNotifs = Array.isArray(d.driverNotifications) ? d.driverNotifications : [];
        const scheduleCards = Array.isArray(d.schedules)
          ? d.schedules.map((sc) => ({
              id: `sched-${sc.id}`,
              title: `📅 Scheduled Shift: ${sc.departure_time} – ${sc.arrival_time}`,
              message: `Admin scheduled your ride on Bus ${sc.shuttle_code || d.shuttle?.code || 'S01'} (${sc.route_name || 'Assigned Route'}). Your schedule time is ${sc.departure_time} to ${sc.arrival_time} — please be ready to ride safely!`,
              created_at: sc.created_at || new Date().toISOString(),
              departure_time: sc.departure_time,
              arrival_time: sc.arrival_time
            }))
          : [];
        const merged = [...existingNotifs, ...scheduleCards];
        setDriverNotifications(merged);
        if (merged.length > 0) {
          setDriverUnreadCount(merged.length);
        }
      } catch (_) {}
    };
    loadDriverNotifs();
    return () => {
      mounted = false;
    };
  }, [user?.role, user?.id]);

  // Listen for real-time schedule assignments & earlier reminders from Admin in Driver Login
  useEffect(() => {
    if (!socket || user?.role !== 'driver') return;

    const handleDriverScheduleAssigned = (payload) => {
      if (!payload) return;
      const myEmail = String(user?.email || '').trim().toLowerCase();
      const targetEmail = String(payload.driverEmail || '').trim().toLowerCase();
      const targetUserId = payload.driverUserId ? String(payload.driverUserId) : '';
      const targetBus = String(payload.busCode || '').trim().toUpperCase();

      const isForMe =
        (myEmail && targetEmail && myEmail === targetEmail) ||
        (targetUserId && String(user?.id) === targetUserId) ||
        (driverBusCode && targetBus && driverBusCode === targetBus);

      if (!isForMe) return;

      const notif = payload.notification || {
        id: `sched-live-${Date.now()}`,
        title:
          payload.mode === 'reminder'
            ? `⏰ Schedule Time Is On (${payload.departure_time} – ${payload.arrival_time})`
            : `📅 New Schedule Assigned (${payload.departure_time} – ${payload.arrival_time})`,
        message: `Admin Notice: Your schedule time (${payload.departure_time} – ${payload.arrival_time}) on Bus ${payload.busCode || driverBusCode || 'S01'} (${payload.routeName || 'Assigned Route'}) is on — please be ready to ride safely! Email notification sent to ${user?.email}.`,
        created_at: new Date().toISOString()
      };

      setDriverNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
      setDriverUnreadCount((c) => c + 1);
      addToast({
        title: notif.title,
        message: notif.message,
        type: 'info',
        duration: 8000
      });
    };

    socket.on('driver:schedule_assigned', handleDriverScheduleAssigned);
    return () => {
      socket.off('driver:schedule_assigned', handleDriverScheduleAssigned);
    };
  }, [socket, user?.role, user?.email, user?.id, driverBusCode, addToast]);

  // Show instant toast ONLY in the Admin website whenever a new Admin notification arrives
  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (!latestAlert || latestAlert._receivedAt === lastAlertRef.current) return;
    lastAlertRef.current = latestAlert._receivedAt;
    addToast({
      title: latestAlert.title || 'New Transit Notification',
      message: latestAlert.message || 'Check Admin Notification Bell for details.',
      type: latestAlert.type === 'off_route' || latestAlert.type === 'emergency_stopped' ? 'danger' : 'warning'
    });
  }, [latestAlert, addToast, user?.role]);

  // Load initial trip_started / passenger notifications & listen for live Trip Started + Stop Delay alerts for Passenger's Bus
  useEffect(() => {
    if (user?.role !== 'user') return;
    let mounted = true;
    api
      .get('/notifications')
      .then((res) => {
        if (!mounted || !res.data?.success || !Array.isArray(res.data.data)) return;
        const busNotifs = res.data.data.filter(
          (n) =>
            n.type === 'trip_started' &&
            (!n.bus_code || String(n.bus_code).trim().toUpperCase() === passengerBusCode)
        );
        if (busNotifs.length > 0) {
          setPassengerDelayNotifications((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const merged = [...busNotifs.filter((b) => !existingIds.has(b.id)), ...prev];
            return merged;
          });
          setPassengerUnreadCount((c) => c + busNotifs.length);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user?.role, passengerBusCode]);

  useEffect(() => {
    if (!socket || user?.role !== 'user') return;

    const handleStopDelayForBusPassengers = (payload) => {
      if (!payload) return;
      const eventBusCode = String(payload.busCode || '').trim().toUpperCase();
      if (eventBusCode && eventBusCode !== passengerBusCode) return;

      const notifItem = {
        id: `${payload.shuttleId}-${payload.stopName}-${payload.reachedTime}`,
        title: `Bus ${eventBusCode || passengerBusCode} Delayed at ${payload.stopName}`,
        message:
          payload.trafficMessage ||
          `Driver reached ${payload.stopName} at ${payload.reachedTime} (+${payload.delayMinutes} min stop delay).`,
        created_at: new Date().toISOString(),
        stopName: payload.stopName,
        delayMinutes: payload.delayMinutes
      };

      setPassengerDelayNotifications((prev) => {
        if (prev.some((n) => n.id === notifItem.id)) return prev;
        setPassengerUnreadCount((c) => c + 1);
        addToast({
          title: notifItem.title,
          message: notifItem.message,
          type: 'warning',
          duration: 6000
        });
        return [notifItem, ...prev];
      });
    };

    const handleTripStartedNotif = (notif) => {
      if (!notif || notif.type !== 'trip_started') return;
      const eventBusCode = String(notif.bus_code || '').trim().toUpperCase();
      if (eventBusCode && eventBusCode !== passengerBusCode) return;

      setPassengerDelayNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        setPassengerUnreadCount((c) => c + 1);
        addToast({
          title: notif.title || `🚍 Bus ${passengerBusCode} Trip Started`,
          message: notif.message,
          type: 'success',
          duration: 7000
        });
        return [notif, ...prev];
      });
    };

    socket.on('passenger:stop_delay_traffic', handleStopDelayForBusPassengers);
    socket.on('notification:new', handleTripStartedNotif);
    return () => {
      socket.off('passenger:stop_delay_traffic', handleStopDelayForBusPassengers);
      socket.off('notification:new', handleTripStartedNotif);
    };
  }, [socket, user?.role, passengerBusCode, addToast]);

  return (
    <header className="h-16 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between z-30 transition-colors">
      {/* Left title & mobile menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base sm:text-lg font-bold text-navy-900 dark:text-white leading-tight">
            {title}
          </h1>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Socket Live
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-slate-400" />
                  <span>Connecting...</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Dark Mode */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
          title="Toggle Dark Mode"
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Admin-Only Notifications Bell */}
        {user?.role === 'admin' && (
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) clearUnread();
              }}
              className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors relative border border-slate-200/80 dark:border-slate-800"
              title="Admin Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-navy-900 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Admin Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-elevated p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-black text-navy-900 dark:text-white uppercase tracking-wider block">
                      Admin Notification Center
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Driver Feedback, Off-Route, Emergency & Arrival Alerts
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-blue-400 text-[10px] font-bold">
                    {realtimeNotifications.length} Alerts
                  </span>
                </div>

                <div className="py-2.5 space-y-2.5 max-h-80 overflow-y-auto">
                  {realtimeNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No active notifications.
                    </div>
                  ) : (
                    realtimeNotifications.map((notif, idx) => {
                      const isOffRoute =
                        notif.type === 'off_route' ||
                        String(notif.title || '').toLowerCase().includes('off-route');
                      const isEmergency =
                        notif.type === 'emergency_stopped' ||
                        String(notif.title || '').toLowerCase().includes('emergency');
                      const isArrivalExceeded =
                        notif.type === 'arrival_exceeded' ||
                        String(notif.title || '').toLowerCase().includes('arrival');

                      return (
                        <div
                          key={notif.id || idx}
                          className={`p-3 rounded-xl border text-xs transition-colors ${
                            isOffRoute || isEmergency
                              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/70'
                              : isArrivalExceeded
                              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/70'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 font-extrabold text-navy-900 dark:text-white">
                              {isOffRoute ? (
                                <NavigationOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                              ) : isArrivalExceeded ? (
                                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                              )}
                              <span>{notif.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                              {new Date(notif.created_at || Date.now()).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Passenger Bus Stop Delay Notification Bell (Only for Passenger's Bus) */}
        {user?.role === 'user' && (
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) setPassengerUnreadCount(0);
              }}
              className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors relative border border-slate-200/80 dark:border-slate-800"
              title={`Bus ${passengerBusCode} Stop Delay Notifications`}
            >
              <Bell className="w-4 h-4" />
              {passengerUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-navy-900 animate-pulse">
                  {passengerUnreadCount > 9 ? '9+' : passengerUnreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-elevated p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-black text-navy-900 dark:text-white uppercase tracking-wider block">
                      Bus {passengerBusCode} Stop Delay Alerts
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Live stop delay notifications for passengers on Bus {passengerBusCode}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                    {passengerDelayNotifications.length} Alerts
                  </span>
                </div>

                <div className="py-2.5 space-y-2.5 max-h-80 overflow-y-auto">
                  {passengerDelayNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No stop delays reported for Bus {passengerBusCode}.
                    </div>
                  ) : (
                    passengerDelayNotifications.map((notif, idx) => (
                      <div
                        key={notif.id || idx}
                        className="p-3 rounded-xl border bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/70 text-xs transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 font-extrabold text-navy-900 dark:text-white">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>{notif.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {new Date(notif.created_at || Date.now()).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Driver Schedule & Dispatch Notification Bell (Driver Login) */}
        {user?.role === 'driver' && (
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) setDriverUnreadCount(0);
              }}
              className="p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-300 transition-colors relative border border-slate-200/80 dark:border-slate-800"
              title="Driver Schedule Notifications from Admin"
            >
              <Bell className="w-4 h-4" />
              {driverUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-navy-900 animate-pulse">
                  {driverUnreadCount > 9 ? '9+' : driverUnreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-[420px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-elevated p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-black text-navy-900 dark:text-white uppercase tracking-wider block">
                      Driver Schedule Notifications
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                      <Mail className="w-3 h-3 text-brand-500" />
                      Admin Schedule Alerts & Email Reminders ({user?.email})
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-blue-400 text-[10px] font-bold">
                    {driverNotifications.length} Notices
                  </span>
                </div>

                <div className="py-2.5 space-y-2.5 max-h-80 overflow-y-auto">
                  {driverNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No schedule notifications assigned yet.
                    </div>
                  ) : (
                    driverNotifications.map((notif, idx) => (
                      <div
                        key={notif.id || idx}
                        className="p-3 rounded-xl border bg-brand-50/60 dark:bg-brand-950/30 border-brand-200 dark:border-brand-900/70 text-xs transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 font-extrabold text-navy-900 dark:text-white">
                            <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                            <span>{notif.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                            {new Date(notif.created_at || Date.now()).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Badge */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <Badge status="active" withDot={false} className="uppercase text-[10px] font-bold">
            {user?.role === 'user'
              ? `Passenger • Bus ${passengerBusCode}`
              : user?.role === 'driver'
              ? `Driver${driverBusCode ? ` • Bus ${driverBusCode}` : ''}`
              : user?.role || 'Guest'}
          </Badge>
        </div>
      </div>
    </header>
  );
};

export default Topbar;

