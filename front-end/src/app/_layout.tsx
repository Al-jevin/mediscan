import '@/services/appSettings';

import { Stack } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppHeader from '@/components/AppHeader';
import { MenuProvider } from '@/components/MenuContext';
import AddMenu from '@/components/AddMenu';
import LogoutDialog from '@/components/LogoutDialog';
import HamburgerMenu from '@/components/HamburgerMenu';
import { ProfileProvider } from '../context/ProfileContext';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function RootLayout() {
  const { isDark, colors } = useAppTheme();

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.actionPrimary,
      background: colors.surfacePrimary,
      card: colors.surfaceSecondary,
      text: colors.textPrimary,
      border: colors.borderDefault,
      notification: colors.statusDanger,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        <MenuProvider>
          <ProfileProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: colors.surfacePrimary,
                },
              }}
            >
              {/* Main app (bottom bar + top bar) */}
              <Stack.Screen name="(tabs)" />

              {/* Opened from the hamburger menu */}
              <Stack.Screen
                name="profile"
                options={{
                  headerShown: true,
                  header: () => (
                    <AppHeader
                      title="Profile"
                      back
                      backToMenu
                    />
                  ),
                }}
              />

              {/* Full screens with a back arrow */}
              <Stack.Screen
                name="notifications"
                options={{ headerShown: false }}
              />

              <Stack.Screen
                name="manual-entry"
                options={{
                  headerShown: true,
                  header: () => (
                    <AppHeader
                      title="Manual Entry"
                      back
                    />
                  ),
                }}
              />

              <Stack.Screen
                name="result"
                options={{
                  headerShown: true,
                  header: () => (
                    <AppHeader
                      title="Scan Result"
                      back
                    />
                  ),
                }}
              />

              <Stack.Screen
                name="edit-medicine"
                options={{
                  headerShown: true,
                  header: () => (
                    <AppHeader
                      title="Edit Medicine"
                      back
                    />
                  ),
                }}
              />

              {/* Sign-in flow */}
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="verify-code" />
              <Stack.Screen name="choose-profile" />
              <Stack.Screen name="create-profile" />

              {/* Bottom sheets */}
              <Stack.Screen
                name="vault-filters"
                options={{
                  presentation: 'transparentModal',
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>

            {/* Popups that sit on top of everything */}
            <HamburgerMenu />
            <AddMenu />
            <LogoutDialog />
          </ProfileProvider>
        </MenuProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
