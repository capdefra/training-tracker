import { exerciseKey } from './stats';

/**
 * Form clips for the home plan.
 *
 * Filmed entries are short, muted trims of wger library videos and images
 * (CC BY-SA 4.0). See public/form-demos/CREDITS.txt. Placeholder entries are
 * original stick-figure loops so the clip still plays inside the app.
 * Replace a placeholder by putting a WebM or GIF at the same path and setting
 * `source` to `wger` with a credit line.
 *
 * Three plan names still point at the closest wger page, because wger has no
 * page for that exact variation:
 * - Standing calf raise → Double Leg Calf Raise.
 * - One-arm dumbbell row → One-Arm Heavy Row.
 * - Half-kneeling one-arm overhead press → Single-arm dumbbell shoulder press.
 */
export type DemoSource = 'wger' | 'placeholder';

export interface ExerciseDemo {
  name: string;
  /** Title of the matching wger page, used on the Learn more link. */
  title: string;
  /** Path under public/, for example form-demos/goblet-squat.webm */
  clip: string;
  source: DemoSource;
  /** Shown under a filmed clip. */
  credit?: string;
  /** Written guide. The Form button does not open this. */
  href: string;
}

export const FORM_LIBRARY = {
  name: 'wger',
  href: 'https://wger.de/',
} as const;

const WGER = 'CC BY-SA 4.0 · wger';

const DEMOS: ExerciseDemo[] = [
  { name: 'Goblet squat', title: 'Dumbbell Goblet Squat', clip: 'form-demos/goblet-squat.webm', source: 'wger', credit: `Exercise 203 · ${WGER}`, href: 'https://wger.de/en/exercise/203/view' },
  { name: 'Bulgarian split squat', title: 'Bulgarian Squat with Dumbbells', clip: 'form-demos/bulgarian-split-squat.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1706/view' },
  { name: 'Step-up', title: 'Step-ups', clip: 'form-demos/step-up.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/981/view' },
  { name: 'Dumbbell Romanian deadlift', title: 'Dumbbell Romanian Deadlift', clip: 'form-demos/dumbbell-romanian-deadlift.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1652/view' },
  { name: 'Side plank', title: 'Side Plank', clip: 'form-demos/side-plank.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/580/view' },
  { name: 'Chest-supported row', title: 'Incline Chest-Supported Dumbbell Row', clip: 'form-demos/chest-supported-row.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1283/view' },
  { name: 'Standing calf raise', title: 'Double Leg Calf Raise', clip: 'form-demos/standing-calf-raise.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1243/view' },
  { name: 'Flat dumbbell bench press', title: 'Benchpress Dumbbells', clip: 'form-demos/flat-dumbbell-bench-press.webm', source: 'wger', credit: `Goulart · ${WGER}`, href: 'https://wger.de/en/exercise/75/view' },
  { name: 'One-arm dumbbell row', title: 'One-Arm Heavy Row', clip: 'form-demos/one-arm-dumbbell-row.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1701/view' },
  { name: 'Incline press', title: 'Incline Bench Press - Dumbbell', clip: 'form-demos/incline-press.webm', source: 'wger', credit: `Goulart · ${WGER}`, href: 'https://wger.de/en/exercise/537/view' },
  { name: 'Half-kneeling one-arm overhead press', title: 'Single-arm dumbbell shoulder press', clip: 'form-demos/half-kneeling-one-arm-overhead-press.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1968/view' },
  { name: 'Rear-delt raise', title: 'Rear Delt Raises', clip: 'form-demos/rear-delt-raise.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/487/view' },
  { name: 'Dumbbell curl', title: 'Biceps Curls With Dumbbell', clip: 'form-demos/dumbbell-curl.webm', source: 'wger', credit: `Goulart · ${WGER}`, href: 'https://wger.de/en/exercise/92/view' },
  { name: 'Overhead triceps extension', title: 'Triceps Overhead (Dumbbell)', clip: 'form-demos/overhead-triceps-extension.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1336/view' },
  { name: 'Dead bug', title: 'Deadbug', clip: 'form-demos/dead-bug.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/178/view' },
  { name: 'Kettlebell swing', title: 'Kettlebell Swing', clip: 'form-demos/kettlebell-swing.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/960/view' },
  { name: 'Single-leg Romanian deadlift', title: 'Single-Leg Deadlift with Dumbbell', clip: 'form-demos/single-leg-romanian-deadlift.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1736/view' },
  { name: 'Reverse lunge', title: 'Dumbbell Rear Lunge', clip: 'form-demos/reverse-lunge.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1651/view' },
  { name: 'Single-leg hip thrust', title: 'Dumbbell Single-leg Hip Thrust', clip: 'form-demos/single-leg-hip-thrust.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1234/view' },
  { name: 'Hip thrust', title: 'Hip Thrust', clip: 'form-demos/hip-thrust.webm', source: 'wger', credit: `Goulart · ${WGER}`, href: 'https://wger.de/en/exercise/294/view' },
  { name: 'Push-up', title: 'Push-Up', clip: 'form-demos/push-up.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1551/view' },
  { name: 'Suitcase carry', title: 'Suitcase Carry', clip: 'form-demos/suitcase-carry.webm', source: 'placeholder', href: 'https://wger.de/en/exercise/1776/view' },
];

const BY_KEY = new Map(DEMOS.map((demo) => [exerciseKey(demo.name), demo]));

export function listDemos(): readonly ExerciseDemo[] {
  return DEMOS;
}

export function findDemo(name: string): ExerciseDemo | undefined {
  return BY_KEY.get(exerciseKey(name));
}

/** Public-folder clip, resolved against Vite's base so GitHub Pages project sites work. */
export function demoAssetUrl(clip: string, base = './'): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${clip.replace(/^\/+/, '')}`;
}
