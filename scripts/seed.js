require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const seedDatabase = async () => {
  console.log('🌱 Seeding database with sample data...');

  try {
    // Create departments
    const departments = [
      { name: 'Engineering', description: 'Software development and technical operations' },
      { name: 'Marketing', description: 'Marketing and brand management' },
      { name: 'Sales', description: 'Sales and customer relations' },
      { name: 'HR', description: 'Human resources and administration' },
      { name: 'Finance', description: 'Financial operations and accounting' }
    ];

    for (const dept of departments) {
      await pool.query(
        'INSERT INTO departments (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [dept.name, dept.description]
      );
    }
    console.log('✅ Departments seeded');

    // Create sample staff members
    const saltRounds = 12;
    const defaultPassword = await bcrypt.hash('password123', saltRounds);

    const staff = [
      {
        employee_id: 'EMP001',
        name: 'John Doe',
        email: 'john.doe@company.com',
        department: 'Engineering',
        position: 'Senior Developer',
        phone: '+1234567890',
        hire_date: '2023-01-15'
      },
      {
        employee_id: 'EMP002',
        name: 'Jane Smith',
        email: 'jane.smith@company.com',
        department: 'Marketing',
        position: 'Marketing Manager',
        phone: '+1234567891',
        hire_date: '2023-02-20'
      },
      {
        employee_id: 'EMP003',
        name: 'Mike Johnson',
        email: 'mike.johnson@company.com',
        department: 'Sales',
        position: 'Sales Representative',
        phone: '+1234567892',
        hire_date: '2023-03-10'
      },
      {
        employee_id: 'EMP004',
        name: 'Sarah Wilson',
        email: 'sarah.wilson@company.com',
        department: 'HR',
        position: 'HR Specialist',
        phone: '+1234567893',
        hire_date: '2023-04-05'
      },
      {
        employee_id: 'ADMIN001',
        name: 'Admin User',
        email: 'admin@company.com',
        department: 'Engineering',
        position: 'System Administrator',
        phone: '+1234567894',
        hire_date: '2023-01-01'
      }
    ];

    for (const member of staff) {
      await pool.query(
        `INSERT INTO staff (employee_id, name, email, department, position, password, phone, hire_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (employee_id) DO NOTHING`,
        [
          member.employee_id,
          member.name,
          member.email,
          member.department,
          member.position,
          defaultPassword,
          member.phone,
          member.hire_date
        ]
      );
    }
    console.log('✅ Staff members seeded');

    // Create sample attendance records for the past week
    const today = new Date();
    const officeLocation = {
      lat: parseFloat(process.env.OFFICE_LATITUDE) || 11.55187745723682,
      lng: parseFloat(process.env.OFFICE_LONGITUDE) || 104.92836774000962
    };

    // Get all staff IDs
    const staffResult = await pool.query('SELECT id FROM staff');
    const staffIds = staffResult.rows.map(row => row.id);

    // Create attendance records for the past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      for (const staffId of staffIds) {
        // 90% chance of attendance
        if (Math.random() < 0.9) {
          const checkInTime = new Date(date);
          checkInTime.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
          
          const checkOutTime = new Date(checkInTime);
          checkOutTime.setHours(checkInTime.getHours() + 8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);

          // Add small random variation to location (within office radius)
          const latVariation = (Math.random() - 0.5) * 0.0001;
          const lngVariation = (Math.random() - 0.5) * 0.0001;
          const distance = Math.floor(Math.random() * 8) + 1; // 1-8 meters from office

          await pool.query(
            `INSERT INTO attendance (
              staff_id, check_in_time, check_out_time, location_lat, location_lng, 
              distance_from_office, date, status, device_info
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (staff_id, date) DO NOTHING`,
            [
              staffId,
              checkInTime,
              checkOutTime,
              officeLocation.lat + latVariation,
              officeLocation.lng + lngVariation,
              distance,
              date.toISOString().split('T')[0],
              'present',
              JSON.stringify({
                device: 'mobile',
                os: Math.random() > 0.5 ? 'iOS' : 'Android',
                version: '1.0.0'
              })
            ]
          );
        }
      }
    }
    console.log('✅ Sample attendance records seeded');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Sample accounts created:');
    console.log('   Email: admin@company.com | Password: password123');
    console.log('   Email: john.doe@company.com | Password: password123');
    console.log('   Email: jane.smith@company.com | Password: password123');
    console.log('\n⚠️  Remember to change default passwords in production!');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

// Run the seeding
seedDatabase();