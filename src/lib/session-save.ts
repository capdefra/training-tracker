import { isISODate } from './dates';
import type { Draft } from './draft';
import { exercisesToSession } from './draft';
import { parseNum } from './format';
import { readWatch } from './watch';
import type { Session } from '../types';

/** The session object the log has always written. Empty exercises are omitted. */
export function sessionFromDraft(draft: Draft, id: string, createdAt: string): Session | string {
  if (!isISODate(draft.date)) return 'Pick a date.';
  const link = {
    goalId: draft.goalId || null,
    planId: draft.planId || null,
    planSessionId: draft.planSessionId || null,
  };
  if (draft.kind === 'strength') {
    const exercises = exercisesToSession(draft.exercises);
    if (typeof exercises === 'string') return exercises;
    const watch = readWatch(draft, false);
    if (typeof watch === 'string') return watch;
    return {
      id,
      date: draft.date,
      kind: 'strength',
      title: draft.title.trim() || exercises[0]?.name || 'Strength',
      notes: draft.notes.trim(),
      ...link,
      exercises,
      ...metricsFromWatch(watch, false, null),
      createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  const distance = parseNum(draft.distanceKm);
  if (draft.distanceKm.trim() && distance === null) return 'Distance needs to be a number.';
  if (distance !== null && distance < 0) return 'Distance can’t be negative.';
  const watch = readWatch(draft, true);
  if (typeof watch === 'string') return watch;
  return {
    id,
    date: draft.date,
    kind: 'run',
    title: draft.title.trim() || 'Run',
    notes: draft.notes.trim(),
    ...link,
    exercises: [],
    ...metricsFromWatch(watch, true, distance),
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function metricsFromWatch(watch: Exclude<ReturnType<typeof readWatch>, string>, run: boolean, distance: number | null) {
  return {
    distanceKm: run && distance !== null && distance > 0 ? Math.round(distance * 100) / 100 : null,
    durationSec: watch.durationSec,
    elevationM: run ? watch.elevationM : null,
    effort: watch.effort,
    paceSec: run ? watch.paceSec : null,
    heartRate: watch.heartRate,
    activeKcal: watch.activeKcal,
    totalKcal: watch.totalKcal,
    cadenceSpm: run ? watch.cadenceSpm : null,
    powerW: run ? watch.powerW : null,
    place: watch.place,
    source: watch.source,
    activity: watch.activity,
    startTime: watch.startTime,
    endTime: watch.endTime,
    weather: watch.weather,
    splits: run ? watch.splits : [],
  };
}
