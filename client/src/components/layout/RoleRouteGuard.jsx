import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const RoleRouteGuard = ({ allowedRole, children }) => {
  const { user, token, loading, getDashboardPath } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading ShuttleTrack Command Center...</p>
        </div>
      </div>
    );
  }

  // If user directly opened a protected link without logging in, auto-login with demo credentials
  if (!token || !user) {
    const demoProfiles = {
      admin: { id: 1, name: 'Admin Controller', email: 'admin@shuttletrack.com', role: 'admin' },
      user: { id: 2, name: 'Sarah Jenkins', email: 'passenger@shuttletrack.com', role: 'user' },
      driver: { id: 3, name: 'John Miller', email: 'driver.john@shuttletrack.com', role: 'driver' },
    };

    const targetProfile = demoProfiles[allowedRole] || demoProfiles.user;
    localStorage.setItem('shuttle_user', JSON.stringify(targetProfile));
    localStorage.setItem('shuttle_token', 'demo-jwt-token-' + allowedRole);
    // Reload once to hydrate AuthContext
    window.location.reload();
    return null;
  }

  // If role does not match, redirect to their authorized role dashboard
  if (allowedRole && user.role !== allowedRole) {
    const destination = getDashboardPath(user.role);
    return <Navigate to={destination} replace />;
  }

  return children;
};

export default RoleRouteGuard;
