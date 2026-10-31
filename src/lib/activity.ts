import type { Session } from '../types';
import { extraLogsForDay, type PlanItem } from './plans';

/**
 * How one Activity square reads.
 * `done` is a solid square: every repeating session that day is done.
 * `extra` is the dim square: nothing repeating was scheduled, and an extra was completed.
 * `skipped` is an outline: a past day still has a repeating session open.
 * `neutral` is a rest day, a future day, or today before the planned workout is done.
 */
export type ActivityMark = 'neutral' | 'skipped' | 'done' | 'extra';

export interface ActivityDay {
  mark: ActivityMark;
  /** Gold border. An extra was completed, on top of whatever the square already shows. */
  extra: boolean;
}

/**
 * Scheduled work is a repeating session, including one moved onto this date.
 * An extra is a done `plan.extras` card, a log whose id is `extra:<presetId>`,
 * or any saved session that is not already the scheduled workout.
 */
export function activityDay(date: string, today: string, planned: PlanItem[], unplanned: Session[]): ActivityDay {
  const scheduled = planned.filter((item) => !item.extra);
  const extra = extraCompleted(planned, unplanned);
  const scheduledDone = scheduled.length > 0 && scheduled.every((item) => item.done);
  if (scheduledDone) return { mark: 'done', extra };
  if (scheduled.length === 0 && extra) return { mark: 'extra', extra: true };
  if (scheduled.length > 0 && date < today) return { mark: 'skipped', extra };
  return { mark: 'neutral', extra };
}

export function activitySummary(day: ActivityDay, scheduled = 0): string {
  if (day.mark === 'done' && day.extra) return 'planned workout done, plus an extra';
  if (day.mark === 'done') return 'planned workout done';
  if (day.mark === 'extra') return 'extra session';
  if (day.mark === 'skipped' && day.extra) return 'planned workout missed, extra logged';
  if (day.mark === 'skipped') return 'planned workout missed';
  if (day.mark === 'neutral' && scheduled > 0 && day.extra) return 'planned workout still open, extra logged';
  if (day.mark === 'neutral' && scheduled > 0) return 'planned workout still open';
  if (day.extra) return 'extra logged';
  return 'nothing planned';
}

/** The squares for one date, from the week’s plan cards and the day’s other logs. */
export function activityDayFor(date: string, today: string, planned: PlanItem[], sessions: Session[]): ActivityDay {
  const onDay = planned.filter((item) => item.date === date);
  return activityDay(date, today, onDay, extraLogsForDay(sessions, onDay, date));
}

function extraCompleted(planned: PlanItem[], unplanned: Session[]): boolean {
  if (unplanned.length > 0) return true;
  // A finished plan.extras card is done. Its log id is `extra:<presetId>`.
  // A short log stays on that card and does not count until the card is done.
  return planned.some((item) => item.extra && item.done);
}
