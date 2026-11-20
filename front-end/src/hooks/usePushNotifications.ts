import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  AndroidImportance,
  IosAuthorizationStatus,
} from 'expo-notifications';
import { useProfile } from '@/context/ProfileContext';
import {
  fetchNotifications,
  registerDevicePushToken,
} from '@/services/notificationsApi';
import { subscribeToReminderChanges } from '@/services/remindersApi';

const LOCAL_NOTIFICATION_SOURCE = 'mediscan.schedule';
const ANDROID_CHANNEL_ID = 'medication-reminders';
const MAX_SCHEDULED_NOTIFICATIONS = 60;

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function cancelManagedNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(
        (notification) =>
          notification.content.data?.source === LOCAL_NOTIFICATION_SOURCE,
      )
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(
          notification.identifier,
        ),
      ),
  );
}

function isPermissionGranted(
  permission: Notifications.NotificationPermissionsStatus,
): boolean {
  return (
    permission.granted ||
    permission.ios?.status === IosAuthorizationStatus.PROVISIONAL
  );
}

async function syncDeviceToken(
  token: Notifications.DevicePushToken,
): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  if (typeof token.data !== 'string' || token.data.length === 0) {
    throw new Error('The device returned an invalid notification token.');
  }
  await registerDevicePushToken(token.data, Platform.OS);
}

export function usePushNotifications(): void {
  const { email, profiles, activeProfile } = useProfile();

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let refreshRequested = false;
    let askedForPermission = false;
    let tokenSubscription: Notifications.EventSubscription | null = null;
    const profileIds = profiles.map((profile) => profile.profile_id);

    const refresh = async () => {
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
      if (refreshing) {
        refreshRequested = true;
        return;
      }
      refreshing = true;
      try {
        if (!email || !activeProfile || profileIds.length === 0) {
          await cancelManagedNotifications();
          return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
            name: 'Medication reminders',
            importance: AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
          });
        }

        let permission = await Notifications.getPermissionsAsync();
        if (
          !isPermissionGranted(permission) &&
          permission.canAskAgain &&
          !askedForPermission
        ) {
          askedForPermission = true;
          permission = await Notifications.requestPermissionsAsync();
        }

        if (!isPermissionGranted(permission)) {
          await cancelManagedNotifications();
          return;
        }

        const notifications = await fetchNotifications(profileIds, 30);
        if (!active) return;

        await cancelManagedNotifications();
        const now = Date.now();
        const upcoming = notifications
          .map((notification) => ({
            notification,
            date: new Date(notification.scheduled_at),
          }))
          .filter(({ date }) => Number.isFinite(date.getTime()) && date.getTime() > now)
          .slice(0, MAX_SCHEDULED_NOTIFICATIONS);

        for (const { notification, date } of upcoming) {
          if (!active) return;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: notification.title,
              body: notification.message,
              sound: 'default',
              data: {
                source: LOCAL_NOTIFICATION_SOURCE,
                profile_id: notification.profile_id,
                notification_id: notification.id,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date,
              ...(Platform.OS === 'android'
                ? { channelId: ANDROID_CHANNEL_ID }
                : {}),
            },
          });
        }

        if (
          active &&
          Device.isDevice &&
          (Platform.OS === 'ios' || Platform.OS === 'android')
        ) {
          if (!tokenSubscription) {
            tokenSubscription = Notifications.addPushTokenListener((token) => {
              if (!active) return;
              void syncDeviceToken(token).catch((error: unknown) => {
                console.warn('[Notifications] Could not update device token:', error);
              });
            });
          }
          await syncDeviceToken(await Notifications.getDevicePushTokenAsync());
        }
      } catch (error) {
        console.warn(
          '[Notifications] Could not synchronize device notifications:',
          error,
        );
      } finally {
        refreshing = false;
        if (refreshRequested && active) {
          refreshRequested = false;
          void refresh();
        }
      }
    };

    void refresh();
    const reminderSubscription = subscribeToReminderChanges(() => {
      void refresh();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });

    return () => {
      active = false;
      reminderSubscription();
      appStateSubscription.remove();
      tokenSubscription?.remove();
    };
  }, [email, profiles, activeProfile]);
}
