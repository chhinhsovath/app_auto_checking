const winston = require('winston');

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' }),
    new winston.transports.Console()
  ]
});

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Default error response
  let error = {
    message: 'Internal Server Error',
    status: 500
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = {
      message: 'Validation Error',
      details: err.details || err.message,
      status: 400
    };
  } else if (err.name === 'UnauthorizedError' || err.message === 'Unauthorized') {
    error = {
      message: 'Unauthorized',
      status: 401
    };
  } else if (err.name === 'ForbiddenError' || err.message === 'Forbidden') {
    error = {
      message: 'Forbidden',
      status: 403
    };
  } else if (err.name === 'NotFoundError' || err.message === 'Not Found') {
    error = {
      message: 'Resource not found',
      status: 404
    };
  } else if (err.code === '23505') { // PostgreSQL unique violation
    error = {
      message: 'Duplicate entry',
      details: 'A record with this information already exists',
      status: 409
    };
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    error = {
      message: 'Reference error',
      details: 'Referenced record does not exist',
      status: 400
    };
  } else if (err.code === '23502') { // PostgreSQL not null violation
    error = {
      message: 'Missing required field',
      details: 'Required field cannot be empty',
      status: 400
    };
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File too large',
      details: 'The uploaded file exceeds the maximum allowed size',
      status: 413
    };
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && error.status === 500) {
    error.message = 'Something went wrong';
    delete error.details;
  }

  // Send error response
  res.status(error.status).json({
    success: false,
    error: error.message,
    ...(error.details && { details: error.details }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Custom error classes
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

module.exports = {
  errorHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
};