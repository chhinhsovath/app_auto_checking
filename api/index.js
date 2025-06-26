// Vercel API Handler for Mobile Attendance System
const http = require('http');
const url = require('url');
const { spawn } = require('child_process');

// Database configuration - Digital Ocean Production
const DB_CONFIG = {
  host: process.env.DB_HOST || '137.184.109.21',
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'staff_tracking_app',
  password: process.env.DB_PASSWORD || 'P@ssw0rd',
  port: process.env.DB_PORT || 5432
};

// Office location for geofencing
const OFFICE_LOCATION = {
  latitude: parseFloat(process.env.OFFICE_LATITUDE || '11.55187745723682'),
  longitude: parseFloat(process.env.OFFICE_LONGITUDE || '104.92836774000962'),
  radius: parseInt(process.env.OFFICE_RADIUS || '10')
};

// Database query function
function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    const psqlArgs = [
      '-h', DB_CONFIG.host,
      '-U', DB_CONFIG.user,
      '-d', DB_CONFIG.database,
      '-t', // tuples only
      '-A', // unaligned output
      '-F', '|', // field separator
      '-c', sql
    ];

    const psql = spawn('psql', psqlArgs, {
      env: { ...process.env, PGPASSWORD: DB_CONFIG.password },
      timeout: 10000
    });

    let output = '';
    let error = '';

    const timeout = setTimeout(() => {
      psql.kill();
      reject(new Error('Database query timeout'));
    }, 15000);

    psql.stdout.on('data', (data) => {
      output += data.toString();
    });

    psql.stderr.on('data', (data) => {
      error += data.toString();
    });

    psql.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        const lines = output.trim().split('\\n').filter(line => line.trim());
        const rows = lines.map(line => line.split('|'));
        resolve(rows);
      } else {
        reject(new Error(error || 'Database query failed'));
      }
    });
  });
}

// Calculate distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

module.exports = async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Health check
    if (path === '/api/health' || path === '/health') {
      res.status(200).json({
        status: 'OK',
        message: 'Mobile Attendance System API is running on Vercel',
        database: 'Digital Ocean PostgreSQL',
        host: DB_CONFIG.host,
        timestamp: new Date().toISOString(),
        environment: 'Vercel Serverless'
      });
      return;
    }

    // Login endpoint
    if (path === '/api/auth/login' && method === 'POST') {
      const { email, password } = req.body;
      
      try {
        const userRows = await dbQuery(
          `SELECT id, employee_id, name, email, department, position, phone, is_active FROM staff WHERE email = '${email}' AND is_active = true`
        );

        if (userRows.length > 0 && password === 'password123') {
          const userData = userRows[0];
          const user = {
            id: parseInt(userData[0]),
            employee_id: userData[1],
            name: userData[2],
            email: userData[3],
            department: userData[4],
            position: userData[5],
            phone: userData[6],
            is_active: userData[7] === 't'
          };

          res.status(200).json({
            success: true,
            message: 'Login successful (Vercel deployment)',
            data: {
              user: user,
              accessToken: 'vercel-token-' + Date.now(),
              refreshToken: 'vercel-refresh-' + Date.now()
            }
          });
        } else {
          res.status(401).json({
            success: false,
            error: 'Invalid email or password'
          });
        }
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Database error: ' + error.message
        });
      }
      return;
    }

    // Check-in endpoint
    if (path === '/api/attendance/checkin' && method === 'POST') {
      const { latitude, longitude, notes, staff_id = 1 } = req.body;
      
      const distance = calculateDistance(
        OFFICE_LOCATION.latitude,
        OFFICE_LOCATION.longitude,
        latitude,
        longitude
      );

      if (distance <= OFFICE_LOCATION.radius) {
        const today = new Date().toISOString().split('T')[0];
        
        try {
          const existingRows = await dbQuery(
            `SELECT id FROM attendance WHERE staff_id = ${staff_id} AND date = '${today}'`
          );

          if (existingRows.length > 0) {
            res.status(400).json({
              success: false,
              message: 'Already checked in today'
            });
            return;
          }

          const insertSql = `
            INSERT INTO attendance (staff_id, location_lat, location_lng, distance_from_office, date, notes, device_info)
            VALUES (${staff_id}, ${latitude}, ${longitude}, ${distance}, '${today}', '${notes || ''}', '{"device": "web", "platform": "vercel"}')
            RETURNING id, check_in_time, date;
          `;
          
          const attendanceRows = await dbQuery(insertSql);
          
          res.status(200).json({
            success: true,
            message: 'Check-in successful (Vercel deployment)!',
            data: {
              attendance: {
                id: parseInt(attendanceRows[0][0]),
                check_in_time: attendanceRows[0][1],
                date: attendanceRows[0][2],
                distance: distance
              },
              location: { distance: distance, withinGeofence: true }
            }
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: 'Database error: ' + error.message
          });
        }
      } else {
        res.status(400).json({
          success: false,
          message: `You are ${distance.toFixed(1)}m away from the office. You must be within ${OFFICE_LOCATION.radius}m to check in.`,
          data: {
            distance: distance,
            requiredDistance: OFFICE_LOCATION.radius,
            canCheckIn: false
          }
        });
      }
      return;
    }

    // Dashboard stats
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const todayStatsRows = await dbQuery(`
          SELECT 
            (SELECT COUNT(*) FROM staff WHERE is_active = true) as total_staff,
            COUNT(DISTINCT a.staff_id) as present_today
          FROM attendance a 
          WHERE a.date = '${today}';
        `);

        const recentActivityRows = await dbQuery(`
          SELECT s.name, s.employee_id, s.department, a.check_in_time, a.check_out_time, a.date
          FROM attendance a
          JOIN staff s ON a.staff_id = s.id
          WHERE a.date >= DATE('${today}') - INTERVAL '7 days'
          ORDER BY a.check_in_time DESC
          LIMIT 10;
        `);

        const stats = todayStatsRows[0] || ['0', '0'];
        const totalStaff = parseInt(stats[0]) || 0;
        const presentToday = parseInt(stats[1]) || 0;
        
        const recentActivity = recentActivityRows.map(row => ({
          name: row[0],
          employee_id: row[1],
          department: row[2],
          check_in_time: row[3],
          check_out_time: row[4],
          date: row[5]
        }));

        res.status(200).json({
          success: true,
          data: {
            today: {
              totalStaff: totalStaff,
              presentToday: presentToday,
              currentlyIn: presentToday,
              attendanceRate: totalStaff > 0 ? ((presentToday / totalStaff) * 100).toFixed(1) : 0
            },
            recentActivity: recentActivity
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Database error: ' + error.message
        });
      }
      return;
    }

    // 404 for other routes
    res.status(404).json({
      success: false,
      error: 'API route not found'
    });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
};