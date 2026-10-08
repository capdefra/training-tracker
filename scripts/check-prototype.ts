import { readFileSync, readdirSync } from 'node:fs';
import { findDemo } from '../src/lib/demos';
import { parseHash } from '../src/hooks/useHashRoute';
import { prototypeSessions } from '../src/prototype/plan';
import type { PlanSession, TrainingData } from '../src/types';

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
  check(
    `${session.id} keeps exercise order, sets, and reps`,
    match.exercises.length === session.exercises.length &&
      match.exercises.every((exercise, index) => sameExercise(exercise, session.exercises[index])),
  );
  for (const exercise of match.exercises) {
    check(`${exercise.name} has a form clip`, findDemo(exercise.name) !== undefined);
  }
}

const byName = new Map(preview.flatMap((session) => session.exercises.map((exercise) => [exercise.name, exercise] as const)));

check('goblet squat starts at the plan’s 16 kg kettlebell', byName.get('Goblet squat')?.seedKg === 16 && byName.get('Goblet squat')?.statedLoad === true);
check('swings start at the plan’s 12 kg', byName.get('Kettlebell swing')?.seedKg === 12 && byName.get('Kettlebell swing')?.statedLoad === true);
check('suitcase carry starts at the plan’s 16 kg', byName.get('Suitcase carry')?.seedKg === 16 && byName.get('Suitcase carry')?.statedLoad === true);
check('split squat quotes the 10–14 kg range', byName.get('Bulgarian split squat')?.loadLabel.includes('10–14') === true && byName.get('Bulgarian split squat')?.statedLoad === true);
check('step-up load is a preview guess', byName.get('Step-up')?.statedLoad === false);
check('side plank stays a timed hold', byName.get('Side plank')?.count === 'seconds' && byName.get('Side plank')?.bodyweight === true);

const folder = new URL('../src/prototype/', import.meta.url);
for (const file of readdirSync(folder)) {
  if (!/\.(ts|tsx|css)$/.test(file)) continue;
  const source = readFileSync(new URL(file, folder), 'utf8');
  check(
    `${file} does not touch the log`,
    !source.includes('lib/storage') && !source.includes('lib/gist') && !source.includes('localStorage') && !source.includes('training.json'),
  );
}

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

console.log(`prototype preview matches ${planned.length} home strength sessions`);
