import type { EffortCount, ExerciseEntry, LogPreset, PlanExercise, Session } from '../types';
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
  count: EffortCount;
  targetLabel: string;
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
  return { key: uid('ex'), name, sets: [blankSet()], count: 'reps', targetLabel: '' };
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
          count: 'reps' as const,
          targetLabel: '',
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

function setsForTemplate(exercise: PlanExercise, previous: ExerciseEntry | null): SetDraft[] {
  const reps = String(parseInt(exercise.reps, 10) || '');
  const count = Math.max(1, exercise.sets);
  return Array.from({ length: count }, (_, index) => {
    const prior = previous?.sets[index] ?? previous?.sets.at(-1);
    const draft = blankSet(reps);
    if (prior && prior.weightKg > 0) draft.weightKg = trimNum(prior.weightKg);
    return draft;
  });
}

export function applyTemplateMeta(draft: Draft, template: PlanExercise[]): Draft {
  if (template.length === 0) return draft;
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => {
      const match = template.find((item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
      if (!match) return exercise;
      return {
        ...exercise,
        count: match.count === 'seconds' ? 'seconds' : 'reps',
        targetLabel: match.count === 'seconds' ? `${match.sets}×${match.reps} sec` : `${match.sets}×${match.reps}`,
      };
    }),
  };
}

export function exercisesFromTemplate(template: PlanExercise[], sessions: Session[]): ExerciseDraft[] {
  if (template.length === 0) return [blankExercise()];
  return template.map((exercise) => ({
    key: uid('ex'),
    name: exercise.name,
    sets: setsForTemplate(exercise, lastExercise(sessions, exercise.name)),
    count: exercise.count === 'seconds' ? 'seconds' : 'reps',
    targetLabel: exercise.count === 'seconds' ? `${exercise.sets}×${exercise.reps} sec` : `${exercise.sets}×${exercise.reps}`,
  }));
}

export function draftFromPreset(preset: LogPreset, sessions: Session[]): Draft {
  const exercises = preset.kind === 'strength' ? exercisesFromTemplate(preset.templateExercises, sessions) : [blankExercise()];

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
    durationMin: preset.durationMin !== null ? String(preset.durationMin) : '',
    prompt: preset.prompt,
    distanceHint: preset.kind === 'run' ? 'Optional. Saving with this blank still counts as doing the run.' : '',
    durationHint: preset.kind === 'run' ? 'Optional.' : '',
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
