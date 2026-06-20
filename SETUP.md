# JIMMI iOS App - Setup Guide

This is a React Native + Expo companion app for JIMMI that syncs Apple Health data (workouts, steps, sleep, calories) with the web backend.

## Project Structure

```
src/
├── services/          # API and health data services
│   ├── authService.ts     # Authentication (Google, Apple, Email)
│   └── healthService.ts   # Apple HealthKit integration
├── hooks/             # Custom React hooks
│   └── useAuthStore.ts    # Zustand auth state management
├── types/             # TypeScript type definitions
├── screens/           # Screen components
├── components/        # Reusable UI components
└── utils/             # Utility functions
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ and npm
- Xcode 15+ (for iOS development)
- Apple Developer Account (for HealthKit permissions)
- Google Cloud Project (for Google Sign-In)

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
EXPO_PUBLIC_API_URL=https://askjimmi.com/api
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
EXPO_PUBLIC_APPLE_SERVICE_ID=com.jimmi.ios
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Apple Health Permissions

The app requires HealthKit permissions. These are configured in `app.json`:

```json
"ios": {
  "bundleIdentifier": "com.jimmi.ios",
  "infoPlist": {
    "NSHealthShareUsageDescription": "JIMMI needs access to your Apple Health data...",
    "NSHealthUpdateUsageDescription": "JIMMI needs permission to save your workouts..."
  }
}
```

### 5. Configure Google Sign-In

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Sign-In API
4. Create OAuth 2.0 credentials (iOS)
5. Add your app's bundle ID: `com.jimmi.ios`
6. Get the Client ID and add to `.env.local`

### 6. Run the App

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on web (for testing)
npm run web
```

## Architecture

### Authentication Flow

1. **Google Sign-In**: Users can sign in with their Google account
2. **Apple Sign-In**: Users can sign in with Apple ID
3. **Email/Password**: Users can create account with email

All auth methods sync with the JIMMI web backend.

### Health Data Sync

1. **Request Permissions**: App requests HealthKit access
2. **Fetch Data**: Reads workouts, steps, sleep, calories from HealthKit
3. **Sync to Backend**: Sends data to JIMMI backend API
4. **Store Locally**: Caches data for offline access
5. **Background Sync**: Periodically syncs new data

### State Management

- **Authentication**: Zustand store (`useAuthStore`)
- **Health Data**: Local AsyncStorage + backend sync
- **UI State**: React component state

## API Endpoints Required

The iOS app expects these endpoints on the backend:

```
POST /api/auth/google-signin-mobile
POST /api/auth/apple-signin-mobile
POST /api/auth/login
POST /api/auth/signup
POST /api/health/sync
GET  /api/health/workouts
GET  /api/health/steps
GET  /api/health/sleep
GET  /api/health/calories
```

## Next Steps

1. **Phase 2**: Implement authentication screens and Google/Apple Sign-In
2. **Phase 3**: Implement HealthKit data fetching
3. **Phase 4**: Add backend API endpoints for health data
4. **Phase 5**: Implement data sync and persistence
5. **Phase 6**: Build UI screens
6. **Phase 7**: Prepare for App Store submission

## Troubleshooting

### HealthKit Permissions Not Showing

- Ensure `app.json` has correct `NSHealthShareUsageDescription`
- Run on physical device (simulator has limited HealthKit support)
- Check iOS version (HealthKit requires iOS 8+)

### Google Sign-In Not Working

- Verify bundle ID matches Google Cloud Console
- Check that Google Sign-In API is enabled
- Ensure Client ID is in `.env.local`

### API Connection Issues

- Verify `EXPO_PUBLIC_API_URL` is correct
- Check backend is running and accessible
- Ensure CORS is configured on backend

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [HealthKit Documentation](https://developer.apple.com/healthkit/)
- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios)
