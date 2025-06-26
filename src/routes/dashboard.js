const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { ForbiddenError } = require('../middleware/errorHandler');

const router = express.Router();

// Middleware to check admin privileges
const requireAdmin = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM staff WHERE id = $1 AND (position ILIKE \'%admin%\' OR employee_id = \'ADMIN001\')',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new ForbiddenError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
};

// GET /api/dashboard/stats - Dashboard statistics
router.get('/stats', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    // Get today's attendance stats
    const todayStats = await query(`
      SELECT 
        COUNT(*) as total_staff,
        COUNT(CASE WHEN a.check_in_time IS NOT NULL THEN 1 END) as present_today,
        COUNT(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NULL THEN 1 END) as currently_in,
        AVG(CASE WHEN a.check_in_time IS NOT NULL THEN a.distance_from_office END) as avg_distance
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = $1
      WHERE s.is_active = true
    `, [today]);

    // Get this month's stats
    const monthStats = await query(`
      SELECT 
        COUNT(DISTINCT a.staff_id) as active_staff_this_month,
        COUNT(*) as total_attendance_records,
        AVG(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
          EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600
        END) as avg_work_hours
      FROM attendance a
      WHERE DATE_TRUNC('month', a.date) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Get department wise attendance for today
    const departmentStats = await query(`
      SELECT 
        s.department,
        COUNT(*) as total_staff,
        COUNT(CASE WHEN a.check_in_time IS NOT NULL THEN 1 END) as present_today,
        ROUND(
          COUNT(CASE WHEN a.check_in_time IS NOT NULL THEN 1 END)::numeric / 
          COUNT(*)::numeric * 100, 
          1
        ) as attendance_rate
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = $1
      WHERE s.is_active = true
      GROUP BY s.department
      ORDER BY attendance_rate DESC
    `, [today]);

    // Get recent attendance activity
    const recentActivity = await query(`
      SELECT 
        s.name,
        s.employee_id,
        s.department,
        a.check_in_time,
        a.check_out_time,
        a.distance_from_office,
        a.date
      FROM attendance a
      JOIN staff s ON a.staff_id = s.id
      WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY 
        CASE 
          WHEN a.check_out_time IS NOT NULL THEN a.check_out_time
          ELSE a.check_in_time
        END DESC
      LIMIT 10
    `);

    const stats = {
      today: {
        totalStaff: parseInt(todayStats.rows[0].total_staff),
        presentToday: parseInt(todayStats.rows[0].present_today),
        currentlyIn: parseInt(todayStats.rows[0].currently_in),
        avgDistance: parseFloat(todayStats.rows[0].avg_distance) || 0,
        attendanceRate: todayStats.rows[0].total_staff > 0 ? 
          ((todayStats.rows[0].present_today / todayStats.rows[0].total_staff) * 100).toFixed(1) : 0
      },
      month: {
        activeStaff: parseInt(monthStats.rows[0].active_staff_this_month) || 0,
        totalRecords: parseInt(monthStats.rows[0].total_attendance_records) || 0,
        avgWorkHours: parseFloat(monthStats.rows[0].avg_work_hours) || 0
      },
      departments: departmentStats.rows,
      recentActivity: recentActivity.rows
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/attendance-chart - Attendance chart data
router.get('/attendance-chart', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;
    
    let dateRange = '';
    let groupBy = '';
    let dateFormat = '';
    
    switch (period) {
      case 'week':
        dateRange = "WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'";
        groupBy = 'a.date';
        dateFormat = "TO_CHAR(a.date, 'Day')";
        break;
      case 'month':
        dateRange = "WHERE a.date >= CURRENT_DATE - INTERVAL '30 days'";
        groupBy = 'a.date';
        dateFormat = "TO_CHAR(a.date, 'MM-DD')";
        break;
      case 'year':
        dateRange = "WHERE a.date >= CURRENT_DATE - INTERVAL '365 days'";
        groupBy = "DATE_TRUNC('month', a.date)";
        dateFormat = "TO_CHAR(DATE_TRUNC('month', a.date), 'Mon YYYY')";
        break;
      default:
        dateRange = "WHERE a.date >= CURRENT_DATE - INTERVAL '7 days'";
        groupBy = 'a.date';
        dateFormat = "TO_CHAR(a.date, 'Day')";
    }

    const result = await query(`
      SELECT 
        ${dateFormat} as period,
        ${groupBy} as date_group,
        COUNT(DISTINCT a.staff_id) as present_count,
        (SELECT COUNT(*) FROM staff WHERE is_active = true) as total_staff,
        ROUND(
          COUNT(DISTINCT a.staff_id)::numeric / 
          (SELECT COUNT(*) FROM staff WHERE is_active = true)::numeric * 100, 
          1
        ) as attendance_rate
      FROM attendance a
      ${dateRange}
      GROUP BY ${groupBy}
      ORDER BY date_group
    `);

    res.json({
      success: true,
      data: {
        period,
        chartData: result.rows
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/live-attendance - Live attendance tracking
router.get('/live-attendance', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.employee_id,
        s.department,
        s.position,
        a.check_in_time,
        a.check_out_time,
        a.location_lat,
        a.location_lng,
        a.distance_from_office,
        a.status,
        CASE 
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NULL THEN 'checked_in'
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN 'checked_out'
          ELSE 'not_checked_in'
        END as current_status,
        CASE 
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NULL THEN
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.check_in_time))/3600
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
            EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600
          ELSE NULL
        END as work_hours
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = $1
      WHERE s.is_active = true
      ORDER BY 
        CASE 
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NULL THEN 1
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN 2
          ELSE 3
        END,
        a.check_in_time DESC
    `, [today]);

    res.json({
      success: true,
      data: {
        date: today,
        staff: result.rows
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/staff-locations - Get current staff locations
router.get('/staff-locations', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.employee_id,
        s.department,
        a.location_lat,
        a.location_lng,
        a.distance_from_office,
        a.check_in_time,
        a.check_out_time,
        CASE 
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NULL THEN 'active'
          WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN 'completed'
          ELSE 'absent'
        END as status
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.date = $1
      WHERE s.is_active = true AND a.location_lat IS NOT NULL AND a.location_lng IS NOT NULL
      ORDER BY a.check_in_time DESC
    `, [today]);

    res.json({
      success: true,
      data: {
        locations: result.rows,
        office: {
          latitude: parseFloat(process.env.OFFICE_LATITUDE) || 11.55187745723682,
          longitude: parseFloat(process.env.OFFICE_LONGITUDE) || 104.92836774000962,
          radius: parseFloat(process.env.OFFICE_RADIUS) || 10
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/dashboard/attendance-summary - Attendance summary report
router.get('/attendance-summary', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { from_date, to_date, department } = req.query;
    
    let whereClause = 'WHERE s.is_active = true';
    let queryParams = [];
    let paramCount = 1;

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

    if (department) {
      whereClause += ` AND s.department = $${paramCount}`;
      queryParams.push(department);
      paramCount++;
    }

    const result = await query(`
      SELECT 
        s.id,
        s.name,
        s.employee_id,
        s.department,
        s.position,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.check_in_time IS NOT NULL THEN 1 END) as present_days,
        COUNT(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN 1 END) as complete_days,
        AVG(CASE WHEN a.check_in_time IS NOT NULL AND a.check_out_time IS NOT NULL THEN
          EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600
        END) as avg_work_hours,
        AVG(a.distance_from_office) as avg_distance,
        MIN(a.date) as first_attendance,
        MAX(a.date) as last_attendance
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id
      ${whereClause}
      GROUP BY s.id, s.name, s.employee_id, s.department, s.position
      ORDER BY present_days DESC, s.name
    `, queryParams);

    const summary = result.rows.map(row => ({
      ...row,
      total_days: parseInt(row.total_days),
      present_days: parseInt(row.present_days),
      complete_days: parseInt(row.complete_days),
      avg_work_hours: parseFloat(row.avg_work_hours) || 0,
      avg_distance: parseFloat(row.avg_distance) || 0,
      attendance_rate: row.total_days > 0 ? ((row.present_days / row.total_days) * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      data: {
        summary,
        filters: {
          from_date,
          to_date,
          department
        }
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;