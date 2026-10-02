import type { ExerciseEntry, PlanExercise, PlanSession, Session } from '../types';
import { exerciseKey } from './stats';

export interface ExerciseTarget {
  name: string;
  targetSets: number;
  repsLabel: string;
  completedSets: number;
  met: boolean;
}

export function targetCount(reps: string): number {
  const match = /(\d+(?:\.\d+)?)/.exec(reps);
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function repsLabel(exercise: PlanExercise): string {
  return exercise.count === 'seconds' ? `${exercise.reps} sec` : exercise.reps;
}

export function exerciseTargetLabel(exercise: PlanExercise): string {
  return `${exercise.sets}×${repsLabel(exercise)}`;
}

function setsMeetingTarget(entries: ExerciseEntry[], need: number): number {
  let count = 0;
  for (const entry of entries) {
    for (const set of entry.sets) {
      if (set.reps >= need) count += 1;
    }
  }
  return count;
}

export function exerciseTargets(session: PlanSession, logs: Session[]): ExerciseTarget[] {
  if (session.kind !== 'strength') return [];
  return session.exercises.map((exercise) => {
    const key = exerciseKey(exercise.name);
    const matches = logs.flatMap((log) =>
      log.kind === 'strength' ? log.exercises.filter((entry) => exerciseKey(entry.name) === key) : [],
    );
    const completedSets = setsMeetingTarget(matches, targetCount(exercise.reps));
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

export function describePlanSession(session: PlanSession): string {
  if (session.kind === 'run') return 'Do the run';
  if (session.exercises.length === 0) return 'Strength';
  return session.exercises.map((exercise) => `${exercise.name} ${exerciseTargetLabel(exercise)}`).join(', ');
}
