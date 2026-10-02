// Writes the starter log: ski-season goal, weekly plan, workout presets, and no sessions.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STAMP = '2026-10-02T00:00:00.000Z';
const goalId = 'goal-ski-2026';
const planId = 'plan-ski-base';

const workouts = [
  {
    id: 'preset-lower',
    planSessionId: 'ps-lower',
    dayOfWeek: 1,
    name: 'Lower body',
    kind: 'strength',
    focus: 'Legs',
    notes: 'Hit every set and rep. Add load when the sets feel solid — the target is the work, not a weight.',
    exercises: [
      { name: 'Back squat', sets: 5, reps: '5' },
      { name: 'Romanian deadlift', sets: 3, reps: '8' },
      { name: 'Walking lunge', sets: 3, reps: '8' },
      { name: 'Calf raise', sets: 3, reps: '12' },
    ],
  },
  {
    id: 'preset-easy',
    planSessionId: 'ps-easy',
    dayOfWeek: 2,
    name: 'Easy run',
    kind: 'run',
    focus: 'Cardio',
    notes: 'Do the run. Easy enough to talk. Distance and pace are optional in the log.',
    exercises: [],
  },
  {
    id: 'preset-balance',
    planSessionId: 'ps-balance',
    dayOfWeek: 3,
    name: 'Balance',
    kind: 'strength',
    focus: 'Balance',
    notes: 'Slow eccentrics. The target is the sets and reps on each side.',
    exercises: [
      { name: 'Bulgarian split squat', sets: 3, reps: '8' },
      { name: 'Single-leg RDL', sets: 3, reps: '8' },
      { name: 'Step-down', sets: 3, reps: '8' },
    ],
  },
  {
    id: 'preset-posterior',
    planSessionId: 'ps-posterior',
    dayOfWeek: 5,
    name: 'Posterior chain',
    kind: 'strength',
    focus: 'Legs',
    notes: 'Hinge and hips. Stop a nordic if a hamstring feels sharp. Side plank targets are seconds.',
    exercises: [
      { name: 'Hip thrust', sets: 3, reps: '8' },
      { name: 'Deadlift', sets: 3, reps: '5' },
      { name: 'Nordic curl', sets: 3, reps: '6' },
      { name: 'Side plank', sets: 3, reps: '30', count: 'seconds' },
    ],
  },
  {
    id: 'preset-long',
    planSessionId: 'ps-long',
    dayOfWeek: 6,
    name: 'Long run',
    kind: 'run',
    focus: 'Cardio',
    notes: 'Do the run. Steady effort, with a hill if the route has one. Distance and pace are optional in the log.',
    exercises: [],
  },
];

function cloneExercises(exercises) {
  return exercises.map((exercise) => ({ ...exercise }));
}

const data = {
  version: 1,
  goals: [
    {
      id: goalId,
      name: 'Ski season prep',
      targetDate: '2026-12-19',
      focus: ['Legs', 'Balance', 'Cardio'],
      notes: 'Be ready for the first week on snow: stronger quads and posterior chain, steadier single-leg balance, and an aerobic base that survives a full day on the hill.',
      status: 'active',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: STAMP,
    },
  ],
  plans: [
    {
      id: planId,
      goalId,
      name: 'Pre-season base',
      startDate: '2026-08-03',
      weeks: 20,
      focus: ['Legs', 'Balance', 'Cardio'],
      notes: 'The same week through the start of the season. Strength targets are sets and reps — choose the load yourself. A run counts as soon as you do it.',
      status: 'active',
      updatedAt: STAMP,
      sessions: workouts.map((workout) => ({
        id: workout.planSessionId,
        dayOfWeek: workout.dayOfWeek,
        kind: workout.kind,
        title: workout.name,
        focus: workout.focus,
        notes: workout.notes,
        exercises: workout.kind === 'strength' ? cloneExercises(workout.exercises) : [],
        distanceKm: null,
        durationMin: null,
      })),
    },
  ],
  presets: workouts.map((workout) => ({
    id: workout.id,
    name: workout.name,
    kind: workout.kind,
    focus: workout.focus,
    notes: workout.notes,
    exercises: workout.kind === 'strength' ? cloneExercises(workout.exercises) : [],
    createdAt: STAMP,
    updatedAt: STAMP,
  })),
  sessions: [],
  deleted: { goals: [], plans: [], presets: [], sessions: [] },
};

if (data.sessions.length !== 0) throw new Error('Starter log must not include sessions');
for (const session of data.plans[0].sessions) {
  if (session.kind === 'run' && (session.distanceKm !== null || session.durationMin !== null)) {
    throw new Error(`${session.title} should not have a distance or time target`);
  }
  for (const exercise of session.exercises) {
    if ('weightKg' in exercise) throw new Error(`${exercise.name} target must not include weight`);
    if (!exercise.sets || !exercise.reps) throw new Error(`${exercise.name} needs sets and reps`);
  }
}
const plank = data.plans[0].sessions.flatMap((session) => session.exercises).find((exercise) => exercise.name === 'Side plank');
if (!plank || plank.count !== 'seconds') throw new Error('Side plank target should be seconds');
if (data.presets.length !== 5) throw new Error('Expected five presets');

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'training.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${data.sessions.length} sessions and ${data.presets.length} presets to ${file}`);
