import type { EffortCount } from '../types';

/**
 * Name hints used only when `perSide` is absent.
 * Bulgarian split squat, reverse lunge, step-up, and dead bug are left alone:
 * those names do not say which side the count belongs to.
 */
const PER_SIDE_NAME = /side plank|single[-\s]?leg|single[-\s]?arm|one[-\s]?arm|\bsuitcase\b/i;

/** Explicit `perSide` wins. A missing field falls back to the name hint. */
export function isPerSide(exercise: { name: string; perSide?: boolean }): boolean {
  if (exercise.perSide === true) return true;
  if (exercise.perSide === false) return false;
  return PER_SIDE_NAME.test(exercise.name);
}

export function sideSuffix(exercise: { name: string; perSide?: boolean }): string {
  return isPerSide(exercise) ? ' /side' : '';
}

/**
 * The quantity next to a set count.
 * Stored reps and seconds are already per side, so the suffix labels them and does not double them.
 */
export function effortLabel(
  exercise: { name: string; reps: string; count?: EffortCount; perSide?: boolean },
  repsText?: string,
): string {
  const raw = repsText ?? exercise.reps;
  const base = exercise.count === 'seconds' ? `${raw} sec` : raw;
  return `${base}${sideSuffix(exercise)}`;
}
