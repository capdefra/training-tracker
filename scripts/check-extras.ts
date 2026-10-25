import { readFileSync } from 'node:fs';
import { draftFromPreset } from '../src/lib/draft';
import { PLAN_KEYS, keepUnknown } from '../src/lib/unknown';
import { applySessionDone, buildPreset, dayProgress, extraLogsForDay, findPlanSession, planItemsForWeek, weekSentence } from '../src/lib/plans';
import { normalize } from '../src/lib/storage';
import type { PlanExercise, Session, TrainingData } from '../src/types';

const raw = JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData;
const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const fullBody: PlanExercise[] = [
  { name: 'Goblet squat', sets: 3, reps: '8', target: { sets: 3, reps: 8, weightKg: 16 } },
  { name: 'One-arm dumbbell row', sets: 3, reps: '8', perSide: true, target: { sets: 3, reps: 8, weightKg: 12 } },
];

const preset = {
  id: 'preset-full-body',
  name: 'Full body (extra)',
  kind: 'strength',
  focus: 'Full',
  notes: 'One-off.',
  exercises: fullBody,
  createdAt: '2026-10-25T08:00:00.000Z',
};

function withPlan(planPatch: Record<string, unknown>, presets: unknown = [...raw.presets, preset], sessions: unknown = raw.sessions): TrainingData {
  return normalize({
    ...raw,
    presets,
    sessions,
    plans: raw.plans.map((plan) => (plan.id === 'plan-ski-home' ? { ...plan, ...planPatch } : plan)),
  });
}

function idsOn(source: TrainingData, date: string): string[] {
  return planItemsForWeek(source, source.plans, date)
    .filter((item) => item.date === date)
    .map((item) => item.session.id);
}

function logged(date: string, planSessionId: string | null, sets: number): Session {
  return {
    id: `log-${planSessionId ?? 'free'}-${date}`,
    date,
    kind: 'strength',
    title: 'Full body (extra)',
    notes: '',
    goalId: 'goal-ski-2026',
    planId: planSessionId ? 'plan-ski-home' : null,
    planSessionId,
    exercises: fullBody.map((exercise) => ({
      name: exercise.name,
      sets: Array.from({ length: sets }, () => ({ reps: 8, weightKg: 16 })),
    })),
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
    createdAt: `${date}T10:00:00.000Z`,
  };
}

const starter = normalize(raw);
check('the starter plan has no extras', starter.plans.every((plan) => plan.extras === undefined));

const sunday = withPlan({
  extras: [{ presetId: 'preset-full-body', date: '2026-10-25', updatedAt: '2026-10-25T09:00:00.000Z', coach: 'easy' }],
});
check('sunday shows the extra and nothing else', idsOn(sunday, '2026-10-25').join() === 'extra:preset-full-body');
const sundayItem = planItemsForWeek(sunday, sunday.plans, '2026-10-25').find((item) => item.date === '2026-10-25');
check('the extra is marked and keeps the preset exercises', sundayItem?.extra === true && sundayItem.session.title === 'Full body (extra)' && sundayItem.session.exercises.length === 2);
check('the extra is not done before it is logged', sundayItem?.done === false);
check('a coach note on the extra round-trips', (sunday.plans.find((plan) => plan.id === 'plan-ski-home')?.extras?.[0] as { coach?: string } | undefined)?.coach === 'easy');

const monday = withPlan({
  extras: [{ presetId: 'preset-full-body', date: '2026-10-19' }],
});
check('an extra sits after the repeating session', idsOn(monday, '2026-10-19').join() === 'ps-lower-a,extra:preset-full-body');

const phased = withPlan({
  extras: [{ presetId: 'preset-full-body', date: '2026-10-25' }],
  phases: [
    ...(raw.plans.find((plan) => plan.id === 'plan-ski-home')?.phases ?? []),
    {
      name: 'Blanket',
      startDate: '2026-10-25',
      endDate: '2026-10-25',
      sessions: [{ sessionId: 'extra:preset-full-body', sets: 9 }],
    },
  ],
});
const phasedItem = planItemsForWeek(phased, phased.plans, '2026-10-25').find((item) => item.session.id === 'extra:preset-full-body');
check('a phase does not rewrite the preset', phasedItem?.session.exercises[0]?.sets === 3 && phasedItem.session.exercises[0]?.target?.weightKg === 16);

const unknown = withPlan({
  extras: [
    { presetId: 'preset-missing', date: '2026-10-25' },
    { presetId: 'preset-full-body', date: '2026-10-25' },
  ],
});
check('an unknown preset draws no card', idsOn(unknown, '2026-10-25').join() === 'extra:preset-full-body');
check('an unknown preset stays in the plan', unknown.plans.find((plan) => plan.id === 'plan-ski-home')?.extras?.some((extra) => extra.presetId === 'preset-missing') === true);

const messy = withPlan({
  extras: [
    { presetId: '', date: '2026-10-25' },
    { presetId: 'preset-full-body', date: '2026-02-31' },
    { presetId: 'preset-full-body', date: 'tomorrow' },
    { presetId: 'preset-full-body', date: '2026-10-25', updatedAt: '2026-10-25T08:00:00.000Z' },
    { presetId: 'preset-full-body', date: '2026-10-25', updatedAt: '2026-10-25T11:00:00.000Z', note: 'later' },
    'nope',
  ],
});
const messyExtra = messy.plans.find((plan) => plan.id === 'plan-ski-home')?.extras ?? [];
check('bad extras are dropped and the later stamp wins', messyExtra.length === 1 && messyExtra[0]?.updatedAt === '2026-10-25T11:00:00.000Z' && (messyExtra[0] as { note?: string }).note === 'later');

const tied = withPlan({
  extras: [
    { presetId: 'preset-full-body', date: '2026-10-25', updatedAt: '2026-10-25T09:00:00.000Z', note: 'first' },
    { presetId: 'preset-full-body', date: '2026-10-25', updatedAt: '2026-10-25T09:00:00.000Z', note: 'second' },
  ],
});
check('an equal stamp keeps the later entry', (tied.plans.find((plan) => plan.id === 'plan-ski-home')?.extras?.[0] as { note?: string } | undefined)?.note === 'second');

check('a non-array extras list is ignored', withPlan({ extras: 'nope' }).plans.every((plan) => plan.extras === undefined));

const past = withPlan({
  extras: [{ presetId: 'preset-full-body', date: '2026-10-18' }],
});
check('a past date shows on that day', idsOn(past, '2026-10-18').join() === 'extra:preset-full-body');
check('a past date does not show on a later day', idsOn(past, '2026-10-25').length === 0);

const outside = withPlan({
  extras: [{ presetId: 'preset-full-body', date: '2026-01-04' }],
});
check('a date outside the plan is kept', outside.plans.find((plan) => plan.id === 'plan-ski-home')?.extras?.[0]?.date === '2026-01-04');
check('a date outside the plan draws no card', idsOn(outside, '2026-01-04').length === 0);

const linked = withPlan(
  { extras: [{ presetId: 'preset-full-body', date: '2026-10-25' }] },
  [...raw.presets, preset],
  [...raw.sessions, logged('2026-10-25', 'extra:preset-full-body', 3)],
);
const linkedItems = planItemsForWeek(linked, linked.plans, '2026-10-25').filter((item) => item.date === '2026-10-25');
check('a linked log finishes the extra', linkedItems[0]?.done === true && linkedItems[0]?.extra === true);
check('a linked log is not a second card', extraLogsForDay(linked.sessions, linkedItems, '2026-10-25').length === 0);
check('a finished extra counts as a done planned day', dayProgress(linkedItems, []) === 'done');

const unlinked = withPlan(
  { extras: [{ presetId: 'preset-full-body', date: '2026-10-25' }] },
  [...raw.presets, preset],
  [...raw.sessions, logged('2026-10-25', null, 3)],
);
const unlinkedItems = planItemsForWeek(unlinked, unlinked.plans, '2026-10-25').filter((item) => item.date === '2026-10-25');
check('an unlinked log does not finish the card', unlinkedItems[0]?.done === false);
check('an unlinked log stays in the logged list', extraLogsForDay(unlinked.sessions, unlinkedItems, '2026-10-25').length === 1);
check('an open extra is a planned day', dayProgress(unlinkedItems, []) === 'planned');
const week = planItemsForWeek(unlinked, unlinked.plans, '2026-10-25');
check('the week sentence counts the extra', weekSentence(week, '2026-10-25') === `0 of ${week.length} done. Next is Full body (extra), today.`);
check('the extra is one of the week cards', week.some((item) => item.extra && item.date === '2026-10-25'));

const marked = applySessionDone(sunday, 'plan-ski-home', 'extra:preset-full-body', '2026-10-25', true, '2026-10-25T12:00:00.000Z');
const markedAgain = normalize(JSON.parse(JSON.stringify(marked)) as TrainingData);
const completion = markedAgain.plans.find((plan) => plan.id === 'plan-ski-home')?.completions?.find((item) => item.sessionId === 'extra:preset-full-body');
check('marking the extra stores a completion', completion?.done === true && completion.date === '2026-10-25');
check('the stored completion keeps the card done', planItemsForWeek(markedAgain, markedAgain.plans, '2026-10-25').find((item) => item.session.id === 'extra:preset-full-body')?.done === true);

const found = findPlanSession(sunday, 'extra:preset-full-body', '2026-10-25');
check('continue can resolve the extra preset', found?.session.exercises[0]?.name === 'Goblet squat' && found.session.id === 'extra:preset-full-body');
check('an unknown extra id does not resolve', findPlanSession(sunday, 'extra:preset-missing', '2026-10-25') === null);

const card = sundayItem;
if (card) {
  const launch = buildPreset(card.plan, card.session, card.date, '2026-10-25');
  const draft = draftFromPreset(launch, []);
  const squat = draft.exercises[0];
  check('start keeps today and the extra id', launch.date === '2026-10-25' && launch.planSessionId === 'extra:preset-full-body');
  check('start fills the preset targets', squat?.pendingReps === '8' && squat.pendingKg === '16' && squat.targetSets === 3);
}

const older = keepUnknown({ id: 'plan-ski-home' }, { id: 'plan-ski-home', extras: [{ presetId: 'preset-full-body', date: '2026-10-25' }] }, PLAN_KEYS.filter((key) => key !== 'extras')) as {
  extras?: unknown;
};
check('an older build keeps the extras list', Array.isArray(older.extras) && older.extras.length === 1);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('extra session checks passed');
