import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countReminderOccurrences,
  formatDateDigits,
  formatReminderTime,
  formatTimeDigits,
  groupRemindersByOccurrenceDate,
  groupUpcomingReminders,
  parseDateInput,
  parseReminderStartDate,
  parseReminderTime,
  parseTimeInput,
} from '../reminderDates.ts';

function reminder(id, startDate) {
  return {
    id,
    medicine: 'Medicine',
    category: 'Tablet',
    instructions: '',
    time: '10:00 AM',
    frequency: 'Daily',
    startDate,
    member: 'Me',
    notes: '',
    enabled: true,
  };
}

test('groups each daily occurrence and the next later date after the start date', () => {
  const now = new Date(2026, 10, 20, 23, 30);
  const groups = groupRemindersByOccurrenceDate([
    reminder('daily', 'Nov 18, 2026'),
    reminder('starts-tomorrow', 'Nov 21, 2026'),
  ], now);

  assert.deepEqual(groups.map((group) => group.title.split(' - ')[0]), [
    'Yesterday',
    'Today',
    'Tomorrow',
    'Sunday, Nov 22, 2026',
  ]);
  assert.deepEqual(groups.map((group) => group.reminders.map((item) => item.id)), [
    ['daily'],
    ['daily'],
    ['daily', 'starts-tomorrow'],
    ['daily', 'starts-tomorrow'],
  ]);
});

test('counts each displayed occurrence separately, including reminders for the same medicine', () => {
  const groups = groupRemindersByOccurrenceDate([
    reminder('morning', 'Nov 18, 2026'),
    { ...reminder('evening', 'Nov 18, 2026'), time: '8:00 PM' },
  ], new Date(2026, 10, 20, 9));

  assert.equal(countReminderOccurrences(groups), 8);
});

test('places Weekly reminders on nearby and next later recurrence dates', () => {
  const now = new Date(2026, 10, 20, 9);
  const groups = groupRemindersByOccurrenceDate([
    { ...reminder('weekly-today', 'Nov 13, 2026'), frequency: 'Weekly' },
    { ...reminder('weekly-tomorrow', 'Nov 14, 2026'), frequency: 'Weekly' },
    { ...reminder('weekly-later', 'Nov 16, 2026'), frequency: 'Weekly' },
  ], now);

  assert.deepEqual(groups.map((group) => group.title.split(' - ')[0]), [
    'Today',
    'Tomorrow',
    'Monday, Nov 23, 2026',
    'Friday, Nov 27, 2026',
    'Saturday, Nov 28, 2026',
  ]);
  assert.deepEqual(groups.map((group) => group.reminders.map((item) => item.id)), [
    ['weekly-today'],
    ['weekly-tomorrow'],
    ['weekly-later'],
    ['weekly-today'],
    ['weekly-tomorrow'],
  ]);
});

test('keeps As needed reminders in their own section', () => {
  const groups = groupRemindersByOccurrenceDate([
    { ...reminder('as-needed', 'Nov 20, 2026'), frequency: 'As needed' },
  ], new Date(2026, 10, 20));

  assert.deepEqual(groups.map((group) => group.title), ['As needed']);
  assert.equal(groups[0].reminders[0].id, 'as-needed');
});

test('limits the collapsed view to the three nearest future enabled occurrences', () => {
  const now = new Date(2026, 10, 20, 11, 30);
  const groups = groupUpcomingReminders([
    { ...reminder('past-time', 'Nov 1, 2026'), time: '10:00 AM' },
    { ...reminder('today', 'Nov 1, 2026'), time: '12:00 PM' },
    { ...reminder('tomorrow-first', 'Nov 1, 2026'), time: '8:00 AM' },
    { ...reminder('tomorrow-second', 'Nov 1, 2026'), time: '10:00 AM' },
    { ...reminder('tomorrow-third', 'Nov 1, 2026'), time: '11:00 AM' },
    { ...reminder('disabled', 'Nov 1, 2026'), enabled: false },
    { ...reminder('as-needed', 'Nov 1, 2026'), frequency: 'As needed' },
  ], now);

  assert.deepEqual(groups.map((group) => group.title.split(' - ')[0]), ['Today', 'Tomorrow']);
  assert.deepEqual(groups.map((group) => group.reminders.map((item) => item.id)), [
    ['today'],
    ['tomorrow-first', 'past-time'],
  ]);
});

test('expanded grouping retains passed and disabled reminders', () => {
  const groups = groupRemindersByOccurrenceDate([
    { ...reminder('disabled-daily', 'Nov 18, 2026'), enabled: false },
  ], new Date(2026, 10, 20, 11));

  assert.deepEqual(groups.map((group) => group.title.split(' - ')[0]), [
    'Yesterday',
    'Today',
    'Tomorrow',
    'Sunday, Nov 22, 2026',
  ]);
  assert.ok(groups.every((group) => group.reminders[0].id === 'disabled-daily'));
});

test('keeps adjacent and next occurrence dates across a DST transition', () => {
  const now = new Date(2026, 2, 8, 23, 30);
  const groups = groupRemindersByOccurrenceDate(
    [
      reminder('daily', 'Mar 7, 2026'),
      { ...reminder('weekly', 'Mar 1, 2026'), frequency: 'Weekly' },
    ],
    now,
  );

  assert.deepEqual(groups.map((group) => group.title.split(' - ')[0]), [
    'Yesterday',
    'Today',
    'Tomorrow',
    'Tuesday, Mar 10, 2026',
    'Sunday, Mar 15, 2026',
  ]);
  assert.deepEqual(groups.map((group) => group.reminders.map((item) => item.id)), [
    ['daily'],
    ['daily', 'weekly'],
    ['daily'],
    ['daily'],
    ['weekly'],
  ]);
});

test('rejects invalid calendar dates and out-of-range time values', () => {
  assert.equal(parseReminderStartDate('Feb 29, 2025'), null);
  assert.equal(parseDateInput('02/31/2026'), null);
  assert.equal(parseReminderTime('13:00 PM'), null);
  assert.equal(parseReminderTime('10:60 AM'), null);
  assert.equal(parseTimeInput('00:00', 'AM'), null);
  assert.equal(parseTimeInput('13:00', 'PM'), null);
  assert.equal(parseTimeInput('12:60', 'PM'), null);
});

test('formats numeric-only web input and parses valid values', () => {
  assert.equal(formatDateDigits('02ab292026'), '02/29/2026');
  assert.equal(formatTimeDigits('14x30'), '14:30');
  assert.equal(parseDateInput('02/28/2026')?.getDate(), 28);
  assert.equal(parseTimeInput('01:30', 'AM')?.getHours(), 1);
  assert.equal(parseTimeInput('12:30', 'PM')?.getHours(), 12);
  assert.equal(parseTimeInput('12:30', 'AM')?.getHours(), 0);
  assert.equal(formatReminderTime(parseTimeInput('01:30', 'PM')), '1:30 PM');
  assert.equal(parseReminderTime('12:15 AM')?.getHours(), 0);
  assert.equal(parseReminderTime('12:15 PM')?.getHours(), 12);
});
