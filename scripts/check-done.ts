import { readFileSync } from 'node:fs';
import { draftFromPreset } from '../src/lib/draft';
import { mergeTraining } from '../src/lib/merge';
import { applySessionDone, buildPreset, planItemsForWeek } from '../src/lib/plans';
import { previewSession } from '../src/lib/preview';
import { allPlannedSetsLogged } from '../src/lib/session-progress';
import { sessionFromDraft } from '../src/lib/session-save';
import { normalize, serialize } from '../src/lib/storage';
import { exerciseTargets } from '../src/lib/targets';
import { PLAN_KEYS, keepUnknown } from '../src/lib/unknown';
import type { PlanCompletion, PlanPhase, Session, TrainingData } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const starter = normalize(JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData);
check('the starter plan has no manual completions', starter.plans.every((plan) => plan.completions === undefined));

const week2: PlanPhase = {
  name: 'Week 2',
  startDate: '2026-10-12',
  endDate: '2026-10-13',
  sessions: [],
  targets: [
    {
      sessionId: 'ps-upper',
      exercises: [{ name: 'Rear-delt raise', sets: 3, reps: 14, weightKg: 8 }],
    },
  ],
};

function withUpperMove(extra?: Partial<TrainingData['plans'][number]>): TrainingData {
  return normalize({
    ...starter,
    plans: starter.plans.map((plan) =>
      plan.id === 'plan-ski-home'
        ? {
            ...plan,
            phases: [...(plan.phases ?? []), week2],
            moves: [{ sessionId: 'ps-upper', fromDate: '2026-10-14', toDate: '2026-10-12', updatedAt: '2026-10-12T08:00:00.000Z' }],
            ...extra,
          }
        : plan,
    ),
  });
}

const moved = withUpperMove();
const monday = planItemsForWeek(moved, moved.plans, '2026-10-12').find((item) => item.date === '2026-10-12' && item.session.id === 'ps-upper');
const wednesday = planItemsForWeek(moved, moved.plans, '2026-10-12').find((item) => item.date === '2026-10-14' && item.session.id === 'ps-upper');
check('Full upper moved off Wednesday', wednesday === undefined);
check('Full upper shows on Monday 12 Oct', monday?.movedFrom === '2026-10-14' && monday.session.title === 'Full upper');
check('the moved card uses the Week 2 phase on the new date', monday?.phase?.name === 'Week 2');
const rear = monday?.session.exercises.find((exercise) => exercise.name === 'Rear-delt raise');
check('Week 2 target is 3×14 @ 8 kg per hand', rear?.sets === 3 && rear.target?.reps === 14 && rear.target?.weightKg === 8);
const raw = moved.plans[0]?.sessions.find((session) => session.id === 'ps-upper');
const preview = raw ? previewSession(moved.plans[0] ?? null, raw, '2026-10-12', []) : null;
const previewRear = preview?.exercises.find((exercise) => exercise.name === 'Rear-delt raise');
check('preview on the moved-to date shows the Week 2 target', preview?.phaseName === 'Week 2' && previewRear?.targetLabel === 'Target: 3×14 @ 8 kg per piece');
const originPreview = raw ? previewSession(moved.plans[0] ?? null, raw, '2026-10-14', []) : null;
check('the original Wednesday is still Easy base', originPreview?.phaseName === 'Easy base' && !originPreview.exercises.find((exercise) => exercise.name === 'Rear-delt raise')?.targetLabel.includes('14'));

function loggedUpper(setsForRear: number): Session {
  const session = monday?.session;
  if (!session) throw new Error('missing moved upper');
  return {
    id: 'log-01831e65',
    date: '2026-10-12',
    kind: 'strength',
    title: 'Full upper',
    notes: '',
    goalId: 'goal-ski-2026',
    planId: 'plan-ski-home',
    planSessionId: 'ps-upper',
    exercises: session.exercises.map((exercise) => {
      const count = exercise.name === 'Rear-delt raise' ? setsForRear : exercise.sets;
      const rearDelt = exercise.name === 'Rear-delt raise';
      return {
        name: exercise.name,
        ...(rearDelt ? { pieces: 2 as const, implement: 'dumbbell' as const } : {}),
        sets: Array.from({ length: count }, () => (rearDelt ? { reps: 10, weightKg: 12, kgPerPiece: 6 } : { reps: 10, weightKg: 0 })),
      };
    }),
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
    createdAt: '2026-10-12T18:00:00.000Z',
  };
}

function card(data: TrainingData) {
  return planItemsForWeek(data, data.plans, '2026-10-12').find((item) => item.date === '2026-10-12' && item.session.id === 'ps-upper');
}

const logged = { ...moved, sessions: [loggedUpper(3)] };
const doneCard = card(logged);
const doneRear = doneCard ? exerciseTargets(doneCard.session, doneCard.logs).find((target) => target.name === 'Rear-delt raise') : undefined;
check('three sets of 10 count for Rear-delt raise', doneRear?.completedSets === 3 && doneRear.met === true && doneRear.repsLabel === '12-15');
check('a short set and a light bell still finish Full upper', doneCard?.done === true);
check('the next Wednesday is a different occurrence', planItemsForWeek(logged, logged.plans, '2026-10-19').find((item) => item.session.id === 'ps-upper')?.done === false);

const short = { ...moved, sessions: [loggedUpper(2)] };
const shortCard = card(short);
const shortRear = shortCard ? exerciseTargets(shortCard.session, shortCard.logs).find((target) => target.name === 'Rear-delt raise') : undefined;
check('two sets stay short of the planned count', shortRear?.completedSets === 2 && shortRear.met === false && shortCard?.done === false);

if (monday) {
  const preset = buildPreset(monday.plan, monday.session, monday.date, '2026-10-12');
  const draft = draftFromPreset(preset, []);
  draft.exercises = draft.exercises.map((exercise, exerciseIndex) => ({
    ...exercise,
    sets: Array.from({ length: Math.max(exercise.targetSets, 1) }, (_, setIndex) => ({
      key: `set-${exerciseIndex}-${setIndex}`,
      reps: '10',
      kgPerPiece: exercise.bodyweight ? '' : '6',
    })),
  }));
  check('Complete workout is ready when the set count is met', allPlannedSetsLogged(draft));
  const saved = sessionFromDraft(draft, 'log-01831e65', '2026-10-12T18:00:00.000Z');
  check('Complete workout saves reps and weight below the target', typeof saved !== 'string' && saved.planSessionId === 'ps-upper' && saved.date === '2026-10-12');
  const dropped = structuredClone(draft);
  dropped.exercises.find((exercise) => exercise.name === 'Rear-delt raise')?.sets.pop();
  check('the set cap still requires every planned set', !allPlannedSetsLogged(dropped));
}

const marked = applySessionDone(moved, 'plan-ski-home', 'ps-upper', '2026-10-12', true, '2026-10-12T12:00:00.000Z');
check('mark done finishes a card with no log', card(marked)?.done === true);
check('the override is stored on the shown date', marked.plans[0]?.completions?.[0]?.sessionId === 'ps-upper' && marked.plans[0]?.completions?.[0]?.date === '2026-10-12' && marked.plans[0]?.completions?.[0]?.done === true);
const cleared = applySessionDone(marked, 'plan-ski-home', 'ps-upper', '2026-10-12', false, '2026-10-12T12:05:00.000Z');
check('mark not done removes an override that matches the empty log', cleared.plans[0]?.completions === undefined && card(cleared)?.done === false);

const heldBack = applySessionDone(logged, 'plan-ski-home', 'ps-upper', '2026-10-12', false, '2026-10-12T19:00:00.000Z');
check('mark not done overrides a finished log', card(heldBack)?.done === false && heldBack.plans[0]?.completions?.[0]?.done === false);
const released = applySessionDone(heldBack, 'plan-ski-home', 'ps-upper', '2026-10-12', true, '2026-10-12T19:05:00.000Z');
check('matching the set count drops the override', released.plans[0]?.completions === undefined && card(released)?.done === true);

const onOrigin = withUpperMove({
  completions: [{ sessionId: 'ps-upper', date: '2026-10-14', done: true, updatedAt: '2026-10-12T09:00:00.000Z' }],
});
check('a flag on the original date does not finish the moved card', card(onOrigin)?.done === false);

const malformed = withUpperMove({
  completions: [
    null,
    { sessionId: 'ps-missing', date: '2026-10-12', done: true },
    { sessionId: 'ps-upper', date: 'Monday', done: true },
    { sessionId: 'ps-upper', date: '2026-02-31', done: true },
    { sessionId: 'ps-upper', date: '2026-10-12', done: 'yes' },
    { sessionId: 'ps-upper', date: '2026-10-12', done: false, updatedAt: '2026-10-12T01:00:00.000Z', by: 'early' },
    { sessionId: 'ps-upper', date: '2026-10-12', done: true, updatedAt: '2026-10-12T02:00:00.000Z', by: 'late' },
  ] as unknown as PlanCompletion[],
});
const kept = malformed.plans[0]?.completions ?? [];
check('malformed completions are dropped and the later stamp wins', kept.length === 1 && kept[0]?.done === true && (kept[0] as { by?: string }).by === 'late');
check('completions that are not an array are ignored', withUpperMove({ completions: { sessionId: 'ps-upper' } as unknown as PlanCompletion[] }).plans[0]?.completions === undefined);

const round = normalize(JSON.parse(serialize(malformed)) as TrainingData);
check('a completion and its unknown field survive a save', (round.plans[0]?.completions?.[0] as { by?: string } | undefined)?.by === 'late' && round.plans[0]?.completions?.[0]?.done === true);

const source = {
  id: 'plan-ski-home',
  name: 'Home',
  completions: [{ sessionId: 'ps-upper', date: '2026-10-12', done: true, by: 'planner' }],
};
const older = keepUnknown({ id: source.id, name: source.name }, source, PLAN_KEYS.filter((key) => key !== 'completions'));
check('an older plan schema keeps completions', (older as { completions?: Array<{ done?: boolean; by?: string }> }).completions?.[0]?.done === true);
check('an older plan schema keeps the completion note', (older as { completions?: Array<{ by?: string }> }).completions?.[0]?.by === 'planner');

const noted = normalize({
  ...logged,
  plans: logged.plans.map((plan) =>
    plan.id === 'plan-ski-home'
      ? { ...plan, completions: [{ sessionId: 'ps-upper', date: '2026-10-12', done: true, updatedAt: '2026-10-12T11:00:00.000Z', by: 'planner' } as PlanCompletion] }
      : plan,
  ),
});
const toggled = applySessionDone(noted, 'plan-ski-home', 'ps-upper', '2026-10-12', false, '2026-10-12T12:00:00.000Z');
check('toggling not done keeps an unknown field on the entry', (toggled.plans[0]?.completions?.[0] as { by?: string } | undefined)?.by === 'planner' && toggled.plans[0]?.completions?.[0]?.done === false);

const olderCopy = structuredClone(noted);
const newerCopy = structuredClone(noted);
const olderPlan = olderCopy.plans[0];
const newerPlan = newerCopy.plans[0];
if (olderPlan && newerPlan && newerPlan.completions?.[0]) {
  olderPlan.updatedAt = '2026-10-12T11:00:00.000Z';
  newerPlan.updatedAt = '2026-10-12T18:00:00.000Z';
  newerPlan.completions[0].done = false;
  newerPlan.completions[0].updatedAt = '2026-10-12T18:00:00.000Z';
  delete (newerPlan.completions[0] as { by?: string }).by;
  const merged = mergeTraining(olderCopy, newerCopy).plans.find((plan) => plan.id === 'plan-ski-home');
  check('merge keeps the newer done flag', merged?.completions?.[0]?.done === false);
  check('merge puts back an unknown completion field', (merged?.completions?.[0] as { by?: string } | undefined)?.by === 'planner');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('done status checks passed');
