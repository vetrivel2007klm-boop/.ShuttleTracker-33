import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import { useToast } from '../../components/common/Toast';
import { Bell, CheckCheck, Bus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export const PassengerNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchNotifs = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      addToast({ title: 'Marked as Read', message: 'All notifications cleared', type: 'info' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkOne = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'delay':
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
      default:
        return <Bus className="w-5 h-5 text-brand-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 16. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Transit Alerts & Advisories
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time stop arrival pings, delay warnings, and shuttle departure updates
          </p>
        </div>

        <Button variant="outline" size="sm" icon={CheckCheck} onClick={handleMarkAllRead}>
          Mark All as Read
        </Button>
      </div>

      {/* 16. Notifications List */}
      <div className="space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            onClick={() => handleMarkOne(notif.id)}
            className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
              !notif.is_read
                ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 shadow-subtle ring-1 ring-brand-500/10'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700/60">
                {getIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2">
                    {notif.title}
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 ring-2 ring-brand-200 dark:ring-blue-900 animate-pulse" />
                    )}
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {notif.message}
                </p>

                <div className="mt-3 flex items-center gap-3 text-[11px]">
                  <Badge
                    status={notif.type === 'delay' ? 'delayed' : notif.type === 'success' ? 'active' : 'info'}
                    withDot={false}
                    className="text-[10px] py-0 px-2 font-bold"
                  >
                    {notif.type.toUpperCase()}
                  </Badge>
                  {notif.shuttle_id && (
                    <span className="text-slate-500 font-semibold">
                      Shuttle S0{notif.shuttle_id}
                    </span>
                  )}
                  <span className="text-slate-400">
                    {notif.is_read ? 'Read' : 'New notification'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PassengerNotifications;
