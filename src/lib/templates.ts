import type { PhaseChange, Plan, PlanExercise, PlanPhase, PlanSession, TrainingData, WorkoutPreset } from '../types';

export const HOME_SKI_NAME = 'Home ski prep';
export const HOME_SKI_START = '2026-10-06';
export const HOME_SKI_END = '2026-12-13';
export const HOME_SKI_WEEKS = 10;
export const HOME_SKI_FOCUS = ['Legs', 'Balance', 'Cardio', 'Upper'];
export const HOME_SKI_NOTES =
  'Mon Lower A, Tue easy run, Wed full upper, Thu off or walk, Fri Lower B, Sat longer run, Sun off. Keep a rest day between the two lower days if the week shifts. Arms stay at 2 sets so they do not steal leg recovery. Leave 1-2 reps in the tank. Phases set the run length, the hills, and the December taper. If he already runs more than this, raise the run days only after he gives usual weekly distance.';

const PLAN_STAMP = '2026-10-03T08:00:00.000Z';
const PRESET_STAMP = '2026-10-03T07:51:00.000Z';
const GOAL_STAMP = '2026-10-03T07:51:00.000Z';

const LOWER_A: PlanExercise[] = [
  { name: 'Goblet squat', sets: 3, reps: '8-12' },
  { name: 'Bulgarian split squat', sets: 3, reps: '8' },
  { name: 'Step-up', sets: 3, reps: '8' },
  { name: 'Dumbbell Romanian deadlift', sets: 3, reps: '8-12' },
  { name: 'Side plank', sets: 3, reps: '20-30', count: 'seconds' },
  { name: 'Chest-supported row', sets: 2, reps: '10' },
  { name: 'Standing calf raise', sets: 3, reps: '12-15' },
];

const UPPER: PlanExercise[] = [
  { name: 'Flat dumbbell bench press', sets: 3, reps: '8-12' },
  { name: 'One-arm dumbbell row', sets: 3, reps: '8-12' },
  { name: 'Incline press', sets: 3, reps: '8-12' },
  { name: 'Half-kneeling one-arm overhead press', sets: 3, reps: '8' },
  { name: 'Rear-delt raise', sets: 3, reps: '12-15' },
  { name: 'Dumbbell curl', sets: 2, reps: '10-15' },
  { name: 'Overhead triceps extension', sets: 2, reps: '10-15' },
  { name: 'Dead bug', sets: 3, reps: '8' },
];

const LOWER_B: PlanExercise[] = [
  { name: 'Kettlebell swing', sets: 4, reps: '12' },
  { name: 'Single-leg Romanian deadlift', sets: 3, reps: '8' },
  { name: 'Reverse lunge', sets: 3, reps: '8' },
  { name: 'Single-leg hip thrust', sets: 3, reps: '10' },
  { name: 'Dead bug', sets: 3, reps: '8' },
  { name: 'Push-up', sets: 2, reps: '8-15' },
  { name: 'Suitcase carry', sets: 2, reps: '30', count: 'seconds' },
];

interface SessionSpec {
  id: string;
  presetId: string;
  dayOfWeek: number;
  name: string;
  kind: PlanSession['kind'];
  focus: string;
  notes: string;
  exercises: PlanExercise[];
  durationMin: number | null;
}

const SESSIONS: SessionSpec[] = [
  {
    id: 'ps-lower-a',
    presetId: 'preset-lower-a',
    dayOfWeek: 1,
    name: 'Lower A (quad and ski stance)',
    kind: 'strength',
    focus: 'Legs',
    notes:
      'About 45 min. Warm up 5 min easy movement plus 2 easy sets of the first exercise. Then two balance finishers. Goblet squat: 16 kg kettlebell, bench at 80 degrees as a depth target. Bulgarian split squat: rear foot on the bench, dumbbells starting around 10-14 kg each. Step-up onto the bench. Side plank is seconds each side.',
    exercises: LOWER_A,
    durationMin: 45,
  },
  {
    id: 'ps-easy',
    presetId: 'preset-easy',
    dayOfWeek: 2,
    name: 'Easy run',
    kind: 'run',
    focus: 'Cardio',
    notes: 'Conversational pace. The phase for this date sets the minutes and any hills.',
    exercises: [],
    durationMin: null,
  },
  {
    id: 'ps-upper',
    presetId: 'preset-upper',
    dayOfWeek: 3,
    name: 'Full upper',
    kind: 'strength',
    focus: 'Upper',
    notes: 'About 40 min. Bench flat for the press, 30 degrees for incline and rear-delt raise. Arms stay at 2 sets.',
    exercises: UPPER,
    durationMin: 40,
  },
  {
    id: 'ps-lower-b',
    presetId: 'preset-lower-b',
    dayOfWeek: 5,
    name: 'Lower B (posterior chain and single leg)',
    kind: 'strength',
    focus: 'Legs',
    notes:
      'About 45 min. Swings start at 12 kg and move to 16 kg. Single-leg hip thrust: shoulders on the bench, dumbbell on the hip. Suitcase carry is seconds each side with the 16 kg kettlebell. Push-ups on the bench if the floor is too hard.',
    exercises: LOWER_B,
    durationMin: 45,
  },
  {
    id: 'ps-long',
    presetId: 'preset-long',
    dayOfWeek: 6,
    name: 'Longer run',
    kind: 'run',
    focus: 'Cardio',
    notes: 'Easy pace. The phase for this date sets the minutes.',
    exercises: [],
    durationMin: null,
  },
];

const PRESET_NOTES: Record<string, string> = {
  'preset-lower-a': 'About 45 min. 16 kg goblet squat to the bench at 80 degrees. Split squats with the rear foot on the bench.',
  'preset-easy': 'Conversational. The plan phase sets the length and any hills.',
  'preset-upper': 'About 40 min. Arms stay at 2 sets.',
  'preset-lower-b': 'About 45 min. Swings 12 kg toward 16 kg. Suitcase carry is timed.',
  'preset-long': 'Easy. The plan phase sets the length. The last phase is a short taper.',
};

function runChange(sessionId: string, notes: string, durationMin: number): PhaseChange {
  return { sessionId, notes, durationMin };
}

function setsChange(sessionId: string, sets: number): PhaseChange {
  return { sessionId, sets };
}

function phase(name: string, startDate: string, endDate: string, sessions: PhaseChange[]): PlanPhase {
  return { name, startDate, endDate, sessions };
}

const PHASES: PlanPhase[] = [
  phase('Easy base', '2026-10-06', '2026-10-18', [
    runChange('ps-easy', '20-25 min easy', 25),
    runChange('ps-long', '30-35 min easy', 35),
  ]),
  phase('Longer easy', '2026-10-19', '2026-11-01', [
    runChange('ps-easy', '25-30 min easy', 30),
    runChange('ps-long', '40 min easy', 40),
  ]),
  phase('Short hills', '2026-11-02', '2026-11-15', [
    runChange('ps-easy', '30 min easy, plus 6 x 20s hill strides', 30),
    runChange('ps-long', '45-50 min easy', 50),
  ]),
  phase('Longer hills', '2026-11-16', '2026-11-29', [
    runChange('ps-easy', '30 min easy, plus 8 x 30s hills', 30),
    runChange('ps-long', '55-60 min easy, last 10 min gentle downhill if the route has one', 60),
  ]),
  phase('Peak hills', '2026-11-30', '2026-12-06', [
    runChange('ps-easy', '25 min easy, plus 6 x 45s hills', 25),
    runChange('ps-long', '45 min easy', 45),
  ]),
  phase('Taper', '2026-12-07', '2026-12-13', [
    setsChange('ps-lower-a', 2),
    runChange('ps-easy', '20 min easy', 20),
    setsChange('ps-upper', 2),
    setsChange('ps-lower-b', 2),
    runChange('ps-long', '30 min easy', 30),
  ]),
];

function cloneExercise(exercise: PlanExercise): PlanExercise {
  const copy: PlanExercise = { name: exercise.name, sets: exercise.sets, reps: exercise.reps };
  if (exercise.count) copy.count = exercise.count;
  if (exercise.alsoCounts && exercise.alsoCounts.length > 0) copy.alsoCounts = [...exercise.alsoCounts];
  return copy;
}

/** The home week. Pass an id function to mint new session ids; phase patches follow them. */
export function homeSkiWeek(nextId: (stableId: string) => string = (id) => id): { sessions: PlanSession[]; phases: PlanPhase[] } {
  const ids = new Map(SESSIONS.map((spec) => [spec.id, nextId(spec.id)]));
  const sessions = SESSIONS.map((spec) => ({
    id: ids.get(spec.id) ?? spec.id,
    dayOfWeek: spec.dayOfWeek,
    kind: spec.kind,
    title: spec.name,
    focus: spec.focus,
    notes: spec.notes,
    exercises: spec.kind === 'strength' ? spec.exercises.map(cloneExercise) : [],
    distanceKm: null,
    durationMin: spec.durationMin,
  }));
  const phases = PHASES.map((item) => ({
    name: item.name,
    startDate: item.startDate,
    endDate: item.endDate,
    sessions: item.sessions.map((change) => ({
      ...change,
      sessionId: ids.get(change.sessionId) ?? change.sessionId,
    })),
  }));
  return { sessions, phases };
}

export function homeSkiPresets(): WorkoutPreset[] {
  return SESSIONS.map((spec) => ({
    id: spec.presetId,
    name: spec.name,
    kind: spec.kind,
    focus: spec.focus,
    notes: PRESET_NOTES[spec.presetId] ?? spec.notes,
    exercises: spec.kind === 'strength' ? spec.exercises.map(cloneExercise) : [],
    createdAt: PRESET_STAMP,
    updatedAt: PRESET_STAMP,
  }));
}

export function homeSkiPlan(goalId: string): Plan {
  const week = homeSkiWeek();
  return {
    id: 'plan-ski-home',
    goalId,
    name: HOME_SKI_NAME,
    startDate: HOME_SKI_START,
    weeks: HOME_SKI_WEEKS,
    endDate: HOME_SKI_END,
    focus: [...HOME_SKI_FOCUS],
    notes: HOME_SKI_NOTES,
    sessions: week.sessions,
    phases: week.phases,
    status: 'active',
    updatedAt: PLAN_STAMP,
  };
}

export function starterDocument(): TrainingData {
  const goalId = 'goal-ski-2026';
  return {
    version: 1,
    goals: [
      {
        id: goalId,
        name: 'Ski season prep',
        targetDate: '2026-12-15',
        focus: [...HOME_SKI_FOCUS],
        notes:
          'Downhill skiing through 15 Dec. Single-leg quads and glutes, posterior chain, an aerobic base, and balanced upper strength. Home only: bench at 0/30/45/80 degrees, kettlebells 8/12/16 kg, two adjustable dumbbells (about 22 kg max each). Five days a week, no current injury, modest base. Leave 1-2 reps in the tank. Add load or slow the eccentric when the top of the rep range is clean. If the legs feel heavy the next morning, repeat the same loads.',
        status: 'active',
        createdAt: '2026-08-01T09:00:00.000Z',
        updatedAt: GOAL_STAMP,
      },
    ],
    plans: [homeSkiPlan(goalId)],
    presets: homeSkiPresets(),
    sessions: [],
    deleted: {
      goals: [{ id: goalId, at: '2026-10-03T07:50:00.000Z' }],
      plans: [{ id: 'plan-ski-base', at: '2026-10-03T07:51:00.000Z' }],
      presets: [
        { id: 'preset-lower', at: '2026-10-03T07:51:00.000Z' },
        { id: 'preset-balance', at: '2026-10-03T07:51:00.000Z' },
        { id: 'preset-posterior', at: '2026-10-03T07:51:00.000Z' },
      ],
      sessions: [],
    },
  };
}
