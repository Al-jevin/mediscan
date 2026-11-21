import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MedicineIcon from '@/components/medicine/MedicineIcon';
import ScanCard from '@/components/medicine/ScanCard';
import { DarkColors, Radius, Spacing, Type } from '@/constants/display';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import { useFirstLaunchPermissions } from '@/hooks/useFirstLaunchPermissions';
import { resetListQuery } from '@/services/listQueryStore';
import {
  firstName, getUpcomingReminders, useLoggedInProfile, useSavedReminders,
} from '@/services/profileReminders';
import { useVault } from '@/services/vaultStore';
import type { StatusFilter, UrgencyFilter, VaultMedicine } from '@/types/medicine';
import { getMedicineForm, overviewCounts } from '@/utils/medicine';

type ThemeColors = typeof DarkColors;

// Home (Figma: Home Page). The top bar (burger + MediScan logo + bell) comes from
// (tabs)/_layout.tsx, so this screen does NOT draw its own header.
export default function HomeScreen() {
  useFirstLaunchPermissions();
  const router = useRouter();
  const { colors, components } = useDisplayTheme();
  const { ready, error, medicines, retry } = useVault();
  const profile = useLoggedInProfile(); // the profile picked on Choose Profile
  const name = firstName(profile);
  const {
    reminders: savedReminders,
    ready: remindersReady,
    error: remindersError,
  } = useSavedReminders();

  const counts = useMemo(() => overviewCounts(medicines), [medicines]);
  const recent = useMemo(
    () => [...medicines].sort((a, b) => b.vault_saved_at.localeCompare(a.vault_saved_at)).slice(0, 3),
    [medicines],
  );
  const reminders = useMemo(
    () => getUpcomingReminders(savedReminders, profile).slice(0, 3),
    [savedReminders, profile],
  );

  const openDetails = (m: VaultMedicine) =>
    router.push({ pathname: '/medicine/[id]', params: { id: m.vault_id } });

  // Medicine Overview cards -> the Vault tab (there is no separate per-profile vault).
  // Total = whole vault; the other cards open the Vault already filtered to match the card.
  const openVault = (status: StatusFilter = 'all', urgency: UrgencyFilter = 'none') => {
    resetListQuery('vault', { status, urgency });
    router.navigate('/vault');
  };

  // Upcoming Reminders -> Reminders tab, filtered to the logged-in profile.
  // With reminderId, the Reminders tab opens that reminder's details right away.
  const member = profile?.profile_display_name ?? '';
  const openReminders = (reminderId?: string) =>
    router.navigate({
      pathname: '/reminders',
      params: reminderId ? { member, reminderId, from: 'home' } : { member },
    });

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.surfacePrimary }]}
      contentContainerStyle={styles.content}
    >
      <LinearGradient
        colors={[colors.surfacePrimary, colors.surfaceSecondary]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.greeting}
      >
        <Text style={[styles.hello, { color: colors.textPrimary }]}>Hello, {name}! 👋</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Take care, stay safe.</Text>
      </LinearGradient>

      <SectionHeader
        title="Medicine Overview"
        titleColor={colors.textPrimary}
        linkColor={colors.textSecondary}
      />
      {!ready ? (
        <ActivityIndicator color={colors.actionPrimary} style={{ marginVertical: Spacing.lg }} />
      ) : error ? (
        <View style={styles.loadError}>
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            Could not load medicines: {error}
          </Text>
          <Pressable onPress={() => void retry()} accessibilityRole="button">
            <Text style={[styles.viewAll, { color: colors.actionPrimary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              icon={<MaterialCommunityIcons name="pill" size={22} color={colors.textSecondary} />}
              value={counts.total}
              label="Total Medicines"
              onPress={() => openVault()}
              colors={colors}
              cardStyle={components.statCard}
            />
            <StatCard
              icon={<Ionicons name="shield-checkmark" size={22} color={colors.statusSuccess} />}
              value={counts.verified}
              label="Verified"
              onPress={() => openVault('verified')}
              colors={colors}
              cardStyle={components.statCard}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon={<Ionicons name="warning" size={22} color={colors.statusWarning} />}
              value={counts.needsVerification}
              label="Needs Verification"
              onPress={() => openVault('needs_verification')}
              colors={colors}
              cardStyle={components.statCard}
            />
            <StatCard
              icon={<Ionicons name="time" size={22} color={colors.statusDanger} />}
              value={counts.expiring}
              label="Expiring"
              onPress={() => openVault('all', 'within30')}
              colors={colors}
              cardStyle={components.statCard}
            />
          </View>
        </View>
      )}

      <SectionHeader
        title="Recent Scans"
        titleColor={colors.textPrimary}
        linkColor={colors.textSecondary}
        onViewAll={() => router.push('/recent-scans')}
      />
      {ready && recent.length === 0 ? (
        <EmptyLine text="No medicines yet. Tap + to scan your first one." color={colors.textSecondary} />
      ) : (
        <View style={styles.list}>
          {recent.map((m) => <ScanCard key={m.vault_id} medicine={m} onPress={openDetails} />)}
        </View>
      )}

      <SectionHeader
        title="Upcoming Reminders"
        titleColor={colors.textPrimary}
        linkColor={colors.textSecondary}
        onViewAll={() => openReminders()}
      />
      {!remindersReady ? (
        <ActivityIndicator color={colors.actionPrimary} style={{ marginVertical: Spacing.md }} />
      ) : remindersError ? (
        <EmptyLine text={`Could not load reminders: ${remindersError}`} color={colors.textSecondary} />
      ) : reminders.length === 0 ? (
        <EmptyLine text={`No upcoming reminders for ${name}.`} color={colors.textSecondary} />
      ) : (
        <View style={styles.list}>
          {reminders.map(({ reminder, label }) => (
            <Pressable
              key={reminder.id}
              style={({ pressed }) => [
                components.medicineCard,
                styles.reminder,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => openReminders(reminder.id)}
              accessibilityRole="button"
              accessibilityLabel={`${reminder.medicine}, ${label}. Open reminder details`}
            >
              <MedicineIcon form={getMedicineForm(reminder.category)} size={48} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.remName, { color: colors.textPrimary }]} numberOfLines={1}>
                  {reminder.medicine}
                </Text>
                <Text style={[styles.remSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {reminder.frequency}
                  {reminder.instructions ? ` · ${reminder.instructions}` : ''}
                </Text>
              </View>
              <View style={styles.remTime}>
                <Ionicons name="alarm-outline" size={16} color={colors.statusSuccess} />
                <Text style={[styles.remTimeText, { color: colors.textPrimary }]}>{label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SectionHeader({
  title,
  onViewAll,
  titleColor,
  linkColor,
}: {
  title: string;
  onViewAll?: () => void;
  titleColor: string;
  linkColor: string;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.section, { color: titleColor }]}>{title}</Text>
      {onViewAll && (
        <Pressable
          onPress={onViewAll}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`View all ${title}`}
        >
          <Text style={[styles.viewAll, { color: linkColor }]}>View All</Text>
        </Pressable>
      )}
    </View>
  );
}

function StatCard({
  icon,
  value,
  label,
  onPress,
  colors,
  cardStyle,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  cardStyle: object;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        cardStyle,
        styles.stat,
        pressed && { backgroundColor: colors.surfaceSecondary },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
    >
      <View style={styles.statTop}>
        {icon}
        <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      </View>
      <Text
        style={[styles.statLabel, { color: colors.textSecondary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EmptyLine({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.empty, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: Spacing.xl * 2 },
  greeting: { paddingHorizontal: Spacing.md + 4, paddingVertical: Spacing.lg },
  hello: { ...Type.h1 },
  sub: { ...Type.bodyLarge, fontWeight: '600' },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm + 4,
  },
  section: { ...Type.h2 },
  viewAll: { ...Type.label },
  statsGrid: { gap: Spacing.sm, paddingHorizontal: Spacing.md + 4 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.sm,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: { ...Type.h2 },
  statLabel: { ...Type.caption, fontWeight: '600', textAlign: 'left' },
  list: { gap: Spacing.sm + 4, paddingHorizontal: Spacing.md + 4 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    padding: Spacing.sm + 4,
  },
  remName: { ...Type.label },
  remSub: { ...Type.caption },
  remTime: { alignItems: 'flex-end', gap: 2, maxWidth: '40%' },
  remTimeText: { ...Type.caption, textAlign: 'right' },
  empty: { ...Type.body, paddingHorizontal: Spacing.md + 4 },
  loadError: { gap: Spacing.xs },
});
