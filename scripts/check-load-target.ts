import { exercisesFromTemplate } from '../src/lib/draft';
import { resolveExerciseTarget } from '../src/lib/load-target';
import { phaseOn, sessionForDate } from '../src/lib/plans';
import { normalize, serialize } from '../src/lib/storage';
import { exerciseTargets } from '../src/lib/targets';
import { starterDocument } from '../src/lib/templates';
import { PHASE_KEYS, PLAN_EXERCISE_KEYS, keepUnknown } from '../src/lib/unknown';
import type { ExerciseLoadTarget, PlanExercise, PlanPhase, Session, TrainingData } from '../src/types';

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

function phaseNamed(data: TrainingData, name: string) {
  const phase = planOf(data).phases?.find((item) => item.name === name);
  if (!phase) throw new Error(`missing phase ${name}`);
  return phase;
}

function resolved(data: TrainingData, date: string, sessionId: string, name: string): ExerciseLoadTarget | null {
  const plan = planOf(data);
  const session = sessionOf(data, sessionId);
  return resolveExerciseTarget(phaseOn(plan, date), session.id, exerciseOf(data, sessionId, name));
}

function stamp(data: TrainingData) {
  const lunge = exerciseOf(data, 'ps-lower-b', 'Reverse lunge');
  lunge.target = { sets: 4, reps: 6, weightKg: 12 };
  lunge.alsoCounts = ['Walking lunge'];
  const week = phaseNamed(data, 'Easy base');
  week.targets = [
    {
      sessionId: 'ps-lower-b',
      exercises: [{ name: ' reverse LUNGE ', sets: 3, reps: 8, weightKg: 10 }],
    },
    {
      sessionId: 'ps-upper',
      exercises: [{ name: 'Reverse lunge', sets: 9, reps: 9, weightKg: 99 }],
    },
  ];
  const deadlift = exerciseOf(data, 'ps-lower-a', 'Dumbbell Romanian deadlift');
  deadlift.alsoCounts = ['Single-leg Romanian deadlift'];
  deadlift.target = { weightKg: 14 };
  week.targets.push({
    sessionId: 'ps-lower-a',
    exercises: [{ name: 'single-leg romanian deadlift', weightKg: 18 }],
  });
}

const data = starterDocument();
stamp(data);

const inWeek = resolved(data, '2026-10-16', 'ps-lower-b', 'Reverse lunge');
check('a date inside the phase uses the phase target', inWeek?.sets === 3 && inWeek.reps === 8 && inWeek.weightKg === 10);
check('the phase start date is included', resolved(data, '2026-10-06', 'ps-lower-b', 'Reverse lunge')?.weightKg === 10);
check('the phase end date is included', resolved(data, '2026-10-18', 'ps-lower-b', 'Reverse lunge')?.weightKg === 10);

const after = resolved(data, '2026-10-19', 'ps-lower-b', 'Reverse lunge');
check('the day after the phase falls back to the exercise target', after?.sets === 4 && after.reps === 6 && after.weightKg === 12);
check('a later phase with no targets still uses the exercise target', resolved(data, '2026-10-23', 'ps-lower-b', 'Reverse lunge')?.weightKg === 12);

const hip = resolved(data, '2026-10-16', 'ps-lower-b', 'Single-leg hip thrust');
check('an exercise with no target resolves to none', hip === null);

const upperNoise = sessionForDate(planOf(data), sessionOf(data, 'ps-lower-b'), '2026-10-16');
const lunge = upperNoise.exercises.find((item) => item.name === 'Reverse lunge');
const hipThrust = upperNoise.exercises.find((item) => item.name === 'Single-leg hip thrust');
check('phase targets for another session do not change this one', lunge?.sets === 3 && lunge.target?.weightKg === 10);
check('hip thrust keeps the plan set count', hipThrust?.sets === 3 && hipThrust.target === undefined);

const dead = sessionForDate(planOf(data), sessionOf(data, 'ps-lower-a'), '2026-10-12');
const rdl = dead.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
check('an alsoCounts alias matches the phase target', rdl?.target?.weightKg === 18 && rdl.sets === 3);

const partial = starterDocument();
const partialLunge = exerciseOf(partial, 'ps-lower-b', 'Reverse lunge');
partialLunge.target = { sets: 4, weightKg: 12 };
phaseNamed(partial, 'Easy base').targets = [
  { sessionId: 'ps-lower-b', exercises: [{ name: 'Reverse lunge', weightKg: 10 }] },
];
const partialResolved = resolved(partial, '2026-10-16', 'ps-lower-b', 'Reverse lunge');
check('a phase field wins and the other fields fall back to the exercise target', partialResolved?.weightKg === 10 && partialResolved.sets === 4 && partialResolved.reps === undefined);

const tapered = starterDocument();
phaseNamed(tapered, 'Taper').targets = [
  { sessionId: 'ps-lower-b', exercises: [{ name: 'Reverse lunge', sets: 5 }] },
];
const taperSession = sessionForDate(planOf(tapered), sessionOf(tapered, 'ps-lower-b'), '2026-12-11');
const taperLunge = taperSession.exercises.find((item) => item.name === 'Reverse lunge');
const taperSwing = taperSession.exercises.find((item) => item.name === 'Kettlebell swing');
check('a target set count replaces the phase-wide set count for that exercise', taperLunge?.sets === 5);
check('other exercises keep the phase-wide set count', taperSwing?.sets === 2);
const taperTargets = exerciseTargets(taperSession, []);
check(
  'the week cap uses the target set count',
  taperTargets.find((item) => item.name === 'Reverse lunge')?.targetSets === 5 &&
    taperTargets.find((item) => item.name === 'Kettlebell swing')?.targetSets === 2,
);

function loggedLunge(name: string, kgPerPiece: number): Session {
  return {
    id: 'prev-lunge',
    date: '2026-10-09',
    kind: 'strength',
    title: 'Lower B',
    notes: '',
    goalId: null,
    planId: 'plan-ski-home',
    planSessionId: 'ps-lower-b',
    exercises: [
      {
        name,
        pieces: 2,
        implement: 'dumbbell',
        sets: [
          { reps: 8, weightKg: kgPerPiece * 2, kgPerPiece },
          { reps: 8, weightKg: kgPerPiece * 2, kgPerPiece },
          { reps: 8, weightKg: kgPerPiece * 2, kgPerPiece },
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
    createdAt: '2026-10-09T18:00:00.000Z',
  };
}

const weekSession = sessionForDate(planOf(data), sessionOf(data, 'ps-lower-b'), '2026-10-16');
const drafted = exercisesFromTemplate(weekSession.exercises, [loggedLunge('Reverse lunge', 8)]);
const draftedLunge = drafted.find((item) => item.name === 'Reverse lunge');
const draftedHip = drafted.find((item) => item.name === 'Single-leg hip thrust');
check('the target weight and reps pre-fill the logger', draftedLunge?.pendingKg === '10' && draftedLunge.pendingReps === '8' && draftedLunge.pendingAsTotal === false);
check('the target weight is per piece', draftedLunge?.pieces === 2 && draftedLunge.seedKg === '10');
check('the target set count is the session cap', draftedLunge?.targetSets === 3);
check('the hint quotes the last log while the steppers show the target', draftedLunge?.comparisonHint === 'Last: 3×8 @ 8 kg');
check('an exercise with no target still pre-fills from the plan reps', draftedHip?.pendingReps === '10' && draftedHip.comparisonHint === '' && draftedHip.targetSets === 3);

const historyOnly = exercisesFromTemplate(
  sessionOf(starterDocument(), 'ps-lower-b').exercises,
  [loggedLunge('Reverse lunge', 8)],
);
const historyLunge = historyOnly.find((item) => item.name === 'Reverse lunge');
check('with no target the last log still pre-fills the weight', historyLunge?.pendingKg === '8' && historyLunge.pendingReps === '8' && historyLunge.comparisonHint === '');

const aliasHistory = exercisesFromTemplate(weekSession.exercises, [loggedLunge('Walking lunge', 8)]);
check(
  'the last hint follows an alsoCounts alias',
  aliasHistory.find((item) => item.name === 'Reverse lunge')?.comparisonHint === 'Last: 3×8 @ 8 kg',
);
const aliasWithoutTarget = exercisesFromTemplate(sessionOf(starterDocument(), 'ps-lower-b').exercises, [loggedLunge('Walking lunge', 8)]);
check(
  'with no target an alias log does not replace the exact-name pre-fill',
  aliasWithoutTarget.find((item) => item.name === 'Reverse lunge')?.pendingKg === '0',
);

const setsOnly = starterDocument();
exerciseOf(setsOnly, 'ps-lower-b', 'Reverse lunge').target = { sets: 4 };
const setsDraft = exercisesFromTemplate(sessionForDate(planOf(setsOnly), sessionOf(setsOnly, 'ps-lower-b'), '2026-10-23').exercises, [
  loggedLunge('Reverse lunge', 8),
]);
const setsLunge = setsDraft.find((item) => item.name === 'Reverse lunge');
check('sets alone change the cap and leave the last weight in the steppers', setsLunge?.targetSets === 4 && setsLunge.pendingKg === '8' && setsLunge.comparisonHint === 'Target: 4 sets');

const legacy = exercisesFromTemplate(
  [
    {
      ...exerciseOf(data, 'ps-lower-b', 'Reverse lunge'),
      target: { reps: 8, weightKg: 10 },
    },
  ],
  [
    {
      ...loggedLunge('Reverse lunge', 8),
      exercises: [{ name: 'Reverse lunge', sets: [{ reps: 8, weightKg: 16 }] }],
    },
  ],
);
check('a legacy total in the hint stays labeled as a total', legacy[0]?.comparisonHint === 'Last: 1×8 @ 16 kg total');

const raw = starterDocument();
const rawPlan = planOf(raw);
const rawLunge = exerciseOf(raw, 'ps-lower-b', 'Reverse lunge') as PlanExercise & { target: Record<string, unknown> };
rawLunge.target = { sets: 0, reps: '8', weightKg: '10', cue: 'each leg' };
const rawPhase = phaseNamed(raw, 'Easy base') as PlanPhase & { targets: unknown; coachNote?: string };
rawPhase.coachNote = 'ease in';
rawPhase.targets = [
  {
    sessionId: 'ps-lower-b',
    exercises: [
      { name: 'Reverse lunge', weightKg: -2, sets: 3.2, note: 'per hand' },
      { name: '   ' },
    ],
  },
];
const stored = normalize(JSON.parse(serialize(raw)));
const storedLunge = exerciseOf(stored, 'ps-lower-b', 'Reverse lunge') as PlanExercise & { target?: ExerciseLoadTarget & { cue?: string } };
check('normalize keeps a numeric weight and drops an empty set count', storedLunge.target?.weightKg === 10 && storedLunge.target.reps === 8 && storedLunge.target.sets === undefined);
check('normalize keeps an unknown field on the exercise target', storedLunge.target?.cue === 'each leg');
const storedPhase = phaseNamed(stored, 'Easy base') as PlanPhase & { coachNote?: string };
const storedTarget = storedPhase.targets?.[0]?.exercises[0] as { sets?: number; weightKg?: number; note?: string } | undefined;
check('normalize rounds phase sets and drops a negative weight', storedTarget?.sets === 3 && storedTarget.weightKg === undefined && storedTarget.note === 'per hand');
check('a phase unknown field still round-trips beside targets', storedPhase.coachNote === 'ease in');

const targetsOnly = normalize({
  version: 1,
  goals: [],
  plans: [
    {
      ...rawPlan,
      sessions: rawPlan.sessions,
      phases: [
        {
          name: 'Targets only',
          startDate: '2026-10-12',
          endDate: '2026-10-18',
          sessions: [],
          targets: [{ sessionId: 'ps-lower-b', exercises: [{ name: 'Reverse lunge', weightKg: 10 }] }],
        },
      ],
    },
  ],
  presets: [],
  sessions: [],
  deleted: { goals: [], plans: [], presets: [], sessions: [] },
});
check('a phase that only carries targets is kept', targetsOnly.plans[0]?.phases?.[0]?.targets?.[0]?.exercises[0]?.weightKg === 10);

const olderExercise = keepUnknown(
  { name: 'Reverse lunge', sets: 3, reps: '8' },
  { name: 'Reverse lunge', sets: 3, reps: '8', target: { weightKg: 10 }, tempo: '3010' },
  PLAN_EXERCISE_KEYS.filter((key) => key !== 'target'),
);
check('a build that does not know target still keeps it', (olderExercise as { target?: { weightKg?: number } }).target?.weightKg === 10);
const olderPhase = keepUnknown(
  { name: 'Week 2', startDate: '2026-10-12', endDate: '2026-10-18', sessions: [] },
  {
    name: 'Week 2',
    startDate: '2026-10-12',
    endDate: '2026-10-18',
    sessions: [],
    targets: [{ sessionId: 'ps-lower-b', exercises: [{ name: 'Reverse lunge', weightKg: 10 }] }],
  },
  PHASE_KEYS.filter((key) => key !== 'targets'),
);
check('a build that does not know phase targets still keeps them', (olderPhase as { targets?: unknown[] }).targets?.length === 1);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('load target checks passed');
