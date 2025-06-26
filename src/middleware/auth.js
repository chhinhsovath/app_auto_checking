const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('./errorHandler');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return next(new UnauthorizedError('Access token required'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new UnauthorizedError('Token expired'));
      }
      if (err.name === 'JsonWebTokenError') {
        return next(new UnauthorizedError('Invalid token'));
      }
      return next(new UnauthorizedError('Token verification failed'));
    }

    req.user = user;
    next();
  });
};

const authenticateRefreshToken = (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return next(new UnauthorizedError('Refresh token required'));
  }

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new UnauthorizedError('Refresh token expired'));
      }
      if (err.name === 'JsonWebTokenError') {
        return next(new UnauthorizedError('Invalid refresh token'));
      }
      return next(new UnauthorizedError('Refresh token verification failed'));
    }

    req.user = user;
    next();
  });
};

const generateTokens = (user) => {
  const payload = {
    id: user.id,
    employee_id: user.employee_id,
    email: user.email,
    name: user.name,
    department: user.department,
    position: user.position
  };

  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
    }
    next();
  });
};

module.exports = {
  authenticateToken,
  authenticateRefreshToken,
  generateTokens,
  optionalAuth
};