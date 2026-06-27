import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, SafeAreaView, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAppleHealth } from '../hooks/useAppleHealth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://askjimmi.com/api';

// Domains that must stay inside the WebView (auth callbacks, Stripe success, etc.)
const INTERNAL_DOMAINS = [
  'askjimmi.com',
  'www.askjimmi.com',
];

// OAuth / payment domains that must navigate inside the WebView (not opened externally)
const OAUTH_DOMAINS = [
  // Manus login portal (JIMMI sign-in)
  'manus.im',
  'api.manus.im',
  // Google (Sign-In + Google Health / Fitbit)
  'accounts.google.com',
  'oauth2.googleapis.com',
  // Oura
  'cloud.ouraring.com',
  'ouraring.com',
  // WHOOP
  'api.prod.whoop.com',
  'whoop.com',
  // Fitbit / Google Health
  'www.fitbit.com',
  'fitbit.com',
  // Stripe checkout
  'checkout.stripe.com',
  'stripe.com',
];

function isInternalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return INTERNAL_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function isOAuthUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return OAUTH_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

function shouldOpenExternally(url: string): boolean {
  // Keep internal and OAuth/payment URLs inside the WebView
  if (isInternalUrl(url)) return false;
  if (isOAuthUrl(url)) return false;
  // Open everything else (YouTube, social links, etc.) in Safari
  return true;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appleHealthConnected, setAppleHealthConnected] = useState(false);

  // Poll Apple Health connection status from the backend using the shared WebView cookie
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    let cancelled = false;

    async function checkAppleHealthStatus() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/trpc/account.appleHealthSyncStatus`,
          {
            method: 'GET',
            credentials: 'include', // sends the shared WebView session cookie automatically
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (!response.ok) return;
        const data = await response.json() as { result?: { data?: { connected?: boolean } } };
        const connected = data?.result?.data?.connected ?? false;
        if (!cancelled) {
          setAppleHealthConnected(connected);
        }
      } catch {
        // Not logged in yet or network error — keep as false
      }
    }

    // Check immediately, then every 60 seconds
    checkAppleHealthStatus();
    const interval = setInterval(checkAppleHealthStatus, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Activate HealthKit sync when connected
  useAppleHealth(appleHealthConnected);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url;
    if (!url) return true;

    if (shouldOpenExternally(url)) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    return true;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://askjimmi.com' }}
        style={styles.webView}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        sharedCookiesEnabled={true}
        userAgent="JIMMI-iOS/1.0.0"
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        allowsFullscreenVideo={true}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
});
