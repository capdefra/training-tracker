export function trimNum(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function parseNum(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '—';
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Accepts 6:42, 6'42", and 6:42 /km. */
export function parsePace(value: string): number | null {
  const trimmed = value
    .trim()
    .toLowerCase()
    .replace(/\/\s*km\b/g, '')
    .replace(/[″”"]/g, '')
    .replace(/[′'’]/g, ':')
    .replace(/\s+/g, '');
  if (!trimmed) return null;
  const clock = /^(\d+):(\d{1,2})$/.exec(trimmed);
  if (!clock) return null;
  const seconds = Number(clock[2]);
  if (seconds > 59) return null;
  const total = Number(clock[1]) * 60 + seconds;
  return total > 0 ? total : null;
}

/**
 * Workout time. `33:57` and `0:33:57` are clock times.
 * A plain number is minutes, so an older “25” entry still means 25:00.
 */
export function parseDuration(value: string): number | null {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!trimmed) return null;
  const clock = /^(?:(\d+):)?(\d+):(\d{2})$/.exec(trimmed);
  if (clock) {
    const hours = clock[1] ? Number(clock[1]) : 0;
    const minutes = Number(clock[2]);
    const seconds = Number(clock[3]);
    if (seconds > 59) return null;
    if (clock[1] && minutes > 59) return null;
    return hours * 3600 + minutes * 60 + seconds;
  }
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 60;
  return null;
}

export function formatKm(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/** Apple Watch effort bands: 1–3 easy, 4–6 moderate, 7–8 hard, 9–10 all out. */
export function effortLabel(effort: number): string {
  if (effort <= 3) return 'Easy';
  if (effort <= 6) return 'Moderate';
  if (effort <= 8) return 'Hard';
  return 'All Out';
}

export function formatDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '—';
  const total = Math.round(totalSec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatKg(value: number): string {
  return `${trimNum(value)} kg`;
}
