import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import AvatarPickerSheet from '../components/AvatarPickerSheet';
import ProfileAvatar from '../components/ProfileAvatar';
import ReminderDialog from '../components/ReminderDialog';
import { useProfile } from '../context/ProfileContext';
import { fromApiDate, maskDate, toApiDate } from '../lib/validation';

export default function AddEditProfileScreen() {
  const router = useRouter();
  const { colors } = useDisplayTheme();
  const params = useLocalSearchParams<{ mode?: string; profileId?: string }>();
  const isEdit = params.mode === 'edit';

  const { profiles, addProfile, updateProfile } = useProfile();

  const existingProfile = profiles.find(
    (p) => p.profile_id.toString() === params.profileId
  );

  const [fullname, setFullname] = useState(() => (isEdit ? existingProfile?.profile_fullname ?? '' : ''));
  const [displayName, setDisplayName] = useState(() => (isEdit ? existingProfile?.profile_display_name ?? '' : ''));
  const [birthdate, setBirthdate] = useState(() => (isEdit ? fromApiDate(existingProfile?.profile_birthdate) : ''));
  const [iconId, setIconId] = useState(() => (isEdit ? existingProfile?.profile_icon || 1 : 1));
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [badDate, setBadDate] = useState(false);
  const [reminder, setReminder] = useState<{ title: string; message: string; items?: string[] } | null>(null);

  const handleSave = async () => {
    const empty: string[] = [];
    if (!fullname.trim()) empty.push('Full Name');
    if (!displayName.trim()) empty.push('Nickname / Display Name');
    if (!birthdate.trim()) empty.push('Date of Birth');
    setMissing(empty);
    if (empty.length) {
      setBadDate(false);
      setReminder({
        title: 'Required fields',
        message: 'Please fill out the following before saving:',
        items: empty,
      });
      return;
    }

    const apiBirthdate = toApiDate(birthdate);
    setBadDate(!apiBirthdate);
    if (!apiBirthdate) {
      setReminder({
        title: 'Invalid date of birth',
        message: 'Please enter the date of birth in numbers as MM/DD/YYYY (e.g. 02/26/2004).',
      });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && existingProfile) {
        await updateProfile(existingProfile.profile_id, {
          profile_fullname: fullname.trim(),
          profile_display_name: displayName.trim(),
          profile_birthdate: apiBirthdate,
          profile_icon: iconId,
        });
      } else {
        await addProfile({
          profile_icon: iconId,
          profile_fullname: fullname.trim(),
          profile_display_name: displayName.trim(),
          profile_birthdate: apiBirthdate,
        });
      }
      router.back();
    } catch (e) {
      setReminder({ title: 'Not saved', message: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={[styles.container, { backgroundColor: colors.background }]}
    >

      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.text }]}>
          {isEdit ? 'Edit Profile' : 'Add Family Member'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={0.8}
              onPress={() => setShowPicker(true)}
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
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: colors.statusSuccess }]}>Choose avatar</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Full Name <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                },
                missing.includes('Full Name') && { borderColor: colors.danger, borderWidth: 1.5 },
              ]}
              placeholder="e.g. Maria Batumbakal"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              maxLength={150}
              value={fullname}
              onChangeText={(t) => {
                setFullname(t);
                setMissing((m) => m.filter((f) => f !== 'Full Name'));
              }}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Nickname / Display Name <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                },
                missing.includes('Nickname / Display Name') && { borderColor: colors.danger, borderWidth: 1.5 },
              ]}
              placeholder="e.g. Me, Mama, Papa"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              maxLength={150}
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t);
                setMissing((m) => m.filter((f) => f !== 'Nickname / Display Name'));
              }}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Date of Birth (MM/DD/YYYY) <Text style={{ color: colors.danger }}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                },
                (missing.includes('Date of Birth') || badDate) && {
                  borderColor: colors.danger,
                  borderWidth: 1.5,
                },
              ]}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
              value={birthdate}
              onChangeText={(t) => {
                setBirthdate(maskDate(t));
                setBadDate(false);
                setMissing((m) => m.filter((f) => f !== 'Date of Birth'));
              }}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              saving && { opacity: 0.7 },
            ]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={[styles.saveBtnText, { color: colors.onAction }]}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Family Member'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <ReminderDialog
        visible={!!reminder}
        title={reminder?.title ?? ''}
        message={reminder?.message ?? ''}
        items={reminder?.items}
        onClose={() => setReminder(null)}
      />

      <AvatarPickerSheet
        visible={showPicker}
        selected={iconId}
        onClose={() => setShowPicker(false)}
        onSave={(newIcon: number) => {
          setIconId(newIcon);
          setShowPicker(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  topBarTitle: { fontSize: 18, fontWeight: '700' },
  scrollContent: { padding: 24, justifyContent: 'space-between', flexGrow: 1 },
  avatarSection: { alignItems: 'center', marginVertical: 16 },
  avatarWrap: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  avatarHint: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  form: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    marginBottom: 18,
  },
  saveBtn: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
});