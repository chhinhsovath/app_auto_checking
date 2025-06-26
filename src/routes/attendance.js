const express = require('express');
const Joi = require('joi');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const { 
  isWithinOfficeGeofence, 
  isValidCoordinates, 
  getGeofenceStatus,
  getCheckInMessage,
  calculateETAToOffice
} = require('../utils/geofencing');

const router = express.Router();

// Validation schemas
const checkInSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  device_info: Joi.object().optional(),
  notes: Joi.string().max(500).optional()
});

const checkOutSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  notes: Joi.string().max(500).optional()
});

// POST /api/attendance/checkin
router.post('/checkin', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = checkInSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const { latitude, longitude, device_info, notes } = value;

    // Validate coordinates
    if (!isValidCoordinates(latitude, longitude)) {
      throw new ValidationError('Invalid coordinates provided');
    }

    // Check geofence
    const geofenceResult = isWithinOfficeGeofence(latitude, longitude);
    if (!geofenceResult.isWithinGeofence) {
      return res.status(400).json({
        success: false,
        message: `You are ${geofenceResult.distance}m away from the office. You must be within ${geofenceResult.officeLocation.radius}m to check in.`,
        data: {
          distance: geofenceResult.distance,
          requiredDistance: geofenceResult.officeLocation.radius,
          canCheckIn: false
        }
      });
    }

    // Check if already checked in today
    const today = new Date().toISOString().split('T')[0];
    const existingAttendance = await query(
      'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2',
      [req.user.id, today]
    );

    if (existingAttendance.rows.length > 0) {
      const attendance = existingAttendance.rows[0];
      if (attendance.check_in_time && !attendance.check_out_time) {
        return res.status(400).json({
          success: false,
          message: 'You are already checked in for today',
          data: {
            checkInTime: attendance.check_in_time,
            alreadyCheckedIn: true
          }
        });
      }
    }

    // Perform check-in
    const result = await query(
      `INSERT INTO attendance (staff_id, location_lat, location_lng, distance_from_office, date, device_info, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (staff_id, date) 
       DO UPDATE SET 
         check_in_time = CURRENT_TIMESTAMP,
         location_lat = EXCLUDED.location_lat,
         location_lng = EXCLUDED.location_lng,
         distance_from_office = EXCLUDED.distance_from_office,
         device_info = EXCLUDED.device_info,
         notes = EXCLUDED.notes,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.user.id, latitude, longitude, geofenceResult.distance, today, device_info, notes]
    );

    const attendance = result.rows[0];

    // Get user info for response
    const userResult = await query(
      'SELECT name, employee_id, department FROM staff WHERE id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: `Check-in successful! Welcome, ${userResult.rows[0].name}`,
      data: {
        attendance,
        user: userResult.rows[0],
        location: {
          distance: geofenceResult.distance,
          withinGeofence: true
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/attendance/checkout
router.post('/checkout', authenticateToken, async (req, res, next) => {
  try {
    const { error, value } = checkOutSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const { latitude, longitude, notes } = value;

    // Validate coordinates
    if (!isValidCoordinates(latitude, longitude)) {
      throw new ValidationError('Invalid coordinates provided');
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if checked in today
    const existingAttendance = await query(
      'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2',
      [req.user.id, today]
    );

    if (existingAttendance.rows.length === 0 || !existingAttendance.rows[0].check_in_time) {
      return res.status(400).json({
        success: false,
        message: 'You must check in first before checking out',
        data: {
          needsCheckIn: true
        }
      });
    }

    const attendance = existingAttendance.rows[0];
    if (attendance.check_out_time) {
      return res.status(400).json({
        success: false,
        message: 'You have already checked out for today',
        data: {
          checkOutTime: attendance.check_out_time,
          alreadyCheckedOut: true
        }
      });
    }

    // Calculate work duration
    const checkInTime = new Date(attendance.check_in_time);
    const checkOutTime = new Date();
    const workDurationMs = checkOutTime - checkInTime;
    const workDurationHours = Math.round((workDurationMs / (1000 * 60 * 60)) * 100) / 100;

    // Perform check-out
    const result = await query(
      `UPDATE attendance 
       SET check_out_time = CURRENT_TIMESTAMP, 
           notes = COALESCE(notes, '') || CASE WHEN notes IS NOT NULL AND notes != '' THEN ' | ' ELSE '' END || COALESCE($3, ''),
           updated_at = CURRENT_TIMESTAMP
       WHERE staff_id = $1 AND date = $2
       RETURNING *`,
      [req.user.id, today, notes]
    );

    const updatedAttendance = result.rows[0];

    // Get user info for response
    const userResult = await query(
      'SELECT name, employee_id, department FROM staff WHERE id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: `Check-out successful! Have a great day, ${userResult.rows[0].name}`,
      data: {
        attendance: updatedAttendance,
        user: userResult.rows[0],
        workDuration: {
          hours: workDurationHours,
          checkInTime: attendance.check_in_time,
          checkOutTime: updatedAttendance.check_out_time
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/status
router.get('/status', authenticateToken, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await query(
      'SELECT * FROM attendance WHERE staff_id = $1 AND date = $2',
      [req.user.id, today]
    );

    const attendance = result.rows[0];
    let status = 'not_checked_in';
    let workDuration = null;

    if (attendance) {
      if (attendance.check_in_time && attendance.check_out_time) {
        status = 'checked_out';
        const checkInTime = new Date(attendance.check_in_time);
        const checkOutTime = new Date(attendance.check_out_time);
        const durationMs = checkOutTime - checkInTime;
        workDuration = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
      } else if (attendance.check_in_time) {
        status = 'checked_in';
        const checkInTime = new Date(attendance.check_in_time);
        const now = new Date();
        const durationMs = now - checkInTime;
        workDuration = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;
      }
    }

    res.json({
      success: true,
      data: {
        status,
        attendance,
        workDuration,
        date: today
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/today
router.get('/today', authenticateToken, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await query(
      `SELECT a.*, s.name, s.employee_id, s.department 
       FROM attendance a
       JOIN staff s ON a.staff_id = s.id
       WHERE a.staff_id = $1 AND a.date = $2`,
      [req.user.id, today]
    );

    res.json({
      success: true,
      data: {
        attendance: result.rows[0] || null,
        date: today
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/history
router.get('/history', authenticateToken, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE a.staff_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (from_date) {
      whereClause += ` AND a.date >= $${paramCount}`;
      queryParams.push(from_date);
      paramCount++;
    }

    if (to_date) {
      whereClause += ` AND a.date <= $${paramCount}`;
      queryParams.push(to_date);
      paramCount++;
    }

    const result = await query(
      `SELECT a.*, s.name, s.employee_id, s.department,
       CASE 
         WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
           EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600
         ELSE NULL
       END as work_hours
       FROM attendance a
       JOIN staff s ON a.staff_id = s.id
       ${whereClause}
       ORDER BY a.date DESC, a.check_in_time DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM attendance a ${whereClause}`,
      queryParams.slice(0, -2) // Remove limit and offset
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        attendance: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/location-status
router.get('/location-status', authenticateToken, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      throw new ValidationError('Latitude and longitude are required');
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (!isValidCoordinates(lat, lng)) {
      throw new ValidationError('Invalid coordinates provided');
    }

    const geofenceStatus = getGeofenceStatus(lat, lng);
    const checkInMessage = getCheckInMessage(lat, lng);
    const eta = calculateETAToOffice(lat, lng);

    res.json({
      success: true,
      data: {
        geofence: geofenceStatus,
        message: checkInMessage,
        eta,
        canCheckIn: checkInMessage.canCheckIn
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/attendance/stats
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND a.date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND a.date >= CURRENT_DATE - INTERVAL '30 days'";
    } else if (period === 'year') {
      dateFilter = "AND a.date >= CURRENT_DATE - INTERVAL '365 days'";
    }

    const result = await query(
      `SELECT 
         COUNT(*) as total_days,
         COUNT(CASE WHEN a.check_in_time IS NOT NULL THEN 1 END) as present_days,
         COUNT(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN 1 END) as complete_days,
         AVG(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
           EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600
         END) as avg_work_hours,
         AVG(a.distance_from_office) as avg_distance
       FROM attendance a
       WHERE a.staff_id = $1 ${dateFilter}`,
      [req.user.id]
    );

    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        period,
        stats: {
          totalDays: parseInt(stats.total_days),
          presentDays: parseInt(stats.present_days),
          completeDays: parseInt(stats.complete_days),
          avgWorkHours: parseFloat(stats.avg_work_hours) || 0,
          avgDistance: parseFloat(stats.avg_distance) || 0,
          attendanceRate: stats.total_days > 0 ? (stats.present_days / stats.total_days * 100).toFixed(1) : 0
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;