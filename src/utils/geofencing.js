// Geofencing utilities for attendance system

// Office location configuration
const OFFICE_LOCATION = {
  latitude: parseFloat(process.env.OFFICE_LATITUDE) || 11.55187745723682,
  longitude: parseFloat(process.env.OFFICE_LONGITUDE) || 104.92836774000962,
  radius: parseFloat(process.env.OFFICE_RADIUS) || 10 // meters
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Check if coordinates are within office geofence
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {object} { isWithinGeofence: boolean, distance: number }
 */
const isWithinOfficeGeofence = (latitude, longitude) => {
  const distance = calculateDistance(
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
    latitude,
    longitude
  );

  return {
    isWithinGeofence: distance <= OFFICE_LOCATION.radius,
    distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
    officeLocation: OFFICE_LOCATION
  };
};

/**
 * Validate location coordinates
 * @param {number} latitude - Latitude to validate
 * @param {number} longitude - Longitude to validate
 * @returns {boolean} True if coordinates are valid
 */
const isValidCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !isNaN(latitude) &&
    !isNaN(longitude)
  );
};

/**
 * Calculate geofence buffer zone (warning zone before strict boundary)
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} bufferRadius - Additional buffer in meters (default: 5m)
 * @returns {object} Geofence status with buffer zone information
 */
const getGeofenceStatus = (latitude, longitude, bufferRadius = 5) => {
  const distance = calculateDistance(
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
    latitude,
    longitude
  );

  const roundedDistance = Math.round(distance * 100) / 100;
  const isWithinCore = distance <= OFFICE_LOCATION.radius;
  const isWithinBuffer = distance <= (OFFICE_LOCATION.radius + bufferRadius);

  let status = 'outside';
  if (isWithinCore) {
    status = 'inside';
  } else if (isWithinBuffer) {
    status = 'buffer';
  }

  return {
    status,
    distance: roundedDistance,
    isWithinCore,
    isWithinBuffer,
    coreRadius: OFFICE_LOCATION.radius,
    bufferRadius: OFFICE_LOCATION.radius + bufferRadius,
    officeLocation: OFFICE_LOCATION
  };
};

/**
 * Generate location verification hash for anti-spoofing
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} timestamp - Timestamp of the location
 * @param {string} deviceId - Device identifier
 * @returns {string} Verification hash
 */
const generateLocationHash = (latitude, longitude, timestamp, deviceId) => {
  const crypto = require('crypto');
  const secret = process.env.LOCATION_VERIFICATION_SECRET || 'default-secret';
  const data = `${latitude},${longitude},${timestamp},${deviceId}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify location hash to prevent spoofing
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} timestamp - Timestamp of the location
 * @param {string} deviceId - Device identifier
 * @param {string} hash - Hash to verify
 * @param {number} maxAge - Maximum age of timestamp in seconds (default: 300s)
 * @returns {boolean} True if hash is valid and not expired
 */
const verifyLocationHash = (latitude, longitude, timestamp, deviceId, hash, maxAge = 300) => {
  const now = Math.floor(Date.now() / 1000);
  const timestampAge = now - timestamp;

  // Check if timestamp is too old
  if (timestampAge > maxAge) {
    return false;
  }

  // Generate expected hash
  const expectedHash = generateLocationHash(latitude, longitude, timestamp, deviceId);
  
  // Compare hashes
  return expectedHash === hash;
};

/**
 * Get recommended check-in message based on location
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {object} Message and status information
 */
const getCheckInMessage = (latitude, longitude) => {
  const geofenceStatus = getGeofenceStatus(latitude, longitude);

  let message = '';
  let canCheckIn = false;
  let severity = 'info';

  switch (geofenceStatus.status) {
    case 'inside':
      message = `✅ You're inside the office (${geofenceStatus.distance}m from center). Ready to check in!`;
      canCheckIn = true;
      severity = 'success';
      break;
    case 'buffer':
      message = `⚠️ You're close to the office (${geofenceStatus.distance}m away). Move ${(geofenceStatus.distance - geofenceStatus.coreRadius).toFixed(1)}m closer to check in.`;
      canCheckIn = false;
      severity = 'warning';
      break;
    case 'outside':
      message = `❌ You're too far from the office (${geofenceStatus.distance}m away). You need to be within ${geofenceStatus.coreRadius}m to check in.`;
      canCheckIn = false;
      severity = 'error';
      break;
  }

  return {
    message,
    canCheckIn,
    severity,
    distance: geofenceStatus.distance,
    status: geofenceStatus.status
  };
};

/**
 * Calculate ETA to office based on current location
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @param {number} walkingSpeed - Walking speed in m/s (default: 1.4 m/s)
 * @returns {object} ETA information
 */
const calculateETAToOffice = (latitude, longitude, walkingSpeed = 1.4) => {
  const distance = calculateDistance(
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
    latitude,
    longitude
  );

  const timeSeconds = distance / walkingSpeed;
  const timeMinutes = Math.ceil(timeSeconds / 60);

  return {
    distance: Math.round(distance * 100) / 100,
    etaSeconds: Math.round(timeSeconds),
    etaMinutes: timeMinutes,
    walkingSpeed
  };
};

/**
 * Get office location information
 * @returns {object} Office location details
 */
const getOfficeLocation = () => {
  return {
    ...OFFICE_LOCATION,
    address: process.env.OFFICE_ADDRESS || 'Office Address Not Set',
    timezone: process.env.OFFICE_TIMEZONE || 'UTC'
  };
};

module.exports = {
  calculateDistance,
  isWithinOfficeGeofence,
  isValidCoordinates,
  getGeofenceStatus,
  generateLocationHash,
  verifyLocationHash,
  getCheckInMessage,
  calculateETAToOffice,
  getOfficeLocation,
  OFFICE_LOCATION
};