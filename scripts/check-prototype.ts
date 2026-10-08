import { readFileSync, readdirSync } from 'node:fs';
import { findDemo } from '../src/lib/demos';
import { parseHash } from '../src/hooks/useHashRoute';
import { floorOrSplit, prototypeSessions, standingExercises } from '../src/prototype/plan';
import type { PlanExercise, PlanSession, TrainingData } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const raw = JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData;
const home = raw.plans.find((plan) => plan.id === 'plan-ski-home');
const planned = (home?.sessions ?? []).filter((session) => session.kind === 'strength');
const preview = prototypeSessions();

check('preview has the home strength sessions', preview.length === planned.length && planned.length === 3);

for (const session of planned) {
  const match = preview.find((item) => item.id === session.id);
  check(`${session.id} is in the preview`, match !== undefined);
  if (!match) continue;
  const standing = standingExercises(session.exercises);
  check(
    `${session.id} keeps standing order, sets, and reps`,
    match.exercises.length === standing.length && match.exercises.every((exercise, index) => sameExercise(exercise, standing[index])),
  );
  for (const exercise of match.exercises) {
    check(`${session.id} ${exercise.name} is standing`, !floorOrSplit(exercise.name));
    if (exercise.name === 'Pallof press') continue;
    check(`${exercise.name} has a form clip`, findDemo(exercise.name) !== undefined);
  }
}

const lowerA = preview.find((session) => session.id === 'ps-lower-a');
const upper = preview.find((session) => session.id === 'ps-upper');
const lowerB = preview.find((session) => session.id === 'ps-lower-b');
const names = preview.flatMap((session) => session.exercises.map((exercise) => exercise.name.toLowerCase()));

check('no bulgarian split squat', names.every((name) => !name.includes('bulgarian') && !name.includes('split squat')));
check('no plank', names.every((name) => !name.includes('plank')));
check('no dead bug', names.every((name) => !name.includes('dead bug') && !name.includes('deadbug')));
check('lower A swaps the split squat for a reverse lunge', lowerA?.exercises[1]?.name === 'Reverse lunge' && lowerA.exercises[1]?.sets === 3 && lowerA.exercises[1]?.repsLabel === '8' && lowerA.exercises[1]?.statedLoad === false);
check('lower A next after goblet is that lunge', lowerA?.exercises[0]?.name === 'Goblet squat' && lowerA.exercises[1]?.name === 'Reverse lunge');
check('lower A swaps the side plank for a timed suitcase carry', lowerA?.exercises[4]?.name === 'Suitcase carry' && lowerA.exercises[4]?.count === 'seconds' && lowerA.exercises[4]?.repsLabel === '20-30' && lowerA.exercises[4]?.statedLoad === false);
check('upper swaps the dead bug for a Pallof press', upper?.exercises.at(-1)?.name === 'Pallof press' && upper.exercises.at(-1)?.repsLabel === '8' && upper.exercises.at(-1)?.pieces === 1);
check('lower B swaps the dead bug for a Pallof press', lowerB?.exercises[4]?.name === 'Pallof press' && lowerB.exercises[5]?.name === 'Push-up');

check('goblet squat starts at the plan’s 16 kg kettlebell', lowerA?.exercises[0]?.seedKg === 16 && lowerA.exercises[0]?.statedLoad === true);
check('swings start at the plan’s 12 kg', lowerB?.exercises[0]?.seedKg === 12 && lowerB.exercises[0]?.statedLoad === true);
check('the planned suitcase carry stays at 16 kg', lowerB?.exercises.at(-1)?.name === 'Suitcase carry' && lowerB.exercises.at(-1)?.seedKg === 16 && lowerB.exercises.at(-1)?.statedLoad === true);
check('step-up load is a preview guess', lowerA?.exercises[2]?.name === 'Step-up' && lowerA.exercises[2]?.statedLoad === false);

const crowded: PlanExercise[] = [
  { name: 'Bulgarian split squat', sets: 3, reps: '8' },
  { name: 'Reverse lunge', sets: 3, reps: '8' },
  { name: 'Step-up', sets: 3, reps: '8' },
  { name: 'Side plank', sets: 2, reps: '20', count: 'seconds' },
  { name: 'Suitcase carry', sets: 2, reps: '30', count: 'seconds' },
  { name: 'Dead bug', sets: 3, reps: '8' },
];
const swapped = standingExercises(crowded).map((exercise) => exercise.name);
check('a crowded session drops the split squat and the dead bug once Pallof is used', swapped.join(', ') === 'Reverse lunge, Step-up, Pallof press, Suitcase carry');

const folder = new URL('../src/prototype/', import.meta.url);
for (const file of readdirSync(folder)) {
  if (!/\.(ts|tsx|css)$/.test(file)) continue;
  const source = readFileSync(new URL(file, folder), 'utf8');
  check(
    `${file} does not write the log or the gist`,
    !source.includes('lib/storage') && !source.includes('saveToGist') && !source.includes('localStorage') && !source.includes('training.json'),
  );
}

const planSource = readFileSync(new URL('../src/prototype/plan.ts', import.meta.url), 'utf8');
check('preview can read the gist', planSource.includes('loadFromGist') && planSource.includes('loadGistConfig'));

const css = readFileSync(new URL('../src/prototype/session.css', import.meta.url), 'utf8');
check('enabled log label is light text', css.includes('.proto-screen button.proto-log') && css.includes('color: #f6f3ec'));
check('disabled log label is its own style', css.includes('.proto-screen button.proto-log:disabled'));

const screen = readFileSync(new URL('../src/prototype/SessionPrototype.tsx', import.meta.url), 'utf8');
check('log set disables only when reps are empty', screen.includes('disabled={!entry || entry.reps <= 0}'));

check('prototype route stays off Today', parseHash('#/today').name === 'today' && parseHash('#/today/2026-10-08').date === '2026-10-08');
check('log routes are unchanged', parseHash('#/log').name === 'log' && parseHash('#/log/abc').id === 'abc');
check('session preview route parses', parseHash('#/prototype/session').name === 'prototype' && parseHash('#/prototype/session').id === undefined);
check('session id parses', parseHash('#/prototype/session/ps-upper').id === 'ps-upper');

function sameExercise(previewExercise: { name: string; sets: number; repsLabel: string; count: string }, plannedExercise: PlanSession['exercises'][number] | undefined): boolean {
  if (!plannedExercise) return false;
  return previewExercise.name === plannedExercise.name && previewExercise.sets === plannedExercise.sets && previewExercise.repsLabel === plannedExercise.reps && previewExercise.count === (plannedExercise.count ?? 'reps');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`prototype preview stands in for ${planned.length} home strength sessions`);
