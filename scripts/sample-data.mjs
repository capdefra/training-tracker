// Rebuilds the checked-in sample log. Cutoff is fixed so the demo week
// stays "this week" around 1 Oct 2026. Overwrites public/data/training.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TODAY = '2026-10-01';
const PLAN_START = '2026-08-03';

const goalId = 'goal-ski-2026';
const planId = 'plan-ski-base';
const ps = {
  lower: 'ps-lower',
  easy: 'ps-easy',
  balance: 'ps-balance',
  posterior: 'ps-posterior',
  long: 'ps-long',
};

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function sets(reps, weightKg, count) {
  return Array.from({ length: count }, () => ({ reps, weightKg }));
}

function strengthSession({ date, title, planSessionId, exercises, notes }) {
  return {
    id: `log-${planSessionId}-${date}`,
    date,
    kind: 'strength',
    title,
    notes,
    goalId,
    planId,
    planSessionId,
    exercises,
    distanceKm: null,
    durationSec: null,
    elevationM: null,
    effort: null,
    createdAt: `${date}T17:30:00.000Z`,
  };
}

function runSession({ date, title, planSessionId, distanceKm, paceSec, elevationM, effort, notes }) {
  return {
    id: `log-${planSessionId}-${date}`,
    date,
    kind: 'run',
    title,
    notes,
    goalId,
    planId,
    planSessionId,
    exercises: [],
    distanceKm,
    durationSec: Math.round(distanceKm * paceSec),
    elevationM,
    effort,
    createdAt: `${date}T07:15:00.000Z`,
  };
}

const lowerNotes = [
  'First squat day of the block. Kept a rep in reserve.',
  'Bar speed was better than last week.',
  'Knees felt fine. Last set of squats was the hard one.',
  'Lunges a bit wobbly. Slowed them down.',
  'Solid five across. Quads will feel this tomorrow.',
  'Repeated the squat weight. Depth was the goal, not the plates.',
  'Moved the squat up again. Bracing felt tighter.',
  'Easy to rush the Romanian deadlift. Stayed long on the way down.',
  'Best squat day of the block so far.',
];

const easyNotes = [
  'Easy out-and-back. Conversational the whole way.',
  'Flat route. Heart rate stayed down.',
  'Short hills, still easy.',
  'Legs heavy from Monday. Kept the pace honest.',
  'Cooler morning. Felt smooth.',
  'A bit flat. Cut the effort rather than the distance.',
  'River path. Could have talked in full sentences.',
  'Same loop as last week, a little quicker without pushing.',
  'Easy eight. Ready for Friday.',
];

const balanceNotes = [
  'Left side is the limiter on split squats.',
  'Slowed the eccentric. Less knee cave.',
  'Step-downs are humbling. Held the rail less.',
  'Single-leg RDL balance improving if I stare at the floor less.',
  'Added a pause at the bottom of the split squat.',
  'Left side still wobbles, but I finished every rep.',
  'No rail on the step-downs today.',
  'Split squats felt even for the first time.',
  'Quiet session. Balance work is starting to look like strength.',
];

const posteriorNotes = [
  'Hip thrust lockout was the weak point.',
  'Deadlift from the floor felt heavier than the warm-up suggested.',
  'Nordics are short. Stopped before the hamstring felt sharp.',
  'Hinge pattern cleaner than the start of August.',
  'Side plank time is up. Hips still drop a little on the left.',
  'Deadlift reps were smooth. Left a little in the tank.',
  'Strong hip thrust day. This is the ski posterior chain.',
];

const longNotes = [
  'Steady, not a race. Walked the steepest minute.',
  'Added a small hill at the end.',
  'Ten kilometres continuous. Fuelled with water only.',
  'Legs turned over fine after yesterday\'s hinge work.',
  'Longer loop. Kept the same effort, not the same pace on climbs.',
  'Hillier route, more like a ski day than a tempo.',
  'Last three kilometres were the point of the session.',
  'Fourteen kilometres, mostly relaxed. Climb at the finish.',
];

const sessions = [];

const squat = [70, 72.5, 75, 77.5, 80, 82.5, 82.5, 85, 90];
const rdl = [60, 62.5, 65, 65, 67.5, 70, 70, 72.5, 75];
const lunge = [12, 12, 14, 14, 16, 16, 16, 18, 18];
const calf = [40, 40, 42.5, 45, 45, 47.5, 50, 50, 52.5];
const split = [10, 10, 12, 12, 14, 14, 16, 16, 18];
const single = [12, 14, 14, 16, 16, 18, 18, 20, 22];
const stepKg = [0, 0, 0, 4, 4, 6, 6, 8, 8];
const thrust = [70, 75, 80, 85, 90, 95, 100];
const deadlift = [80, 85, 90, 90, 95, 100, 105];
const nordicReps = [4, 5, 5, 6, 6, 7, 8];
const plankSec = [20, 25, 25, 30, 30, 35, 40];
const easyKm = [5, 5.5, 6, 6.2, 7, 7, 7.5, 8, 8];
const easyPace = [390, 384, 378, 372, 366, 372, 348, 342, 336];
const easyEffort = [4, 4, 5, 4, 5, 6, 5, 4, 4];
const longKm = [8, 9, 10, 10, 12, 12, 13, 14];
const longPace = [405, 400, 396, 390, 384, 378, 372, 366];
const longElev = [60, 80, 90, 110, 120, 140, 150, 180];
const longEffort = [6, 6, 6, 7, 6, 7, 7, 6];

let posteriorIndex = 0;
let longIndex = 0;

for (let week = 0; week < 9; week += 1) {
  const monday = addDays(PLAN_START, week * 7);
  const tuesday = addDays(monday, 1);
  const wednesday = addDays(monday, 2);
  const friday = addDays(monday, 4);
  const saturday = addDays(monday, 5);

  if (monday <= TODAY) {
    sessions.push(strengthSession({
      date: monday,
      title: 'Lower body',
      planSessionId: ps.lower,
      notes: lowerNotes[week],
      exercises: [
        { name: 'Back squat', sets: sets(5, squat[week], 5) },
        { name: 'Romanian deadlift', sets: sets(8, rdl[week], 3) },
        { name: 'Walking lunge', sets: sets(8, lunge[week], 3) },
        { name: 'Calf raise', sets: sets(12, calf[week], 3) },
      ],
    }));
  }

  if (tuesday <= TODAY) {
    sessions.push(runSession({
      date: tuesday,
      title: 'Easy run',
      planSessionId: ps.easy,
      distanceKm: easyKm[week],
      paceSec: easyPace[week],
      elevationM: week % 2 === 0 ? 20 : 35,
      effort: easyEffort[week],
      notes: easyNotes[week],
    }));
  }

  if (wednesday <= TODAY) {
    sessions.push(strengthSession({
      date: wednesday,
      title: 'Balance',
      planSessionId: ps.balance,
      notes: balanceNotes[week],
      exercises: [
        { name: 'Bulgarian split squat', sets: sets(8, split[week], 3) },
        { name: 'Single-leg RDL', sets: sets(8, single[week], 3) },
        { name: 'Step-down', sets: sets(8, stepKg[week], 3) },
      ],
    }));
  }

  if (friday <= TODAY && friday !== '2026-08-21') {
    const i = posteriorIndex;
    sessions.push(strengthSession({
      date: friday,
      title: 'Posterior chain',
      planSessionId: ps.posterior,
      notes: posteriorNotes[i],
      exercises: [
        { name: 'Hip thrust', sets: sets(8, thrust[i], 3) },
        { name: 'Deadlift', sets: sets(5, deadlift[i], 3) },
        { name: 'Nordic curl', sets: sets(nordicReps[i], 0, 3) },
        { name: 'Side plank', sets: sets(plankSec[i], 0, 3) },
      ],
    }));
    posteriorIndex += 1;
  }

  if (saturday <= TODAY) {
    const i = longIndex;
    sessions.push(runSession({
      date: saturday,
      title: 'Long run',
      planSessionId: ps.long,
      distanceKm: longKm[i],
      paceSec: longPace[i],
      elevationM: longElev[i],
      effort: longEffort[i],
      notes: longNotes[i],
    }));
    longIndex += 1;
  }
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
    },
  ],
  plans: [
    {
      id: planId,
      goalId,
      name: 'Pre-season base',
      startDate: PLAN_START,
      weeks: 20,
      focus: ['Legs', 'Balance', 'Cardio'],
      notes: 'Four to five sessions a week. Two lower-body lifts, one balance day, one easy run, one longer run. Friday 21 Aug was a travel day and is missing on purpose.',
      status: 'active',
      sessions: [
        {
          id: ps.lower,
          dayOfWeek: 1,
          kind: 'strength',
          title: 'Lower body',
          focus: 'Legs',
          notes: 'Main squat day. Add load when all five sets are solid.',
          exercises: [
            { name: 'Back squat', sets: 5, reps: '5' },
            { name: 'Romanian deadlift', sets: 3, reps: '8' },
            { name: 'Walking lunge', sets: 3, reps: '8' },
            { name: 'Calf raise', sets: 3, reps: '12' },
          ],
          distanceKm: null,
          durationMin: null,
        },
        {
          id: ps.easy,
          dayOfWeek: 2,
          kind: 'run',
          title: 'Easy run',
          focus: 'Cardio',
          notes: 'Conversational. Leave Monday\'s legs alone.',
          exercises: [],
          distanceKm: 8,
          durationMin: 45,
        },
        {
          id: ps.balance,
          dayOfWeek: 3,
          kind: 'strength',
          title: 'Balance',
          focus: 'Balance',
          notes: 'Slow eccentrics. The left side sets the load.',
          exercises: [
            { name: 'Bulgarian split squat', sets: 3, reps: '8' },
            { name: 'Single-leg RDL', sets: 3, reps: '8' },
            { name: 'Step-down', sets: 3, reps: '8' },
          ],
          distanceKm: null,
          durationMin: null,
        },
        {
          id: ps.posterior,
          dayOfWeek: 5,
          kind: 'strength',
          title: 'Posterior chain',
          focus: 'Legs',
          notes: 'Hinge and hips. Stop nordics if a hamstring feels sharp.',
          exercises: [
            { name: 'Hip thrust', sets: 3, reps: '8' },
            { name: 'Deadlift', sets: 3, reps: '5' },
            { name: 'Nordic curl', sets: 3, reps: '6' },
            { name: 'Side plank', sets: 3, reps: '30' },
          ],
          distanceKm: null,
          durationMin: null,
        },
        {
          id: ps.long,
          dayOfWeek: 6,
          kind: 'run',
          title: 'Long run',
          focus: 'Cardio',
          notes: 'Steady effort. Take a hill if the route has one.',
          exercises: [],
          distanceKm: 14,
          durationMin: 85,
        },
      ],
    },
  ],
  sessions,
};

if (weekday(PLAN_START) !== 1) throw new Error('Plan start is not a Monday');
if (weekday('2026-08-21') !== 5) throw new Error('Expected 21 Aug 2026 to be Friday');
if (sessions.some((session) => session.date > TODAY)) throw new Error('Sample logs a future date');
if (sessions.some((session) => session.date === '2026-08-21')) throw new Error('Travel day should be missing');
if (posteriorIndex !== thrust.length) throw new Error(`Posterior count ${posteriorIndex}`);
if (longIndex !== longKm.length) throw new Error(`Long run count ${longIndex}`);

for (const session of sessions) {
  const template = data.plans[0].sessions.find((item) => item.id === session.planSessionId);
  if (!template) throw new Error(`Missing template for ${session.id}`);
  if (weekday(session.date) !== template.dayOfWeek) {
    throw new Error(`${session.date} weekday does not match ${template.title}`);
  }
}

const squatLogs = sessions.filter((session) => session.planSessionId === ps.lower);
const firstSquat = squatLogs[0].exercises[0].sets[0].weightKg;
const lastSquat = squatLogs.at(-1).exercises[0].sets[0].weightKg;
if (firstSquat !== 70 || lastSquat !== 90) throw new Error(`Squat progression ${firstSquat} → ${lastSquat}`);

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'training.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${sessions.length} sessions to ${file}`);
