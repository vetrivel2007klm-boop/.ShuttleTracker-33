const bcrypt = require('bcryptjs');

// Standard pre-computed hash for Admin account
const adminHash = bcrypt.hashSync('admin123', 10);

// Only the Admin account is seeded; all dummy passengers, drivers, shuttles, routes, stops, schedules, and trips have been removed
const initialUsers = [
  {
    id: 1,
    name: 'Admin Controller',
    email: 'admin@shuttletrack.com',
    password_hash: adminHash,
    role: 'admin',
    phone: '+1 (555) 019-2834',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    created_at: new Date('2026-01-01T08:00:00Z').toISOString()
  }
];

const initialDrivers = [];
const initialRoutes = [];
const initialStops = [];
const initialShuttles = [];
const initialTrips = [];
const initialNotifications = [];
const initialSchedules = [];

module.exports = {
  initialUsers,
  initialDrivers,
  initialRoutes,
  initialStops,
  initialShuttles,
  initialTrips,
  initialNotifications,
  initialSchedules
};
