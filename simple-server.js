// Simple demo server for Mobile Attendance System
// Runs without external dependencies for quick testing

const http = require('http');
const url = require('url');

// Simple in-memory database for demo
let users = [
  {
    id: 1,
    employee_id: 'ADMIN001',
    name: 'Admin User',
    email: 'admin@company.com',
    password: 'password123',
    department: 'Administration',
    position: 'System Administrator'
  },
  {
    id: 2,
    employee_id: 'EMP001',
    name: 'John Doe',
    email: 'john.doe@company.com',
    password: 'password123',
    department: 'Engineering',
    position: 'Senior Developer'
  }
];

let attendance = [];

// Office location for geofencing
const OFFICE_LOCATION = {
  latitude: 11.55187745723682,
  longitude: 104.92836774000962,
  radius: 10 // meters
};

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

  return R * c; // Distance in meters
}

// Simple HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      message: 'Attendance System API is running',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Login endpoint
  if (path === '/api/auth/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { email, password } = JSON.parse(body);
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
          const { password: _, ...userWithoutPassword } = user;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Login successful',
            data: {
              user: userWithoutPassword,
              accessToken: 'demo-token-' + Date.now(),
              refreshToken: 'demo-refresh-' + Date.now()
            }
          }));
        } else {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: 'Invalid email or password'
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON'
        }));
      }
    });
    return;
  }

  // Check-in endpoint
  if (path === '/api/attendance/checkin' && method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { latitude, longitude, notes } = JSON.parse(body);
        
        // Calculate distance from office
        const distance = calculateDistance(
          OFFICE_LOCATION.latitude,
          OFFICE_LOCATION.longitude,
          latitude,
          longitude
        );

        if (distance <= OFFICE_LOCATION.radius) {
          const attendanceRecord = {
            id: attendance.length + 1,
            staff_id: 1,
            check_in_time: new Date().toISOString(),
            location_lat: latitude,
            location_lng: longitude,
            distance_from_office: distance,
            date: new Date().toISOString().split('T')[0],
            status: 'present',
            notes: notes
          };
          
          attendance.push(attendanceRecord);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'Check-in successful!',
            data: {
              attendance: attendanceRecord,
              location: {
                distance: distance,
                withinGeofence: true
              }
            }
          }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            message: `You are ${distance.toFixed(1)}m away from the office. You must be within ${OFFICE_LOCATION.radius}m to check in.`,
            data: {
              distance: distance,
              requiredDistance: OFFICE_LOCATION.radius,
              canCheckIn: false
            }
          }));
        }
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON'
        }));
      }
    });
    return;
  }

  // Get attendance status
  if (path === '/api/attendance/status' && method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        status: todayAttendance.length > 0 ? 'checked_in' : 'not_checked_in',
        attendance: todayAttendance[0] || null,
        date: today
      }
    }));
    return;
  }

  // Dashboard stats
  if (path === '/api/dashboard/stats' && method === 'GET') {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        today: {
          totalStaff: users.length,
          presentToday: todayAttendance.length,
          currentlyIn: todayAttendance.length,
          attendanceRate: users.length > 0 ? ((todayAttendance.length / users.length) * 100).toFixed(1) : 0
        },
        recentActivity: attendance.slice(-5).reverse()
      }
    }));
    return;
  }

  // Serve demo interface
  if (path === '/' || path === '/demo') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Mobile Attendance System - Demo</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
        .header h1 { color: #1976d2; margin: 0 0 10px 0; font-size: 2.5em; }
        .header p { color: #666; margin: 0; font-size: 1.1em; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }
        .card { background: white; padding: 25px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
        .card h3 { margin-top: 0; color: #333; font-size: 1.3em; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
        .form-group input { width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 16px; box-sizing: border-box; }
        .form-group input:focus { outline: none; border-color: #1976d2; }
        .btn { background: #1976d2; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 500; width: 100%; margin-top: 10px; }
        .btn:hover { background: #1565c0; }
        .btn:active { transform: translateY(1px); }
        .status { padding: 15px; border-radius: 8px; margin: 15px 0; font-weight: 500; }
        .success { background: #e8f5e8; color: #2e7d32; border-left: 4px solid #4caf50; }
        .error { background: #fff3e0; color: #ef6c00; border-left: 4px solid #ff9800; }
        .info { background: #e3f2fd; color: #1976d2; border-left: 4px solid #2196f3; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 28px; font-weight: bold; color: #1976d2; margin-bottom: 5px; }
        .stat-label { color: #666; font-size: 14px; }
        .credentials { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        .credentials h4 { margin-top: 0; font-size: 1.2em; }
        .api-list { list-style: none; padding: 0; }
        .api-list li { background: #f8f9fa; margin: 8px 0; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .feature { text-align: center; padding: 15px; }
        .feature-icon { font-size: 48px; margin-bottom: 10px; }
        @media (max-width: 768px) {
            .header h1 { font-size: 2em; }
            .grid { grid-template-columns: 1fr; }
            body { padding: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏢 Mobile Attendance System</h1>
            <p>Geofencing-enabled attendance tracking with real-time monitoring</p>
        </div>

        <div class="credentials">
            <h4>🔑 Demo Credentials</h4>
            <p><strong>Admin:</strong> admin@company.com / password123</p>
            <p><strong>Staff:</strong> john.doe@company.com / password123</p>
        </div>

        <div class="grid">
            <div class="card">
                <h3>📊 System Status</h3>
                <div class="info">✅ Server is running! API endpoints are available.</div>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number" id="totalStaff">-</div>
                        <div class="stat-label">Total Staff</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="presentToday">-</div>
                        <div class="stat-label">Present Today</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="attendanceRate">-</div>
                        <div class="stat-label">Attendance Rate</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>🔐 Authentication Demo</h3>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="loginEmail" value="admin@company.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="loginPassword" value="password123">
                </div>
                <button class="btn" onclick="testLogin()">Test Login</button>
                <div id="loginResult"></div>
            </div>

            <div class="card">
                <h3>📍 Geofencing Demo</h3>
                <p><strong>Office Location:</strong> ${OFFICE_LOCATION.latitude}, ${OFFICE_LOCATION.longitude}</p>
                <p><strong>Geofence Radius:</strong> ${OFFICE_LOCATION.radius} meters</p>
                <div class="form-group">
                    <label>Latitude</label>
                    <input type="number" id="latitude" value="${OFFICE_LOCATION.latitude}" step="0.000001">
                </div>
                <div class="form-group">
                    <label>Longitude</label>
                    <input type="number" id="longitude" value="${OFFICE_LOCATION.longitude}" step="0.000001">
                </div>
                <div class="form-group">
                    <label>Notes (optional)</label>
                    <input type="text" id="notes" placeholder="Optional notes">
                </div>
                <button class="btn" onclick="testCheckin()">Test Check-in</button>
                <div id="checkinResult"></div>
            </div>

            <div class="card">
                <h3>🚀 Key Features</h3>
                <div class="feature-grid">
                    <div class="feature">
                        <div class="feature-icon">🔐</div>
                        <h4>JWT Auth</h4>
                        <p>Secure authentication system</p>
                    </div>
                    <div class="feature">
                        <div class="feature-icon">📍</div>
                        <h4>Geofencing</h4>
                        <p>10m radius location tracking</p>
                    </div>
                    <div class="feature">
                        <div class="feature-icon">⚡</div>
                        <h4>Real-time</h4>
                        <p>Live updates and monitoring</p>
                    </div>
                    <div class="feature">
                        <div class="feature-icon">📱</div>
                        <h4>Mobile Ready</h4>
                        <p>Cross-platform mobile app</p>
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>📱 API Endpoints</h3>
                <ul class="api-list">
                    <li>POST /api/auth/login</li>
                    <li>POST /api/attendance/checkin</li>
                    <li>GET /api/attendance/status</li>
                    <li>GET /api/dashboard/stats</li>
                    <li>GET /health</li>
                </ul>
            </div>

            <div class="card">
                <h3>🛠️ Setup Instructions</h3>
                <ol>
                    <li>Fix npm permissions: <code>sudo chown -R $(whoami) ~/.npm</code></li>
                    <li>Install dependencies: <code>npm install</code></li>
                    <li>Set up PostgreSQL database</li>
                    <li>Run backend: <code>npm run server</code></li>
                    <li>Start dashboard: <code>npm run dev</code></li>
                    <li>Launch mobile: <code>cd mobile-app && expo start</code></li>
                </ol>
            </div>
        </div>
    </div>

    <script>
        async function testLogin() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const resultDiv = document.getElementById('loginResult');

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.className = 'status success';
                    resultDiv.innerHTML = '✅ Login successful! Welcome ' + data.data.user.name;
                } else {
                    resultDiv.className = 'status error';
                    resultDiv.innerHTML = '❌ ' + data.error;
                }
            } catch (error) {
                resultDiv.className = 'status error';
                resultDiv.innerHTML = '❌ Error: ' + error.message;
            }
        }

        async function testCheckin() {
            const latitude = parseFloat(document.getElementById('latitude').value);
            const longitude = parseFloat(document.getElementById('longitude').value);
            const notes = document.getElementById('notes').value;
            const resultDiv = document.getElementById('checkinResult');

            try {
                const response = await fetch('/api/attendance/checkin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latitude, longitude, notes })
                });
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.className = 'status success';
                    resultDiv.innerHTML = '✅ ' + data.message + ' Distance: ' + data.data.location.distance.toFixed(1) + 'm';
                } else {
                    resultDiv.className = 'status error';
                    resultDiv.innerHTML = '❌ ' + data.message;
                }
                loadStats();
            } catch (error) {
                resultDiv.className = 'status error';
                resultDiv.innerHTML = '❌ Error: ' + error.message;
            }
        }

        async function loadStats() {
            try {
                const response = await fetch('/api/dashboard/stats');
                const data = await response.json();
                
                if (data.success) {
                    document.getElementById('totalStaff').textContent = data.data.today.totalStaff;
                    document.getElementById('presentToday').textContent = data.data.today.presentToday;
                    document.getElementById('attendanceRate').textContent = data.data.today.attendanceRate + '%';
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        // Load stats on page load
        loadStats();
    </script>
</body>
</html>
    `);
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    error: 'Route not found'
  }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`
🚀 Mobile Attendance System Demo Server Started!

📍 Server running on: http://localhost:${PORT}
🌐 Demo interface: http://localhost:${PORT}/demo
🔍 Health check: http://localhost:${PORT}/health

📱 Key Features:
   ✅ JWT Authentication
   ✅ Geofencing (10m radius)
   ✅ Real-time API endpoints
   ✅ Distance calculation

🔑 Demo Credentials:
   Admin: admin@company.com / password123
   Staff: john.doe@company.com / password123

🏢 Office Location: 
   Lat: ${OFFICE_LOCATION.latitude}
   Lng: ${OFFICE_LOCATION.longitude}
   Radius: ${OFFICE_LOCATION.radius}m

📝 To test geofencing:
   1. Visit http://localhost:${PORT}/demo
   2. Try check-in with office coordinates (success)
   3. Try check-in with different coordinates (fail)

⚡ Next steps:
   1. Fix npm permissions: sudo chown -R $(whoami) ~/.npm
   2. Install dependencies: npm install
   3. Set up PostgreSQL database
   4. Run full system: npm run server
  `);
});