import type { ExerciseEntry, ExerciseLoadTarget, PhaseExerciseTarget, PlanExercise, PlanPhase, Session } from '../types';
import { exerciseNameMatches } from './targets';
import { exerciseKey } from './stats';

/** Keep positive recommendations. Anything else is treated as omitted. */
export function usableTarget(value: ExerciseLoadTarget | PhaseExerciseTarget | undefined): ExerciseLoadTarget | null {
  if (!value) return null;
  const target: ExerciseLoadTarget = {};
  if (typeof value.sets === 'number' && Number.isFinite(value.sets) && value.sets > 0) target.sets = Math.round(value.sets);
  if (typeof value.reps === 'number' && Number.isFinite(value.reps) && value.reps > 0) target.reps = Math.round(value.reps);
  if (typeof value.weightKg === 'number' && Number.isFinite(value.weightKg) && value.weightKg > 0) target.weightKg = value.weightKg;
  return target.sets !== undefined || target.reps !== undefined || target.weightKg !== undefined ? target : null;
}

function matchPhaseExercise(phase: PlanPhase, sessionId: string, exercise: PlanExercise): ExerciseLoadTarget | null {
  const block = phase.targets?.find((item) => item.sessionId === sessionId);
  if (!block) return null;
  const planKey = exerciseKey(exercise.name);
  const matches = block.exercises.filter((item) => exerciseNameMatches(item.name, exercise));
  const exact = matches.find((item) => exerciseKey(item.name) === planKey && usableTarget(item));
  const alias = matches.find((item) => usableTarget(item));
  return usableTarget(exact ?? alias);
}

/**
 * Phase fields win when the date's phase lists this session and exercise.
 * Missing phase fields fall back to `exercise.target`. Missing there means no recommendation.
 */
export function resolveExerciseTarget(phase: PlanPhase | null, sessionId: string, exercise: PlanExercise): ExerciseLoadTarget | null {
  const fromPhase = phase ? matchPhaseExercise(phase, sessionId, exercise) : null;
  const fromPlan = usableTarget(exercise.target);
  if (!fromPhase && !fromPlan) return null;
  const sets = fromPhase?.sets ?? fromPlan?.sets;
  const reps = fromPhase?.reps ?? fromPlan?.reps;
  const weightKg = fromPhase?.weightKg ?? fromPlan?.weightKg;
  const merged: ExerciseLoadTarget = {};
  if (sets !== undefined) merged.sets = sets;
  if (reps !== undefined) merged.reps = reps;
  if (weightKg !== undefined) merged.weightKg = weightKg;
  return merged.sets !== undefined || merged.reps !== undefined || merged.weightKg !== undefined ? merged : null;
}

/** Most recent log whose name is the plan name or an `alsoCounts` alias. */
export function lastLoggedExercise(sessions: Session[], exercise: PlanExercise): ExerciseEntry | null {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  for (const session of sorted) {
    if (session.kind !== 'strength') continue;
    const found = session.exercises.find((entry) => exerciseNameMatches(entry.name, exercise) && entry.sets.length > 0);
    if (found) return found;
  }
  return null;
}
