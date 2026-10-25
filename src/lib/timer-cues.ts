import type { TimerPhase } from './set-timer';

/** One-shot sounds for a timed set. Each is played at most once per second. */
export type TimerSound = 'tick' | 'start' | 'warn' | 'done' | 'rest' | 'switch';

/**
 * The sound for this moment of the countdown.
 * Rest, the opening gap, and the switch between sides announce themselves,
 * then tick on 3, 2, and 1. A hold opens with a start tone and warns on the last three seconds.
 * `phaseSeconds` is the length of the phase on screen, not always the hold.
 */
export function timerSound(phase: TimerPhase, secondsLeft: number, phaseSeconds: number): TimerSound | null {
  const resting = phase === 'lead' || phase === 'switch' || phase === 'rest';
  if (resting && phaseSeconds > 0 && secondsLeft === phaseSeconds) return phase === 'switch' ? 'switch' : 'rest';
  if (resting && secondsLeft >= 1 && secondsLeft <= 3 && secondsLeft < phaseSeconds) return 'tick';
  const holding = phase === 'work' || phase === 'side1' || phase === 'side2';
  if (holding && secondsLeft === phaseSeconds) return 'start';
  if (holding && secondsLeft >= 1 && secondsLeft <= 3 && secondsLeft < phaseSeconds) return 'warn';
  return null;
}
