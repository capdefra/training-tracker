import { SWITCH_MS, type TimerPhase } from './set-timer';

/** One-shot sounds for a timed set. Each is played at most once per second. */
export type TimerSound = 'tick' | 'start' | 'warn' | 'done' | 'rest' | 'switch';

const SWITCH_SEC = SWITCH_MS / 1000;

/**
 * The sound for this moment of the countdown.
 * Get-ready ticks on 3, 2, and 1. The hold opens with a start tone.
 * A hold longer than the current second warns on 3, 2, and 1.
 * The switch between sides opens with its own tone, then ticks.
 * The logged flash is the done tone. Rest itself is silent until it ends.
 */
export function timerSound(phase: TimerPhase, secondsLeft: number, holdSeconds: number): TimerSound | null {
  if (phase === 'lead' && secondsLeft >= 1 && secondsLeft <= 3) return 'tick';
  if (phase === 'switch' && secondsLeft === SWITCH_SEC) return 'switch';
  if (phase === 'switch' && secondsLeft >= 1 && secondsLeft <= 3) return 'tick';
  if (phase === 'done') return 'done';
  const holding = phase === 'work' || phase === 'side1' || phase === 'side2';
  if (holding && secondsLeft === holdSeconds) return 'start';
  if (holding && secondsLeft >= 1 && secondsLeft <= 3 && secondsLeft < holdSeconds) return 'warn';
  return null;
}
