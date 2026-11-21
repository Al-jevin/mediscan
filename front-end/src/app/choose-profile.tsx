import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthHeader from '@/components/AuthHeader';
import ProfileAvatar from '@/components/ProfileAvatar';
import { MockAuth, Profile } from '@/mock/mockAuth';
import { Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export default function ChooseProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const [profiles, setProfiles] = useState<Profile[]>(MockAuth.getProfiles());

  useFocusEffect(
    useCallback(() => {
      setProfiles([...MockAuth.getProfiles()]);
    }, [])
  );

  if (!MockAuth.isLoggedIn()) return <Redirect href="/login" />;
  if (profiles.length === 0) return <Redirect href="/create-profile" />;

  const pick = (p: Profile) => {
    MockAuth.selectProfile(p);
    router.replace('/');
  };

  const logout = () => {
    MockAuth.logout();
    router.replace('/login');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <AuthHeader />

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>Choose your profile</Text>

          <View style={styles.grid}>
            {profiles.map((p) => (
              <Pressable
                key={p.profile_id}
                style={styles.tile}
                onPress={() => pick(p)}
                accessibilityLabel={`Continue as ${p.profile_display_name}`}
              >
                <ProfileAvatar icon={p.profile_icon} size={72} />
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {p.profile_display_name}
                </Text>
              </Pressable>
            ))}

            <Pressable
              style={styles.tile}
              onPress={() => router.push({ pathname: '/create-profile', params: { mode: 'add' } })}
              accessibilityLabel="Add family member"
            >
              <View
                style={[
                  styles.addCircle,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <Ionicons name="add" size={32} color={colors.text} />
              </View>
              <Text style={[styles.name, { color: colors.text }]}>Add</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ flex: 1 }} />
        <Pressable
          style={[styles.logout, { marginBottom: insets.bottom + Spacing.md }]}
          onPress={logout}
          hitSlop={8}
        >
          <Text style={[styles.logoutText, { color: colors.textMuted }]}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { paddingHorizontal: Spacing.lg - 4, paddingTop: Spacing.lg },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: Spacing.lg },
  tile: { width: '33.33%', alignItems: 'center', gap: Spacing.sm },
  name: { fontSize: 15, fontWeight: '600', maxWidth: '90%' },
  addCircle: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logout: { alignSelf: 'center', paddingVertical: Spacing.sm },
  logoutText: { fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
});