# Mobile Attendance System - Setup Guide

## Prerequisites

- **Node.js** (v18+ recommended)
- **PostgreSQL** (v12+ recommended)
- **npm** or **yarn**
- **Expo CLI** (for mobile app)

## Quick Start

### 1. Environment Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# Update DATABASE_URL with your PostgreSQL connection string
```

### 2. Database Setup

```bash
# Install dependencies (if npm permissions work)
npm install

# Set up database tables
npm run db:setup

# Seed with sample data
npm run db:seed
```

### 3. Start Backend Server

```bash
# Development mode with auto-reload
npm run server

# Production mode
npm start
```

The backend will run on **http://localhost:3001**

### 4. Start Admin Dashboard

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

The dashboard will be available at **http://localhost:3000**

### 5. Mobile App Setup

```bash
# Navigate to mobile app directory
cd mobile-app

# Install Expo CLI globally (if not installed)
npm install -g @expo/cli

# Install dependencies
npm install

# Start Expo development server
expo start
```

## Configuration

### Database Configuration (.env)
```env
DATABASE_URL=postgresql://username:password@localhost:5432/attendance_system
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key
OFFICE_LATITUDE=11.55187745723682
OFFICE_LONGITUDE=104.92836774000962
OFFICE_RADIUS=10
```

### Mobile App Configuration
Update `mobile-app/app.json`:
```json
{
  "expo": {
    "extra": {
      "apiUrl": "http://YOUR_IP:3001",
      "socketUrl": "http://YOUR_IP:3001"
    }
  }
}
```

## Demo Accounts

| Role  | Email | Password |
|-------|-------|----------|
| Admin | admin@company.com | password123 |
| Staff | john.doe@company.com | password123 |
| Staff | jane.smith@company.com | password123 |

## Testing the System

### 1. Backend API Test
```bash
curl http://localhost:3001/health
```

### 2. Login Test
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"password123"}'
```

### 3. Mobile App Testing
- Install Expo Go app on your phone
- Scan QR code from `expo start`
- Test location permissions and geofencing

## Troubleshooting

### Database Connection Issues
```sql
-- Create database manually if needed
CREATE DATABASE attendance_system;
CREATE USER attendance_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE attendance_system TO attendance_user;
```

### NPM Permission Issues
```bash
# Clear npm cache
npm cache clean --force

# Or use yarn instead
npm install -g yarn
yarn install
```

### Mobile App Network Issues
- Use your computer's IP address instead of localhost
- Ensure firewall allows connections on ports 3000 and 3001
- Check that mobile device is on same network

### Location Permissions
- Enable location services on mobile device
- Grant background location permission for geofencing
- Test in real location near configured office coordinates

## Development Commands

```bash
# Backend
npm run server          # Start development server
npm run db:setup        # Setup database tables
npm run db:seed         # Seed sample data
npm test               # Run tests

# Frontend
npm run dev            # Start Next.js development
npm run build          # Build for production
npm run lint           # Run linting

# Mobile App
expo start             # Start Expo development server
expo start --android   # Open in Android emulator
expo start --ios       # Open in iOS simulator
expo build:android     # Build Android APK
expo build:ios         # Build iOS IPA
```

## Production Deployment

### Backend (Railway/Heroku)
```bash
# Set environment variables
heroku config:set DATABASE_URL=your_postgres_url
heroku config:set JWT_SECRET=your_jwt_secret

# Deploy
git push heroku main
```

### Frontend (Vercel)
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
```

### Mobile App (Expo Application Services)
```bash
# Build for app stores
eas build --platform all

# Submit to app stores
eas submit --platform all
```

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │  Admin Dashboard │    │  Backend Server │
│  (React Native)│◄──►│    (Next.js)    │◄──►│   (Node.js)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                          ┌─────────────────┐
                          │   PostgreSQL    │
                          │    Database     │
                          └─────────────────┘
```

## Features Checklist

- ✅ JWT Authentication with refresh tokens
- ✅ Geofencing with 10m office radius
- ✅ Real-time Socket.IO communication
- ✅ Background location tracking
- ✅ Admin dashboard with analytics
- ✅ Staff management (CRUD)
- ✅ Attendance history and reports
- ✅ Push notifications
- ✅ Offline capability
- ✅ Export functionality (CSV)
- ✅ Responsive design
- ✅ TypeScript support
- ✅ Security best practices

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Verify environment variables are set correctly
3. Ensure database is running and accessible
4. Check network connectivity between components