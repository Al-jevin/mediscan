import React, { useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizes, Radius, Spacing } from '@/constants/display';
import { useProfile } from '@/context/ProfileContext';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import AvatarPickerSheet from '@/components/AvatarPickerSheet';
import DataSync from '@/components/Datasync';
import ProfileAvatar from '@/components/ProfileAvatar';
import HealthInfo from '@/components/HealthInfo';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const [healthOpen, setHealthOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { activeProfile: profile, email, updateProfile } = useProfile();
  const [savingIcon, setSavingIcon] = useState<number | null>(null);

  if (!profile) return <Redirect href="/choose-profile" />;

  const iconId = savingIcon ?? profile.profile_icon;

  const chooseAvatar = async (id: number) => {
    setPickerOpen(false);
    if (id === profile.profile_icon) return;
    setSavingIcon(id);
    try {
      await updateProfile(profile.profile_id, { profile_icon: id });
    } catch (e) {
      Alert.alert('Avatar not saved', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingIcon(null);
    }
  };

  const openEdit = () =>
    router.push({
      pathname: '/add-edit-profile',
      params: { mode: 'edit', profileId: String(profile.profile_id) },
    } as any);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identity}>
          <Pressable
            style={({ pressed }) => [styles.avatarWrap, pressed && { opacity: 0.8 }]}
            onPress={() => setPickerOpen(true)}
            accessibilityLabel="Change profile picture"
          >
            <ProfileAvatar icon={iconId} size={96} />
            <View
              style={[
                styles.editBadge,
                { backgroundColor: colors.primary, borderColor: colors.surface },
              ]}
            >
              <Ionicons name="pencil" size={14} color={colors.onAction} />
            </View>
          </Pressable>
          <Text style={[styles.fullName, { color: colors.text }]}>
            {profile.profile_fullname}
          </Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{email}</Text>
        </View>

        <DataSync />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile</Text>

        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { backgroundColor: colors.primarySoft },
          ]}
          onPress={openEdit}
        >
          <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} />
          <Text style={[styles.rowText, { color: colors.text }]}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { backgroundColor: colors.primarySoft },
          ]}
          onPress={() => setHealthOpen(true)}
        >
          <MaterialCommunityIcons name="heart-pulse" size={20} color={colors.primary} />
          <Text style={[styles.rowText, { color: colors.text }]}>Health Information</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      </ScrollView>

      <AvatarPickerSheet
        visible={pickerOpen}
        selected={iconId}
        onClose={() => setPickerOpen(false)}
        onSave={chooseAvatar}
      />

      <HealthInfo visible={healthOpen} onClose={() => setHealthOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  identity: { alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.lg },
  avatarWrap: { marginBottom: Spacing.sm + 4 },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  fullName: { fontWeight: '700', fontSize: FontSizes.body + 4 },
  email: { fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontWeight: '700',
    fontSize: FontSizes.body,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm + 2,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  rowText: { flex: 1, fontSize: FontSizes.body - 1, fontWeight: '600' },
});