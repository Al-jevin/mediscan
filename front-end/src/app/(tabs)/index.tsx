import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MedicineIcon from '@/components/medicine/MedicineIcon';
import ScanCard from '@/components/medicine/ScanCard';
import { DarkColors, Radius, Spacing } from '@/constants/display';
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

export default function HomeScreen() {
  useFirstLaunchPermissions();
  const router = useRouter();
  const { colors, components, type } = useDisplayTheme();
  const { ready, error, medicines, retry } = useVault();
  const profile = useLoggedInProfile();
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

  const openVault = (status: StatusFilter = 'all', urgency: UrgencyFilter = 'none') => {
    resetListQuery('vault', { status, urgency });
    router.navigate('/vault');
  };

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
        <Text style={[type.h1, { color: colors.textPrimary }]}>Hello, {name}! 👋</Text>
        <Text style={[type.bodyLarge, { fontWeight: '600', color: colors.textSecondary }]}>
          Take care, stay safe.
        </Text>
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
          <Text style={[type.body, styles.empty, { color: colors.textSecondary }]}>
            Could not load medicines: {error}
          </Text>
          <Pressable onPress={() => void retry()} accessibilityRole="button">
            <Text style={[type.label, { color: colors.actionPrimary, paddingHorizontal: Spacing.md + 4 }]}>
              Retry
            </Text>
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
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[type.label, { color: colors.textPrimary }]} numberOfLines={1}>
                  {reminder.medicine}
                </Text>
                <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                  {reminder.frequency}
                  {reminder.instructions ? ` · ${reminder.instructions}` : ''}
                </Text>
              </View>
              <View style={styles.remTime}>
                <Ionicons name="alarm-outline" size={16} color={colors.statusSuccess} />
                <Text style={[type.caption, { textAlign: 'right', color: colors.textPrimary }]}>
                  {label}
                </Text>
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
  const { type } = useDisplayTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[type.h2, { color: titleColor }]}>{title}</Text>
      {onViewAll && (
        <Pressable
          onPress={onViewAll}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`View all ${title}`}
        >
          <Text style={[type.label, { color: linkColor }]}>View All</Text>
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
  const { type } = useDisplayTheme();
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
        <Text style={[type.h2, { color: colors.textPrimary }]}>{value}</Text>
      </View>
      <Text
        style={[type.caption, { fontWeight: '600', textAlign: 'left', color: colors.textSecondary }]}
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
  const { type } = useDisplayTheme();
  return <Text style={[type.body, styles.empty, { color }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: Spacing.xl * 2 },
  greeting: { paddingHorizontal: Spacing.md + 4, paddingVertical: Spacing.lg },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md + 4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm + 4,
  },
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
  list: { gap: Spacing.sm + 4, paddingHorizontal: Spacing.md + 4 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    padding: Spacing.sm + 4,
  },
  remTime: { alignItems: 'flex-end', gap: 2, maxWidth: '40%' },
  empty: { paddingHorizontal: Spacing.md + 4 },
  loadError: { gap: Spacing.xs },
});