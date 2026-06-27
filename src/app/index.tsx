import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, SafeAreaView, Linking } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Intercept YouTube links — open in Safari (in-app browser ) instead of YouTube app
  const handleNavigationChange = useCallback((navState: WebViewNavigation) => {
    const url = navState.url;
    if (url && url !== 'https://askjimmi.com' && !url.startsWith('https://askjimmi.com' )) {
      // External link — open in Safari and stay on askjimmi.com
      webViewRef.current?.stopLoading();
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
        onLoadStart={( ) => setIsLoading(true)}
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
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url;
          if (url && url !== 'https://askjimmi.com' && !url.startsWith('https://askjimmi.com' )) {
            Linking.openURL(url).catch(() => {});
            return false;
          }
          return true;
        }}
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
