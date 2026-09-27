import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './components/common/Toast';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';
import RoleRouteGuard from './components/layout/RoleRouteGuard';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import PassengerRoutes from './pages/user/PassengerRoutes';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLiveTracking from './pages/admin/AdminLiveTracking';
import AdminShuttles from './pages/admin/AdminShuttles';
import AdminDrivers from './pages/admin/AdminDrivers';
import AdminPassengers from './pages/admin/AdminPassengers';
import AdminRoutes from './pages/admin/AdminRoutes';
import AdminStops from './pages/admin/AdminStops';
import AdminSchedules from './pages/admin/AdminSchedules';
import AdminTrips from './pages/admin/AdminTrips';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminSettings from './pages/admin/AdminSettings';

// User / Passenger Pages
import PassengerDashboard from './pages/user/PassengerDashboard';
import PassengerTrack from './pages/user/PassengerTrack';
import PassengerDriverDetails from './pages/user/PassengerDriverDetails';
import PassengerNotifications from './pages/user/PassengerNotifications';
import PassengerProfile from './pages/user/PassengerProfile';

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverTrip from './pages/driver/DriverTrip';
import DriverRoute from './pages/driver/DriverRoute';
import DriverPassengers from './pages/driver/DriverPassengers';
import DriverProfile from './pages/driver/DriverProfile';

// Catch-all smart redirect
const SmartRedirect = () => {
  const { isAuthenticated, role, getDashboardPath } = useAuth();
  if (isAuthenticated && role) {
    return <Navigate to={getDashboardPath(role)} replace />;
  }
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* 32. Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/routes" element={<LandingPage />} />

                {/* 32. Admin Protected Routes */}
                <Route
                  path="/admin"
                  element={
                    <RoleRouteGuard allowedRole="admin">
                      <DashboardLayout title="Admin Fleet Command" />
                    </RoleRouteGuard>
                  }
                >
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="live-tracking" element={<AdminLiveTracking />} />
                  <Route path="shuttles" element={<AdminShuttles />} />
                  <Route path="drivers" element={<AdminDrivers />} />
                  <Route path="passengers" element={<AdminPassengers />} />
                  <Route path="routes" element={<AdminRoutes />} />
                  <Route path="stops" element={<AdminStops />} />
                  <Route path="schedules" element={<AdminSchedules />} />
                  <Route path="trips" element={<AdminTrips />} />
                  <Route path="notifications" element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>

                {/* 32. Passenger / User Protected Routes */}
                <Route
                  path="/user"
                  element={
                    <RoleRouteGuard allowedRole="user">
                      <DashboardLayout title="Passenger Transit Hub" />
                    </RoleRouteGuard>
                  }
                >
                  <Route index element={<Navigate to="/user/dashboard" replace />} />
                  <Route path="dashboard" element={<PassengerDashboard />} />
                  <Route path="track" element={<Navigate to="/user/dashboard" replace />} />
                  <Route path="routes" element={<PassengerRoutes />} />
                  <Route path="driver-details" element={<PassengerDriverDetails />} />
                  <Route path="notifications" element={<Navigate to="/user/dashboard" replace />} />
                  <Route path="profile" element={<PassengerProfile />} />
                </Route>

                {/* 32. Driver Protected Routes */}
                <Route
                  path="/driver"
                  element={
                    <RoleRouteGuard allowedRole="driver">
                      <DashboardLayout title="Driver Transit Cockpit" />
                    </RoleRouteGuard>
                  }
                >
                  <Route index element={<Navigate to="/driver/dashboard" replace />} />
                  <Route path="dashboard" element={<DriverDashboard />} />
                  <Route path="trip" element={<Navigate to="/driver/dashboard" replace />} />
                  <Route path="route" element={<DriverRoute />} />
                  <Route path="passengers" element={<DriverPassengers />} />
                  <Route path="profile" element={<DriverProfile />} />
                </Route>

                {/* Wildcard */}
                <Route path="*" element={<SmartRedirect />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
