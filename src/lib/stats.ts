import type { ExerciseEntry, Session, SetEntry } from '../types';
import { addDays, formatDayMonth, startOfWeek } from './dates';
import { trimNum } from './format';

export function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function bestSet(exercise: ExerciseEntry): { set: SetEntry; e1rm: number } | null {
  let best: { set: SetEntry; e1rm: number } | null = null;
  for (const set of exercise.sets) {
    const estimate = epley(set.weightKg, set.reps);
    const score = set.weightKg > 0 ? estimate : set.reps;
    const bestScore = best ? (best.set.weightKg > 0 ? best.e1rm : best.set.reps) : -1;
    if (!best || score > bestScore) best = { set, e1rm: estimate };
  }
  return best;
}

export function exerciseKey(name: string): string {
  return name.trim().toLowerCase();
}

export interface LiftPoint {
  date: string;
  reps: number;
  weightKg: number;
  e1rm: number;
  volume: number;
}

export function liftSeries(sessions: Session[], name: string, start: string | null, end: string): LiftPoint[] {
  const key = exerciseKey(name);
  const points: LiftPoint[] = [];
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  for (const session of sorted) {
    if (session.kind !== 'strength') continue;
    if (start && session.date < start) continue;
    if (session.date > end) continue;
    const matches = session.exercises.filter((exercise) => exerciseKey(exercise.name) === key);
    if (matches.length === 0) continue;
    let chosen: LiftPoint | null = null;
    for (const exercise of matches) {
      const best = bestSet(exercise);
      if (!best) continue;
      const volume = exercise.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0);
      const point = {
        date: session.date,
        reps: best.set.reps,
        weightKg: best.set.weightKg,
        e1rm: Math.round(best.e1rm * 10) / 10,
        volume,
      };
      if (!chosen || point.e1rm > chosen.e1rm || (point.e1rm === chosen.e1rm && point.weightKg > chosen.weightKg)) {
        chosen = point;
      }
    }
    if (chosen) points.push(chosen);
  }
  return points;
}

export interface ExerciseOption {
  key: string;
  label: string;
  count: number;
}

export function exerciseOptions(sessions: Session[]): ExerciseOption[] {
  const map = new Map<string, ExerciseOption>();
  for (const session of sessions) {
    if (session.kind !== 'strength') continue;
    for (const exercise of session.exercises) {
      const key = exerciseKey(exercise.name);
      if (!key) continue;
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { key, label: exercise.name.trim(), count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function lastExercise(sessions: Session[], name: string): ExerciseEntry | null {
  const key = exerciseKey(name);
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  for (const session of sorted) {
    const found = session.exercises.find((exercise) => exerciseKey(exercise.name) === key);
    if (found && found.sets.length > 0) return found;
  }
  return null;
}

export interface RunPoint {
  date: string;
  title: string;
  distanceKm: number;
  durationSec: number;
  paceSec: number;
  long: boolean;
}

export function runPoints(sessions: Session[], start: string | null, end: string): RunPoint[] {
  return sessions
    .filter((session) => session.kind === 'run' && session.distanceKm && session.durationSec && session.distanceKm > 0)
    .filter((session) => (!start || session.date >= start) && session.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => {
      const distanceKm = session.distanceKm ?? 0;
      const durationSec = session.durationSec ?? 0;
      const long = session.title.toLowerCase().includes('long') || distanceKm >= 12;
      return {
        date: session.date,
        title: session.title,
        distanceKm,
        durationSec,
        paceSec: durationSec / distanceKm,
        long,
      };
    });
}

export interface WeekDistance {
  start: string;
  label: string;
  km: number;
}

export function weeklyDistance(sessions: Session[], start: string | null, end: string): WeekDistance[] {
  const runs = sessions.filter(
    (session) => session.kind === 'run' && session.distanceKm && (!start || session.date >= start) && session.date <= end,
  );
  if (runs.length === 0) return [];
  const earliest = runs.map((session) => session.date).sort()[0] ?? end;
  let cursor = startOfWeek(start && start > earliest ? start : earliest);
  const last = startOfWeek(end);
  const weeks: WeekDistance[] = [];
  while (cursor <= last) {
    const next = addDays(cursor, 7);
    const km = runs
      .filter((session) => session.date >= cursor && session.date < next)
      .reduce((sum, session) => sum + (session.distanceKm ?? 0), 0);
    weeks.push({ start: cursor, label: formatDayMonth(cursor), km: Math.round(km * 10) / 10 });
    cursor = next;
  }
  return weeks;
}

export interface RangeSummary {
  sessions: number;
  strength: number;
  runs: number;
  km: number;
  runSec: number;
  volume: number;
}

export function summarize(sessions: Session[], start: string | null, end: string): RangeSummary {
  const inRange = sessions.filter((session) => (!start || session.date >= start) && session.date <= end);
  return inRange.reduce<RangeSummary>(
    (summary, session) => {
      summary.sessions += 1;
      if (session.kind === 'run') {
        summary.runs += 1;
        summary.km += session.distanceKm ?? 0;
        summary.runSec += session.durationSec ?? 0;
      } else {
        summary.strength += 1;
        summary.volume += session.exercises.reduce(
          (sum, exercise) => sum + exercise.sets.reduce((setSum, set) => setSum + set.reps * set.weightKg, 0),
          0,
        );
      }
      return summary;
    },
    { sessions: 0, strength: 0, runs: 0, km: 0, runSec: 0, volume: 0 },
  );
}

export function bestLift(session: Session): { name: string; reps: number; weightKg: number } | null {
  let best: { name: string; reps: number; weightKg: number; score: number } | null = null;
  for (const exercise of session.exercises) {
    const top = bestSet(exercise);
    if (!top) continue;
    const score = top.set.weightKg > 0 ? top.e1rm : top.set.reps / 100;
    if (!best || score > best.score) {
      best = { name: exercise.name, reps: top.set.reps, weightKg: top.set.weightKg, score };
    }
  }
  return best;
}

export function sessionSummary(session: Session): string {
  if (session.kind === 'run') {
    const bits: string[] = [];
    if (session.distanceKm) bits.push(`${trimNum(session.distanceKm)} km`);
    if (session.distanceKm && session.durationSec) {
      bits.push(`${formatPaceInline(session.durationSec / session.distanceKm)} /km`);
    } else if (session.durationSec) {
      bits.push(`${Math.round(session.durationSec / 60)} min`);
    }
    if (session.elevationM) bits.push(`${Math.round(session.elevationM)} m up`);
    return bits.join(' · ') || 'Run';
  }
  const top = bestLift(session);
  const count = session.exercises.length;
  if (!top) return count ? `${count} exercises` : 'Strength';
  const load = top.weightKg > 0 ? `${trimNum(top.weightKg)}×${top.reps}` : `${top.reps} reps`;
  const extra = count > 1 ? ` · ${count} exercises` : '';
  return `${top.name} ${load}${extra}`;
}

function formatPaceInline(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function averagePace(points: RunPoint[]): number | null {
  const distance = points.reduce((sum, point) => sum + point.distanceKm, 0);
  const duration = points.reduce((sum, point) => sum + point.durationSec, 0);
  if (distance <= 0 || duration <= 0) return null;
  return duration / distance;
}
