# 📱 Simple Mobile App Build Guide

## 🚀 **3 Easy Build Options**

### **Option 1: Online EAS Build (Recommended - No Setup Required)**

#### Step 1: Create Free Expo Account
1. Go to https://expo.dev/signup
2. Create account with email/password
3. Remember your credentials

#### Step 2: Login and Build
```bash
cd mobile-app

# Login to Expo (you'll be prompted for email/password)
npx eas-cli login

# Configure the project (run once)
npx eas-cli configure

# Build Android APK (takes 5-10 minutes)
npx eas-cli build --platform android --profile preview
```

#### Step 3: Download APK
- EAS will provide a download link
- Install the APK on your Android device
- App will connect to `192.168.0.113:3001`

---

### **Option 2: Expo Go Development (Quick Test)**

#### For Quick Testing (No Building Required):
1. **Install Expo Go** on your phone:
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Start Development Server**:
```bash
cd mobile-app
npx expo start
```

3. **Connect Your Phone**:
   - Open browser: http://localhost:8081
   - Scan QR code with Expo Go
   - App connects to your local server!

---

### **Option 3: Web Version (Browser Testing)**

#### Test in Browser:
```bash
cd mobile-app
npx expo start --web
```
- Opens at: http://localhost:8081
- Test all features except location services
- Good for UI testing

---

## 🔧 **Quick Setup Commands**

### Start Everything:
```bash
# Terminal 1: Start Backend
cd /Users/user/Documents/GitHub/app_auto_checkin
node production-server.js

# Terminal 2: Start Mobile App  
cd mobile-app
npx expo start
```

### Test Network Access:
```bash
# Test from your phone browser
curl http://192.168.0.113:3001/health

# Should return server status
```

---

## ⚡ **Fastest Option: Expo Go**

**For immediate testing without building:**

1. **Install Expo Go** on your phone
2. **Run**: `cd mobile-app && npx expo start`
3. **Scan QR code** from http://localhost:8081
4. **Login** with: `admin@company.com` / `password123`
5. **Test check-in** (location services will prompt)

---

## 🛠️ **If You Want a Real APK File**

### Easy EAS Build:
```bash
cd mobile-app

# One-time setup
npx eas-cli login
npx eas-cli configure

# Build APK (takes 5-10 minutes online)
npx eas-cli build --platform android --profile preview

# Download link will be provided
```

### Alternative: Local Android Studio Setup
If you prefer local building:
1. Install Android Studio
2. Set up Android SDK
3. Run: `npx expo run:android`

---

## 📋 **Current Configuration**

✅ **Backend**: `192.168.0.113:3001` (network accessible)  
✅ **Mobile App**: Ready with network IP  
✅ **Database**: Digital Ocean PostgreSQL connected  
✅ **Features**: Login, geofencing, check-in/out, real-time updates  

---

## 🎯 **Recommended Steps:**

1. **Quick Test**: Use Expo Go (5 minutes)
2. **Real APK**: Use EAS build (15 minutes total)
3. **Production**: Test with real location at office

**Demo Credentials:**
- Email: `admin@company.com`
- Password: `password123`

The app will automatically connect to your server at `192.168.0.113:3001`! 📱