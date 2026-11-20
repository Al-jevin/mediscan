import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

const CHANNEL_ID = 'mediscan-reminders-v2';
const STORAGE_KEY = 'mediscan.scheduled-reminder-notifications.v1';

export type SchedulableReminder = {
  id: string;
  medicine: string;
  time: string;
  frequency?: string;
  instructions?: string;
  enabled: boolean;
};

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
      console.warn('[Notif] channel setup skipped, using default channel:', err);
    }
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
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

function parseReminderTime(timeStr: string): { hour: number; minute: number } | null {
  const value = timeStr.trim();

  // Matches 12-hour format: "8:05 AM", "12:30 pm", "09:00:00 AM"
  const match12 = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i.exec(value);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2]);
    const meridiem = match12[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (meridiem === 'AM') hour = hour === 12 ? 0 : hour;
    else hour = hour === 12 ? 12 : hour + 12;
    return { hour, minute };
  }

  // Matches 24-hour format: "08:05", "20:30", "10:00:00"
  const match24 = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
}

async function readIdMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeIdMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('[Notif] could not save notification ID map:', err);
  }
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const map = await readIdMap();
    const existingNotifId = map[reminderId];
    if (existingNotifId) {
      await Notifications.cancelScheduledNotificationAsync(existingNotifId);
      delete map[reminderId];
      await writeIdMap(map);
      console.log('[Notif] cancelled reminder:', reminderId);
    }
  } catch (err) {
    console.warn('[Notif] cancel failed:', err);
  }
}

export async function scheduleReminderNotification(
  reminder: SchedulableReminder,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    // Always clear any previous schedule for this reminder first
    await cancelReminderNotification(reminder.id);
    if (!reminder.enabled) return null;

    const parsed = parseReminderTime(reminder.time);
    if (!parsed) {
      console.warn('[Notif] could not parse reminder time:', reminder.time);
      return null;
    }

    const { granted, channelId } = await initLocalNotifications();
    if (!granted) return null;

    const freq = (reminder.frequency ?? 'daily').toLowerCase();
    const channelOpt = channelId ? { channelId } : {};

    let trigger: Notifications.NotificationTriggerInput;
    if (freq.includes('week')) {
      // Expo weekday is 1 (Sunday) through 7 (Saturday)
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: new Date().getDay() + 1,
        hour: parsed.hour,
        minute: parsed.minute,
        ...channelOpt,
      };
    } else if (freq.includes('need')) {
      // One-time alert at the next occurrence of the selected time
      const next = new Date();
      next.setHours(parsed.hour, parsed.minute, 0, 0);
      if (next.getTime() <= Date.now()) {
        next.setDate(next.getDate() + 1);
      }
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: next,
        ...channelOpt,
      };
    } else {
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsed.hour,
        minute: parsed.minute,
        ...channelOpt,
      };
    }

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication Reminder',
        body: reminder.instructions
          ? `Time to take ${reminder.medicine} (${reminder.instructions})`
          : `Time to take ${reminder.medicine}`,
        sound: true,
        data: { reminderId: reminder.id },
      },
      trigger,
    });

    const map = await readIdMap();
    map[reminder.id] = notifId;
    await writeIdMap(map);

    console.log(
      `[Notif] scheduled "${reminder.medicine}" (${freq}) at ${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')} -> ${notifId}`,
    );
    return notifId;
  } catch (err) {
    console.error('[Notif] schedule failed:', err);
    return null;
  }
}