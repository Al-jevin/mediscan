import { apiRequest } from '@/mock/mockAuth';

export type NotificationItem = {
  id: string;
  type: 'medication_reminder';
  title: string;
  message: string;
  profile_id: string;
  profile_display_name: string;
  scheduled_at: string;
};

type Envelope<T> = { success: boolean; data: T };

function localDateTime(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return [
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`,
  ].join('');
}

export async function fetchNotifications(
  profileIds: string[],
  horizonDays = 7,
): Promise<NotificationItem[]> {
  if (profileIds.length === 0) return [];
  const query = [
    ...profileIds.map((profileId) => `profile_ids=${encodeURIComponent(profileId)}`),
    `horizon_days=${horizonDays}`,
    `local_now=${encodeURIComponent(localDateTime(new Date()))}`,
  ].join('&');
  const response = await apiRequest<Envelope<NotificationItem[]>>(
    `/accounts/me/notifications?${query}`,
    'GET',
  );
  return response.data;
}

export async function registerDevicePushToken(
  pushToken: string,
  platform: 'ios' | 'android',
): Promise<void> {
  await apiRequest<{ success: boolean; code: number; message: string }>(
    '/accounts/me/notifications/device-token',
    'POST',
    { push_token: pushToken, platform },
  );
}

export async function revokeDevicePushToken(pushToken: string): Promise<void> {
  await apiRequest<{ success: boolean; code: number; message: string }>(
    '/accounts/me/notifications/device-token',
    'DELETE',
    { push_token: pushToken },
  );
}
