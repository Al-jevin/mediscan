import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import { MenuProvider } from '@/components/MenuContext';
import AddMenu from '@/components/AddMenu';
import LogoutDialog from '@/components/LogoutDialog';
import HamburgerMenu from '@/components/HamburgerMenu';
import { ProfileProvider } from '../context/ProfileContext';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ensureApiBaseUrlDiscovered } from '@/services/apiUrl';

function NotificationRuntime() {
  usePushNotifications();
  return null;
}

function ApiDiscoveryRuntime() {
  useEffect(() => {
    void ensureApiBaseUrlDiscovered().catch((error: unknown) => {
      console.warn('[MediScan API] Discovery failed:', error);
    });
  }, []);
  return null;
}

function ThemedStatusBar() {
  const { colorScheme } = useAppTheme();
  return <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
      <MenuProvider>
        <ProfileProvider>
          <ThemedStatusBar />
          <ApiDiscoveryRuntime />
          <NotificationRuntime />
          <Stack screenOptions={{ headerShown: false }}>
            {/* Main app (bottom bar + top bar) */}
            <Stack.Screen name="(tabs)" />

            {/* Opened from the hamburger menu (back arrow returns to the menu) */}
            <Stack.Screen
              name="profile"
              options={{ headerShown: true, header: () => <AppHeader title="Profile" back backToMenu /> }}
            />

            {/* Full screens with a back arrow (no bottom bar) */}
            <Stack.Screen
              name="notifications"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="manual-entry"
              options={{ headerShown: true, header: () => <AppHeader title="Manual Entry" back /> }}
            />
            <Stack.Screen
              name="result"
              options={{ headerShown: true, header: () => <AppHeader title="Scan Result" back /> }}
            />
            <Stack.Screen
              name="edit-medicine"
              options={{ headerShown: true, header: () => <AppHeader title="Edit Medicine" back /> }}
            />

            {/* Sign-in flow (no header, no bottom bar) */}
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="verify-code" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="choose-profile" />
            <Stack.Screen name="create-profile" />

            {/* Bottom sheets: slide up over the screen behind them */}
            <Stack.Screen
              name="vault-filters"
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
            />
          </Stack>

          {/* Popups that sit on top of everything */}
          <HamburgerMenu />
          <AddMenu />
          <LogoutDialog />
        </ProfileProvider>
      </MenuProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}