const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const DAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
] as const;

export function parseISODate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date(NaN);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function isISODate(iso: string): boolean {
  return !Number.isNaN(parseISODate(iso).getTime());
}

/** True only when `iso` is a real calendar day. `2026-02-31` is not. */
export function isRealISODate(iso: string): boolean {
  if (!isISODate(iso)) return false;
  return toISODate(parseISODate(iso)) === iso;
}

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function startOfWeek(iso: string): string {
  const date = parseISODate(iso);
  const day = date.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + delta);
  return toISODate(date);
}

export function weekdayIndex(iso: string): number {
  return parseISODate(iso).getDay();
}

export function weekdayLabel(day: number, length: 'short' | 'long' = 'short'): string {
  const index = ((day % 7) + 7) % 7;
  return length === 'long' ? WEEKDAYS_LONG[index] : WEEKDAYS[index];
}

export function formatWeekday(iso: string, length: 'short' | 'long' = 'short'): string {
  return weekdayLabel(weekdayIndex(iso), length);
}

export function formatDayMonth(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatPretty(iso: string): string {
  const date = parseISODate(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatLong(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

export function daysBetween(from: string, to: string): number {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function formatCountdown(today: string, target: string): string {
  const left = daysBetween(today, target);
  if (left > 1) return `${left} days to go`;
  if (left === 1) return 'Tomorrow';
  if (left === 0) return 'Target day';
  if (left === -1) return '1 day past target';
  return `${Math.abs(left)} days past target`;
}
