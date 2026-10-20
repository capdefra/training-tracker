/** Lead-in before a timed hold. Four seconds sits in the 3–5s range Marc asked for. */
export const LEAD_MS = 4000;
/** How long the finished ring stays before rest, or before the controls return. */
export const FINISH_MS = 1600;

/**
 * A timed set running in the strength session.
 * Every boundary is an epoch millisecond. Pausing shifts those boundaries.
 * The display reads the clock; it does not subtract one each tick.
 */
export interface SetTimer {
  exerciseKey: string;
  /** Seconds logged when the hold finishes. */
  seconds: number;
  leadEndsAt: number;
  workEndsAt: number;
  flashEndsAt: number;
  restEndsAt: number | null;
  pausedAt: number | null;
  logged: boolean;
}

export type TimerPhase = 'lead' | 'work' | 'done' | 'rest';

export interface TimerView {
  phase: TimerPhase;
  /** Whole seconds still to show. Zero only as a phase ends. */
  secondsLeft: number;
  /** 0 at the start of the phase, 1 at the end. */
  progress: number;
  caption: string;
}

/** The first positive number in a reps or seconds string. `"20-30"` is 20. */
export function holdSeconds(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(text.trim());
  if (!match) return null;
  const value = Math.round(Number(match[1]));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function startSetTimer(exerciseKey: string, seconds: number, restSec: number | null, now: number): SetTimer {
  const leadEndsAt = now + LEAD_MS;
  const workEndsAt = leadEndsAt + seconds * 1000;
  const flashEndsAt = workEndsAt + FINISH_MS;
  const restEndsAt = restSec !== null && restSec > 0 ? flashEndsAt + restSec * 1000 : null;
  return {
    exerciseKey,
    seconds,
    leadEndsAt,
    workEndsAt,
    flashEndsAt,
    restEndsAt,
    pausedAt: null,
    logged: false,
  };
}

export function pauseSetTimer(timer: SetTimer, now: number): SetTimer {
  if (timer.pausedAt !== null) return timer;
  return { ...timer, pausedAt: now };
}

export function resumeSetTimer(timer: SetTimer, now: number): SetTimer {
  if (timer.pausedAt === null) return timer;
  return { ...shift(timer, now - timer.pausedAt), pausedAt: null };
}

/** What the ring should show. Null means the timer is over and can be dropped. */
export function viewSetTimer(timer: SetTimer, now: number): TimerView | null {
  const at = timer.pausedAt ?? now;
  if (at < timer.leadEndsAt) {
    return phaseView('lead', 'Get ready', at, timer.leadEndsAt - LEAD_MS, timer.leadEndsAt);
  }
  if (at < timer.workEndsAt) {
    return phaseView('work', 'Hold', at, timer.leadEndsAt, timer.workEndsAt);
  }
  if (!timer.logged || at < timer.flashEndsAt) {
    return { phase: 'done', secondsLeft: timer.seconds, progress: 1, caption: 'Logged' };
  }
  if (timer.restEndsAt !== null && at < timer.restEndsAt) {
    return phaseView('rest', 'Rest', at, timer.flashEndsAt, timer.restEndsAt);
  }
  return null;
}

/** True once the hold has elapsed and the set still needs to be written. */
export function holdElapsed(timer: SetTimer, now: number): boolean {
  const at = timer.pausedAt ?? now;
  return !timer.logged && at >= timer.workEndsAt;
}

export function readSetTimer(value: unknown): SetTimer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<SetTimer>;
  const seconds = typeof record.seconds === 'number' ? Math.round(record.seconds) : 0;
  if (typeof record.exerciseKey !== 'string' || record.exerciseKey === '' || seconds <= 0) return null;
  if (!Number.isFinite(record.leadEndsAt) || !Number.isFinite(record.workEndsAt) || !Number.isFinite(record.flashEndsAt)) return null;
  return {
    exerciseKey: record.exerciseKey,
    seconds,
    leadEndsAt: record.leadEndsAt as number,
    workEndsAt: record.workEndsAt as number,
    flashEndsAt: record.flashEndsAt as number,
    restEndsAt: typeof record.restEndsAt === 'number' && Number.isFinite(record.restEndsAt) ? record.restEndsAt : null,
    pausedAt: typeof record.pausedAt === 'number' && Number.isFinite(record.pausedAt) ? record.pausedAt : null,
    logged: Boolean(record.logged),
  };
}

function shift(timer: SetTimer, delta: number): SetTimer {
  return {
    ...timer,
    leadEndsAt: timer.leadEndsAt + delta,
    workEndsAt: timer.workEndsAt + delta,
    flashEndsAt: timer.flashEndsAt + delta,
    restEndsAt: timer.restEndsAt === null ? null : timer.restEndsAt + delta,
  };
}

function phaseView(phase: TimerPhase, caption: string, now: number, start: number, end: number): TimerView {
  const total = Math.max(1, end - start);
  const remaining = Math.max(0, end - now);
  const progress = Math.min(1, Math.max(0, (now - start) / total));
  return { phase, caption, secondsLeft: Math.ceil(remaining / 1000), progress };
}
