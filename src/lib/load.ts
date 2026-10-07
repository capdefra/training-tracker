import type { ExerciseEntry, LoadImplement, LoadPieces, SetEntry } from '../types';
import { parseNum, trimNum } from './format';

/**
 * Kilograms on a strength set.
 *
 * The logger always shows **kg per piece** as the large number once a piece
 * choice is known, and the **total** on the line under it. Those two roles
 * do not swap. Two pieces are a pair of dumbbells. One piece is either a
 * dumbbell or a kettlebell.
 *
 * `weightKg` on a saved set is always the total. `kgPerPiece` is the number
 * on one bell. Older sessions stored only `weightKg`. That number stays the
 * total. A one-piece choice is filled in only when the name makes the total
 * and the per-piece weight the same number:
 * - "kettlebell" in the name, Goblet squat, or Suitcase carry → 1 kettlebell
 *   (Goblet squat and Suitcase carry follow the home plan notes)
 * - "one-arm" or "single-arm" → 1 dumbbell
 * A pair is never guessed. The old number does not say whether it was the
 * weight of one dumbbell or of both.
 */

export type LoadDefault = { kind: 'bodyweight' } | { kind: 'loaded'; pieces: LoadPieces; implement: LoadImplement };

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function loaded(pieces: LoadPieces, implement: LoadImplement): LoadDefault {
  return { kind: 'loaded', pieces, implement };
}

/** Starting piece choice for a new exercise. The logger still shows the picker. */
const PROGRAM_LOAD: Record<string, LoadDefault> = {
  'goblet squat': loaded(1, 'kettlebell'),
  'bulgarian split squat': loaded(2, 'dumbbell'),
  'step-up': loaded(2, 'dumbbell'),
  'dumbbell romanian deadlift': loaded(2, 'dumbbell'),
  'side plank': { kind: 'bodyweight' },
  'chest-supported row': loaded(2, 'dumbbell'),
  'standing calf raise': { kind: 'bodyweight' },
  'flat dumbbell bench press': loaded(2, 'dumbbell'),
  'one-arm dumbbell row': loaded(1, 'dumbbell'),
  'incline press': loaded(2, 'dumbbell'),
  'half-kneeling one-arm overhead press': loaded(1, 'dumbbell'),
  'rear-delt raise': loaded(2, 'dumbbell'),
  'dumbbell curl': loaded(2, 'dumbbell'),
  'overhead triceps extension': loaded(1, 'dumbbell'),
  'dead bug': { kind: 'bodyweight' },
  'kettlebell swing': loaded(1, 'kettlebell'),
  'single-leg romanian deadlift': loaded(1, 'dumbbell'),
  'reverse lunge': loaded(2, 'dumbbell'),
  'single-leg hip thrust': loaded(1, 'dumbbell'),
  'push-up': { kind: 'bodyweight' },
  'suitcase carry': loaded(1, 'kettlebell'),
};

export function defaultLoad(name: string): LoadDefault {
  const key = nameKey(name);
  const known = PROGRAM_LOAD[key];
  if (known) return known;
  if (key.includes('kettlebell')) return loaded(1, 'kettlebell');
  if (key.includes('one-arm') || key.includes('single-arm') || key.includes('suitcase')) return loaded(1, 'dumbbell');
  if (key.includes('dead bug') || key.includes('push-up') || key.includes('pushup') || key.includes('plank') || key.includes('calf raise')) {
    return { kind: 'bodyweight' };
  }
  return loaded(2, 'dumbbell');
}

/** One piece, and only when the stored total is also the weight of that piece. */
export function inferLegacyPieces(name: string): { pieces: 1; implement: LoadImplement } | null {
  const key = nameKey(name);
  if (key.includes('kettlebell') || key === 'goblet squat' || key === 'suitcase carry') {
    return { pieces: 1, implement: 'kettlebell' };
  }
  if (key.includes('one-arm') || key.includes('single-arm')) return { pieces: 1, implement: 'dumbbell' };
  return null;
}

export function roundKg(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}

export function gearPhrase(pieces: LoadPieces, implement: LoadImplement | null | undefined): string {
  if (pieces === 2) return '2 dumbbells';
  if (implement === 'kettlebell') return '1 kettlebell';
  if (implement === 'dumbbell') return '1 dumbbell';
  return '1 piece';
}

export function migrateExercise(name: string, sets: SetEntry[], rawPieces: unknown, rawImplement: unknown): ExerciseEntry {
  let pieces: LoadPieces | undefined = rawPieces === 1 || rawPieces === 2 ? rawPieces : undefined;
  let implement: LoadImplement | undefined = rawImplement === 'dumbbell' || rawImplement === 'kettlebell' ? rawImplement : undefined;
  const weighted = sets.some((set) => set.weightKg > 0 || (set.kgPerPiece ?? 0) > 0);
  if (!pieces && weighted) {
    const inferred = inferLegacyPieces(name);
    if (inferred) {
      pieces = inferred.pieces;
      implement = implement ?? inferred.implement;
    }
  }
  if (pieces === 2) implement = 'dumbbell';
  const nextSets = sets.map((set) => reconcileSet(set, pieces));
  const entry: ExerciseEntry = { name, sets: nextSets };
  if (pieces && nextSets.some((set) => set.weightKg > 0)) {
    entry.pieces = pieces;
    if (implement) entry.implement = implement;
  }
  return entry;
}

function reconcileSet(set: SetEntry, pieces: LoadPieces | undefined): SetEntry {
  if (!pieces) return { reps: set.reps, weightKg: roundKg(set.weightKg) };
  const fromPer = set.kgPerPiece && set.kgPerPiece > 0 ? roundKg(set.kgPerPiece) : 0;
  const fromTotal = set.weightKg > 0 ? roundKg(set.weightKg / pieces) : 0;
  const per = fromPer || fromTotal;
  if (per <= 0) return { reps: set.reps, weightKg: 0 };
  return { reps: set.reps, weightKg: roundKg(per * pieces), kgPerPiece: per };
}

/** History and progress. Per piece first, total after it, or a bare total when pieces were not stored. */
export function formatLoggedLoad(exercise: Pick<ExerciseEntry, 'pieces' | 'implement'>, set: SetEntry): string {
  if (set.weightKg <= 0 && !(set.kgPerPiece && set.kgPerPiece > 0)) return '';
  if (exercise.pieces && set.kgPerPiece && set.kgPerPiece > 0) {
    return `${gearPhrase(exercise.pieces, exercise.implement)} · ${trimNum(set.kgPerPiece)} kg per piece · ${trimNum(set.weightKg)} kg total`;
  }
  return `${trimNum(set.weightKg)} kg total`;
}

export interface ShownLoad {
  caption: 'kg per piece' | 'kg total';
  value: string;
  detail: string;
}

/** The logging stepper. The caption names the large number. The detail names the total. */
export function shownLoad(pieces: LoadPieces | null, implement: LoadImplement | null, kg: string, asTotal: boolean): ShownLoad {
  const stored = parseNum(kg) ?? 0;
  if (!pieces) {
    return {
      caption: 'kg total',
      value: kg.trim() === '' ? '0' : kg,
      detail: 'Pick 1 or 2 pieces',
    };
  }
  if (!asTotal && kg.endsWith('.')) {
    const gear = gearPhrase(pieces, implement);
    const total = roundKg(stored * pieces);
    return { caption: 'kg per piece', value: kg, detail: `${gear} · ${trimNum(total)} kg total` };
  }
  const per = asTotal ? stored / pieces : stored;
  const total = asTotal ? stored : per * pieces;
  return {
    caption: 'kg per piece',
    value: kg.trim() === '' && !asTotal ? '0' : trimNum(roundKg(per)),
    detail: `${gearPhrase(pieces, implement)} · ${trimNum(roundKg(total))} kg total`,
  };
}

/** Logged-set line while the draft still knows whether the typed number was a total. */
export function formatAmount(pieces: LoadPieces | null, implement: LoadImplement | null, kg: string, asTotal: boolean): string {
  const stored = parseNum(kg) ?? 0;
  if (stored <= 0) return '';
  if (!pieces) return `${trimNum(roundKg(stored))} kg total`;
  const per = asTotal ? stored / pieces : stored;
  const total = asTotal ? stored : per * pieces;
  return `${gearPhrase(pieces, implement)} · ${trimNum(roundKg(per))} kg per piece · ${trimNum(roundKg(total))} kg total`;
}
