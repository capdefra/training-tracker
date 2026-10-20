import { effortLabel, isPerSide } from '../src/lib/per-side';
import { normalize, serialize } from '../src/lib/storage';
import { repsLabel } from '../src/lib/targets';
import { starterDocument } from '../src/lib/templates';
import type { PlanExercise } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

function exercise(name: string): PlanExercise | undefined {
  return starterDocument()
    .plans[0]?.sessions.flatMap((session) => session.exercises)
    .find((item) => item.name === name);
}

check('side plank is marked each side', exercise('Side plank')?.perSide === true && repsLabel(exercise('Side plank')!) === '20-30 sec /side');
check('suitcase carry seconds stay per side', exercise('Suitcase carry')?.perSide === true && repsLabel(exercise('Suitcase carry')!) === '30 sec /side');
check('a single-leg rep count is labeled per side', repsLabel(exercise('Single-leg hip thrust')!) === '10 /side');
check('one-arm work is labeled per side', repsLabel(exercise('One-arm dumbbell row')!) === '8-12 /side');
check('a bilateral exercise has no suffix', repsLabel(exercise('Goblet squat')!) === '8-12' && isPerSide(exercise('Goblet squat')!) === false);
check('bulgarian split squat is not inferred', isPerSide({ name: 'Bulgarian split squat' }) === false);
check('reverse lunge is not inferred', isPerSide({ name: 'Reverse lunge' }) === false);
check('step-up is not inferred', isPerSide({ name: 'Step-up' }) === false);
check('dead bug is not inferred', isPerSide({ name: 'Dead bug' }) === false);
check('an explicit true marks a split squat', isPerSide({ name: 'Bulgarian split squat', perSide: true }));
check('an explicit false wins over the name', isPerSide({ name: 'Side plank', perSide: false }) === false);
check('a missing field still hints from the name', isPerSide({ name: 'Suitcase carry' }) && effortLabel({ name: 'Side plank', reps: '30', count: 'seconds' }) === '30 sec /side');
check('the stored reps are not doubled', effortLabel({ name: 'Single-leg Romanian deadlift', reps: '8', perSide: true }) === '8 /side');

const cleared = starterDocument();
const clearedPlank = cleared.plans[0]?.sessions.flatMap((session) => session.exercises).find((item) => item.name === 'Side plank');
if (clearedPlank) {
  delete clearedPlank.perSide;
  (clearedPlank as PlanExercise & { tempo?: string }).tempo = '3010';
}
const hinted = normalize(JSON.parse(serialize(cleared)));
const hintedPlank = hinted.plans[0]?.sessions.flatMap((session) => session.exercises).find((item) => item.name === 'Side plank') as (PlanExercise & { tempo?: string }) | undefined;
check('an omitted perSide stays omitted', hintedPlank?.perSide === undefined);
check('a name hint still labels an omitted field', hintedPlank !== undefined && repsLabel(hintedPlank) === '20-30 sec /side');
check('a field beside perSide still round-trips', hintedPlank?.tempo === '3010');

const forced = starterDocument();
const forcedPlank = forced.plans[0]?.sessions.flatMap((session) => session.exercises).find((item) => item.name === 'Side plank');
if (forcedPlank) forcedPlank.perSide = false;
const off = normalize(JSON.parse(serialize(forced)));
const offPlank = off.plans[0]?.sessions.flatMap((session) => session.exercises).find((item) => item.name === 'Side plank');
check('explicit false round-trips and turns the hint off', offPlank?.perSide === false && offPlank !== undefined && repsLabel(offPlank) === '20-30 sec');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('per-side checks passed');
