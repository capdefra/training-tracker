import { useEffect } from 'react';
import { holdScreenAwake, isWorkoutOpenHref, requestScreenWakeLock } from '../lib/screen-wake';

/**
 * Hold a screen wake lock while the tracker is visible.
 * Links that open the log are an existing gesture, so Safari can grant the
 * first lock without a separate switch.
 */
export function useScreenWakeLock(): void {
  useEffect(() => {
    const stop = holdScreenAwake();
    const onClick = (event: MouseEvent) => {
      if (!clickOpensWorkout(event)) return;
      requestScreenWakeLock();
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      stop();
    };
  }, []);
}

function clickOpensWorkout(event: MouseEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const link = target.closest('a[href]');
  if (!link) return false;
  return isWorkoutOpenHref(link.getAttribute('href'));
}
