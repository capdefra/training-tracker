/** Lead-in before a timed hold. Four seconds sits in the 3–5s range Marc asked for. */
export const LEAD_MS = 4000;
/** How long the finished ring stays before rest, or before the controls return. */
export const FINISH_MS = 1600;
/** Time to change sides between the left and right holds. */
export const SWITCH_MS = 4000;

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
  /**
   * Both sides of one set. `workEndsAt` is the end of the left hold,
   * then `switchEndsAt`, then `side2EndsAt` for the right hold.
   * The logged seconds stay the per-side length.
   */
  perSide?: boolean;
  switchEndsAt?: number;
  side2EndsAt?: number;
}

export type TimerPhase = 'lead' | 'work' | 'side1' | 'switch' | 'side2' | 'done' | 'rest';

export interface TimerView {
  phase: TimerPhase;
  /** Whole seconds still to show. Zero only as a phase ends. */
  secondsLeft: number;
  /** 0 at the start of the phase, 1 at the end. */
  progress: number;
  caption: string;
  /** Side 1 / Side 2, shown under the countdown. */
  detail?: string;
}

/** The first positive number in a reps or seconds string. `"20-30"` is 20. */
export function holdSeconds(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(text.trim());
  if (!match) return null;
  const value = Math.round(Number(match[1]));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function startSetTimer(exerciseKey: string, seconds: number, restSec: number | null, now: number, perSide = false): SetTimer {
  const leadEndsAt = now + LEAD_MS;
  const workEndsAt = leadEndsAt + seconds * 1000;
  const switchEndsAt = perSide ? workEndsAt + SWITCH_MS : undefined;
  const side2EndsAt = perSide && switchEndsAt !== undefined ? switchEndsAt + seconds * 1000 : undefined;
  const finishedAt = side2EndsAt ?? workEndsAt;
  const flashEndsAt = finishedAt + FINISH_MS;
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
    ...(perSide ? { perSide: true, switchEndsAt, side2EndsAt } : {}),
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
  if (timer.perSide && typeof timer.switchEndsAt === 'number' && typeof timer.side2EndsAt === 'number') {
    if (at < timer.workEndsAt) return phaseView('side1', 'Left', at, timer.leadEndsAt, timer.workEndsAt, 'Side 1');
    if (at < timer.switchEndsAt) return phaseView('switch', 'Switch', at, timer.workEndsAt, timer.switchEndsAt, 'Change sides');
    if (at < timer.side2EndsAt) return phaseView('side2', 'Right', at, timer.switchEndsAt, timer.side2EndsAt, 'Side 2');
  } else if (at < timer.workEndsAt) {
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

/** Epoch when both sides, or the single hold, are finished. */
export function holdCompleteAt(timer: SetTimer): number {
  if (timer.perSide && typeof timer.side2EndsAt === 'number') return timer.side2EndsAt;
  return timer.workEndsAt;
}

/** True once the hold has elapsed and the set still needs to be written. A per-side set waits for the right side. */
export function holdElapsed(timer: SetTimer, now: number): boolean {
  const at = timer.pausedAt ?? now;
  return !timer.logged && at >= holdCompleteAt(timer);
}

export function readSetTimer(value: unknown): SetTimer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<SetTimer>;
  const seconds = typeof record.seconds === 'number' ? Math.round(record.seconds) : 0;
  if (typeof record.exerciseKey !== 'string' || record.exerciseKey === '' || seconds <= 0) return null;
  if (!Number.isFinite(record.leadEndsAt) || !Number.isFinite(record.workEndsAt) || !Number.isFinite(record.flashEndsAt)) return null;
  const perSide = record.perSide === true;
  if (perSide && (!Number.isFinite(record.switchEndsAt) || !Number.isFinite(record.side2EndsAt))) return null;
  return {
    exerciseKey: record.exerciseKey,
    seconds,
    leadEndsAt: record.leadEndsAt as number,
    workEndsAt: record.workEndsAt as number,
    flashEndsAt: record.flashEndsAt as number,
    restEndsAt: typeof record.restEndsAt === 'number' && Number.isFinite(record.restEndsAt) ? record.restEndsAt : null,
    pausedAt: typeof record.pausedAt === 'number' && Number.isFinite(record.pausedAt) ? record.pausedAt : null,
    logged: Boolean(record.logged),
    ...(perSide
      ? { perSide: true as const, switchEndsAt: record.switchEndsAt as number, side2EndsAt: record.side2EndsAt as number }
      : {}),
  };
}

function shift(timer: SetTimer, delta: number): SetTimer {
  return {
    ...timer,
    leadEndsAt: timer.leadEndsAt + delta,
    workEndsAt: timer.workEndsAt + delta,
    flashEndsAt: timer.flashEndsAt + delta,
    restEndsAt: timer.restEndsAt === null ? null : timer.restEndsAt + delta,
    ...(typeof timer.switchEndsAt === 'number' ? { switchEndsAt: timer.switchEndsAt + delta } : {}),
    ...(typeof timer.side2EndsAt === 'number' ? { side2EndsAt: timer.side2EndsAt + delta } : {}),
  };
}

function phaseView(phase: TimerPhase, caption: string, now: number, start: number, end: number, detail?: string): TimerView {
  const total = Math.max(1, end - start);
  const remaining = Math.max(0, end - now);
  const progress = Math.min(1, Math.max(0, (now - start) / total));
  return { phase, caption, secondsLeft: Math.ceil(remaining / 1000), progress, ...(detail ? { detail } : {}) };
}
