import type { ExerciseEntry, LogPreset, Session } from '../types';
import { todayISO } from './dates';
import { trimNum } from './format';
import { uid } from './ids';
import { lastExercise } from './stats';

export interface SetDraft {
  key: string;
  reps: string;
  weightKg: string;
}

export interface ExerciseDraft {
  key: string;
  name: string;
  sets: SetDraft[];
}

export interface Draft {
  date: string;
  kind: 'strength' | 'run';
  title: string;
  notes: string;
  goalId: string;
  planId: string;
  planSessionId: string;
  exercises: ExerciseDraft[];
  distanceKm: string;
  durationMin: string;
  durationSec: string;
  elevationM: string;
  effort: number | null;
  prompt: string;
  distanceHint: string;
  durationHint: string;
}

export function blankSet(reps = '5'): SetDraft {
  return { key: uid('set'), reps, weightKg: '' };
}

export function blankExercise(name = ''): ExerciseDraft {
  return { key: uid('ex'), name, sets: [blankSet()] };
}

export function blankDraft(date = todayISO()): Draft {
  return {
    date,
    kind: 'strength',
    title: '',
    notes: '',
    goalId: '',
    planId: '',
    planSessionId: '',
    exercises: [blankExercise()],
    distanceKm: '',
    durationMin: '',
    durationSec: '',
    elevationM: '',
    effort: null,
    prompt: '',
    distanceHint: '',
    durationHint: '',
  };
}

function setsFromExercise(exercise: ExerciseEntry): SetDraft[] {
  return exercise.sets.map((set) => ({
    key: uid('set'),
    reps: String(set.reps),
    weightKg: trimNum(set.weightKg),
  }));
}

export function draftFromSession(session: Session): Draft {
  const duration = session.durationSec ?? 0;
  const minutes = session.durationSec ? String(Math.floor(duration / 60)) : '';
  const seconds = session.durationSec ? String(duration % 60) : '';
  return {
    date: session.date,
    kind: session.kind,
    title: session.title,
    notes: session.notes,
    goalId: session.goalId ?? '',
    planId: session.planId ?? '',
    planSessionId: session.planSessionId ?? '',
    exercises: session.exercises.length
      ? session.exercises.map((exercise) => ({
          key: uid('ex'),
          name: exercise.name,
          sets: setsFromExercise(exercise),
        }))
      : [blankExercise()],
    distanceKm: session.distanceKm !== null ? trimNum(session.distanceKm) : '',
    durationMin: minutes,
    durationSec: seconds,
    elevationM: session.elevationM !== null ? trimNum(session.elevationM) : '',
    effort: session.effort,
    prompt: '',
    distanceHint: '',
    durationHint: '',
  };
}

export function draftFromPreset(preset: LogPreset, sessions: Session[]): Draft {
  const exercises =
    preset.kind === 'strength'
      ? preset.templateExercises.length
        ? preset.templateExercises.map((exercise) => {
            const previous = lastExercise(sessions, exercise.name);
            if (previous) {
              return { key: uid('ex'), name: exercise.name, sets: setsFromExercise(previous) };
            }
            const reps = String(parseInt(exercise.reps, 10) || '');
            const count = Math.max(1, exercise.sets);
            return {
              key: uid('ex'),
              name: exercise.name,
              sets: Array.from({ length: count }, () => blankSet(reps)),
            };
          })
        : [blankExercise()]
      : [blankExercise()];

  return {
    ...blankDraft(preset.date),
    date: preset.date,
    kind: preset.kind,
    title: preset.title,
    goalId: preset.goalId ?? '',
    planId: preset.planId ?? '',
    planSessionId: preset.planSessionId ?? '',
    exercises,
    distanceKm: preset.distanceKm !== null ? trimNum(preset.distanceKm) : '',
    prompt: preset.prompt,
    distanceHint: preset.distanceKm !== null ? `Plan target ${trimNum(preset.distanceKm)} km` : '',
    durationHint: preset.durationMin !== null ? `Plan target ${preset.durationMin} min` : '',
  };
}

export const COMMON_LIFTS = [
  'Back squat',
  'Romanian deadlift',
  'Deadlift',
  'Hip thrust',
  'Bulgarian split squat',
  'Walking lunge',
  'Calf raise',
  'Single-leg RDL',
  'Step-down',
  'Nordic curl',
  'Bench press',
  'Pull-up',
];

export const RUN_TITLES = ['Easy run', 'Long run', 'Hills', 'Intervals'];
