import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthInput from '@/components/AuthInput';
import AvatarPickerSheet from '@/components/AvatarPickerSheet';
import FormError from '@/components/FormError';
import ProfileAvatar from '@/components/ProfileAvatar';
import ReminderDialog from '@/components/ReminderDialog';
import { MockAuth } from '@/mock/mockAuth';
import { maskDate, toApiDate } from '@/lib/validation';
import { DarkColors, Radius, Spacing } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';

export default function CreateProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useDisplayTheme();
  const isDark = colors.background === DarkColors.background;
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [isFirst] = useState(() => mode !== 'add' && MockAuth.getProfiles().length === 0);

  const [icon, setIcon] = useState(3);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [badDate, setBadDate] = useState(false);
  const [reminder, setReminder] = useState<{ title: string; message: string; items?: string[] } | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (isFirst) {
      MockAuth.logout();
      router.replace('/login');
    } else router.replace('/choose-profile');
  };

  const onSave = async () => {
    setError(null);
    const name = fullName.trim();
    const nickname = displayName.trim();

    const empty: string[] = [];
    if (!name) empty.push('Full Name');
    if (!nickname) empty.push('Nickname / Display Name');
    if (!dob.trim()) empty.push('Date of Birth');
    setMissing(empty);
    if (empty.length) {
      setBadDate(false);
      return setReminder({
        title: 'Required fields',
        message: 'Please fill out the following before saving:',
        items: empty,
      });
    }

    const birthdate = toApiDate(dob);
    setBadDate(!birthdate);
    if (!birthdate) {
      return setReminder({
        title: 'Invalid date of birth',
        message: 'Please enter the date of birth in numbers as MM/DD/YYYY (e.g. 02/26/2004).',
      });
    }

    setLoading(true);
    const res = await MockAuth.addProfile({
      profile_icon: icon,
      profile_fullname: name,
      profile_display_name: nickname,
      profile_birthdate: birthdate,
    });
    setLoading(false);
    if (!res.success || !res.data) {
      if (res.code === 401 || !MockAuth.isLoggedIn()) {
        router.replace({ pathname: '/login', params: { email: MockAuth.getEmail() ?? undefined } });
        return;
      }
      return setError(res.message);
    }

    if (isFirst) {
      MockAuth.selectProfile(res.data);
      router.replace('/(tabs)');
    } else {
      goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.sm,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Pressable onPress={goBack} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isFirst ? 'Create Profile' : 'Add Family Member'}
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {isFirst ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Let&apos;s set up your profile</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              This will be the first profile on MediScan. You can add family members later.
            </Text>
          </>
        ) : null}

        <Pressable style={styles.avatarWrap} onPress={() => setPickerOpen(true)} accessibilityLabel="Choose avatar">
          <View>
            <ProfileAvatar icon={icon} size={96} />
            <View
              style={[
                styles.editBadge,
                { backgroundColor: colors.primary, borderColor: colors.surface },
              ]}
            >
              <Ionicons name="pencil" size={14} color={colors.onAction} />
            </View>
          </View>
          <Text style={[styles.avatarLabel, { color: colors.success }]}>Choose avatar</Text>
        </Pressable>

        <FormError message={error} />

        <AuthInput
          label="Full Name"
          required
          invalid={missing.includes('Full Name')}
          placeholder="e.g. Maria Batumbakal"
          autoCapitalize="words"
          maxLength={150}
          value={fullName}
          onChangeText={(t) => {
            setFullName(t);
            setMissing((m) => m.filter((f) => f !== 'Full Name'));
          }}
        />
        <AuthInput
          label="Nickname / Display Name"
          required
          invalid={missing.includes('Nickname / Display Name')}
          placeholder="e.g. Me, Mama, Papa"
          autoCapitalize="words"
          maxLength={10}
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            setMissing((m) => m.filter((f) => f !== 'Nickname / Display Name'));
          }}
        />
        <AuthInput
          label="Date of Birth (MM/DD/YYYY)"
          required
          invalid={missing.includes('Date of Birth') || badDate}
          placeholder="MM/DD/YYYY"
          keyboardType="number-pad"
          value={dob}
          onChangeText={(t) => {
            setDob(maskDate(t));
            setBadDate(false);
            setMissing((m) => m.filter((f) => f !== 'Date of Birth'));
          }}
          maxLength={10}
        />

        <View style={{ flex: 1 }} />
        <Pressable
          style={[
            styles.primaryBtn,
            { backgroundColor: colors.primary, marginBottom: insets.bottom + Spacing.md },
            loading && styles.disabled,
          ]}
          onPress={onSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAction} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.onAction} />
              <Text style={[styles.primaryText, { color: colors.onAction }]}>
                {isFirst ? 'Create Profile' : 'Save Family Member'}
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      <ReminderDialog
        visible={!!reminder}
        title={reminder?.title ?? ''}
        message={reminder?.message ?? ''}
        items={reminder?.items}
        onClose={() => setReminder(null)}
      />

      <AvatarPickerSheet
        visible={pickerOpen}
        selected={icon}
        onClose={() => setPickerOpen(false)}
        onSave={(i) => {
          setIcon(i);
          setPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg - 4,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  body: { flexGrow: 1, paddingHorizontal: Spacing.lg - 4, paddingTop: Spacing.lg },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  avatarWrap: { alignSelf: 'center', alignItems: 'center', marginVertical: Spacing.lg },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { marginTop: Spacing.sm, fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row',
    gap: Spacing.sm,
    height: 50,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  disabled: { opacity: 0.7 },
  primaryText: { fontSize: 16, fontWeight: '700' },
});