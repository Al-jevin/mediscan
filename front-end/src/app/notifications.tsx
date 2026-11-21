import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import {
  getUpcomingReminders,
  useLoggedInProfile,
  useSavedReminders,
} from '@/services/profileReminders';
import { useVault } from '@/services/vaultStore';
import {
  isExpired,
  isExpiringWithin,
  medicineName,
  parseDate,
} from '@/utils/medicine';

const ALERT_PREFERENCES_KEY = 'mediscan.alert-preferences.v1';
const DAY_MS = 86_400_000;

type NotificationItem = {
  id: string;
  priority: number;
  title: string;
  message: string;
  time: string;
  color: string;
  onPress: () => void;
};

type AlertPrefs = {
  archivedIds: string[];
  snoozedUntil: Record<string, number>;
};

const EMPTY_PREFS: AlertPrefs = { archivedIds: [], snoozedUntil: {} };

function formatRelativeTime(iso: string | undefined, now: number): string {
  if (!iso) return 'Needs review';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'Needs review';
  const diffMin = Math.max(0, Math.floor((now - ts) / 60_000));
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function parseAlertPrefs(raw: string | null): AlertPrefs {
  if (!raw) return EMPTY_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<AlertPrefs>;
    const archivedIds = Array.isArray(parsed.archivedIds)
      ? parsed.archivedIds.filter((id): id is string => typeof id === 'string')
      : [];
    const snoozedUntil =
      parsed.snoozedUntil && typeof parsed.snoozedUntil === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.snoozedUntil).filter(
              (entry): entry is [string, number] =>
                typeof entry[1] === 'number' && Number.isFinite(entry[1]),
            ),
          )
        : {};
    return { archivedIds, snoozedUntil };
  } catch {
    return EMPTY_PREFS;
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useDisplayTheme();
  const profile = useLoggedInProfile();
  const {
    medicines,
    ready: vaultReady,
    error: vaultError,
    retry: retryVault,
  } = useVault();
  const {
    reminders: savedReminders,
    ready: remindersReady,
    error: remindersError,
  } = useSavedReminders();

  const [prefs, setPrefs] = useState<AlertPrefs>(EMPTY_PREFS);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(ALERT_PREFERENCES_KEY)
        .then((raw) => {
          if (!active) return;
          setPrefs(parseAlertPrefs(raw));
          setNow(Date.now());
        })
        .catch(() => {
          if (active) setNow(Date.now());
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const member = profile?.profile_display_name ?? '';

    const openMedicine = (vaultId: string) =>
      router.push({ pathname: '/medicine/[id]', params: { id: vaultId } });

    for (const med of medicines) {
      if (prefs.archivedIds.includes(med.vault_id)) continue;

      const label = [medicineName(med), med.fda_dosage_strength]
        .filter(Boolean)
        .join(' ');
      const expiry = parseDate(med.vault_expiry_date);
      const isSnoozed = (prefs.snoozedUntil[med.vault_id] ?? 0) > now;

      if (!isSnoozed && expiry) {
        const diffDays = Math.round((expiry.getTime() - todayStart) / DAY_MS);

        if (isExpired(med)) {
          const daysAgo = Math.abs(diffDays);
          items.push({
            id: `expired-${med.vault_id}`,
            priority: 0,
            title: 'Medicine expired',
            message: `${label} has expired`,
            time:
              daysAgo <= 0
                ? 'Expired today'
                : daysAgo === 1
                  ? '1d ago'
                  : `${daysAgo}d ago`,
            color: colors.statusDanger,
            onPress: () => openMedicine(med.vault_id),
          });
        } else if (isExpiringWithin(med, 30)) {
          items.push({
            id: `expiring-${med.vault_id}`,
            priority: 1,
            title: 'Medicine expiring soon',
            message:
              diffDays === 0
                ? `${label} expires today`
                : diffDays === 1
                  ? `${label} expires tomorrow`
                  : `${label} expires in ${diffDays} days`,
            time: `Expires ${expiry.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}`,
            color: colors.statusWarning,
            onPress: () => openMedicine(med.vault_id),
          });
        }
      }

      if (med.vault_status === 'needs_verification' || !expiry) {
        items.push({
          id: `verify-${med.vault_id}`,
          priority: 2,
          title: 'Verification needed',
          message: `${label} needs verification`,
          time: formatRelativeTime(med.vault_saved_at, now),
          color: colors.statusWarning,
          onPress: () => openMedicine(med.vault_id),
        });
      }
    }

    const upcoming = getUpcomingReminders(savedReminders, profile);
    for (const { reminder, label } of upcoming) {
      items.push({
        id: `reminder-${reminder.id}`,
        priority: 3,
        title: 'Reminder',
        message: `Time to take ${reminder.medicine}`,
        time: label,
        color: colors.statusSuccess,
        onPress: () =>
          router.navigate({
            pathname: '/(tabs)/reminders',
            params: { member, reminderId: reminder.id },
          } as any),
      });
    }

    return items.sort((a, b) => a.priority - b.priority);
  }, [medicines, savedReminders, profile, prefs, now, router, colors]);

  const loading = !vaultReady || !remindersReady;
  const loadError = vaultError || remindersError;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surfacePrimary }]}
      edges={['top']}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)' as any);
            }
          }}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={25} color={colors.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Notifications
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.actionPrimary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {loadError ? (
            <View
              style={[
                styles.errorBox,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.statusWarning,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: colors.statusWarning }]}>
                {loadError}
              </Text>
              {vaultError ? (
                <Pressable onPress={() => void retryVault()} hitSlop={8}>
                  <Text style={[styles.retryText, { color: colors.textPrimary }]}>
                    Retry
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {notifications.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="notifications-off-outline"
                size={40}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                You&apos;re all caught up
              </Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Expiry alerts, verification notices, and reminders will appear
                here.
              </Text>
            </View>
          ) : (
            notifications.map((item) => (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}: ${item.message}`}
              >
                <View style={styles.cardHeading}>
                  <View
                    style={[styles.dot, { backgroundColor: item.color }]}
                  />
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {item.title}
                  </Text>
                </View>

                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {item.message}
                </Text>

                <Text style={[styles.time, { color: item.color }]}>
                  {item.time}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 62,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 25,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
    flexGrow: 1,
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 64,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  card: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 9,
    minHeight: 83,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 7,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
  },
  message: {
    fontSize: 13,
    marginLeft: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 20,
  },
});