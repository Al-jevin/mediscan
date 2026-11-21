import { useEffect, useRef } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useProfile } from '@/context/ProfileContext';
import { registerDevicePushToken } from '@/services/notificationsApi';
import { fetchReminders, subscribeToReminderChanges } from '@/services/remindersApi';
import { showAppToast } from '@/services/toastStore';
import type { Reminder } from '@/components/reminderTypes';
import { getNextReminderOccurrence } from '@/utils/reminderDates';

const LOCAL_NOTIFICATION_SOURCE = 'mediscan.schedule';
const ANDROID_CHANNEL_ID = 'mediscan-reminders-v2';
const MAX_SCHEDULED_NOTIFICATIONS = 48;
const MAX_OCCURRENCES_PER_REMINDER = 5;
const MAX_IN_APP_TIMER_MS = 24 * 60 * 60 * 1000;
const IN_APP_POLL_MS = 5_000;
const FIRED_WINDOW_MS = 90_000;

type NotificationsModule = typeof import('expo-notifications');

let handlerConfigured = false;
const firedInAppKeys = new Set<string>();

function isExpoGo(): boolean {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

async function ensureAndroidPostNotificationsPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
    const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
    if (!(await PermissionsAndroid.check(permission))) {
      await PermissionsAndroid.request(permission);
    }
  }
}

async function loadNotifications(): Promise<NotificationsModule | null> {
  try {
    const Notifications = await import('expo-notifications');
    if (!handlerConfigured && (Platform.OS === 'ios' || Platform.OS === 'android')) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldShowAlert: true,
        }),
      });
      handlerConfigured = true;
    }
    return Notifications;
  } catch (error) {
    console.warn('[Notifications] expo-notifications unavailable:', error);
    return null;
  }
}

async function cancelManagedNotifications(
  Notifications: NotificationsModule,
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (notification) =>
          notification.content.data?.source === LOCAL_NOTIFICATION_SOURCE,
      )
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );
}

function isPermissionGranted(
  Notifications: NotificationsModule,
  permission: Awaited<ReturnType<NotificationsModule['getPermissionsAsync']>>,
): boolean {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function syncDeviceToken(token: { data: unknown }): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (typeof token.data !== 'string' || token.data.length === 0) {
    throw new Error('The device returned an invalid notification token.');
  }
  await registerDevicePushToken(token.data, Platform.OS);
}

function upcomingReminderDates(reminder: Reminder, now: Date): Date[] {
  const dates: Date[] = [];
  let cursor = now;
  for (let index = 0; index < MAX_OCCURRENCES_PER_REMINDER; index += 1) {
    const next = getNextReminderOccurrence(reminder, cursor);
    if (!next) break;
    dates.push(next);
    cursor = new Date(next.getTime() + 60_000);
  }
  return dates;
}

function reminderFireKey(reminder: Reminder, date: Date): string {
  return `${reminder.id}|${date.toISOString().slice(0, 16)}`;
}

function reminderCopy(reminder: Reminder): { title: string; body: string } {
  return {
    title: `Time for ${reminder.medicine}`,
    body: reminder.notes.trim()
      ? `${reminder.member}: ${reminder.notes}`
      : `${reminder.member} · ${reminder.instructions || reminder.time}`,
  };
}

function fireReminderToast(reminder: Reminder, date: Date): void {
  const key = reminderFireKey(reminder, date);
  if (firedInAppKeys.has(key)) return;
  firedInAppKeys.add(key);
  if (firedInAppKeys.size > 200) {
    const keep = [...firedInAppKeys].slice(-80);
    firedInAppKeys.clear();
    keep.forEach((k) => firedInAppKeys.add(k));
  }
  const copy = reminderCopy(reminder);
  showAppToast(copy.title, copy.body);
  if (__DEV__) {
    console.log(`[Notifications] In-app toast: ${copy.title} @ ${date.toISOString()}`);
  }
}

export function usePushNotifications(): void {
  const { email, profiles, activeProfile } = useProfile();
  const remindersCache = useRef<Reminder[]>([]);
  const inAppTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let refreshRequested = false;
    let tokenSubscription: { remove: () => void } | null = null;
    let receivedSubscription: { remove: () => void } | null = null;

    const clearInAppTimers = () => {
      inAppTimers.current.forEach(clearTimeout);
      inAppTimers.current = [];
    };

    /** Precise JS timers — reliable in Expo Go when OS local notifs never surface. */
    const armInAppTimers = (reminders: Reminder[]) => {
      clearInAppTimers();
      const now = Date.now();
      for (const reminder of reminders) {
        if (!reminder.enabled) continue;
        for (const date of upcomingReminderDates(reminder, new Date(now))) {
          const delay = date.getTime() - now;
          if (delay <= 0 || delay > MAX_IN_APP_TIMER_MS) continue;
          const key = reminderFireKey(reminder, date);
          if (firedInAppKeys.has(key)) continue;
          const timer = setTimeout(() => {
            if (!active) return;
            fireReminderToast(reminder, date);
          }, delay);
          inAppTimers.current.push(timer);
        }
      }
      if (__DEV__) {
        console.log(`[Notifications] Armed ${inAppTimers.current.length} in-app toast timer(s).`);
      }
    };

    const pollDueReminders = () => {
      const now = Date.now();
      for (const reminder of remindersCache.current) {
        if (!reminder.enabled) continue;
        const next = getNextReminderOccurrence(reminder, new Date(now - FIRED_WINDOW_MS));
        if (!next) continue;
        const delta = next.getTime() - now;
        if (delta > 5_000 || delta < -FIRED_WINDOW_MS) continue;
        fireReminderToast(reminder, next);
      }
    };

    const refreshOsSchedules = async () => {
      if (refreshing) {
        refreshRequested = true;
        return;
      }
      refreshing = true;
      try {
        if (!email || !activeProfile || profiles.length === 0) {
          clearInAppTimers();
          remindersCache.current = [];
          const Notifications = await loadNotifications();
          if (Notifications) await cancelManagedNotifications(Notifications);
          return;
        }

        let reminders: Reminder[] = [];
        try {
          reminders = await fetchReminders(profiles);
          remindersCache.current = reminders;
        } catch (error) {
          console.warn('[Notifications] Could not load reminders for scheduling:', error);
          reminders = remindersCache.current;
        }

        // Always arm in-app toast timers first (works even without OS permission).
        armInAppTimers(reminders);
        pollDueReminders();

        if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

        const Notifications = await loadNotifications();
        if (!Notifications || !active) return;

        await ensureAndroidPostNotificationsPermission();

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'Medication reminders',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            enableVibrate: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
          });
        }

        let permission = await Notifications.getPermissionsAsync();
        if (!isPermissionGranted(Notifications, permission) && permission.canAskAgain) {
          permission = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
        }

        if (!receivedSubscription) {
          receivedSubscription = Notifications.addNotificationReceivedListener((event) => {
            if (event.request.content.data?.source !== LOCAL_NOTIFICATION_SOURCE) return;
            const title = event.request.content.title ?? 'Medication reminder';
            const body = event.request.content.body ?? 'It is time to take your medicine.';
            const fireKey = String(event.request.content.data?.fire_key ?? '');
            if (fireKey && firedInAppKeys.has(fireKey)) return;
            if (fireKey) firedInAppKeys.add(fireKey);
            showAppToast(title, body);
          });
        }

        type Planned = { title: string; body: string; date: Date; key: string };
        const planned: Planned[] = [];
        const nowMs = Date.now();
        for (const reminder of reminders) {
          if (!reminder.enabled) continue;
          for (const date of upcomingReminderDates(reminder, new Date())) {
            if (date.getTime() <= nowMs) continue;
            const copy = reminderCopy(reminder);
            planned.push({
              title: copy.title,
              body: copy.body,
              date,
              key: reminderFireKey(reminder, date),
            });
          }
        }

        const upcoming = planned
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .slice(0, MAX_SCHEDULED_NOTIFICATIONS);

        if (isPermissionGranted(Notifications, permission)) {
          await cancelManagedNotifications(Notifications);
          for (const item of upcoming) {
            if (!active) return;
            const seconds = Math.max(1, Math.ceil((item.date.getTime() - Date.now()) / 1000));
            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: item.title,
                  body: item.body,
                  sound: 'default',
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
                  data: {
                    source: LOCAL_NOTIFICATION_SOURCE,
                    fire_key: item.key,
                  },
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                  seconds,
                  repeats: false,
                  ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
                },
              });
            } catch (error) {
              console.warn('[Notifications] Could not schedule OS notification:', error);
            }
          }
          if (__DEV__) {
            console.log(`[Notifications] Scheduled ${upcoming.length} OS TIME_INTERVAL notif(s).`);
          }
        } else if (__DEV__) {
          console.warn('[Notifications] OS permission denied — relying on in-app toast timers.');
        }

        const canRegisterPush =
          active &&
          Device.isDevice &&
          !isExpoGo() &&
          (Platform.OS === 'ios' || Platform.OS === 'android');
        if (canRegisterPush) {
          if (!tokenSubscription) {
            tokenSubscription = Notifications.addPushTokenListener((token) => {
              if (!active) return;
              void syncDeviceToken(token).catch((error: unknown) => {
                console.warn('[Notifications] Could not update device token:', error);
              });
            });
          }
          try {
            await syncDeviceToken(await Notifications.getDevicePushTokenAsync());
          } catch (error) {
            console.warn('[Notifications] Push token sync skipped:', error);
          }
        }
      } catch (error) {
        console.warn('[Notifications] Could not synchronize device notifications:', error);
      } finally {
        refreshing = false;
        if (refreshRequested && active) {
          refreshRequested = false;
          void refreshOsSchedules();
        }
      }
    };

    void refreshOsSchedules();
    const reminderSubscription = subscribeToReminderChanges(() => {
      void refreshOsSchedules();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        pollDueReminders();
        void refreshOsSchedules();
      }
    });
    const pollTimer = setInterval(pollDueReminders, IN_APP_POLL_MS);

    return () => {
      active = false;
      clearInAppTimers();
      reminderSubscription();
      appStateSubscription.remove();
      tokenSubscription?.remove();
      receivedSubscription?.remove();
      clearInterval(pollTimer);
    };
  }, [email, profiles, activeProfile]);
}
