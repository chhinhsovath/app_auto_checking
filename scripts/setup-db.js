require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const createTables = async () => {
  console.log('🚀 Setting up database tables...');

  try {
    // Create staff table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        department VARCHAR(50),
        position VARCHAR(100),
        password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        phone VARCHAR(20),
        profile_image VARCHAR(255),
        hire_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Staff table created');

    // Create attendance table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        check_out_time TIMESTAMP,
        location_lat DECIMAL(10, 8) NOT NULL,
        location_lng DECIMAL(11, 8) NOT NULL,
        distance_from_office DECIMAL(8, 2) NOT NULL,
        date DATE DEFAULT CURRENT_DATE,
        status VARCHAR(20) DEFAULT 'present',
        device_info JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(staff_id, date)
      );
    `);
    console.log('✅ Attendance table created');

    // Create refresh_tokens table for JWT management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked BOOLEAN DEFAULT false
      );
    `);
    console.log('✅ Refresh tokens table created');

    // Create departments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        manager_id INTEGER REFERENCES staff(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Departments table created');

    // Create attendance_logs for audit trail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id SERIAL PRIMARY KEY,
        attendance_id INTEGER REFERENCES attendance(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        performed_by INTEGER REFERENCES staff(id),
        performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT
      );
    `);
    console.log('✅ Attendance logs table created');

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, date);
      CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
      CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance(check_in_time);
      CREATE INDEX IF NOT EXISTS idx_staff_employee_id ON staff(employee_id);
      CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_staff ON refresh_tokens(staff_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    `);
    console.log('✅ Database indexes created');

    // Create triggers for updated_at timestamps
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Database triggers created');

    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the setup
createTables();