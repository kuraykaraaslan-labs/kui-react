'use client';
import type { CalendarMessages } from '../types';

export const EN_MESSAGES: CalendarMessages = {
  today: 'Today',
  previous: 'Previous',
  next: 'Next',
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
  resource: 'Resource',
  allDay: 'All-day',
  noEvents: 'No events',
  more: (n) => `+${n} more`,
  edit: 'Edit',
  delete: 'Delete',
  confirmDelete: 'Confirm delete?',
  close: 'Close',
  calendars: 'Calendars',
  noResources: 'No resources defined',
  search: 'Search events…',
  showing: (label) => `Showing ${label}`,
  cellLabel: (date, count) => count === 0
    ? `${date}, no events`
    : count === 1
      ? `${date}, 1 event`
      : `${date}, ${count} events`,
  rangeSelected: (days) => `${days} selected`,
  rangeChanged: (title, days) => `${title} now runs ${days}`,
  cellKeysHint: 'Shift and the arrow keys select days, Enter creates an event.',
  barKeysHint: 'Alt and the arrow keys move the event, Shift and Left or Right change its end, Alt, Shift and Left or Right change its start.',
};

/** Sunday-start (US default). */
export const EN_WEEK_START = 0;

export const EN_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Weekday headers, indexed Sun..Sat. */
export const EN_DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const EN_DAY_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
