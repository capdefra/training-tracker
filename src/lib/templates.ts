import type { PlanExercise, PlanSession, WorkoutPreset } from '../types';
import { uid } from './ids';

interface WorkoutSpec {
  id: string;
  planSessionId: string;
  dayOfWeek: number;
  name: string;
  kind: PlanSession['kind'];
  focus: string;
  notes: string;
  exercises: PlanExercise[];
}

export const SKI_PREP_STAMP = '2026-10-02T00:00:00.000Z';

export const SKI_WORKOUTS: WorkoutSpec[] = [
  {
    id: 'preset-lower',
    planSessionId: 'ps-lower',
    dayOfWeek: 1,
    name: 'Lower body',
    kind: 'strength',
    focus: 'Legs',
    notes: 'Hit every set and rep. Add load when the sets feel solid — the target is the work, not a weight.',
    exercises: [
      { name: 'Back squat', sets: 5, reps: '5' },
      { name: 'Romanian deadlift', sets: 3, reps: '8' },
      { name: 'Walking lunge', sets: 3, reps: '8' },
      { name: 'Calf raise', sets: 3, reps: '12' },
    ],
  },
  {
    id: 'preset-easy',
    planSessionId: 'ps-easy',
    dayOfWeek: 2,
    name: 'Easy run',
    kind: 'run',
    focus: 'Cardio',
    notes: 'Do the run. Easy enough to talk. Distance and pace are optional in the log.',
    exercises: [],
  },
  {
    id: 'preset-balance',
    planSessionId: 'ps-balance',
    dayOfWeek: 3,
    name: 'Balance',
    kind: 'strength',
    focus: 'Balance',
    notes: 'Slow eccentrics. The target is the sets and reps on each side.',
    exercises: [
      { name: 'Bulgarian split squat', sets: 3, reps: '8' },
      { name: 'Single-leg RDL', sets: 3, reps: '8' },
      { name: 'Step-down', sets: 3, reps: '8' },
    ],
  },
  {
    id: 'preset-posterior',
    planSessionId: 'ps-posterior',
    dayOfWeek: 5,
    name: 'Posterior chain',
    kind: 'strength',
    focus: 'Legs',
    notes: 'Hinge and hips. Stop a nordic if a hamstring feels sharp. Side plank targets are seconds.',
    exercises: [
      { name: 'Hip thrust', sets: 3, reps: '8' },
      { name: 'Deadlift', sets: 3, reps: '5' },
      { name: 'Nordic curl', sets: 3, reps: '6' },
      { name: 'Side plank', sets: 3, reps: '30', count: 'seconds' },
    ],
  },
  {
    id: 'preset-long',
    planSessionId: 'ps-long',
    dayOfWeek: 6,
    name: 'Long run',
    kind: 'run',
    focus: 'Cardio',
    notes: 'Do the run. Steady effort, with a hill if the route has one. Distance and pace are optional in the log.',
    exercises: [],
  },
];

export function skiPresets(): WorkoutPreset[] {
  return SKI_WORKOUTS.map((workout) => ({
    id: workout.id,
    name: workout.name,
    kind: workout.kind,
    focus: workout.focus,
    notes: workout.notes,
    exercises: workout.exercises.map((exercise) => ({ ...exercise })),
    createdAt: SKI_PREP_STAMP,
    updatedAt: SKI_PREP_STAMP,
  }));
}

export function skiPlanSessions(freshIds = false): PlanSession[] {
  return SKI_WORKOUTS.map((workout) => ({
    id: freshIds ? uid('ps') : workout.planSessionId,
    dayOfWeek: workout.dayOfWeek,
    kind: workout.kind,
    title: workout.name,
    focus: workout.focus,
    notes: workout.notes,
    exercises: workout.kind === 'strength' ? workout.exercises.map((exercise) => ({ ...exercise })) : [],
    distanceKm: null,
    durationMin: null,
  }));
}

export function skiBaseSessions(): PlanSession[] {
  return skiPlanSessions(true);
}
