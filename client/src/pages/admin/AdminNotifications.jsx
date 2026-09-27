import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../components/common/Toast';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input, { Select } from '../../components/common/Input';
import { Bell, Send, AlertTriangle, CheckCircle2, Megaphone } from 'lucide-react';

export const AdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    shuttle_id: ''
  });

  const { addToast } = useToast();

  const fetchNotifs = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    try {
      await api.post('/notifications/broadcast', formData);
      addToast({ title: 'Alert Broadcasted', message: 'Sent in real-time to all passengers & drivers', type: 'success' });
      setIsModalOpen(false);
      setFormData({ title: '', message: '', type: 'info', shuttle_id: '' });
      fetchNotifs();
    } catch (err) {
      addToast({ title: 'Broadcast Failed', message: 'Could not send announcement', type: 'danger' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Campus Broadcast Center & Notifications
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Send instant real-time alerts for road construction, route disruptions or delays
          </p>
        </div>

        <Button onClick={() => setIsModalOpen(true)} icon={Megaphone} size="sm">
          Broadcast New Alert
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {notifications.map((notif) => (
          <Card key={notif.id} className="p-5 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge status={notif.type === 'delay' ? 'delayed' : notif.type === 'warning' ? 'danger' : 'info'}>
                  {notif.type.toUpperCase()}
                </Badge>
                <span className="text-[10px] text-slate-400">
                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h4 className="text-sm font-bold text-navy-900 dark:text-white">
                {notif.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {notif.message}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>{notif.shuttle_id ? `Target: Shuttle S0${notif.shuttle_id}` : 'Target: All Campus Transit'}</span>
              <span className="text-emerald-500 font-semibold">✓ Broadcasted</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Broadcast Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Broadcast Campus Transit Notification"
        subtitle="This message will push immediately to passenger and driver screens"
      >
        <form onSubmit={handleBroadcast} className="space-y-4">
          <Input
            label="Alert Title / Headline"
            id="notifTitle"
            required
            placeholder="e.g. Heavy Delay Advisory on Route 2"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />

          <Select
            label="Alert Priority & Type"
            id="notifType"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { label: 'Informational (General)', value: 'info' },
              { label: 'Traffic / Delay Advisory', value: 'delay' },
              { label: 'Caution / Route Modification', value: 'warning' },
              { label: 'Success / Resumed Normal Loop', value: 'success' }
            ]}
          />

          <div className="w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Detailed Notification Message *
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. East Gate is currently closed for annual festival prep. Shuttles are detouring through North Loop."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm p-3 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" icon={Send}>
              Send Broadcast
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminNotifications;
