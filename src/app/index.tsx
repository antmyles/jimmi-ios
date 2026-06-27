import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { useAuthStore } from '@/hooks/useAuthStore';

export default function Home() {
  const { user, token } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Give the auth store a moment to load persisted data
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // If user is authenticated, show HomeScreen
  if (user && token) {
    return <HomeScreen />;
  }

  // Otherwise show LoginScreen
  return <LoginScreen />;
}
