const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.authenticatedSockets = new Map(); // socketId -> user data
  }

  initialize(io) {
    this.io = io;
    
    // Socket authentication middleware
    io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify user exists and is active
        const result = await query(
          'SELECT id, employee_id, name, email, department, position FROM staff WHERE id = $1 AND is_active = true',
          [decoded.id]
        );

        if (result.rows.length === 0) {
          return next(new Error('User not found or inactive'));
        }

        socket.user = result.rows[0];
        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });

    io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('Socket.IO service initialized');
  }

  handleConnection(socket) {
    const user = socket.user;
    console.log(`User connected: ${user.name} (${user.employee_id})`);

    // Store user connection
    this.connectedUsers.set(user.id, socket.id);
    this.authenticatedSockets.set(socket.id, user);

    // Join user to their personal room
    socket.join(`user_${user.id}`);
    
    // Join admin room if user is admin
    if (user.position && user.position.toLowerCase().includes('admin')) {
      socket.join('admin_room');
    }

    // Send welcome message
    socket.emit('connection_success', {
      message: `Welcome ${user.name}!`,
      user: user,
      timestamp: new Date().toISOString()
    });

    // Broadcast user online status to admins
    socket.to('admin_room').emit('user_status', {
      type: 'user_online',
      user: {
        id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        department: user.department
      },
      timestamp: new Date().toISOString()
    });

    // Handle location updates
    socket.on('location_update', (data) => {
      this.handleLocationUpdate(socket, data);
    });

    // Handle attendance events
    socket.on('attendance_event', (data) => {
      this.handleAttendanceEvent(socket, data);
    });

    // Handle admin requests
    socket.on('admin_request', (data) => {
      this.handleAdminRequest(socket, data);
    });

    // Handle ping/pong for connection health
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback('pong');
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });
  }

  handleLocationUpdate(socket, data) {
    const user = socket.user;
    
    // Validate location data
    if (!data.latitude || !data.longitude) {
      socket.emit('error', { message: 'Invalid location data' });
      return;
    }

    const locationData = {
      user: {
        id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        department: user.department
      },
      location: {
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
        timestamp: data.timestamp || new Date().toISOString()
      },
      geofence: data.geofence
    };

    // Broadcast location to admin room for real-time tracking
    socket.to('admin_room').emit('staff_location_update', locationData);

    // Acknowledge location update
    socket.emit('location_update_ack', {
      success: true,
      timestamp: new Date().toISOString()
    });
  }

  handleAttendanceEvent(socket, data) {
    const user = socket.user;
    
    const attendanceData = {
      user: {
        id: user.id,
        name: user.name,
        employee_id: user.employee_id,
        department: user.department
      },
      event: data.event, // 'check_in', 'check_out'
      timestamp: data.timestamp || new Date().toISOString(),
      location: data.location,
      details: data.details
    };

    // Broadcast to admin room
    socket.to('admin_room').emit('attendance_event', attendanceData);

    // Send notification to user
    socket.emit('attendance_notification', {
      message: data.event === 'check_in' ? 'Check-in successful!' : 'Check-out successful!',
      type: 'success',
      timestamp: new Date().toISOString()
    });
  }

  handleAdminRequest(socket, data) {
    const user = socket.user;
    
    // Verify admin privileges
    if (!user.position || !user.position.toLowerCase().includes('admin')) {
      socket.emit('error', { message: 'Admin privileges required' });
      return;
    }

    switch (data.type) {
      case 'get_online_users':
        this.sendOnlineUsers(socket);
        break;
      case 'send_notification':
        this.sendNotificationToUser(data.targetUserId, data.notification);
        break;
      case 'broadcast_announcement':
        this.broadcastAnnouncement(data.announcement);
        break;
      default:
        socket.emit('error', { message: 'Unknown admin request type' });
    }
  }

  handleDisconnection(socket, reason) {
    const user = this.authenticatedSockets.get(socket.id);
    
    if (user) {
      console.log(`User disconnected: ${user.name} (${user.employee_id}) - ${reason}`);
      
      // Remove from connected users
      this.connectedUsers.delete(user.id);
      this.authenticatedSockets.delete(socket.id);

      // Broadcast user offline status to admins
      socket.to('admin_room').emit('user_status', {
        type: 'user_offline',
        user: {
          id: user.id,
          name: user.name,
          employee_id: user.employee_id,
          department: user.department
        },
        reason: reason,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Public methods for external use

  sendNotificationToUser(userId, notification) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  broadcastAnnouncement(announcement) {
    this.io.emit('announcement', {
      ...announcement,
      timestamp: new Date().toISOString()
    });
  }

  sendToAdmins(event, data) {
    this.io.to('admin_room').emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  sendOnlineUsers(socket) {
    const onlineUsers = Array.from(this.authenticatedSockets.values()).map(user => ({
      id: user.id,
      name: user.name,
      employee_id: user.employee_id,
      department: user.department
    }));

    socket.emit('online_users', {
      users: onlineUsers,
      count: onlineUsers.length,
      timestamp: new Date().toISOString()
    });
  }

  getOnlineUserCount() {
    return this.connectedUsers.size;
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Method to send real-time attendance updates
  notifyAttendanceUpdate(attendanceData) {
    this.sendToAdmins('attendance_update', {
      type: 'attendance_change',
      data: attendanceData
    });
  }

  // Method to send system alerts
  sendSystemAlert(alert) {
    this.io.emit('system_alert', {
      ...alert,
      timestamp: new Date().toISOString()
    });
  }
}

// Create singleton instance
const socketService = new SocketService();

module.exports = socketService;