import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import 'react-native-reanimated';

const CLOUD_BAP_URL = (
  process.env.EXPO_PUBLIC_ONDC_BAP_URL ||
  'https://faresnap-ondc-bap-gateway.onrender.com'
).replace(/\/$/, '');

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Pre-warm Render cloud backend immediately on app launch & foregrounding
  // so it is already awake before the user reaches the Compare Rides screen.
  useEffect(() => {
    const pingCloudBackend = () => {
      fetch(`${CLOUD_BAP_URL}/health`).catch(() => {});
    };
    pingCloudBackend();

    const interval = setInterval(pingCloudBackend, 9 * 60 * 1000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        pingCloudBackend();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
          headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="plugins" options={{ title: 'Connect Ride Plugins', headerRight: () => null }} />
        <Stack.Screen name="location" options={{ title: 'Enter Location', headerRight: () => null }} />
        <Stack.Screen name="results" options={{ title: 'Available Rides', headerRight: () => null }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}