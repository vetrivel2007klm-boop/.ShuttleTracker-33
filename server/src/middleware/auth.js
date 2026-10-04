const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'shuttletrack-super-secret-production-key-2026';

const resolveDemoUser = (role) => ({
  userId: role === 'admin' ? 1 : role === 'driver' ? 3 : 2,
  role,
  email:
    role === 'admin'
      ? 'cleancodeuniverse@gmail.com'
      : role === 'driver'
      ? 'driver.john@cleancodeuniverse.com'
      : 'passenger@cleancodeuniverse.com',
  name: role === 'admin' ? 'Admin Controller' : role === 'driver' ? 'John Miller' : 'Sarah Jenkins',
  organization_name: null
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token missing. Please sign in.'
    });
  }

  const token = authHeader.split(' ')[1];

  // Support demo preview tokens gracefully without 401 unmount
  if (token && token.startsWith('demo-jwt-token-')) {
    const role = token.replace('demo-jwt-token-', '');
    req.user = resolveDemoUser(role);
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role, email, name, organization_name }
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please sign in again.'
    });
  }
};

const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  if (token && token.startsWith('demo-jwt-token-')) {
    const role = token.replace('demo-jwt-token-', '');
    req.user = resolveDemoUser(role);
    return next();
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (_) {}
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires ${roles.join(' or ')} privileges.`
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  JWT_SECRET
};
