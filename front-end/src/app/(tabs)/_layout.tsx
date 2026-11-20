import AddTabButton from '@/components/AddTabButton';
import AppHeader from '@/components/AppHeader';
import ReminderIcon from '@/components/ReminderIcon';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { Ionicons } from '@expo/vector-icons';
import { MockAuth } from '@/mock/mockAuth';
import { Redirect, Tabs } from 'expo-router';

// ito yung tab bar layout na ginagamit sa buong app. It defines the bottom bar tabs, their icons, and the header for each screen.
const icons = {
  home: (c: any) => <Ionicons name="home-outline" size={24} color={c} />,
  vault: (c: any) => <Ionicons name="shield-outline" size={24} color={c} />,
  add: (c: any) => <Ionicons name="add" size={24} color={c} />,
  reminders: (c: any) => <ReminderIcon size={24} color={c} />,
  profiles: (c: any) => <Ionicons name="person-outline" size={24} color={c} />,
};

// Header title per tab. You can add/remove tabs here when updating the UI.
const tab = (title: string, icon: (c: any) => any, showLogo = false) => ({
  title,
  header: () => <AppHeader title={title} showLogo={showLogo} />,
  tabBarIcon: ({ color }: { color: any }) => icon(color),
});

export default function TabsLayout() {
  const { colors } = useDisplayTheme();
  // Not signed in → Log In. Signed in but no profile picked yet → Choose / Create Profile.
  // (Previously any missing active profile sent users to /login, which bounced new accounts
  // right after they tapped "Create Profile".)
  if (!MockAuth.isLoggedIn()) return <Redirect href="/login" />;
  if (!MockAuth.getActiveProfile()) return <Redirect href="/choose-profile" />;
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.text,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 64,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      {/* Bottom bar */}
      <Tabs.Screen name="index" options={{ ...tab('MediScan', icons.home, true), tabBarLabel: 'Home' }} />
      <Tabs.Screen name="vault" options={{ ...tab('Medicine Vault', icons.vault), tabBarLabel: 'Vault' }} />
      <Tabs.Screen
        name="camera"
        options={{
          ...tab('Scan Medicine', icons.add),
          tabBarLabel: '',
          tabBarButton: () => <AddTabButton />,
          // Camera screen only: full screen, no header and no bottom bar
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="reminders" options={{ ...tab('Reminders', icons.reminders), headerShown: false }} />
      <Tabs.Screen name="profiles" options={{ ...tab('Family Profile', icons.profiles), tabBarLabel: 'Profiles' }} />
    </Tabs>
  );
}