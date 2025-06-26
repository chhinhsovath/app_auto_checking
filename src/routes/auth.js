const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { query } = require('../config/database');
const { authenticateToken, authenticateRefreshToken, generateTokens } = require('../middleware/auth');
const { ValidationError, UnauthorizedError, NotFoundError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  employee_id: Joi.string().required(),
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  department: Joi.string().max(50).optional(),
  position: Joi.string().max(100).optional(),
  phone: Joi.string().max(20).optional()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const { email, password } = value;

    // Find user by email
    const result = await query(
      'SELECT * FROM staff WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await query(
      'INSERT INTO refresh_tokens (staff_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const { employee_id, name, email, password, department, position, phone } = value;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await query(
      `INSERT INTO staff (employee_id, name, email, password, department, position, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, employee_id, name, email, department, position, phone, is_active, created_at`,
      [employee_id, name, email, hashedPassword, department, position, phone]
    );

    const newUser = result.rows[0];

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(newUser);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'INSERT INTO refresh_tokens (staff_id, token, expires_at) VALUES ($1, $2, $3)',
      [newUser.id, refreshToken, expiresAt]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: newUser,
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
router.post('/refresh', authenticateRefreshToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    // Check if refresh token exists and is not revoked
    const tokenResult = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND is_revoked = false AND expires_at > NOW()',
      [refreshToken]
    );

    if (tokenResult.rows.length === 0) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Get user data
    const userResult = await query(
      'SELECT * FROM staff WHERE id = $1 AND is_active = true',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = userResult.rows[0];

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Revoke old refresh token and store new one
    await query('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [refreshToken]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      'INSERT INTO refresh_tokens (staff_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, expiresAt]
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: userWithoutPassword,
        accessToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Revoke refresh token
      await query(
        'UPDATE refresh_tokens SET is_revoked = true WHERE token = $1 AND staff_id = $2',
        [refreshToken, req.user.id]
      );
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, employee_id, name, email, department, position, phone, profile_image, hire_date, is_active, created_at FROM staff WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const updateSchema = Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      phone: Joi.string().max(20).optional(),
      profile_image: Joi.string().uri().optional()
    });

    const { error, value } = updateSchema.validate(req.body);
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
    updateValues.push(req.user.id);

    const result = await query(
      `UPDATE staff SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} 
       RETURNING id, employee_id, name, email, department, position, phone, profile_image, hire_date, is_active, created_at, updated_at`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: result.rows[0]
      }
    });

  } catch (error) {
    next(error);
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res, next) => {
  try {
    const changePasswordSchema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required()
    });

    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid input data', error.details);
    }

    const { currentPassword, newPassword } = value;

    // Get current password hash
    const result = await query(
      'SELECT password FROM staff WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await query(
      'UPDATE staff SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, req.user.id]
    );

    // Revoke all existing refresh tokens for security
    await query(
      'UPDATE refresh_tokens SET is_revoked = true WHERE staff_id = $1',
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;