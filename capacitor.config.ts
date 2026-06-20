import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.askjimmi.app",
  appName: "JIMMI",
  webDir: "client/dist",
  server: {
    // Live URL mode: the native shell loads askjimmi.com directly.
    // This means web updates deploy instantly without rebuilding the Xcode project.
    // Only comment this out if you need a fully offline/bundled build.
    url: "https://askjimmi.com",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#000000",
    preferredContentMode: "mobile",
    // Privacy usage descriptions — required by Apple or the app crashes on first use
    NSCameraUsageDescription:
      "JIMMI uses your camera to scan food product barcodes for instant nutrition lookup.",
    NSMicrophoneUsageDescription:
      "JIMMI uses your microphone to hear your voice commands so you can log food and workouts hands-free.",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    BarcodeScanner: {
      // MLKit barcode scanning plugin config
    },
    SpeechRecognition: {
      // Speech recognition plugin config
    },
  },
};

export default config;
