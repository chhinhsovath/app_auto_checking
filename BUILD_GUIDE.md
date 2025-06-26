# 📱 Mobile App Build Guide

## ✅ Current Configuration
- **Backend Server**: `192.168.0.113:3001` (Your local network IP)
- **Mobile App**: Ready for building with network access
- **Database**: Digital Ocean PostgreSQL

## 🚀 Building Options

### **Option 1: Expo Development Build (Recommended)**

#### For Android APK:
```bash
cd mobile-app
npx eas build --platform android --profile preview
```

#### For iOS (requires Apple Developer Account):
```bash
cd mobile-app
npx eas build --platform ios --profile preview
```

### **Option 2: Production Builds**

#### Android Production APK:
```bash
cd mobile-app
npx eas build --platform android --profile production
```

#### iOS Production:
```bash
cd mobile-app
npx eas build --platform ios --profile production
```

### **Option 3: Local Development Build**

#### Prerequisites:
- **Android**: Android Studio + SDK
- **iOS**: Xcode (macOS only)

#### Commands:
```bash
# Android
cd mobile-app
npx expo run:android

# iOS (macOS only)
cd mobile-app
npx expo run:ios
```

## 📋 Pre-Build Checklist

### ✅ Already Configured:
- [x] Network IP configured (`192.168.0.113:3001`)
- [x] App permissions (location, internet)
- [x] App icons and splash screen
- [x] Bundle identifiers
- [x] Database connection tested

### 🔧 Before Building:
1. **Expo Account**: Create free account at https://expo.dev
2. **Login**: `npx eas login`
3. **Configure Project**: `npx eas configure`

## 🌐 Network Requirements

### For Testing on Real Devices:
- Ensure your phone is on the same WiFi network as your Mac
- Server must be accessible at `192.168.0.113:3001`
- Firewall should allow connections on port 3001

### Test Network Connection:
```bash
# From your phone's browser, visit:
http://192.168.0.113:3001/health
```

## 📱 App Features Include:
- ✅ **Login System**: Database authentication
- ✅ **Geofencing**: 10-meter office radius detection  
- ✅ **Check-in/out**: Location-based attendance
- ✅ **Real-time**: Socket.io connection
- ✅ **History**: Past attendance records
- ✅ **Offline**: Basic offline functionality

## 🔐 Demo Credentials:
- **Email**: `admin@company.com`
- **Password**: `password123`

## 🏢 Office Location:
- **Latitude**: `11.55187745723682`
- **Longitude**: `104.92836774000962`
- **Radius**: `10 meters`

## 🛠️ Troubleshooting

### Common Issues:

#### 1. Network Connection Failed:
- Verify IP address: `ifconfig | grep "inet "`
- Update `mobile-app/app.json` with new IP
- Restart both server and mobile app

#### 2. Build Fails:
- Clear cache: `npx expo r -c`
- Update dependencies: `cd mobile-app && npm update`
- Check EAS status: `npx eas status`

#### 3. Location Permission:
- Enable location services in phone settings
- Grant "Allow all the time" for background tracking

## 📞 Support Commands:

### Check Running Services:
```bash
# Backend server
curl http://192.168.0.113:3001/health

# Mobile app bundler
curl http://localhost:8081

# Check processes
ps aux | grep -E "(node|expo)"
```

### Restart Everything:
```bash
# Stop all services
lsof -ti:3001,8081 | xargs kill -9

# Start backend
cd /Users/user/Documents/GitHub/app_auto_checkin
node production-server.js &

# Start mobile app
cd mobile-app
npx expo start &
```

## 🎯 Next Steps:
1. **Create Expo account**: https://expo.dev/signup
2. **Login**: `npx eas login`
3. **Build**: `npx eas build --platform android --profile preview`
4. **Download APK** from Expo dashboard
5. **Install** on Android device
6. **Test** with your network IP!