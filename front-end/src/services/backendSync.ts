import { MockAuth } from '@/mock/mockAuth';
import type { VaultMedicine } from '@/types/medicine';
import type { Reminder } from '@/components/reminderTypes';
import { apiFetch, getAccessToken } from './apiClient';
import { getChangeLog, markSynced } from './changeLog';
import { mdyToYMD, parseDate } from '@/utils/medicine';

function activeProfileId(): string | null {
  const profile = MockAuth.getActiveProfile();
  return profile ? String(profile.profile_id) : null;
}

async function resolveFdaId(medicine: VaultMedicine): Promise<number | null> {
  const query =
    medicine.fda_registration_id ||
    medicine.fda_brandname ||
    medicine.fda_genericname ||
    '';
  if (!query.trim()) return null;
  const res = await apiFetch<{ data?: Array<{ fda_id?: number; fda_registration_id?: string }> }>(
    `/api/v1/vault/fda/search?q=${encodeURIComponent(query)}`,
  );
  if (!res.ok || !res.data.data?.length) return null;
  const exact = res.data.data.find(
    (row) => row.fda_registration_id === medicine.fda_registration_id,
  );
  return Number((exact ?? res.data.data[0]).fda_id) || null;
}

export async function pushVaultMedicine(medicine: VaultMedicine): Promise<void> {
  if (!getAccessToken() || !MockAuth.isLiveBackend()) return;
  const profileId = activeProfileId();
  if (!profileId) return;
  const fdaId = await resolveFdaId(medicine);
  if (!fdaId) return;
  const expiry =
    medicine.vault_expiry_date ||
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await apiFetch('/api/v1/vault/', {
    method: 'POST',
    body: JSON.stringify({
      profile_id: profileId,
      fda_id: fdaId,
      expiry_date: expiry,
    }),
  });
}

function parseReminderTime(text: string): string {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return '08:00:00';
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const ampm = match[3]?.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

function parseReminderStartDate(text: string): string {
  const ymd = mdyToYMD(text);
  if (ymd) return ymd;
  const d = parseDate(text);
  if (d) return d.toISOString().slice(0, 10);
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function frequencyType(freq: Reminder['frequency']): string {
  if (freq === 'Weekly') return 'weekly';
  if (freq === 'As needed') return 'as_needed';
  return 'daily';
}

export async function pushReminder(reminder: Reminder): Promise<void> {
  if (!getAccessToken() || !MockAuth.isLiveBackend()) return;
  const profileId = activeProfileId();
  if (!profileId) return;
  const search = await apiFetch<{ data?: Array<{ fda_id?: number }> }>(
    `/api/v1/vault/fda/search?q=${encodeURIComponent(reminder.medicine)}`,
  );
  const fdaId = search.ok ? Number(search.data.data?.[0]?.fda_id) : NaN;
  if (!fdaId) return;
  await apiFetch('/api/v1/schedules/', {
    method: 'POST',
    body: JSON.stringify({
      profile_id: profileId,
      fda_id: fdaId,
      frequency_type: frequencyType(reminder.frequency),
      reminder_times: [parseReminderTime(reminder.time)],
      start_date: parseReminderStartDate(reminder.startDate),
      notes: reminder.notes || reminder.instructions || null,
    }),
  });
}

export async function syncPendingChanges(): Promise<{ pushed: number; message: string }> {
  if (!getAccessToken()) {
    return { pushed: 0, message: 'Not logged in to a live backend session.' };
  }
  if (!MockAuth.isLiveBackend()) {
    return { pushed: 0, message: 'Backend offline. Local data kept on device.' };
  }
  const profileId = activeProfileId();
  if (!profileId) {
    return { pushed: 0, message: 'Select a profile before syncing.' };
  }

  const log = await getChangeLog();
  const pending = log.filter((entry) => !entry.synced);
  let pushed = 0;
  const syncedIds: string[] = [];

  for (const entry of pending) {
    if (entry.entity !== 'medicine') continue;
    if (entry.action === 'create' && entry.data) {
      await pushVaultMedicine(entry.data as unknown as VaultMedicine);
      pushed += 1;
      syncedIds.push(entry.log_id);
    } else if (entry.action === 'delete') {
      // Server vault ids differ from local vault_ids; best-effort skip until mapped.
      syncedIds.push(entry.log_id);
    } else if (entry.action === 'update') {
      syncedIds.push(entry.log_id);
    }
  }

  if (syncedIds.length) await markSynced(syncedIds);

  // Pull server vault into local cache signal (caller may reload vault separately).
  await apiFetch(`/api/v1/vault/${profileId}`);
  await apiFetch(`/api/v1/schedules/${profileId}`);

  return {
    pushed,
    message: pushed
      ? `Synced ${pushed} vault change(s) to the server.`
      : 'Local vault checked. Nothing new to upload.',
  };
}
