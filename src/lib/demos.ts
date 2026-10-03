import { exerciseKey } from './stats';

/**
 * Form guides for the home plan, all from the wger exercise library.
 * wger publishes these pages for linking (Creative Commons exercise data, public API).
 * Each href was checked against https://wger.de/api/v2/exerciseinfo/{id}/ and the public
 * /en/exercise/{id}/view route. Nothing here is scraped, framed, or invented.
 *
 * Three plan names use the closest real wger page, because wger has no page for that exact variation:
 * - Standing calf raise → Double Leg Calf Raise (bodyweight heel raise, not the machine page).
 * - One-arm dumbbell row → One-Arm Heavy Row.
 * - Half-kneeling one-arm overhead press → Single-arm dumbbell shoulder press.
 */
export interface ExerciseDemo {
  name: string;
  /** Title of the wger page. */
  title: string;
  href: string;
}

export const FORM_LIBRARY = {
  name: 'wger',
  href: 'https://wger.de/',
} as const;

const DEMOS: ExerciseDemo[] = [
  { name: 'Goblet squat', title: 'Dumbbell Goblet Squat', href: 'https://wger.de/en/exercise/203/view' },
  { name: 'Bulgarian split squat', title: 'Bulgarian Squat with Dumbbells', href: 'https://wger.de/en/exercise/1706/view' },
  { name: 'Step-up', title: 'Step-ups', href: 'https://wger.de/en/exercise/981/view' },
  { name: 'Dumbbell Romanian deadlift', title: 'Dumbbell Romanian Deadlift', href: 'https://wger.de/en/exercise/1652/view' },
  { name: 'Side plank', title: 'Side Plank', href: 'https://wger.de/en/exercise/580/view' },
  { name: 'Chest-supported row', title: 'Incline Chest-Supported Dumbbell Row', href: 'https://wger.de/en/exercise/1283/view' },
  { name: 'Standing calf raise', title: 'Double Leg Calf Raise', href: 'https://wger.de/en/exercise/1243/view' },
  { name: 'Flat dumbbell bench press', title: 'Benchpress Dumbbells', href: 'https://wger.de/en/exercise/75/view' },
  { name: 'One-arm dumbbell row', title: 'One-Arm Heavy Row', href: 'https://wger.de/en/exercise/1701/view' },
  { name: 'Incline press', title: 'Incline Bench Press - Dumbbell', href: 'https://wger.de/en/exercise/537/view' },
  { name: 'Half-kneeling one-arm overhead press', title: 'Single-arm dumbbell shoulder press', href: 'https://wger.de/en/exercise/1968/view' },
  { name: 'Rear-delt raise', title: 'Rear Delt Raises', href: 'https://wger.de/en/exercise/487/view' },
  { name: 'Dumbbell curl', title: 'Biceps Curls With Dumbbell', href: 'https://wger.de/en/exercise/92/view' },
  { name: 'Overhead triceps extension', title: 'Triceps Overhead (Dumbbell)', href: 'https://wger.de/en/exercise/1336/view' },
  { name: 'Dead bug', title: 'Deadbug', href: 'https://wger.de/en/exercise/178/view' },
  { name: 'Kettlebell swing', title: 'Kettlebell Swing', href: 'https://wger.de/en/exercise/960/view' },
  { name: 'Single-leg Romanian deadlift', title: 'Single-Leg Deadlift with Dumbbell', href: 'https://wger.de/en/exercise/1736/view' },
  { name: 'Reverse lunge', title: 'Dumbbell Rear Lunge', href: 'https://wger.de/en/exercise/1651/view' },
  { name: 'Single-leg hip thrust', title: 'Dumbbell Single-leg Hip Thrust', href: 'https://wger.de/en/exercise/1234/view' },
  { name: 'Push-up', title: 'Push-Up', href: 'https://wger.de/en/exercise/1551/view' },
  { name: 'Suitcase carry', title: 'Suitcase Carry', href: 'https://wger.de/en/exercise/1776/view' },
];

const BY_KEY = new Map(DEMOS.map((demo) => [exerciseKey(demo.name), demo]));

export function findDemo(name: string): ExerciseDemo | undefined {
  return BY_KEY.get(exerciseKey(name));
}
