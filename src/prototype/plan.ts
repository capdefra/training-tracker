import { loadFromGist, loadGistConfig } from '../lib/gist';
import { defaultLoad, gearPhrase } from '../lib/load';
import { planCovers, sessionForDate } from '../lib/plans';
import { homeSkiWeek } from '../lib/templates';
import type { EffortCount, LoadImplement, LoadPieces, Plan, PlanExercise, PlanSession, TrainingData } from '../types';

/**
 * Preview copy of the home plan's strength sessions.
 *
 * When this browser already has gist access, the preview reads that plan and
 * does not write it. Otherwise it uses the committed home week. Either way,
 * Bulgarian split squats and floor-lying work are swapped for standing
 * alternatives before the screen is built.
 *
 * Kilograms marked `statedLoad` are written in the plan notes. The others are
 * starting points so the steppers are not zero.
 */
const STATED_LOAD: Record<string, { kg: number; label: string }> = {
  'goblet squat': { kg: 16, label: '16 kg kettlebell' },
  'kettlebell swing': { kg: 12, label: '12 kg to start' },
  'suitcase carry': { kg: 16, label: '16 kg, each side' },
};

/** Preview starting points and short target lines. Not the plan's prescription. */
const GUESSED_LOAD: Record<string, { kg: number; label: string }> = {
  'step-up': { kg: 8, label: 'Onto the bench' },
  'dumbbell romanian deadlift': { kg: 12, label: '2 dumbbells' },
  'chest-supported row': { kg: 10, label: '2 dumbbells' },
  'standing calf raise': { kg: 0, label: 'Bodyweight' },
  'flat dumbbell bench press': { kg: 12, label: 'Bench flat' },
  'one-arm dumbbell row': { kg: 12, label: '1 dumbbell' },
  'incline press': { kg: 10, label: 'Bench at 30°' },
  'half-kneeling one-arm overhead press': { kg: 8, label: '1 dumbbell' },
  'rear-delt raise': { kg: 4, label: 'Bench at 30°' },
  'dumbbell curl': { kg: 8, label: '2 dumbbells' },
  'overhead triceps extension': { kg: 8, label: '1 dumbbell' },
  'single-leg romanian deadlift': { kg: 8, label: '1 dumbbell' },
  'reverse lunge': { kg: 8, label: '2 dumbbells' },
  'single-leg hip thrust': { kg: 10, label: 'Dumbbell on the hip' },
  'push-up': { kg: 0, label: 'Bench if needed' },
  'pallof press': { kg: 8, label: 'Standing' },
};

const SHORT_TITLE: Record<string, string> = {
  'ps-lower-a': 'Lower A',
  'ps-upper': 'Full upper',
  'ps-lower-b': 'Lower B',
};

const HOME_PLAN_ID = 'plan-ski-home';

export interface PrototypeExercise {
  name: string;
  sets: number;
  repsLabel: string;
  count: EffortCount;
  seedReps: number;
  seedKg: number;
  bodyweight: boolean;
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
  loadLabel: string;
  /** True when the home plan notes name this load. */
  statedLoad: boolean;
}

export interface PrototypeSession {
  id: string;
  title: string;
  short: string;
  exercises: PrototypeExercise[];
}

interface StandingExercise {
  exercise: PlanExercise;
  substituted: boolean;
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function seedReps(reps: string): number {
  const parsed = parseInt(reps, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

/** Bulgarian split squats, planks, and work done lying on the floor. */
export function floorOrSplit(name: string): boolean {
  const key = nameKey(name);
  if (key.includes('bulgarian') || key.includes('split squat')) return true;
  if (key.includes('plank')) return true;
  return (
    key.includes('dead bug') ||
    key.includes('deadbug') ||
    key.includes('bird dog') ||
    key.includes('bird-dog') ||
    key.includes('glute bridge') ||
    key.includes('lying') ||
    key.includes('supine') ||
    key.includes('floor press') ||
    key.includes('floor fly') ||
    key.includes('floor pull')
  );
}

function replacementName(name: string, reserved: Set<string>): string | null {
  const key = nameKey(name);
  const split = key.includes('bulgarian') || key.includes('split squat');
  const plank = key.includes('plank');
  const candidates = split ? ['Reverse lunge', 'Step-up'] : plank ? ['Suitcase carry', 'Pallof press'] : ['Pallof press', 'Suitcase carry'];
  return candidates.find((candidate) => !reserved.has(nameKey(candidate))) ?? null;
}

function substitute(exercise: PlanExercise, name: string): PlanExercise {
  const timed = exercise.count === 'seconds';
  if (name === 'Suitcase carry') {
    return { name, sets: exercise.sets, reps: timed ? exercise.reps : '30', count: 'seconds' };
  }
  if (name === 'Pallof press') {
    return { name, sets: exercise.sets, reps: timed ? '8-12' : exercise.reps };
  }
  return { name, sets: exercise.sets, reps: timed ? '8' : exercise.reps };
}

/** Standing copy of one session. A hated or floor exercise is swapped, or dropped when both alternatives are already there. */
export function standingExercises(exercises: readonly PlanExercise[]): PlanExercise[] {
  const reserved = new Set(exercises.filter((exercise) => !floorOrSplit(exercise.name)).map((exercise) => nameKey(exercise.name)));
  const out: PlanExercise[] = [];
  for (const exercise of exercises) {
    if (!floorOrSplit(exercise.name)) {
      const key = nameKey(exercise.name);
      if (out.some((item) => nameKey(item.name) === key)) continue;
      out.push(exercise);
      continue;
    }
    const name = replacementName(exercise.name, reserved);
    if (!name) continue;
    reserved.add(nameKey(name));
    out.push(substitute(exercise, name));
  }
  return out;
}

function standingPlan(exercises: readonly PlanExercise[]): StandingExercise[] {
  const original = new Set(exercises.filter((exercise) => !floorOrSplit(exercise.name)).map((exercise) => nameKey(exercise.name)));
  return standingExercises(exercises).map((exercise) => ({
    exercise,
    substituted: !original.has(nameKey(exercise.name)),
  }));
}

function loadFor(
  name: string,
  bodyweight: boolean,
  pieces: LoadPieces | null,
  implement: LoadImplement | null,
  substituted: boolean,
): Pick<PrototypeExercise, 'seedKg' | 'loadLabel' | 'statedLoad'> {
  const key = nameKey(name);
  if (!substituted) {
    const stated = STATED_LOAD[key];
    if (stated) return { seedKg: stated.kg, loadLabel: stated.label, statedLoad: true };
  }
  const guessed = GUESSED_LOAD[key];
  if (guessed) return { seedKg: guessed.kg, loadLabel: guessed.label, statedLoad: false };
  if (key === 'suitcase carry') return { seedKg: 16, loadLabel: '16 kg kettlebell', statedLoad: false };
  if (bodyweight) return { seedKg: 0, loadLabel: 'Bodyweight', statedLoad: false };
  return { seedKg: 8, loadLabel: pieces ? gearPhrase(pieces, implement) : '2 dumbbells', statedLoad: false };
}

function gearFor(name: string): { bodyweight: boolean; pieces: LoadPieces | null; implement: LoadImplement | null } {
  if (nameKey(name) === 'pallof press') return { bodyweight: false, pieces: 1, implement: 'dumbbell' };
  const load = defaultLoad(name);
  if (load.kind === 'bodyweight') return { bodyweight: true, pieces: null, implement: null };
  return { bodyweight: false, pieces: load.pieces, implement: load.implement };
}

function toExercise(item: StandingExercise): PrototypeExercise {
  const { exercise, substituted } = item;
  const gear = gearFor(exercise.name);
  return {
    name: exercise.name,
    sets: exercise.sets,
    repsLabel: exercise.reps,
    count: exercise.count ?? 'reps',
    seedReps: seedReps(exercise.reps),
    bodyweight: gear.bodyweight,
    pieces: gear.pieces,
    implement: gear.implement,
    ...loadFor(exercise.name, gear.bodyweight, gear.pieces, gear.implement, substituted),
  };
}

function shortTitle(session: PlanSession): string {
  const known = SHORT_TITLE[session.id];
  if (known) return known;
  const cut = session.title.split('(')[0]?.trim() || session.title;
  return cut.length > 22 ? `${cut.slice(0, 21).trimEnd()}…` : cut;
}

function buildSessions(sessions: readonly PlanSession[]): PrototypeSession[] {
  return sessions
    .filter((session) => session.kind === 'strength')
    .map((session) => ({
      id: session.id,
      title: session.title,
      short: shortTitle(session),
      exercises: standingPlan(session.exercises).map(toExercise),
    }))
    .filter((session) => session.exercises.length > 0);
}

function fallbackSessions(): PrototypeSession[] {
  return buildSessions(homeSkiWeek().sessions);
}

const SESSIONS = fallbackSessions();

export function prototypeSessions(): readonly PrototypeSession[] {
  return SESSIONS;
}

export function findPrototypeSession(id: string | undefined, sessions: readonly PrototypeSession[] = SESSIONS): PrototypeSession {
  const list = sessions.length > 0 ? sessions : SESSIONS;
  if (!id) return list[0]!;
  return list.find((session) => session.id === id) ?? list[0]!;
}

function todayStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function pickPlan(data: TrainingData, today: string): Plan | null {
  const usable = data.plans.filter((plan) => plan.sessions.some((session) => session.kind === 'strength' && session.exercises.length > 0));
  const covering = usable.filter((plan) => planCovers(plan, today));
  if (covering.length > 0) return covering.find((plan) => plan.id === HOME_PLAN_ID) ?? covering[0] ?? null;
  return usable.find((plan) => plan.id === HOME_PLAN_ID) ?? usable.find((plan) => plan.status === 'active') ?? usable[0] ?? null;
}

/** Read the gist plan when this browser already has access. Never writes. Falls back to the standing home week. */
export async function loadPrototypeSessions(): Promise<readonly PrototypeSession[]> {
  const fallback = prototypeSessions();
  try {
    const config = loadGistConfig();
    if (!config) return fallback;
    const data = await loadFromGist(config.token, config.gistId);
    const today = todayStamp();
    const plan = pickPlan(data, today);
    if (!plan) return fallback;
    const sessions = buildSessions(plan.sessions.map((session) => sessionForDate(plan, session, today)));
    return sessions.length > 0 ? sessions : fallback;
  } catch {
    return fallback;
  }
}
