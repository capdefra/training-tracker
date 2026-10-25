/**
 * A timed set running in the strength session.
 * Every boundary is an epoch millisecond. Pausing shifts those boundaries.
 * The display reads the clock; it does not subtract one each tick.
 *
 * `restSec` is the one rest the modal sets before Start. It counts down
 * before the first hold, between the left and right holds, and after the last hold.
 * Zero skips those gaps. The timer never writes a set.
 */
export interface SetTimer {
  exerciseKey: string;
  /** Seconds for one hold. A per-side set uses this length on each side. */
  seconds: number;
  restSec: number;
  leadEndsAt: number;
  workEndsAt: number;
  /** End of the rest after the last hold. Null when `restSec` is 0. */
  restEndsAt: number | null;
  pausedAt: number | null;
  /**
   * Both sides of one set. `workEndsAt` is the end of the left hold,
   * then `switchEndsAt`, then `side2EndsAt` for the right hold.
   */
  perSide?: boolean;
  switchEndsAt?: number;
  side2EndsAt?: number;
}

export type TimerPhase = 'lead' | 'work' | 'side1' | 'switch' | 'side2' | 'rest';

export interface TimerView {
  phase: TimerPhase;
  /** Whole seconds still to show. Zero only as a phase ends. */
  secondsLeft: number;
  /** 0 at the start of the phase, 1 at the end. */
  progress: number;
  /** The large label: Rest, Left, Switch, Right, or Hold. */
  caption: string;
  /** Shown under the countdown. */
  detail?: string;
}

/** The first positive number in a reps or seconds string. `"20-30"` is 20. */
export function holdSeconds(text: string): number | null {
  const match = /(\d+(?:\.\d+)?)/.exec(text.trim());
  if (!match) return null;
  const value = Math.round(Number(match[1]));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function startSetTimer(exerciseKey: string, seconds: number, restSec: number, now: number, perSide = false): SetTimer {
  const rest = Math.max(0, Math.round(restSec));
  const restMs = rest * 1000;
  const leadEndsAt = now + restMs;
  const workEndsAt = leadEndsAt + seconds * 1000;
  const switchEndsAt = perSide ? workEndsAt + restMs : undefined;
  const side2EndsAt = perSide && switchEndsAt !== undefined ? switchEndsAt + seconds * 1000 : undefined;
  const finishedAt = side2EndsAt ?? workEndsAt;
  return {
    exerciseKey,
    seconds,
    restSec: rest,
    leadEndsAt,
    workEndsAt,
    restEndsAt: rest > 0 ? finishedAt + restMs : null,
    pausedAt: null,
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

/** What the countdown should show. Null means the timer is over and can be dropped. */
export function viewSetTimer(timer: SetTimer, now: number): TimerView | null {
  const at = timer.pausedAt ?? now;
  const restMs = timer.restSec * 1000;
  if (restMs > 0 && at < timer.leadEndsAt) {
    return phaseView('lead', 'Rest', at, timer.leadEndsAt - restMs, timer.leadEndsAt, timer.perSide ? 'Then left' : 'Then hold');
  }
  if (timer.perSide && typeof timer.switchEndsAt === 'number' && typeof timer.side2EndsAt === 'number') {
    if (at < timer.workEndsAt) return phaseView('side1', 'Left', at, timer.leadEndsAt, timer.workEndsAt, 'Side 1');
    if (restMs > 0 && at < timer.switchEndsAt) return phaseView('switch', 'Switch', at, timer.workEndsAt, timer.switchEndsAt, 'Then right');
    if (at < timer.side2EndsAt) return phaseView('side2', 'Right', at, timer.switchEndsAt, timer.side2EndsAt, 'Side 2');
  } else if (at < timer.workEndsAt) {
    return phaseView('work', 'Hold', at, timer.leadEndsAt, timer.workEndsAt);
  }
  if (timer.restEndsAt !== null && at < timer.restEndsAt) {
    const finishedAt = timer.perSide && typeof timer.side2EndsAt === 'number' ? timer.side2EndsAt : timer.workEndsAt;
    return phaseView('rest', 'Rest', at, finishedAt, timer.restEndsAt, 'Then log the set');
  }
  return null;
}

export function readSetTimer(value: unknown): SetTimer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<SetTimer>;
  const seconds = typeof record.seconds === 'number' ? Math.round(record.seconds) : 0;
  const restSec = typeof record.restSec === 'number' && Number.isFinite(record.restSec) ? Math.max(0, Math.round(record.restSec)) : null;
  if (typeof record.exerciseKey !== 'string' || record.exerciseKey === '' || seconds <= 0 || restSec === null) return null;
  if (!Number.isFinite(record.leadEndsAt) || !Number.isFinite(record.workEndsAt)) return null;
  const perSide = record.perSide === true;
  if (perSide && (!Number.isFinite(record.switchEndsAt) || !Number.isFinite(record.side2EndsAt))) return null;
  return {
    exerciseKey: record.exerciseKey,
    seconds,
    restSec,
    leadEndsAt: record.leadEndsAt as number,
    workEndsAt: record.workEndsAt as number,
    restEndsAt: typeof record.restEndsAt === 'number' && Number.isFinite(record.restEndsAt) ? record.restEndsAt : null,
    pausedAt: typeof record.pausedAt === 'number' && Number.isFinite(record.pausedAt) ? record.pausedAt : null,
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
