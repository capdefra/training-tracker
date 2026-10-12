import type { ExerciseEntry, PlanExercise, PlanSession, Session } from '../types';
import { exerciseKey } from './stats';

export interface ExerciseTarget {
  name: string;
  targetSets: number;
  repsLabel: string;
  completedSets: number;
  met: boolean;
}

export function repsLabel(exercise: PlanExercise): string {
  return exercise.count === 'seconds' ? `${exercise.reps} sec` : exercise.reps;
}

export function exerciseTargetLabel(exercise: PlanExercise): string {
  return `${exercise.sets}×${repsLabel(exercise)}`;
}

/** Every logged set counts. Reps and weight are suggestions, so a short set still fills the planned count. */
function loggedSetCount(entries: ExerciseEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    for (const set of entry.sets) {
      if (set.reps > 0) count += 1;
    }
  }
  return count;
}

/** True when `candidate` is the plan name or one of `alsoCounts`. Both sides are trimmed and compared case-insensitively. */
export function exerciseNameMatches(candidate: string, exercise: PlanExercise): boolean {
  const logged = exerciseKey(candidate);
  if (!logged) return false;
  if (logged === exerciseKey(exercise.name)) return true;
  return (exercise.alsoCounts ?? []).some((alias) => {
    const key = exerciseKey(alias);
    return key !== '' && key === logged;
  });
}

/** A logged name counts when it is the plan name or one of `alsoCounts`. */
function loggedNameCounts(loggedName: string, exercise: PlanExercise): boolean {
  return exerciseNameMatches(loggedName, exercise);
}

export function exerciseTargets(session: PlanSession, logs: Session[]): ExerciseTarget[] {
  if (session.kind !== 'strength') return [];
  return session.exercises.map((exercise) => {
    const matches = logs.flatMap((log) =>
      log.kind === 'strength' ? log.exercises.filter((entry) => loggedNameCounts(entry.name, exercise)) : [],
    );
    const completedSets = loggedSetCount(matches);
    return {
      name: exercise.name,
      targetSets: exercise.sets,
      repsLabel: repsLabel(exercise),
      completedSets,
      met: completedSets >= exercise.sets,
    };
  });
}

export function sessionTargetsMet(session: PlanSession, logs: Session[]): boolean {
  if (logs.length === 0) return false;
  if (session.kind === 'run') return logs.some((log) => log.kind === 'run');
  const targets = exerciseTargets(session, logs);
  if (targets.length === 0) return logs.some((log) => log.kind === 'strength');
  return targets.every((target) => target.met);
}

export function runPrescription(session: PlanSession): string {
  const notes = session.notes.trim();
  if (notes) return notes;
  if (session.durationMin) return `${session.durationMin} min`;
  return 'Do the run';
}

export function describePlanSession(session: PlanSession): string {
  if (session.kind === 'run') return runPrescription(session);
  if (session.exercises.length === 0) return 'Strength';
  return session.exercises.map((exercise) => `${exercise.name} ${exerciseTargetLabel(exercise)}`).join(', ');
}
