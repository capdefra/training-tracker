import type { Draft } from './draft';

const PROGRESS_KEY = 'training-tracker:strength-progress';
const PENDING_KEY = 'training-tracker:strength-pending';

export interface StrengthProgress {
  sessionId: string;
  createdAt: string;
  /** Sets already stored when this workout was opened. Exit confirms only after this changes. */
  baseline: string;
  cursor: number;
  restOn: boolean;
  restChoice: number;
  draft: Draft;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loggedSignature(draft: Draft): string {
  return draft.exercises.map((exercise) => exercise.sets.map((set) => `${set.reps}:${set.kgPerPiece}:${set.asTotal ? 1 : 0}`).join(',')).join('|');
}

export function progressHasSets(progress: StrengthProgress): boolean {
  return progress.draft.exercises.some((exercise) => exercise.sets.length > 0);
}

export function isDirty(progress: StrengthProgress): boolean {
  return loggedSignature(progress.draft) !== progress.baseline;
}

export function freshProgress(draft: Draft, sessionId: string, createdAt: string): StrengthProgress {
  return {
    sessionId,
    createdAt,
    baseline: loggedSignature(draft),
    cursor: 0,
    restOn: false,
    restChoice: 90,
    draft,
  };
}

function sameWorkout(stored: StrengthProgress, draft: Draft, sessionId: string): boolean {
  if (stored.sessionId === sessionId) return true;
  return Boolean(draft.planSessionId) && stored.draft.planSessionId === draft.planSessionId && stored.draft.date === draft.date;
}

export type LaunchDecision = { kind: 'use'; progress: StrengthProgress } | { kind: 'ask'; current: StrengthProgress; next: StrengthProgress };

/** Resume the same plan day. Ask before a different workout with logged sets is replaced. */
export function decideLaunch(next: StrengthProgress, stored: StrengthProgress | null): LaunchDecision {
  if (!stored) return { kind: 'use', progress: next };
  if (sameWorkout(stored, next.draft, next.sessionId)) return { kind: 'use', progress: stored };
  if (!progressHasSets(stored)) return { kind: 'use', progress: next };
  return { kind: 'ask', current: stored, next };
}

function readProgress(raw: string | null): StrengthProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StrengthProgress;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.sessionId || !parsed.draft || parsed.draft.kind !== 'strength' || !Array.isArray(parsed.draft.exercises)) return null;
    return {
      sessionId: parsed.sessionId,
      createdAt: parsed.createdAt || new Date(0).toISOString(),
      baseline: typeof parsed.baseline === 'string' ? parsed.baseline : '',
      cursor: Number.isFinite(parsed.cursor) ? parsed.cursor : 0,
      restOn: Boolean(parsed.restOn),
      restChoice: parsed.restChoice === 45 || parsed.restChoice === 60 || parsed.restChoice === 90 || parsed.restChoice === 120 ? parsed.restChoice : 90,
      draft: parsed.draft,
    };
  } catch {
    return null;
  }
}

export function loadStrengthProgress(storage?: Store): StrengthProgress | null {
  const store = storage ?? localStorage;
  return readProgress(store.getItem(PROGRESS_KEY));
}

export function saveStrengthProgress(progress: StrengthProgress, storage?: Store): void {
  const store = storage ?? localStorage;
  store.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

export function clearStrengthProgress(storage?: Store): void {
  const store = storage ?? localStorage;
  store.removeItem(PROGRESS_KEY);
}

export function readPendingLaunch(storage?: Store): StrengthProgress | null {
  const store = storage ?? sessionStorage;
  return readProgress(store.getItem(PENDING_KEY));
}

export function writePendingLaunch(progress: StrengthProgress, storage?: Store): void {
  const store = storage ?? sessionStorage;
  store.setItem(PENDING_KEY, JSON.stringify(progress));
}

export function clearPendingLaunch(storage?: Store): void {
  const store = storage ?? sessionStorage;
  store.removeItem(PENDING_KEY);
}
