import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  Bus,
  Users2,
  UserCheck,
  MapPin,
  Calendar,
  Compass,
  History,
  Bell,
  Settings,
  LogOut,
  Navigation2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Badge from '../common/Badge';

export const Sidebar = ({ onClose = null }) => {
  const { role, logout, user } = useAuth();
  const navigate = useNavigate();

  // Navigation configurations based on role
  const adminLinks = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Live Tracking', path: '/admin/live-tracking', icon: Radio, badge: 'Live' },
    { label: 'Shuttles', path: '/admin/shuttles', icon: Bus },
    { label: 'Drivers', path: '/admin/drivers', icon: UserCheck },
    { label: 'Routes', path: '/admin/routes', icon: Navigation2 },
    { label: 'Schedules', path: '/admin/schedules', icon: Calendar },
    { label: 'Admin Profile & Settings', path: '/admin/settings', icon: Settings },
  ];

  const userLinks = [
    { label: 'Dashboard', path: '/user/dashboard', icon: LayoutDashboard },
    { label: 'Campus Routes', path: '/user/routes', icon: Navigation2 },
    { label: 'Driver Details', path: '/user/driver-details', icon: UserCheck },
    { label: 'Profile', path: '/user/profile', icon: Users2 },
  ];

  const driverLinks = [
    { label: 'Dashboard', path: '/driver/dashboard', icon: LayoutDashboard },
    { label: 'Routes & Current Location', path: '/driver/route', icon: Navigation2 },
    { label: 'Passengers', path: '/driver/passengers', icon: Users2 },
    { label: 'Driver Profile', path: '/driver/profile', icon: UserCheck },
  ];

  const links = role === 'admin' ? adminLinks : role === 'driver' ? driverLinks : userLinks;

  const handleLogout = () => {
    const currentRole = role || 'admin';
    logout();
    navigate(`/login?role=${currentRole}`);
  };

  return (
    <aside className="w-64 h-full bg-white dark:bg-navy-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between select-none">
      {/* Top Brand Header */}
      <div>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-navy-900 dark:text-white tracking-tight text-base">
                Shuttle<span className="text-brand-500">Track</span>
              </span>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                {role} console
              </div>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)]">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-blue-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <img
            src={user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'User')}`}
            alt="User avatar"
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-navy-900 dark:text-white truncate">
              {user?.name || 'Account'}
            </p>
            <p className="text-[10px] text-slate-400 capitalize truncate">
              {user?.role || 'Passenger'}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
