import { defaultLoad, gearPhrase } from '../lib/load';
import { homeSkiWeek } from '../lib/templates';
import type { EffortCount, LoadImplement, LoadPieces } from '../types';

/**
 * Preview copy of the home plan's strength sessions.
 * Kilograms marked `statedLoad` are written in the plan notes. The others are
 * starting points so the steppers are not zero. This module does not read or
 * write the log.
 */
const STATED_LOAD: Record<string, { kg: number; label: string }> = {
  'goblet squat': { kg: 16, label: '16 kg kettlebell' },
  'bulgarian split squat': { kg: 12, label: '10–14 kg each' },
  'kettlebell swing': { kg: 12, label: '12 kg to start' },
  'suitcase carry': { kg: 16, label: '16 kg, each side' },
};

/** Preview starting points and short target lines. Not the plan's prescription. */
const GUESSED_LOAD: Record<string, { kg: number; label: string }> = {
  'step-up': { kg: 8, label: 'Onto the bench' },
  'dumbbell romanian deadlift': { kg: 12, label: '2 dumbbells' },
  'side plank': { kg: 0, label: 'Each side' },
  'chest-supported row': { kg: 10, label: '2 dumbbells' },
  'standing calf raise': { kg: 0, label: 'Bodyweight' },
  'flat dumbbell bench press': { kg: 12, label: 'Bench flat' },
  'one-arm dumbbell row': { kg: 12, label: '1 dumbbell' },
  'incline press': { kg: 10, label: 'Bench at 30°' },
  'half-kneeling one-arm overhead press': { kg: 8, label: '1 dumbbell' },
  'rear-delt raise': { kg: 4, label: 'Bench at 30°' },
  'dumbbell curl': { kg: 8, label: '2 dumbbells' },
  'overhead triceps extension': { kg: 8, label: '1 dumbbell' },
  'dead bug': { kg: 0, label: 'Bodyweight' },
  'single-leg romanian deadlift': { kg: 8, label: '1 dumbbell' },
  'reverse lunge': { kg: 8, label: '2 dumbbells' },
  'single-leg hip thrust': { kg: 10, label: 'Dumbbell on the hip' },
  'push-up': { kg: 0, label: 'Bench if needed' },
};

const SHORT_TITLE: Record<string, string> = {
  'ps-lower-a': 'Lower A',
  'ps-upper': 'Full upper',
  'ps-lower-b': 'Lower B',
};

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

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function seedReps(reps: string): number {
  const parsed = parseInt(reps, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
}

function loadFor(name: string, bodyweight: boolean, pieces: LoadPieces | null, implement: LoadImplement | null): Pick<PrototypeExercise, 'seedKg' | 'loadLabel' | 'statedLoad'> {
  const key = nameKey(name);
  const stated = STATED_LOAD[key];
  if (stated) return { seedKg: stated.kg, loadLabel: stated.label, statedLoad: true };
  const guessed = GUESSED_LOAD[key];
  if (guessed) return { seedKg: guessed.kg, loadLabel: guessed.label, statedLoad: false };
  if (bodyweight) return { seedKg: 0, loadLabel: 'Bodyweight', statedLoad: false };
  return { seedKg: 8, loadLabel: pieces ? gearPhrase(pieces, implement) : '2 dumbbells', statedLoad: false };
}

function buildSessions(): PrototypeSession[] {
  return homeSkiWeek()
    .sessions.filter((session) => session.kind === 'strength')
    .map((session) => ({
      id: session.id,
      title: session.title,
      short: SHORT_TITLE[session.id] ?? session.title,
      exercises: session.exercises.map((exercise) => {
        const load = defaultLoad(exercise.name);
        const bodyweight = load.kind === 'bodyweight';
        const pieces = bodyweight ? null : load.pieces;
        const implement = bodyweight ? null : load.implement;
        return {
          name: exercise.name,
          sets: exercise.sets,
          repsLabel: exercise.reps,
          count: exercise.count ?? 'reps',
          seedReps: seedReps(exercise.reps),
          bodyweight,
          pieces,
          implement,
          ...loadFor(exercise.name, bodyweight, pieces, implement),
        };
      }),
    }));
}

const SESSIONS = buildSessions();

export function prototypeSessions(): readonly PrototypeSession[] {
  return SESSIONS;
}

export function findPrototypeSession(id: string | undefined): PrototypeSession {
  if (!id) return SESSIONS[0]!;
  return SESSIONS.find((session) => session.id === id) ?? SESSIONS[0]!;
}
