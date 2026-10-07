import { readFileSync } from 'node:fs';
import { exercisesFromTemplate, exercisesToSession, type ExerciseDraft } from '../src/lib/draft';
import { formatLoggedLoad, shownLoad } from '../src/lib/load';
import { sessionSummary } from '../src/lib/stats';
import { normalize } from '../src/lib/storage';
import { starterDocument } from '../src/lib/templates';
import type { Session, TrainingData } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const raw = JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData;
const tombstone = raw.deleted.goals.find((item) => item.id === 'goal-ski-2026');
const loadedFile = normalize(raw);
const loadedTombstone = loadedFile.deleted.goals.find((item) => item.id === 'goal-ski-2026');
check('ski goal tombstone is unchanged', tombstone?.at === '2026-10-03T07:50:00.000Z' && loadedTombstone?.at === tombstone.at);
check('ski goal tombstone is still one entry', loadedFile.deleted.goals.filter((item) => item.id === 'goal-ski-2026').length === 1);
check('starter document keeps the same tombstone', starterDocument().deleted.goals.find((item) => item.id === 'goal-ski-2026')?.at === '2026-10-03T07:50:00.000Z');

function legacySession(): unknown {
  return {
    id: 'old-strength',
    date: '2026-09-01',
    kind: 'strength',
    title: 'Lower',
    notes: '',
    goalId: null,
    planId: null,
    planSessionId: null,
    exercises: [
      { name: 'Goblet squat', sets: [{ reps: 8, weightKg: 16 }] },
      { name: 'Flat dumbbell bench press', sets: [{ reps: 10, weightKg: 24 }] },
      { name: 'Kettlebell swing', sets: [{ reps: 12, weightKg: 16 }] },
      { name: 'One-arm dumbbell row', sets: [{ reps: 8, weightKg: 14 }] },
      { name: 'Push-up', sets: [{ reps: 10, weightKg: 0 }] },
      { name: 'Incline press', pieces: 2, implement: 'kettlebell', sets: [{ reps: 8, weightKg: 24, kgPerPiece: 12 }] },
    ],
    createdAt: '2026-09-01T10:00:00.000Z',
  };
}

const migrated = normalize({ version: 1, goals: [], plans: [], presets: [], sessions: [legacySession()], deleted: { goals: [], plans: [], presets: [], sessions: [] } });
const session = migrated.sessions[0];
check('legacy session still loads', session?.id === 'old-strength');

const byName = new Map(session?.exercises.map((exercise) => [exercise.name, exercise]) ?? []);
const goblet = byName.get('Goblet squat');
check('goblet infers one kettlebell', goblet?.pieces === 1 && goblet.implement === 'kettlebell' && goblet.sets[0]?.kgPerPiece === 16 && goblet.sets[0]?.weightKg === 16);
const bench = byName.get('Flat dumbbell bench press');
check('bench stays a total', bench?.pieces === undefined && bench?.sets[0]?.weightKg === 24 && bench.sets[0]?.kgPerPiece === undefined);
const swing = byName.get('Kettlebell swing');
check('swing infers one kettlebell', swing?.pieces === 1 && swing.implement === 'kettlebell' && swing.sets[0]?.kgPerPiece === 16);
const row = byName.get('One-arm dumbbell row');
check('one-arm row infers one dumbbell', row?.pieces === 1 && row.implement === 'dumbbell' && row.sets[0]?.kgPerPiece === 14);
const pushUp = byName.get('Push-up');
check('bodyweight set gains no pieces', pushUp?.pieces === undefined && pushUp?.sets[0]?.weightKg === 0);
const incline = byName.get('Incline press');
check('two pieces are dumbbells even if a kettlebell was stored', incline?.pieces === 2 && incline.implement === 'dumbbell' && incline.sets[0]?.kgPerPiece === 12 && incline.sets[0]?.weightKg === 24);

const again = normalize(JSON.parse(JSON.stringify(migrated)) as TrainingData);
check('migration is stable', JSON.stringify(again.sessions) === JSON.stringify(migrated.sessions));

check('legacy bench reads as a total', formatLoggedLoad(bench!, bench!.sets[0]!) === '24 kg total');
check(
  'pair reads per piece then total',
  formatLoggedLoad(incline!, incline!.sets[0]!) === '2 dumbbells · 12 kg per piece · 24 kg total',
);
check('session summary keeps the old bench readable', sessionSummary(session!).includes('24 kg total'));

const split = shownLoad(2, 'dumbbell', '24', true);
check('a stored total splits only in the display', split.caption === 'kg per piece' && split.value === '12' && split.detail === '2 dumbbells · 24 kg total');
const one = shownLoad(1, 'kettlebell', '16', false);
check('one kettlebell shows per piece and the same total', one.caption === 'kg per piece' && one.value === '16' && one.detail === '1 kettlebell · 16 kg total');
const bare = shownLoad(null, null, '24', true);
check('no pieces stays a total', bare.caption === 'kg total' && bare.value === '24' && bare.detail === 'Pick 1 or 2 pieces');

const drafted = exercisesFromTemplate(
  [
    { name: 'Goblet squat', sets: 3, reps: '8-12' },
    { name: 'Side plank', sets: 3, reps: '20-30', count: 'seconds' },
  ],
  [],
);
check('new goblet starts as one kettlebell', drafted[0]?.pieces === 1 && drafted[0]?.implement === 'kettlebell' && drafted[0]?.pendingKg === '0');
check('side plank starts bodyweight', drafted[1]?.bodyweight === true && drafted[1]?.pieces === null && drafted[1]?.seedReps === '20');

const logged = exercisesToSession([
  {
    ...(drafted[0] as ExerciseDraft),
    sets: [{ key: 's1', reps: '8', kgPerPiece: '16', asTotal: false }],
  },
]);
if (Array.isArray(logged)) {
  check('saved goblet is 16 per piece and 16 total', logged[0]?.pieces === 1 && logged[0]?.implement === 'kettlebell' && logged[0]?.sets[0]?.kgPerPiece === 16 && logged[0]?.sets[0]?.weightKg === 16);
} else {
  check('saved goblet is 16 per piece and 16 total', false);
}

const paired = exercisesToSession([
  {
    ...(drafted[0] as ExerciseDraft),
    name: 'Flat dumbbell bench press',
    pieces: 2,
    implement: 'dumbbell',
    bodyweight: false,
    sets: [{ key: 's2', reps: '10', kgPerPiece: '24', asTotal: true }],
  },
]);
if (Array.isArray(paired)) {
  check('a legacy total of 24 with two dumbbells saves 12 per piece', paired[0]?.sets[0]?.kgPerPiece === 12 && paired[0]?.sets[0]?.weightKg === 24 && paired[0]?.implement === 'dumbbell');
}

check('empty strength log is refused', exercisesToSession([]) === 'Log at least one set.');

const summary = sessionSummary({
  ...(session as Session),
  exercises: incline ? [incline] : [],
});
check('history names both bells', summary.includes('2 dumbbells') && summary.includes('12 kg per piece') && summary.includes('24 kg total'));

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('load checks passed');
