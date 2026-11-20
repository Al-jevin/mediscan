import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'mediscan-reminders-v2';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initLocalNotifications(): Promise<{
  granted: boolean;
  channelId?: string;
}> {
  if (Platform.OS === 'web') return { granted: false };

  let activeChannelId: string | undefined;
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.MAX,
      });
      activeChannelId = CHANNEL_ID;
    } catch (err) {
      // Fall back to Expo's default channel if custom channel creation fails in Expo Go
      console.warn('[Notif] channel setup skipped, using default channel:', err);
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  console.log('[Notif] existing permission:', status, 'canAskAgain:', existing.canAskAgain);

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
    console.log('[Notif] requested permission:', status);
  }

  if (status !== 'granted') {
    Alert.alert(
      'Notifications blocked',
      'Open Android Settings → Apps → Expo Go → Notifications and turn them on.',
    );
    return { granted: false };
  }

  return { granted: true, channelId: activeChannelId };
}

export async function sendTestNotification(): Promise<void> {
  try {
    const { granted, channelId } = await initLocalNotifications();
    if (!granted) return;

    // 1) Immediate notification
    const immediateId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MediScan Instant Test',
        body: 'Notifications are working.',
        sound: true,
      },
      trigger: null,
    });
    console.log('[Notif] immediate scheduled:', immediateId);

    // 2) 5-second delayed notification (minimize Expo Go right after tapping Test)
    const delayedId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'MediScan 5s Reminder',
        body: 'Time to take Paracetamol 500 mg',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        repeats: false,
        ...(channelId ? { channelId } : {}),
      },
    });
    console.log('[Notif] 5s scheduled:', delayedId);
  } catch (err) {
    console.error('[Notif] failed:', err);
    Alert.alert('Notification error', err instanceof Error ? err.message : String(err));
  }
}