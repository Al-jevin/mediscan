import type { Reminder } from '../components/reminderTypes';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseReminderStartDate(value: string | undefined): Date | null {
  const match = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec((value ?? '').trim());
  if (!match) return null;
  const month = MONTHS.indexOf(match[1].toLowerCase());
  if (month < 0) return null;
  const year = Number(match[3]);
  const day = Number(match[2]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

export function formatReminderStartDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function parseReminderTime(value: string | undefined): Date | null {
  const match = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec((value ?? '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const date = new Date();
  date.setHours((hour % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0), minute, 0, 0);
  return date;
}

export function formatReminderTime(date: Date): string {
  const hour = date.getHours();
  return `${hour % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatDateDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export function parseDateInput(value: string): Date | null {
  const match = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]) - 1;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

export function formatTimeDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function parseTimeInput(value: string, period: 'AM' | 'PM'): Date | null {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const date = new Date();
  const hour = Number(match[1]) % 12 + (period === 'PM' ? 12 : 0);
  date.setHours(hour, Number(match[2]), 0, 0);
  return date;
}

export type ReminderDateGroup = {
  key: string;
  title: string;
  reminders: Reminder[];
  dayOrdinal: number | null;
};

export type ScheduledReminderOccurrence = {
  reminder: Reminder;
  date: Date;
};

function dayOrdinal(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createDateGroup(date: Date, todayOrdinal: number): ReminderDateGroup {
  const ordinal = dayOrdinal(date);
  const difference = ordinal - todayOrdinal;
  const relativeTitle = difference === -1
    ? 'Yesterday'
    : difference === 0
      ? 'Today'
      : difference === 1
        ? 'Tomorrow'
        : null;
  const title = relativeTitle
    ? `${relativeTitle} - ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
    : date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  return { key: dateKey(date), title, reminders: [], dayOrdinal: ordinal };
}

function addToDateGroup(
  groups: Map<string, ReminderDateGroup>,
  reminder: Reminder,
  date: Date,
  todayOrdinal: number,
): void {
  const key = dateKey(date);
  const group = groups.get(key) ?? createDateGroup(date, todayOrdinal);
  group.reminders.push(reminder);
  groups.set(key, group);
}

function addToUnscheduledGroup(
  groups: Map<string, ReminderDateGroup>,
  reminder: Reminder,
  key: string,
  title: string,
): void {
  const group = groups.get(key) ?? {
    key,
    title,
    reminders: [],
    dayOrdinal: null,
  };
  group.reminders.push(reminder);
  groups.set(key, group);
}

function sortDateGroups(groups: Map<string, ReminderDateGroup>): ReminderDateGroup[] {
  return [...groups.values()].sort((a, b) => {
    if (a.dayOrdinal === null) return b.dayOrdinal === null ? 0 : 1;
    if (b.dayOrdinal === null) return -1;
    return a.dayOrdinal - b.dayOrdinal;
  });
}

export function countReminderOccurrences(groups: ReminderDateGroup[]): number {
  return groups.reduce((count, group) => count + group.reminders.length, 0);
}

export function getNextReminderOccurrence(
  reminder: Reminder,
  now = new Date(),
): Date | null {
  if (reminder.frequency === 'As needed') return null;
  const start = parseReminderStartDate(reminder.startDate);
  const time = parseReminderTime(reminder.time);
  if (!start || !time) return null;

  const step = reminder.frequency === 'Weekly' ? 7 : 1;
  let day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dayOrdinal(day) < dayOrdinal(start)) day = new Date(start);
  if (step === 7) {
    const offset = (start.getDay() - day.getDay() + 7) % 7;
    day.setDate(day.getDate() + offset);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const occurrence = new Date(day);
    occurrence.setHours(time.getHours(), time.getMinutes(), 0, 0);
    if (occurrence > now) return occurrence;
    day.setDate(day.getDate() + step);
  }
  return null;
}

export function groupUpcomingReminders(
  reminders: Reminder[],
  now = new Date(),
  limit = 3,
): ReminderDateGroup[] {
  const occurrences: ScheduledReminderOccurrence[] = reminders
    .filter((reminder) => reminder.enabled)
    .flatMap((reminder) => {
      const date = getNextReminderOccurrence(reminder, now);
      return date ? [{ reminder, date }] : [];
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, Math.max(0, limit));

  const todayOrdinal = dayOrdinal(now);
  const groups = new Map<string, ReminderDateGroup>();
  for (const occurrence of occurrences) {
    addToDateGroup(groups, occurrence.reminder, occurrence.date, todayOrdinal);
  }
  return sortDateGroups(groups);
}

export function groupRemindersByOccurrenceDate(
  reminders: Reminder[],
  now = new Date(),
): ReminderDateGroup[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayOrdinal = dayOrdinal(today);
  const groups = new Map<string, ReminderDateGroup>();

  for (const reminder of reminders) {
    if (reminder.frequency === 'As needed') {
      addToUnscheduledGroup(groups, reminder, 'as-needed', 'As needed');
      continue;
    }

    const date = parseReminderStartDate(reminder.startDate);
    if (!date) {
      addToUnscheduledGroup(groups, reminder, 'undated', 'Date unavailable');
      continue;
    }

    const startOrdinal = dayOrdinal(date);
    for (const offset of [-1, 0, 1]) {
      const occurrence = new Date(today);
      occurrence.setDate(occurrence.getDate() + offset);
      const occurrenceOrdinal = dayOrdinal(occurrence);
      if (occurrenceOrdinal < startOrdinal) continue;
      if (reminder.frequency === 'Weekly' && (occurrenceOrdinal - startOrdinal) % 7 !== 0) continue;
      addToDateGroup(groups, reminder, occurrence, todayOrdinal);
    }

    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + 2);
    if (dayOrdinal(nextDate) < startOrdinal) nextDate.setTime(date.getTime());
    if (reminder.frequency === 'Weekly') {
      const offset = (date.getDay() - nextDate.getDay() + 7) % 7;
      nextDate.setDate(nextDate.getDate() + offset);
    }
    addToDateGroup(groups, reminder, nextDate, todayOrdinal);
  }

  return sortDateGroups(groups);
}
