const express = require('express');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { ValidationError, NotFoundError, ForbiddenError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const createStaffSchema = Joi.object({
  employee_id: Joi.string().required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  department: Joi.string().max(50).optional(),
  position: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  hire_date: Joi.date().optional()
});

const updateStaffSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  department: Joi.string().max(50).optional(),
  position: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  hire_date: Joi.date().optional(),
  is_active: Joi.boolean().optional()
});

// Middleware to check if user is admin (for this demo, we'll use a simple check)
const requireAdmin = async (req, res, next) => {
  try {
    // For demo purposes, check if user has admin role or is specific admin user
    // In production, you should have a proper role-based system
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

// GET /api/staff - Get all staff members (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, department, is_active } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR employee_id ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    if (department) {
      whereClause += ` AND department = $${paramCount}`;
      queryParams.push(department);
      paramCount++;
    }

    if (is_active !== undefined) {
      whereClause += ` AND is_active = $${paramCount}`;
      queryParams.push(is_active === 'true');
      paramCount++;
    }

    const result = await query(
      `SELECT id, employee_id, name, email, department, position, phone, 
              profile_image, hire_date, is_active, created_at, updated_at
       FROM staff 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...queryParams, limit, offset]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM staff ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        staff: result.rows,
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

// GET /api/staff/:id - Get specific staff member
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Users can only view their own profile unless they're admin
    if (parseInt(id) !== req.user.id) {
      const adminCheck = await query(
        'SELECT * FROM staff WHERE id = $1 AND (position ILIKE \'%admin%\' OR employee_id = \'ADMIN001\')',
        [req.user.id]
      );
      
      if (adminCheck.rows.length === 0) {
        throw new ForbiddenError('You can only view your own profile');
      }
    }

    const result = await query(
      `SELECT id, employee_id, name, email, department, position, phone, 
              profile_image, hire_date, is_active, created_at, updated_at
       FROM staff WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Staff member not found');
    }

    res.json({
      success: true,
      data: {
        staff: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/staff - Create new staff member (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { error, value } = createStaffSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const { employee_id, name, email, password, department, position, phone, hire_date } = value;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO staff (employee_id, name, email, password, department, position, phone, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, employee_id, name, email, department, position, phone, hire_date, is_active, created_at`,
      [employee_id, name, email, hashedPassword, department, position, phone, hire_date]
    );

    res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      data: {
        staff: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/staff/:id - Update staff member
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Users can only update their own profile unless they're admin
    if (parseInt(id) !== req.user.id) {
      const adminCheck = await query(
        'SELECT * FROM staff WHERE id = $1 AND (position ILIKE \'%admin%\' OR employee_id = \'ADMIN001\')',
        [req.user.id]
      );
      
      if (adminCheck.rows.length === 0) {
        throw new ForbiddenError('You can only update your own profile');
      }
    }

    const { error, value } = updateStaffSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(val);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(id);

    const result = await query(
      `UPDATE staff SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, employee_id, name, email, department, position, phone, profile_image, hire_date, is_active, created_at, updated_at`,
      updateValues
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Staff member not found');
    }

    res.json({
      success: true,
      message: 'Staff member updated successfully',
      data: {
        staff: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /api/staff/:id - Deactivate staff member (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow deactivating self
    if (parseInt(id) === req.user.id) {
      throw new ForbiddenError('You cannot deactivate your own account');
    }

    const result = await query(
      'UPDATE staff SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name, email',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Staff member not found');
    }

    // Revoke all refresh tokens for the deactivated user
    await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE staff_id = $1',
      [id]
    );

    res.json({
      success: true,
      message: 'Staff member deactivated successfully',
      data: {
        staff: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/staff/:id/activate - Reactivate staff member (Admin only)
router.post('/:id/activate', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE staff SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, name, email',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Staff member not found');
    }

    res.json({
      success: true,
      message: 'Staff member activated successfully',
      data: {
        staff: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/staff/:id/attendance - Get staff attendance history (Admin or self)
router.get('/:id/attendance', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, from_date, to_date } = req.query;
    const offset = (page - 1) * limit;

    // Users can only view their own attendance unless they're admin
    if (parseInt(id) !== req.user.id) {
      const adminCheck = await query(
        'SELECT * FROM staff WHERE id = $1 AND (position ILIKE \'%admin%\' OR employee_id = \'ADMIN001\')',
        [req.user.id]
      );
      
      if (adminCheck.rows.length === 0) {
        throw new ForbiddenError('You can only view your own attendance');
      }
    }

    let whereClause = 'WHERE a.staff_id = $1';
    let queryParams = [id];
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

// GET /api/staff/departments - Get all departments
router.get('/departments/list', authenticateToken, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT name, description FROM departments WHERE is_active = true ORDER BY name'
    );

    res.json({
      success: true,
      data: {
        departments: result.rows
      }
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;