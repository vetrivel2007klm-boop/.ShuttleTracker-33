import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import { Search, Mail, Phone, Bus } from 'lucide-react';

export const AdminPassengers = () => {
  const [passengers, setPassengers] = useState([]);
  const [search, setSearch] = useState('');
  const { socket } = useSocket();

  const fetchPassengers = async () => {
    try {
      const res = await api.get('/auth/passengers');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPassengers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load passengers:', err);
    }
  };

  useEffect(() => {
    fetchPassengers();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('passenger:updated', fetchPassengers);
    socket.on('driver:updated', fetchPassengers);
    socket.on('shuttle:updated', fetchPassengers);
    return () => {
      socket.off('passenger:updated', fetchPassengers);
      socket.off('driver:updated', fetchPassengers);
      socket.off('shuttle:updated', fetchPassengers);
    };
  }, [socket]);

  const filtered = passengers.filter(
    (p) =>
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.bus_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-navy-900 dark:text-white">
            Passenger & Student Community
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Live registered passengers, profile photos, and assigned bus routes
          </p>
        </div>

        <div className="w-full sm:w-72">
          <Input
            icon={Search}
            placeholder="Search passenger by name/email/bus..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Passenger</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">Bus Route</th>
                <th className="py-3.5 px-4">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filtered.map((user) => {
                const avatarSrc =
                  user.avatar_url ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'Passenger')}`;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={avatarSrc}
                          alt={user.name}
                          className="w-9 h-9 rounded-xl object-cover border-2 border-brand-500 shrink-0 bg-slate-900"
                        />
                        <div>
                          <div className="font-bold text-navy-900 dark:text-white">{user.name}</div>
                          <span className="text-[10px] text-slate-400">
                            {user.organization_name || 'Sairam Engineering College'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {user.phone || '+91 98765 43210'}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-bold text-navy-900 dark:text-white">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-blue-400 text-xs font-extrabold">
                        <Bus className="w-3.5 h-3.5" />
                        <span>Bus {user.bus_number || 'S01'}</span>
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge status="active">Active Passenger</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPassengers;
