import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useDisplayTheme } from '@/hooks/useDisplayTheme';
import {
  fetchNotifications,
  type NotificationItem,
} from '@/services/notificationsApi';

function formatScheduledTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const now = new Date();
  const dateLabel =
    date.toDateString() === now.toDateString()
      ? 'Today'
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel}, ${timeLabel}`;
}

export default function NotificationsScreen() {
  const { colors } = useDisplayTheme();
  const router = useRouter();
  const { profiles } = useProfile();
  const profileIdsKey = profiles
    .map((profile) => profile.profile_id)
    .sort()
    .join(',');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const notificationColor = (item: NotificationItem): string =>
    item.type === 'medication_reminder' ? colors.statusSuccess : colors.statusWarning;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const profileIds = profileIdsKey ? profileIdsKey.split(',') : [];
      setLoading(true);
      setError(null);
      fetchNotifications(profileIds)
        .then((items) => {
          if (active) setNotifications(items);
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setNotifications([]);
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load notifications.',
          );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [profileIdsKey]),
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.surfacePrimary }]}
      edges={['top']}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surfacePrimary,
            borderBottomColor: colors.borderDefault,
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
          <Ionicons name="arrow-back" size={25} color={colors.textPrimary} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator color={colors.statusSuccess} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              Loading notifications…
            </Text>
          </View>
        ) : error ? (
          <Text
            style={[styles.statusText, { color: colors.statusDanger }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : notifications.length === 0 ? (
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            No upcoming medication reminders.
          </Text>
        ) : (
          notifications.map((item) => {
            const color = notificationColor(item);
            return (
              <View
                key={item.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surfacePrimary,
                    borderColor: colors.borderDefault,
                  },
                ]}
              >
                <View style={styles.cardHeading}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
                </View>

                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {item.message}
                </Text>

                <Text style={[styles.time, { color }]}>
                  {formatScheduledTime(item.scheduled_at)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  list: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 8,
  },
  status: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusText: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    textAlign: 'center',
    fontSize: 14,
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
  dot: { width: 9, height: 9, borderRadius: 5 },
  title: { flex: 1, fontSize: 14, fontWeight: '900' },
  message: { fontSize: 13, marginLeft: 20, marginBottom: 6 },
  time: { fontSize: 12, fontWeight: '600', marginLeft: 20 },
});
