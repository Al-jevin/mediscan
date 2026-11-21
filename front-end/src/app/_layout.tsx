import '@/services/appSettings';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import { MenuProvider } from '@/components/MenuContext';
import AddMenu from '@/components/AddMenu';
import LogoutDialog from '@/components/LogoutDialog';
import HamburgerMenu from '@/components/HamburgerMenu';
import AppToast from '@/components/AppToast';
import { ProfileProvider } from '../context/ProfileContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
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

function RootLayoutContent() {
  const { colors, isDark } = useDisplayTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <MenuProvider>
          <ProfileProvider>
            <ApiDiscoveryRuntime />
            <NotificationRuntime />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />

              <Stack.Screen
                name="profile"
                options={{
                  headerShown: true,
                  header: () => <AppHeader title="Profile" back backToMenu />,
                }}
              />

              <Stack.Screen name="upcoming-alerts" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ headerShown: false }} />
              <Stack.Screen
                name="manual-entry"
                options={{
                  headerShown: true,
                  header: () => <AppHeader title="Manual Entry" back />,
                }}
              />
              <Stack.Screen
                name="result"
                options={{
                  headerShown: true,
                  header: () => <AppHeader title="Scan Result" back />,
                }}
              />
              <Stack.Screen
                name="edit-medicine"
                options={{
                  headerShown: true,
                  header: () => <AppHeader title="Edit Medicine" back />,
                }}
              />

              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="forgot-password" />
              <Stack.Screen name="verify-code" />
              <Stack.Screen name="choose-profile" />
              <Stack.Screen name="create-profile" />

              <Stack.Screen
                name="vault-filters"
                options={{
                  presentation: 'transparentModal',
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>

            <HamburgerMenu />
            <AddMenu />
            <LogoutDialog />
            <AppToast />
          </ProfileProvider>
        </MenuProvider>
      </KeyboardProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
