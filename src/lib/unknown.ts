import type {
  ExerciseEntry,
  Goal,
  Plan,
  PlanExercise,
  PlanCompletion,
  PlanExtra,
  PlanMove,
  PlanPhase,
  PlanSession,
  Session,
  WorkoutPreset,
} from '../types';

/**
 * Keys this build reads and writes on purpose. Anything else on a persisted
 * record is kept verbatim so an older bundle cannot wipe a field it does not
 * model — the failure that dropped `moves` and `alsoCounts`.
 */
export const GOAL_KEYS = ['id', 'name', 'targetDate', 'focus', 'notes', 'status', 'createdAt', 'updatedAt'] as const;
export const LOAD_TARGET_KEYS = ['sets', 'reps', 'weightKg'] as const;
export const PHASE_EXERCISE_TARGET_KEYS = ['name', 'sets', 'reps', 'weightKg'] as const;
export const PHASE_SESSION_TARGET_KEYS = ['sessionId', 'exercises'] as const;
export const PLAN_EXERCISE_KEYS = ['name', 'sets', 'reps', 'count', 'perSide', 'alsoCounts', 'target', 'equipment'] as const;
export const PLAN_SESSION_KEYS = ['id', 'dayOfWeek', 'kind', 'title', 'focus', 'notes', 'exercises', 'distanceKm', 'durationMin'] as const;
export const PHASE_CHANGE_KEYS = ['sessionId', 'notes', 'durationMin', 'sets'] as const;
export const PHASE_KEYS = ['name', 'startDate', 'endDate', 'sessions', 'targets'] as const;
export const MOVE_KEYS = ['sessionId', 'fromDate', 'toDate', 'updatedAt'] as const;
export const COMPLETION_KEYS = ['sessionId', 'date', 'done', 'updatedAt'] as const;
export const EXTRA_KEYS = ['presetId', 'date', 'updatedAt'] as const;
export const PLAN_KEYS = ['id', 'goalId', 'name', 'startDate', 'weeks', 'endDate', 'focus', 'notes', 'sessions', 'phases', 'moves', 'completions', 'extras', 'status', 'updatedAt'] as const;
export const PRESET_KEYS = ['id', 'name', 'kind', 'focus', 'notes', 'exercises', 'createdAt', 'updatedAt'] as const;
export const SET_KEYS = ['reps', 'weightKg', 'kgPerPiece'] as const;
export const LOGGED_EXERCISE_KEYS = ['name', 'sets', 'pieces', 'implement'] as const;
export const SPLIT_KEYS = ['km', 'timeSec', 'paceSec', 'heartRate'] as const;
export const WEATHER_KEYS = ['tempC', 'humidityPct', 'airQuality'] as const;
export const SESSION_KEYS = [
  'id',
  'date',
  'kind',
  'title',
  'notes',
  'goalId',
  'planId',
  'planSessionId',
  'exercises',
  'distanceKm',
  'durationSec',
  'elevationM',
  'effort',
  'paceSec',
  'heartRate',
  'activeKcal',
  'totalKcal',
  'cadenceSpm',
  'powerW',
  'place',
  'source',
  'activity',
  'startTime',
  'endTime',
  'weather',
  'splits',
  'createdAt',
  'updatedAt',
] as const;
export const DELETION_KEYS = ['id', 'at'] as const;
export const DELETIONS_KEYS = ['goals', 'plans', 'presets', 'sessions'] as const;
export const ROOT_KEYS = ['version', 'goals', 'plans', 'presets', 'sessions', 'deleted'] as const;

const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function jsonSafe(value: unknown): boolean {
  if (value === null) return true;
  const kind = typeof value;
  if (kind === 'string' || kind === 'boolean') return true;
  if (kind === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(jsonSafe);
  if (kind === 'object') {
    return Object.entries(value as Record<string, unknown>).every(([key, item]) => !FORBIDDEN.has(key) && jsonSafe(item));
  }
  return false;
}

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Copy JSON values this build does not model onto `built`. Known keys stay as `built` left them. */
export function keepUnknown<T extends object>(built: T, source: unknown, known: readonly string[]): T {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return built;
  const knownSet = new Set<string>(known);
  const record = source as Record<string, unknown>;
  const target = built as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (knownSet.has(key) || FORBIDDEN.has(key) || Object.prototype.hasOwnProperty.call(target, key)) continue;
    const value = record[key];
    if (!jsonSafe(value)) continue;
    target[key] = JSON.parse(JSON.stringify(value));
  }
  return built;
}

function absorbNamed<T extends { name: string }>(winner: T[], loser: readonly T[] | undefined, absorbOne: (winner: T, loser: T) => T): T[] {
  if (!loser || loser.length === 0) return winner;
  const used = new Set<number>();
  return winner.map((item, index) => {
    const found = winner.length === loser.length ? index : loser.findIndex((other, i) => !used.has(i) && other.name.trim().toLowerCase() === item.name.trim().toLowerCase());
    if (found < 0 || used.has(found)) return item;
    used.add(found);
    const previous = loser[found];
    return previous ? absorbOne(item, previous) : item;
  });
}

export function absorbGoal(winner: Goal, loser: Goal): Goal {
  return keepUnknown(cloneData(winner), loser, GOAL_KEYS);
}

export function absorbPlanExercise(winner: PlanExercise, loser: PlanExercise): PlanExercise {
  return keepUnknown(cloneData(winner), loser, PLAN_EXERCISE_KEYS);
}

export function absorbPlanSession(winner: PlanSession, loser: PlanSession): PlanSession {
  const copy = keepUnknown(cloneData(winner), loser, PLAN_SESSION_KEYS);
  copy.exercises = absorbNamed(copy.exercises, loser.exercises, absorbPlanExercise);
  return copy;
}

function absorbPhase(winner: PlanPhase, loser: PlanPhase): PlanPhase {
  const copy = keepUnknown(cloneData(winner), loser, PHASE_KEYS);
  copy.sessions = copy.sessions.map((change, index) => {
    const previous = copy.sessions.length === loser.sessions.length ? loser.sessions[index] : loser.sessions.find((item) => item.sessionId === change.sessionId);
    return previous ? keepUnknown(cloneData(change), previous, PHASE_CHANGE_KEYS) : change;
  });
  return copy;
}

function absorbPhases(winner: PlanPhase[] | undefined, loser: PlanPhase[] | undefined): PlanPhase[] | undefined {
  if (!winner || !loser) return winner;
  return winner.map((phase, index) => {
    const previous =
      winner.length === loser.length
        ? loser[index]
        : loser.find((item) => item.name === phase.name && item.startDate === phase.startDate && item.endDate === phase.endDate);
    return previous ? absorbPhase(phase, previous) : phase;
  });
}

function absorbMove(winner: PlanMove, loser: PlanMove): PlanMove {
  return keepUnknown(cloneData(winner), loser, MOVE_KEYS);
}

function absorbCompletion(winner: PlanCompletion, loser: PlanCompletion): PlanCompletion {
  return keepUnknown(cloneData(winner), loser, COMPLETION_KEYS);
}

function absorbCompletions(winner: PlanCompletion[] | undefined, loser: PlanCompletion[] | undefined): PlanCompletion[] | undefined {
  if (!winner || !loser) return winner;
  return winner.map((item, index) => {
    const previous =
      winner.length === loser.length
        ? loser[index]
        : loser.find((other) => other.sessionId === item.sessionId && other.date === item.date);
    return previous ? absorbCompletion(item, previous) : item;
  });
}

function absorbExtra(winner: PlanExtra, loser: PlanExtra): PlanExtra {
  return keepUnknown(cloneData(winner), loser, EXTRA_KEYS);
}

function absorbExtras(winner: PlanExtra[] | undefined, loser: PlanExtra[] | undefined): PlanExtra[] | undefined {
  if (!winner || !loser) return winner;
  return winner.map((extra, index) => {
    const previous =
      winner.length === loser.length
        ? loser[index]
        : loser.find((item) => item.presetId === extra.presetId && item.date === extra.date);
    return previous ? absorbExtra(extra, previous) : extra;
  });
}

function absorbMoves(winner: PlanMove[] | undefined, loser: PlanMove[] | undefined): PlanMove[] | undefined {
  if (!winner || !loser) return winner;
  return winner.map((move, index) => {
    const previous =
      winner.length === loser.length
        ? loser[index]
        : loser.find((item) => item.sessionId === move.sessionId && item.fromDate === move.fromDate);
    return previous ? absorbMove(move, previous) : move;
  });
}

export function absorbPlan(winner: Plan, loser: Plan): Plan {
  const copy = keepUnknown(cloneData(winner), loser, PLAN_KEYS);
  copy.sessions = copy.sessions.map((session) => {
    const previous = loser.sessions.find((item) => item.id === session.id);
    return previous ? absorbPlanSession(session, previous) : session;
  });
  const phases = absorbPhases(copy.phases, loser.phases);
  if (phases) copy.phases = phases;
  const moves = absorbMoves(copy.moves, loser.moves);
  if (moves) copy.moves = moves;
  const completions = absorbCompletions(copy.completions, loser.completions);
  if (completions) copy.completions = completions;
  const extras = absorbExtras(copy.extras, loser.extras);
  if (extras) copy.extras = extras;
  return copy;
}

export function absorbPreset(winner: WorkoutPreset, loser: WorkoutPreset): WorkoutPreset {
  const copy = keepUnknown(cloneData(winner), loser, PRESET_KEYS);
  copy.exercises = absorbNamed(copy.exercises, loser.exercises, absorbPlanExercise);
  return copy;
}

function absorbLoggedExercise(winner: ExerciseEntry, loser: ExerciseEntry): ExerciseEntry {
  const copy = keepUnknown(cloneData(winner), loser, LOGGED_EXERCISE_KEYS);
  copy.sets = copy.sets.map((set, index) => {
    const previous = loser.sets[index];
    return previous ? keepUnknown(cloneData(set), previous, SET_KEYS) : set;
  });
  return copy;
}

export function absorbSession(winner: Session, loser: Session): Session {
  const copy = keepUnknown(cloneData(winner), loser, SESSION_KEYS);
  copy.exercises = absorbNamed(copy.exercises, loser.exercises, absorbLoggedExercise);
  if (copy.weather && loser.weather) copy.weather = keepUnknown(cloneData(copy.weather), loser.weather, WEATHER_KEYS);
  copy.splits = copy.splits.map((split, index) => {
    const previous = loser.splits[index];
    return previous ? keepUnknown(cloneData(split), previous, SPLIT_KEYS) : split;
  });
  return copy;
}

/** Keep unknown fields from the stored session when a rebuild replaces it. */
export function replaceLoggedSession(sessions: Session[], session: Session): Session[] {
  const index = sessions.findIndex((item) => item.id === session.id);
  const previous = index >= 0 ? sessions[index] : undefined;
  if (!previous) return [...sessions, session];
  const carried = absorbSession(session, previous);
  return sessions.map((item, i) => (i === index ? carried : item));
}
