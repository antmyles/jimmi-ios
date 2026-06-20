# Google Sign-In Setup Guide

## What's Been Configured

✅ **Backend**: Mobile Google Sign-In endpoint added to JIMMI web app
✅ **iOS App**: Google Sign-In library installed and configured
✅ **Environment**: Google Client ID added to `.env.local`
✅ **App Config**: `app.json` updated with Google Sign-In plugin

## What You Need to Do

### Step 1: Download GoogleService-Info.plist

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (jimmi-496318)
3. Go to **APIs & Services** → **Credentials**
4. Find your iOS OAuth 2.0 credential
5. Click the download icon (⬇️) next to it
6. Save the file as `GoogleService-Info.plist`
7. Place it in the root of your iOS project: `/home/ubuntu/jimmi-ios/GoogleService-Info.plist`

### Step 2: Build and Test on Physical Device

**Important**: Google Sign-In and Apple HealthKit require a physical iOS device. Simulators have limited support.

```bash
# From /home/ubuntu/jimmi-ios/
npm start

# Then follow Expo instructions to run on your device
```

### Step 3: Test the Sign-In Flow

1. Open the JIMMI app on your iOS device
2. Tap "Sign in with Google"
3. You should be redirected to Google Sign-In
4. After signing in, you should be logged into JIMMI

## Troubleshooting

### "Google Sign-In not configured" error
- Make sure `GoogleService-Info.plist` is in the project root
- Check that the bundle ID matches: `com.jimmi.ios`

### "Invalid Client ID" error
- Verify the Client ID in `.env.local` matches Google Cloud Console
- Make sure the iOS app is registered in Google Cloud Console

### Sign-In doesn't work on simulator
- Google Sign-In requires a physical device
- Use `npm start` and run on your iPhone

### "Web client ID not configured" error
- This is expected - we're using the iOS Client ID
- The error can be safely ignored

## Files Modified

- `app.json` - Added Google Sign-In plugin
- `.env.local` - Added Google Client ID
- `src/screens/LoginScreen.tsx` - Implemented Google Sign-In button
- `package.json` - Added `@react-native-google-signin/google-signin`

## Next Steps

1. Download `GoogleService-Info.plist` from Google Cloud Console
2. Place it in `/home/ubuntu/jimmi-ios/`
3. Test on physical iOS device
4. Implement Apple Sign-In (similar process)

## Reference

- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios)
- [@react-native-google-signin/google-signin](https://github.com/react-native-google-signin/google-signin)
