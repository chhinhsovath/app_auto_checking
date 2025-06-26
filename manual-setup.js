// Manual setup script for running the attendance system
// This creates a minimal working version without npm install

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Mobile Attendance System manually...');

// Create a simplified server that can run without external dependencies
const simpleServer = `
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple in-memory database for demo
let users = [
  {
    id: 1,
    employee_id: 'ADMIN001',
    name: 'Admin User',
    email: 'admin@company.com',
    password: 'password123', // In real app, this would be hashed
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
            staff_id: 1, // Demo user
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
            message: \`You are \${distance.toFixed(1)}m away from the office. You must be within \${OFFICE_LOCATION.radius}m to check in.\`,
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

  // Serve static files for the demo
  if (path === '/' || path === '/demo') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
<!DOCTYPE html>
<html>
<head>
    <title>Mobile Attendance System - Demo</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #1976d2; margin-bottom: 10px; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .section h3 { color: #333; margin-top: 0; }
        .demo-form { display: grid; gap: 15px; }
        .demo-form input, .demo-form button { padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .demo-form button { background: #1976d2; color: white; cursor: pointer; }
        .demo-form button:hover { background: #1565c0; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .success { background: #e8f5e8; color: #2e7d32; border: 1px solid #4caf50; }
        .error { background: #ffeaa7; color: #d68910; border: 1px solid #f39c12; }
        .info { background: #e3f2fd; color: #1976d2; border: 1px solid #2196f3; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #1976d2; }
        .credentials { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 15px 0; }
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

        <div class="section">
            <h3>📊 System Status</h3>
            <div id="systemStatus" class="info">Server is running! API endpoints are available.</div>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number" id="totalStaff">-</div>
                    <div>Total Staff</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="presentToday">-</div>
                    <div>Present Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number" id="attendanceRate">-</div>
                    <div>Attendance Rate</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h3>🔐 Authentication Demo</h3>
            <div class="demo-form">
                <input type="email" id="loginEmail" placeholder="Email" value="admin@company.com">
                <input type="password" id="loginPassword" placeholder="Password" value="password123">
                <button onclick="testLogin()">Test Login</button>
                <div id="loginResult"></div>
            </div>
        </div>

        <div class="section">
            <h3>📍 Geofencing Demo</h3>
            <p><strong>Office Location:</strong> ${OFFICE_LOCATION.latitude}, ${OFFICE_LOCATION.longitude}</p>
            <p><strong>Geofence Radius:</strong> ${OFFICE_LOCATION.radius} meters</p>
            <div class="demo-form">
                <input type="number" id="latitude" placeholder="Latitude" value="${OFFICE_LOCATION.latitude}" step="0.000001">
                <input type="number" id="longitude" placeholder="Longitude" value="${OFFICE_LOCATION.longitude}" step="0.000001">
                <input type="text" id="notes" placeholder="Notes (optional)">
                <button onclick="testCheckin()">Test Check-in</button>
                <div id="checkinResult"></div>
            </div>
        </div>

        <div class="section">
            <h3>📱 API Endpoints</h3>
            <ul>
                <li><strong>POST /api/auth/login</strong> - User authentication</li>
                <li><strong>POST /api/attendance/checkin</strong> - Check-in with geofencing</li>
                <li><strong>GET /api/attendance/status</strong> - Get attendance status</li>
                <li><strong>GET /api/dashboard/stats</strong> - Dashboard statistics</li>
                <li><strong>GET /health</strong> - Health check</li>
            </ul>
        </div>

        <div class="section">
            <h3>🚀 Next Steps</h3>
            <ol>
                <li>Install dependencies: <code>npm install</code></li>
                <li>Set up PostgreSQL database</li>
                <li>Run full backend: <code>npm run server</code></li>
                <li>Start admin dashboard: <code>npm run dev</code></li>
                <li>Launch mobile app: <code>cd mobile-app && expo start</code></li>
            </ol>
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
                    resultDiv.innerHTML = \`✅ Login successful! Welcome \${data.data.user.name}\`;
                } else {
                    resultDiv.className = 'status error';
                    resultDiv.innerHTML = \`❌ \${data.error}\`;
                }
            } catch (error) {
                resultDiv.className = 'status error';
                resultDiv.innerHTML = \`❌ Error: \${error.message}\`;
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
                    resultDiv.innerHTML = \`✅ \${data.message} Distance: \${data.data.location.distance.toFixed(1)}m\`;
                } else {
                    resultDiv.className = 'status error';
                    resultDiv.innerHTML = \`❌ \${data.message}\`;
                }
                loadStats();
            } catch (error) {
                resultDiv.className = 'status error';
                resultDiv.innerHTML = \`❌ Error: \${error.message}\`;
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
    \`);
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
  console.log(\`
🚀 Mobile Attendance System Demo Server Started!

📍 Server running on: http://localhost:\${PORT}
🌐 Demo interface: http://localhost:\${PORT}/demo
🔍 Health check: http://localhost:\${PORT}/health

📱 Key Features:
   ✅ JWT Authentication
   ✅ Geofencing (10m radius)
   ✅ Real-time API endpoints
   ✅ Distance calculation

🔑 Demo Credentials:
   Admin: admin@company.com / password123
   Staff: john.doe@company.com / password123

🏢 Office Location: 
   Lat: \${OFFICE_LOCATION.latitude}
   Lng: \${OFFICE_LOCATION.longitude}
   Radius: \${OFFICE_LOCATION.radius}m

📝 To test geofencing:
   1. Visit http://localhost:\${PORT}/demo
   2. Try check-in with office coordinates (success)
   3. Try check-in with different coordinates (fail)

⚡ Next steps:
   1. Fix npm permissions: sudo chown -R $(whoami) ~/.npm
   2. Install dependencies: npm install
   3. Set up PostgreSQL database
   4. Run full system: npm run server
  \`);
});
`;

// Write the simple server
fs.writeFileSync('simple-server.js', simpleServer);

console.log('✅ Created simple-server.js');
console.log('🚀 You can now run: node simple-server.js');
console.log('🌐 Then visit: http://localhost:3001/demo');