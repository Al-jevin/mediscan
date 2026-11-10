import { apiRequest } from '@/mock/mockAuth';
import type { Profile } from '@/types/profile';
import type { Reminder } from '@/components/reminderTypes';
import { formatTime } from '@/utils/medicine';

type Schedule = {
  schedule_id: number;
  profile_id: string;
  fda_id: number;
  sched_is_active: boolean;
  sched_frequency_type: 'daily' | 'weekly' | 'as_needed';
  sched_reminder_time: string[];
  sched_start_date: string;
  sched_end_date: string | null;
  sched_notes: string | null;
  fda_genericname: string;
  fda_brandname: string | null;
  fda_dosage_form: string | null;
  fda_dosage_strength: string | null;
};

type Envelope<T> = { success: boolean; data: T };

function displayDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function frequencyToDisplay(value: Schedule['sched_frequency_type']): Reminder['frequency'] {
  if (value === 'as_needed') return 'As needed';
  return value === 'weekly' ? 'Weekly' : 'Daily';
}

function frequencyToApi(value: Reminder['frequency']): Schedule['sched_frequency_type'] {
  if (value === 'As needed') return 'as_needed';
  return value === 'Weekly' ? 'weekly' : 'daily';
}

function parseStartDate(value: string): Date | null {
  const match = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  const date = new Date(Number(match[3]), month, Number(match[2]));
  return date.getMonth() === month && date.getDate() === Number(match[2]) ? date : null;
}

function toReminder(schedule: Schedule, profile: Profile): Reminder {
  return {
    id: String(schedule.schedule_id),
    profile_id: schedule.profile_id,
    fda_id: schedule.fda_id,
    medicine: schedule.fda_brandname?.trim() || schedule.fda_genericname,
    category: schedule.fda_dosage_form ?? 'Medicine',
    instructions: schedule.fda_dosage_strength ?? '',
    time: formatTime(schedule.sched_reminder_time[0] ?? ''),
    frequency: frequencyToDisplay(schedule.sched_frequency_type),
    startDate: displayDate(schedule.sched_start_date),
    member: profile.profile_display_name,
    notes: schedule.sched_notes ?? '',
    enabled: schedule.sched_is_active,
  };
}

export async function fetchReminders(profiles: Profile[]): Promise<Reminder[]> {
  const lists = await Promise.all(
    profiles.map(async (profile) => {
      const response = await apiRequest<Envelope<Schedule[]>>(
        `/accounts/me/profiles/${encodeURIComponent(profile.profile_id)}/schedules`,
        'GET',
      );
      return response.data.map((schedule) => toReminder(schedule, profile));
    }),
  );
  return lists.flat();
}

function reminderPayload(reminder: Reminder) {
  if (!reminder.fda_id) throw new Error('Choose a medicine from your vault.');
  const start = parseStartDate(reminder.startDate);
  if (!start) throw new Error('Enter a valid reminder start date.');
  const time = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(reminder.time.trim());
  if (!time) throw new Error('Enter a valid reminder time.');
  let hour = Number(time[1]) % 12;
  if (time[3].toUpperCase() === 'PM') hour += 12;

  return {
    fda_id: reminder.fda_id,
    sched_frequency_type: frequencyToApi(reminder.frequency),
    sched_reminder_time: [`${String(hour).padStart(2, '0')}:${time[2]}:00`],
    sched_start_date: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
    sched_notes: reminder.notes.trim() || null,
  };
}

export async function createReminder(reminder: Reminder): Promise<Reminder> {
  if (!reminder.profile_id) throw new Error('Choose the profile for this reminder.');
  const response = await apiRequest<Envelope<Schedule>>(
    `/accounts/me/profiles/${encodeURIComponent(reminder.profile_id)}/schedules`,
    'POST',
    reminderPayload(reminder),
  );
  return {
    ...reminder,
    id: String(response.data.schedule_id),
    profile_id: response.data.profile_id,
    fda_id: response.data.fda_id,
    enabled: response.data.sched_is_active,
  };
}

export async function updateReminder(reminder: Reminder): Promise<void> {
  if (!reminder.profile_id || !/^\d+$/.test(reminder.id)) {
    throw new Error('This reminder is not linked to a saved database record.');
  }
  await apiRequest<Envelope<Schedule>>(
    `/accounts/me/profiles/${encodeURIComponent(reminder.profile_id)}/schedules/${encodeURIComponent(reminder.id)}`,
    'PATCH',
    { ...reminderPayload(reminder), sched_is_active: reminder.enabled },
  );
}

export async function deleteReminder(reminder: Reminder): Promise<void> {
  if (!reminder.profile_id || !/^\d+$/.test(reminder.id)) {
    throw new Error('This reminder is not linked to a saved database record.');
  }
  await apiRequest<{ success: boolean; message: string }>(
    `/accounts/me/profiles/${encodeURIComponent(reminder.profile_id)}/schedules/${encodeURIComponent(reminder.id)}`,
    'DELETE',
  );
}
