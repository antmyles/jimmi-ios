# JIMMI iOS App - Setup & Testing Guide

This guide covers setting up the iOS companion app for JIMMI Fit Recovery and testing it in the Xcode simulator.

## Prerequisites

- **Xcode 15+** (download from App Store or [developer.apple.com](https://developer.apple.com))
- **Node.js 18+** and **npm/pnpm**
- **Expo CLI**: `npm install -g expo-cli`
- **CocoaPods** (for native dependencies): `sudo gem install cocoapods`

## Project Structure

```
jimmi-ios/
├── src/
│   ├── screens/           # App screens (Auth, Chat, Health Dashboard)
│   ├── services/          # Business logic (Auth, Health, Sync)
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Zustand state management
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Root app component
├── app.json               # Expo configuration
├── package.json           # Dependencies
└── eas.json               # EAS Build configuration
```

## Installation

1. **Navigate to the iOS project directory:**
   ```bash
   cd /home/ubuntu/jimmi-ios
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Install native dependencies (if using native modules):**
   ```bash
   cd ios
   pod install
   cd ..
   ```

## Running in Xcode Simulator

### Method 1: Using Expo CLI (Recommended for Development)

1. **Start the Expo dev server:**
   ```bash
   npm start
   # or
   pnpm start
   ```

2. **In the terminal, press `i` to launch iOS simulator:**
   ```
   Press i to open iOS simulator
   ```

3. **The app will build and launch in the simulator.**

### Method 2: Using Xcode Directly

1. **Open the iOS project in Xcode:**
   ```bash
   open ios/jimmiios.xcworkspace
   ```

2. **Select a simulator device** (e.g., iPhone 15):
   - Top menu: Product → Destination → Choose simulator

3. **Build and run:**
   - Press `Cmd + R` or Product → Run

## Testing Authentication

### Google Sign-In (iOS Simulator)

1. **In the simulator, tap "Sign in with Google"**
2. **You'll be redirected to a web view** with the Google OAuth flow
3. **Use test credentials** (or your actual Google account)
4. **After authentication, you'll be redirected back to the app**

**Note:** Google Sign-In requires proper configuration:
- `GoogleService-Info.plist` must be in the iOS project
- Google OAuth Client ID must match the one in `app.json`

### Apple Sign-In (iOS Simulator)

1. **Tap "Sign in with Apple"**
2. **The simulator will show the Apple Sign-In dialog**
3. **Select or create a test iCloud account**
4. **After authentication, you'll be logged in**

**Note:** Apple Sign-In works in the simulator with a valid Apple ID.

## Testing Health Data Integration

### HealthKit Simulator Limitations

**Important:** HealthKit is **not available in the iOS simulator**. You must:
- Test on a **physical iOS device** for real HealthKit data
- Use mock data for simulator testing (see below)

### Mock Health Data for Simulator Testing

The `healthKitService.ts` currently returns empty arrays. To test with mock data:

1. **Create a mock data file** at `src/services/mockHealthData.ts`:
   ```typescript
   export const mockWorkouts = [
     {
       id: 'workout-1',
       date: new Date(Date.now() - 86400000),
       type: 'running',
       duration: 30,
       calories: 350,
       distance: 5,
     },
   ];
   ```

2. **Update `healthKitService.ts`** to return mock data in development:
   ```typescript
   async fetchWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
     if (__DEV__) {
       return mockWorkouts;
     }
     // ... real HealthKit code
   }
   ```

### Testing Health Dashboard

1. **After logging in, navigate to the Health Dashboard**
2. **Pull down to refresh** and trigger a sync
3. **Watch the console** for sync logs:
   ```
   [HealthSync] Fetching health data from HealthKit...
   [HealthSync] Synced: 0 workouts, 0 step records...
   ```

## Backend Connection

### Configure API Endpoint

The app connects to the backend at `http://localhost:3000/api/trpc` by default.

To change the endpoint, edit `.env.local`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api
```

**For simulator to reach localhost:**
- Use `http://localhost:3000` (simulator has direct access to host machine)
- Or use your machine's IP address: `http://192.168.1.X:3000`

### Verify Backend Connection

1. **Start the web backend** (if not already running):
   ```bash
   cd /home/ubuntu/jimmi-fit-recovery
   pnpm run dev
   ```

2. **In the iOS app, check the console** for API calls:
   ```
   [HealthSync] Syncing to backend...
   POST /api/trpc/health.syncWorkouts
   ```

## Debugging

### Console Logs

View console logs in Xcode:
1. Open Xcode
2. View → Debug Area → Show Console (Cmd + Shift + C)

Or in Expo CLI:
- Logs appear directly in the terminal where you ran `npm start`

### Network Requests

Monitor network requests:
1. **In Xcode:** Debug → View Memory Graph
2. **Or use React Native Debugger:**
   ```bash
   npm install -g react-native-debugger
   react-native-debugger
   ```

### Hot Reload

Changes to TypeScript/JavaScript files automatically reload:
- Press `r` in the Expo CLI terminal to reload
- Press `d` to open the developer menu

## Testing Checklist

- [ ] App launches without errors
- [ ] Google Sign-In flow completes
- [ ] Apple Sign-In flow completes (if testing on device)
- [ ] User data persists after app restart
- [ ] Health Dashboard loads without errors
- [ ] Pull-to-refresh triggers a sync
- [ ] Console shows successful API calls
- [ ] No TypeScript errors in Xcode

## Physical Device Testing

To test on a real iPhone:

1. **Connect iPhone via USB**
2. **In Xcode:** Window → Devices and Simulators → Select your device
3. **Run the app:** Product → Run (Cmd + R)
4. **Trust the developer certificate** on your iPhone

**For HealthKit testing:**
- Real device required (HealthKit not available in simulator)
- App will request HealthKit permissions on first launch
- Grant permissions to see real workout/step/sleep data

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
# or
pnpm install
```

### Pod installation fails
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Simulator won't start
```bash
# Reset simulator
xcrun simctl erase all
# Or restart Xcode
```

### Backend connection fails
- Verify backend is running: `curl http://localhost:3000`
- Check API URL in `.env.local`
- Check firewall settings

### Google Sign-In not working
- Verify `GoogleService-Info.plist` exists in iOS project
- Check Client ID matches configuration
- Ensure redirect URI is correct

## Next Steps

1. **Physical Device Testing:** Once Xcode is set up, test on a real iPhone for HealthKit access
2. **HealthKit Integration:** Implement actual HealthKit queries when ready
3. **Background Sync:** Set up background task for periodic health data sync
4. **Offline Support:** Implement local caching for offline access

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [HealthKit Documentation](https://developer.apple.com/healthkit)
- [Xcode Help](https://help.apple.com/xcode)
