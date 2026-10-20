import { visiblePhaseNotes } from '../src/lib/equipment';
import { previewSession } from '../src/lib/preview';
import { normalize, serialize } from '../src/lib/storage';
import { starterDocument } from '../src/lib/templates';
import type { PlanExercise, Session, TrainingData } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

function planOf(data: TrainingData) {
  const plan = data.plans[0];
  if (!plan) throw new Error('missing plan');
  return plan;
}

function sessionOf(data: TrainingData, id: string) {
  const session = planOf(data).sessions.find((item) => item.id === id);
  if (!session) throw new Error(`missing ${id}`);
  return session;
}

function exerciseOf(data: TrainingData, sessionId: string, name: string) {
  const exercise = sessionOf(data, sessionId).exercises.find((item) => item.name === name);
  if (!exercise) throw new Error(`missing ${name}`);
  return exercise;
}

function row(data: TrainingData, date: string, sessionId: string, name: string, logs: Session[] = []) {
  const model = previewSession(planOf(data), sessionOf(data, sessionId), date, logs);
  return { model, exercise: model.exercises.find((item) => item.name === name) };
}

function logged(name: string, kgPerPiece: number, pieces: 1 | 2 = 2): Session {
  return {
    id: `log-${name}`,
    date: '2026-10-02',
    kind: 'strength',
    title: 'Lower B',
    notes: '',
    goalId: null,
    planId: 'plan-ski-home',
    planSessionId: 'ps-lower-b',
    exercises: [
      {
        name,
        pieces,
        implement: 'dumbbell',
        sets: [
          { reps: 8, weightKg: kgPerPiece * pieces, kgPerPiece },
          { reps: 8, weightKg: kgPerPiece * pieces, kgPerPiece },
          { reps: 8, weightKg: kgPerPiece * pieces, kgPerPiece },
        ],
      },
    ],
    distanceKm: null,
    durationSec: null,
    elevationM: null,
    effort: null,
    paceSec: null,
    heartRate: null,
    activeKcal: null,
    totalKcal: null,
    cadenceSpm: null,
    powerW: null,
    place: '',
    source: '',
    activity: '',
    startTime: '',
    endTime: '',
    weather: null,
    splits: [],
    createdAt: '2026-10-02T18:00:00.000Z',
  };
}

const data = starterDocument();
const lunge = exerciseOf(data, 'ps-lower-b', 'Reverse lunge') as PlanExercise & { notes?: string };
lunge.target = { sets: 4, reps: 6, weightKg: 12 };
lunge.alsoCounts = ['Walking lunge'];
lunge.notes = 'Each leg';
const phase = planOf(data).phases?.find((item) => item.name === 'Easy base');
if (!phase) throw new Error('missing phase');
phase.sessions.push({
  sessionId: 'ps-lower-b',
  notes: 'Loads: Reverse lunge 3x8 each leg @ 10 kg per hand\nShoulders on the bench for the hip thrust.',
});
phase.targets = [
  {
    sessionId: 'ps-lower-b',
    exercises: [{ name: ' reverse LUNGE ', sets: 3, reps: 8, weightKg: 10 }],
  },
  {
    sessionId: 'ps-upper',
    exercises: [{ name: 'Reverse lunge', sets: 9, reps: 9, weightKg: 99 }],
  },
];

const history = [logged('Reverse lunge', 8), logged('Walking lunge', 6), logged('Single-leg hip thrust', 12, 1)];
const inPhase = row(data, '2026-10-16', 'ps-lower-b', 'Reverse lunge', history);
check('the selected day inside the phase uses the phase target', inPhase.exercise?.targetLabel === 'Target: 3×8 @ 10 kg per piece');
check('the plan line keeps the template sets and reps', inPhase.exercise?.planLabel === '3×8');
check('history is quoted beside the target', inPhase.exercise?.lastLabel === 'Last: 3×8 @ 8 kg');
check('a loads summary is left off and the coaching note stays', inPhase.model.phaseNotes === 'Shoulders on the bench for the hip thrust.' && inPhase.model.phaseName === 'Easy base');
check(
  'lower b lists the pair, the kettlebell, the bench, and a mat',
  inPhase.model.equipmentLabel === '2× dumbbells, kettlebell, bench, mat',
);
check('reverse lunge is a pair of dumbbells', inPhase.exercise?.equipmentLabel === '2× dumbbells');
check('the hip thrust names the single dumbbell and the bench', row(data, '2026-10-16', 'ps-lower-b', 'Single-leg hip thrust').exercise?.equipmentLabel === 'dumbbell · bench');
check('dead bug is a mat', row(data, '2026-10-16', 'ps-lower-b', 'Dead bug').exercise?.equipmentLabel === 'mat');
check('the swing is one kettlebell', row(data, '2026-10-16', 'ps-lower-b', 'Kettlebell swing').exercise?.equipmentLabel === 'kettlebell');
check('an exercise note is shown when the data has one', inPhase.exercise?.notes === 'Each leg');
check('a known form clip is offered', inPhase.exercise?.hasDemo === true);
check('the phase start and end dates are included', row(data, '2026-10-06', 'ps-lower-b', 'Reverse lunge').exercise?.targetLabel === 'Target: 3×8 @ 10 kg per piece' && row(data, '2026-10-18', 'ps-lower-b', 'Reverse lunge').exercise?.targetLabel === 'Target: 3×8 @ 10 kg per piece');

const after = row(data, '2026-10-23', 'ps-lower-b', 'Reverse lunge', history);
check('after the phase the exercise target is the suggestion', after.exercise?.targetLabel === 'Target: 4×6 @ 12 kg per piece' && after.exercise?.planLabel === '3×8');
check('a target on another session does not apply', after.exercise?.targetLabel !== 'Target: 9×9 @ 99 kg per piece');

const hip = row(data, '2026-10-16', 'ps-lower-b', 'Single-leg hip thrust', history);
check('with no written target the last weight is the reference', hip.exercise?.planLabel === '3×10 /side' && hip.exercise?.targetLabel === 'Target: 3×10 /side @ 12 kg per piece' && hip.exercise?.lastLabel === 'Last: 3×8 /side @ 12 kg');

const bare = row(data, '2026-10-16', 'ps-lower-b', 'Dead bug');
check('with no target and no log the plan sets and reps are the suggestion', bare.exercise?.targetLabel === 'Target: 3×8' && bare.exercise?.lastLabel === '');

const alias = row(data, '2026-10-16', 'ps-lower-b', 'Reverse lunge', [logged('Walking lunge', 6)]);
check('last weight follows an alsoCounts alias', alias.exercise?.lastLabel === 'Last: 3×8 @ 6 kg');

const madeUp = sessionOf(data, 'ps-lower-b');
madeUp.exercises.push({ name: 'Made-up lift', sets: 2, reps: '5' });
const custom = row(data, '2026-10-16', 'ps-lower-b', 'Made-up lift');
check('an exercise without a clip has no demo', custom.exercise?.hasDemo === false);

const push = exerciseOf(data, 'ps-lower-b', 'Push-up');
push.target = { weightKg: 10, reps: 12 };
const body = row(data, '2026-10-23', 'ps-lower-b', 'Push-up', [logged('Push-up', 8, 1)]);
check('a bodyweight exercise does not pick up a weight', body.exercise?.targetLabel === 'Target: 2×12' && body.exercise?.planLabel === '2×8-15');

const legacy = previewSession(planOf(data), sessionOf(data, 'ps-lower-b'), '2026-10-23', [
  {
    ...logged('Kettlebell swing', 16, 1),
    exercises: [{ name: 'Kettlebell swing', sets: [{ reps: 12, weightKg: 16 }] }],
  },
]);
check('a legacy total stays labeled as a total', legacy.exercises.find((item) => item.name === 'Kettlebell swing')?.targetLabel === 'Target: 4×12 @ 16 kg total' && legacy.exercises.find((item) => item.name === 'Kettlebell swing')?.lastLabel === 'Last: 1×12 @ 16 kg total');

const taper = row(data, '2026-12-11', 'ps-lower-b', 'Reverse lunge');
const taperSwing = row(data, '2026-12-11', 'ps-lower-b', 'Kettlebell swing');
check('a phase-wide set count is the planned count', taper.exercise?.planLabel === '2×8' && taperSwing.exercise?.planLabel === '2×12');
check('the original template sets are left unchanged', exerciseOf(data, 'ps-lower-b', 'Reverse lunge').sets === 3);

const run = previewSession(planOf(data), sessionOf(data, 'ps-easy'), '2026-10-16', []);
check('a run preview keeps the phase notes and has no exercise rows', run.kind === 'run' && run.phaseNotes.includes('20-25') && run.exercises.length === 0 && run.equipmentLabel === '');
const hills = previewSession(planOf(data), sessionOf(data, 'ps-easy'), '2026-11-16', []);
check('a hill note is not treated as a loads summary', hills.phaseNotes.includes('8 x 30s'));
check(
  'coaching that follows a loads sentence stays in that paragraph',
  visiblePhaseNotes('Loads: Reverse lunge 3x8 @ 10 kg per hand. Shoulders on the bench.') === 'Shoulders on the bench.',
);

const preset = previewSession(null, { ...sessionOf(data, 'ps-lower-b'), id: 'preset-lower-b' }, '2026-10-16', history);
check('a preset has no phase, so the exercise target is used', preset.phaseName === '' && preset.exercises.find((item) => item.name === 'Reverse lunge')?.targetLabel === 'Target: 4×6 @ 12 kg per piece');

const barePrescription = previewSession(planOf(data), sessionOf(data, 'ps-upper'), '2026-10-16', []);
const upperPhase = planOf(data).phases?.find((item) => item.name === 'Easy base');
upperPhase?.sessions.push({ sessionId: 'ps-upper', notes: 'Flat press 3x8 @ 16 kg per hand' });
const prescribed = previewSession(planOf(data), sessionOf(data, 'ps-upper'), '2026-10-16', []);
check('a note that is only a load prescription is left off', prescribed.phaseNotes === '');
check('upper gear is inferred before that note is attached', barePrescription.equipmentLabel === '2× dumbbells, bench, mat');

const written = exerciseOf(data, 'ps-lower-b', 'Suitcase carry');
written.equipment = ['resistance band', 'Resistance band'];
const banded = row(data, '2026-10-16', 'ps-lower-b', 'Suitcase carry');
check('a written equipment list replaces the inferred kettlebell', banded.exercise?.equipmentLabel === 'resistance band');

(written as PlanExercise & { cue?: string }).cue = 'left side';
const roundTrip = normalize(JSON.parse(serialize(data)));
const kept = roundTrip.plans[0]?.sessions.find((item) => item.id === 'ps-lower-b')?.exercises.find((item) => item.name === 'Reverse lunge') as { notes?: string } | undefined;
const keptCarry = roundTrip.plans[0]?.sessions.find((item) => item.id === 'ps-lower-b')?.exercises.find((item) => item.name === 'Suitcase carry') as { equipment?: string[]; cue?: string } | undefined;
check('an exercise note still round-trips as an unknown field', kept?.notes === 'Each leg');
check('equipment round-trips and a duplicate is dropped', keptCarry?.equipment?.join('|') === 'resistance band');
check('a field beside equipment still round-trips', keptCarry?.cue === 'left side');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('session preview checks passed');
