import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import AddTabButton from '@/components/AddTabButton';
import AppHeader from '@/components/AppHeader';
import { useMenu } from '@/components/MenuContext';
import ReminderIcon from '@/components/ReminderIcon';
import { MockAuth } from '@/mock/mockAuth';
import { HeaderFilterProvider, useHeaderFilter } from '@/components/HeaderFilterContext';

const icons = {
  home: (c: any) => <Ionicons name="home-outline" size={24} color={c} />,
  vault: (c: any) => <Ionicons name="shield-outline" size={24} color={c} />,
  add: (c: any) => <Ionicons name="add" size={24} color={c} />,
  reminders: (c: any) => <ReminderIcon size={24} color={c} />,
  profiles: (c: any) => <Ionicons name="person-outline" size={24} color={c} />,
};

const tab = (title: string, icon: (c: any) => any, showLogo = false) => ({
  title,
  header: () => <AppHeader title={title} showLogo={showLogo} />,
  tabBarIcon: ({ color }: { color: any }) => icon(color),
});

function RemindersHeader() {
  const { colors, type } = useDisplayTheme();
  const { openMenu } = useMenu();
  const { onFilterPress } = useHeaderFilter();

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.headerSafe,
        { backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          testID="reminders-menu"
          onPress={openMenu}
          hitSlop={12}
          style={styles.headerSide}
        >
          <Ionicons name="menu" size={28} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text
            style={[type.h2, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            All Reminders
          </Text>
        </View>

        <View style={styles.headerRight}>
          {onFilterPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter reminders by family member"
              testID="open-reminder-filter"
              onPress={onFilterPress}
              hitSlop={10}
            >
              <Ionicons name="filter-outline" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upcoming alerts"
            testID="header-bell"
            onPress={() => router.push('/upcoming-alerts' as never)}
            hitSlop={10}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function TabsLayout() {
  const { colors, scaleFont } = useDisplayTheme();
  const insets = useSafeAreaInsets();

  if (!MockAuth.getActiveProfile()) return <Redirect href="/login" />;
  return (
    <HeaderFilterProvider>
      <Tabs
        backBehavior="history"
        screenOptions={{
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.text,
          tabBarLabelStyle: { fontSize: Math.min(13, scaleFont(12)), fontWeight: '600' },
          tabBarStyle: {
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          },
        }}
      >
        <Tabs.Screen name="index" options={{ ...tab('MediScan', icons.home, true), tabBarLabel: 'Home' }} />
        <Tabs.Screen name="vault" options={{ ...tab('Medicine Vault', icons.vault), tabBarLabel: 'Vault' }} />
        <Tabs.Screen
          name="camera"
          options={{
            ...tab('Scan Medicine', icons.add),
            tabBarLabel: '',
            tabBarButton: () => <AddTabButton />,
            headerShown: false,
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            ...tab('Reminders', icons.reminders),
            tabBarLabel: 'Reminders',
            header: () => <RemindersHeader />,
          }}
        />
        <Tabs.Screen name="profiles" options={{ ...tab('Family Profile', icons.profiles), tabBarLabel: 'Profiles' }} />
      </Tabs>
    </HeaderFilterProvider>
  );
}

const styles = StyleSheet.create({
  headerSafe: {
    borderBottomWidth: 1,
  },
  header: {
    height: 56,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
});