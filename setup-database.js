// Simple database setup script that works without npm dependencies
const { spawn } = require('child_process');

const DB_CONFIG = {
  host: '137.184.109.21',
  user: 'postgres',
  database: 'staff_tracking_app',
  password: 'P@ssw0rd',
  port: 5432
};

function runSQL(sql, description) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 ${description}...`);
    
    const psql = spawn('psql', [
      '-h', DB_CONFIG.host,
      '-U', DB_CONFIG.user,
      '-d', DB_CONFIG.database,
      '-c', sql
    ], {
      env: { ...process.env, PGPASSWORD: DB_CONFIG.password }
    });

    let output = '';
    let error = '';

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      error += data.toString();
    });

    psql.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed`);
        resolve(output);
      } else {
        console.error(`❌ ${description} failed:`, error);
        reject(new Error(error));
      }
    });
  });
}

async function setupDatabase() {
  console.log('🚀 Setting up Mobile Attendance System Database...');
  console.log(`📊 Database: ${DB_CONFIG.database} on ${DB_CONFIG.host}:${DB_CONFIG.port}`);

  try {
    // Drop existing tables if they exist
    await runSQL('DROP TABLE IF EXISTS attendance_logs, refresh_tokens, attendance, staff, departments CASCADE;', 'Cleaning existing tables');

    // Create staff table
    await runSQL(`
      CREATE TABLE staff (
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
    `, 'Creating staff table');

    // Create attendance table
    await runSQL(`
      CREATE TABLE attendance (
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
    `, 'Creating attendance table');

    // Create refresh_tokens table
    await runSQL(`
      CREATE TABLE refresh_tokens (
        id SERIAL PRIMARY KEY,
        staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked BOOLEAN DEFAULT false
      );
    `, 'Creating refresh tokens table');

    // Create departments table
    await runSQL(`
      CREATE TABLE departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        manager_id INTEGER REFERENCES staff(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, 'Creating departments table');

    // Create attendance_logs table
    await runSQL(`
      CREATE TABLE attendance_logs (
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
    `, 'Creating attendance logs table');

    // Create indexes
    await runSQL(`
      CREATE INDEX idx_attendance_staff_date ON attendance(staff_id, date);
      CREATE INDEX idx_attendance_date ON attendance(date);
      CREATE INDEX idx_attendance_check_in ON attendance(check_in_time);
      CREATE INDEX idx_staff_employee_id ON staff(employee_id);
      CREATE INDEX idx_staff_email ON staff(email);
      CREATE INDEX idx_refresh_tokens_staff ON refresh_tokens(staff_id);
      CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    `, 'Creating database indexes');

    // Create update triggers
    await runSQL(`
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
    `, 'Creating database triggers');

    // Insert departments
    await runSQL(`
      INSERT INTO departments (name, description) VALUES
      ('Engineering', 'Software development and technical operations'),
      ('Marketing', 'Marketing and brand management'),
      ('Sales', 'Sales and customer relations'),
      ('HR', 'Human resources and administration'),
      ('Finance', 'Financial operations and accounting');
    `, 'Seeding departments');

    // Insert sample staff with hashed passwords (using simple hash for demo)
    // In production, you'd use proper bcrypt hashing
    await runSQL(`
      INSERT INTO staff (employee_id, name, email, department, position, password, phone, hire_date) VALUES
      ('ADMIN001', 'Admin User', 'admin@company.com', 'Engineering', 'System Administrator', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDlIv..L/yRWTuu', '+1234567894', '2023-01-01'),
      ('EMP001', 'John Doe', 'john.doe@company.com', 'Engineering', 'Senior Developer', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDlIv..L/yRWTuu', '+1234567890', '2023-01-15'),
      ('EMP002', 'Jane Smith', 'jane.smith@company.com', 'Marketing', 'Marketing Manager', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDlIv..L/yRWTuu', '+1234567891', '2023-02-20'),
      ('EMP003', 'Mike Johnson', 'mike.johnson@company.com', 'Sales', 'Sales Representative', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDlIv..L/yRWTuu', '+1234567892', '2023-03-10'),
      ('EMP004', 'Sarah Wilson', 'sarah.wilson@company.com', 'HR', 'HR Specialist', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewDlIv..L/yRWTuu', '+1234567893', '2023-04-05');
    `, 'Seeding staff members');

    // Insert sample attendance data for the past few days
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);

    // Office location
    const officeLat = 11.55187745723682;
    const officeLng = 104.92836774000962;

    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      await runSQL(`
        INSERT INTO attendance (staff_id, check_in_time, check_out_time, location_lat, location_lng, distance_from_office, date, status, device_info) VALUES
        (1, '${dateStr} 08:30:00', '${dateStr} 17:45:00', ${officeLat + (Math.random() - 0.5) * 0.0001}, ${officeLng + (Math.random() - 0.5) * 0.0001}, ${Math.floor(Math.random() * 8) + 1}, '${dateStr}', 'present', '{"device": "mobile", "os": "iOS", "version": "1.0.0"}'),
        (2, '${dateStr} 09:00:00', '${dateStr} 18:00:00', ${officeLat + (Math.random() - 0.5) * 0.0001}, ${officeLng + (Math.random() - 0.5) * 0.0001}, ${Math.floor(Math.random() * 8) + 1}, '${dateStr}', 'present', '{"device": "mobile", "os": "Android", "version": "1.0.0"}'),
        (3, '${dateStr} 08:45:00', '${dateStr} 17:30:00', ${officeLat + (Math.random() - 0.5) * 0.0001}, ${officeLng + (Math.random() - 0.5) * 0.0001}, ${Math.floor(Math.random() * 8) + 1}, '${dateStr}', 'present', '{"device": "mobile", "os": "iOS", "version": "1.0.0"}');
      `, `Seeding attendance data for ${dateStr}`);
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Sample accounts created (password: password123):');
    console.log('   📧 admin@company.com - System Administrator');
    console.log('   📧 john.doe@company.com - Senior Developer');
    console.log('   📧 jane.smith@company.com - Marketing Manager');
    console.log('   📧 mike.johnson@company.com - Sales Representative');
    console.log('   📧 sarah.wilson@company.com - HR Specialist');
    console.log('\n⚠️  Remember to change default passwords in production!');
    console.log('\n🚀 Ready to start the full system:');
    console.log('   Backend: npm run server (port 3001)');
    console.log('   Frontend: npm run dev (port 3000)');
    console.log('   Mobile: cd mobile-app && expo start');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();