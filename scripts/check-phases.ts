import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { effortLabel, formatPace } from '../src/lib/format';
import { mergeTraining } from '../src/lib/merge';
import { extraLogsForDay, planCovers, planItemsForWeek } from '../src/lib/plans';
import { sessionSummary } from '../src/lib/stats';
import { normalize, serialize } from '../src/lib/storage';
import { starterDocument } from '../src/lib/templates';
import type { PlanSession, Session, TrainingData } from '../src/types';

const raw = JSON.parse(readFileSync(join(process.cwd(), 'public/data/training.json'), 'utf8')) as TrainingData;
const data = normalize(raw);
const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const text = JSON.stringify(raw);
check('no sessions in the committed log', raw.sessions.length === 0);
check('old plan is not scheduled', !raw.plans.some((item) => item.id === 'plan-ski-base'));
check('old plan stays tombstoned', raw.deleted.plans.some((item) => item.id === 'plan-ski-base'));
check('old lower week is gone', !text.includes('Back squat') && !text.includes('Walking lunge') && !text.includes('Nordic curl'));
check('old preset ids are gone from the live list', !raw.presets.some((preset) => ['preset-lower', 'preset-balance', 'preset-posterior'].includes(preset.id)));
check('no token in the document', !/token|ghp_|github_pat/i.test(text));
check('six phases survive normalize', data.plans[0]?.phases?.length === 6);
check('round trip keeps phases', JSON.stringify(normalize(JSON.parse(serialize(data)))) === JSON.stringify(data));

const plan = data.plans[0];
if (!plan) throw new Error('missing plan');

check('plan starts 6 Oct', planCovers(plan, '2026-10-06'));
check('5 Oct is before the plan', !planCovers(plan, '2026-10-05'));
check('13 Dec is the last day', planCovers(plan, '2026-12-13'));
check('14 Dec is outside the plan', !planCovers(plan, '2026-12-14'));

function item(date: string, id: string) {
  return planItemsForWeek(data, data.plans, date).find((entry) => entry.session.id === id);
}

function expectRun(date: string, id: string, notes: string, minutes: number) {
  const found = item(date, id);
  check(`${date} ${id} exists`, Boolean(found));
  check(`${date} ${id} notes`, found?.session.notes === notes);
  check(`${date} ${id} minutes`, found?.session.durationMin === minutes);
}

function expectSets(date: string, id: string, sets: number[]) {
  const found = item(date, id);
  check(`${date} ${id} exists`, Boolean(found));
  check(
    `${date} ${id} sets ${sets.join(',')}`,
    Boolean(found) && found!.session.exercises.every((exercise, index) => exercise.sets === sets[index]),
  );
}

expectRun('2026-10-06', 'ps-easy', '20-25 min easy', 25);
expectRun('2026-10-06', 'ps-long', '30-35 min easy', 35);
expectRun('2026-10-20', 'ps-easy', '25-30 min easy', 30);
expectRun('2026-10-24', 'ps-long', '40 min easy', 40);
expectRun('2026-11-03', 'ps-easy', '30 min easy, plus 6 x 20s hill strides', 30);
expectRun('2026-11-07', 'ps-long', '45-50 min easy', 50);
expectRun('2026-11-17', 'ps-easy', '30 min easy, plus 8 x 30s hills', 30);
expectRun('2026-11-21', 'ps-long', '55-60 min easy, last 10 min gentle downhill if the route has one', 60);
expectRun('2026-12-01', 'ps-easy', '25 min easy, plus 6 x 45s hills', 25);
expectRun('2026-12-05', 'ps-long', '45 min easy', 45);
expectRun('2026-12-08', 'ps-easy', '20 min easy', 20);
expectRun('2026-12-12', 'ps-long', '30 min easy', 30);

expectSets('2026-10-12', 'ps-lower-a', [3, 3, 3, 3, 3, 2, 3]);
expectSets('2026-10-14', 'ps-upper', [3, 3, 3, 3, 3, 2, 2, 3]);
expectSets('2026-10-16', 'ps-lower-b', [4, 3, 3, 3, 3, 2, 2]);
expectSets('2026-12-07', 'ps-lower-a', [2, 2, 2, 2, 2, 2, 2]);
expectSets('2026-12-09', 'ps-upper', [2, 2, 2, 2, 2, 2, 2, 2]);
expectSets('2026-12-11', 'ps-lower-b', [2, 2, 2, 2, 2, 2, 2]);

const firstWeek = planItemsForWeek(data, data.plans, '2026-10-06').map((entry) => entry.date);
check('first week skips 5 Oct', !firstWeek.includes('2026-10-05'));
check('14 Dec week is empty', planItemsForWeek(data, data.plans, '2026-12-14').length === 0);

function loggedRun(date: string, planSessionId: string): Session {
  return {
    id: 'log-run',
    date,
    kind: 'run',
    title: 'Easy run',
    notes: '',
    goalId: 'goal-ski-2026',
    planId: plan.id,
    planSessionId,
    exercises: [],
    distanceKm: null,
    durationSec: null,
    elevationM: null,
    effort: null,
    createdAt: '2026-10-06T10:00:00.000Z',
  };
}

function loggedStrength(date: string, session: PlanSession, setCount: number): Session {
  return {
    id: `log-${session.id}`,
    date,
    kind: 'strength',
    title: session.title,
    notes: '',
    goalId: 'goal-ski-2026',
    planId: plan.id,
    planSessionId: session.id,
    exercises: session.exercises.map((exercise) => ({
      name: exercise.name,
      sets: Array.from({ length: setCount }, () => ({ reps: 30, weightKg: 0 })),
    })),
    distanceKm: null,
    durationSec: null,
    elevationM: null,
    effort: null,
    createdAt: `${date}T10:00:00.000Z`,
  };
}

const withRun = { ...data, sessions: [loggedRun('2026-10-06', 'ps-easy')] };
check('a saved run counts', planItemsForWeek(withRun, withRun.plans, '2026-10-06').find((entry) => entry.session.id === 'ps-easy')?.done === true);
check('the other run stays open', planItemsForWeek(withRun, withRun.plans, '2026-10-06').find((entry) => entry.session.id === 'ps-long')?.done === false);

const beforePlan = {
  ...data,
  sessions: [{ ...loggedRun('2026-10-03', ''), id: 'log-easy-2026-10-03', planId: null, planSessionId: null }],
};
const oct3 = planItemsForWeek(beforePlan, beforePlan.plans, '2026-10-03').filter((entry) => entry.date === '2026-10-03');
check('3 Oct is before the plan', oct3.length === 0);
check(
  'a logged run still shows on 3 Oct',
  extraLogsForDay(beforePlan.sessions, oct3, '2026-10-03').map((entry) => entry.id).join() === 'log-easy-2026-10-03',
);

const shakeout = {
  ...loggedRun('2026-10-06', ''),
  id: 'log-shakeout',
  title: 'Shakeout',
  planId: null,
  planSessionId: null,
  createdAt: '2026-10-06T18:00:00.000Z',
};
const bothDay = { ...data, sessions: [loggedRun('2026-10-06', 'ps-easy'), shakeout] };
const tuesday = planItemsForWeek(bothDay, bothDay.plans, '2026-10-06').filter((entry) => entry.date === '2026-10-06');
const tuesdayEasy = tuesday.find((entry) => entry.session.id === 'ps-easy');
const tuesdayExtras = extraLogsForDay(bothDay.sessions, tuesday, '2026-10-06');
check('a linked run marks the plan done', tuesdayEasy?.done === true);
check('the linked run is not a second card', !tuesdayExtras.some((entry) => entry.id === 'log-run'));
check('an extra log on that day stays separate', tuesdayExtras.some((entry) => entry.id === 'log-shakeout'));

const wednesday = planItemsForWeek(data, data.plans, '2026-10-07').filter((entry) => entry.date === '2026-10-07');
check('a planned day with no log is not done', wednesday.length === 1 && wednesday[0]?.done === false);
check('a planned day with no log has nothing else', extraLogsForDay(data.sessions, wednesday, '2026-10-07').length === 0);

const lower = plan.sessions.find((session) => session.id === 'ps-lower-a');
if (!lower) throw new Error('missing lower A');
const shortOfTarget = { ...data, sessions: [loggedStrength('2026-10-12', lower, 2)] };
const fullTarget = { ...data, sessions: [loggedStrength('2026-10-12', lower, 3)] };
const taperTarget = { ...data, sessions: [loggedStrength('2026-12-07', lower, 2)] };
check('two sets do not finish a 3-set week', planItemsForWeek(shortOfTarget, shortOfTarget.plans, '2026-10-12').find((entry) => entry.session.id === 'ps-lower-a')?.done === false);
check('three sets finish the full week', planItemsForWeek(fullTarget, fullTarget.plans, '2026-10-12').find((entry) => entry.session.id === 'ps-lower-a')?.done === true);
check('two sets finish the taper', planItemsForWeek(taperTarget, taperTarget.plans, '2026-12-07').find((entry) => entry.session.id === 'ps-lower-a')?.done === true);

const olderPlan = {
  ...plan,
  updatedAt: '2026-10-03T07:51:00.000Z',
  phases: undefined,
  endDate: undefined,
};
const remote = normalize({
  ...data,
  plans: [olderPlan],
  sessions: [loggedRun('2026-10-20', 'ps-easy')],
});
const merged = mergeTraining(data, remote);
check('merge keeps the logged session', merged.sessions.length === 1 && merged.sessions[0]?.id === 'log-run');
check('newer phased plan wins the merge', merged.plans[0]?.phases?.length === 6 && merged.plans[0]?.endDate === '2026-12-13');
check('merge the other way keeps the session', mergeTraining(remote, data).sessions.length === 1);

const legacy = normalize({
  ...starterDocument(),
  plans: [
    {
      id: 'plan-ski-base',
      goalId: 'goal-ski-2026',
      name: 'Pre-season base',
      startDate: '2026-08-03',
      weeks: 20,
      focus: ['Legs'],
      notes: 'old',
      sessions: [],
      status: 'active',
      updatedAt: '2026-10-02T00:00:00.000Z',
    },
  ],
  presets: [
    {
      id: 'preset-lower',
      name: 'Lower body',
      kind: 'strength',
      focus: 'Legs',
      notes: '',
      exercises: [{ name: 'Back squat', sets: 5, reps: '5' }],
      createdAt: '2026-10-02T00:00:00.000Z',
      updatedAt: '2026-10-02T00:00:00.000Z',
    },
  ],
  sessions: [loggedRun('2026-09-01', 'ps-easy')],
  deleted: { goals: [], plans: [], presets: [], sessions: [] },
});
const cleaned = mergeTraining(data, legacy);
check('old plan stays deleted', !cleaned.plans.some((item) => item.id === 'plan-ski-base'));
check('old preset stays deleted', !cleaned.presets.some((item) => item.id === 'preset-lower'));
check('a session logged against the old week is kept', cleaned.sessions.some((item) => item.id === 'log-run'));
check('goal survives its older tombstone', cleaned.goals.some((item) => item.id === 'goal-ski-2026'));
check('goal tombstone was not replaced', data.deleted.goals.filter((item) => item.id === 'goal-ski-2026').length === 1);
check(
  'goal tombstone stays older than the goal',
  (data.goals.find((item) => item.id === 'goal-ski-2026')?.updatedAt ?? '') > (data.deleted.goals.find((item) => item.id === 'goal-ski-2026')?.at ?? '9'),
);

const watchRaw = {
  version: 1,
  goals: [],
  plans: [],
  presets: [],
  sessions: [
    {
      id: 'log-watch',
      date: '2026-10-03',
      kind: 'run',
      title: 'Outdoor run',
      notes: '',
      goalId: null,
      planId: null,
      planSessionId: null,
      exercises: [],
      distanceKm: 5.07,
      durationSec: 2037,
      elevationM: 19,
      effort: 4,
      paceSec: 402,
      heartRate: 142,
      activeKcal: 428,
      totalKcal: 499,
      cadenceSpm: 132,
      powerW: 246,
      place: 'Barcelona',
      source: 'Apple Watch',
      activity: 'Outdoor run',
      startTime: '11:30',
      endTime: '12:03',
      weather: { tempC: 21, humidityPct: 83, airQuality: 2 },
      // Shape fixture only. The real per-km rows were not provided.
      splits: [{ km: 1, timeSec: 390, paceSec: 390, heartRate: 136 }],
      createdAt: '2026-10-03T10:05:00.000Z',
    },
    {
      id: 'log-old',
      date: '2026-09-02',
      kind: 'run',
      title: 'Easy run',
      notes: 'felt fine',
      goalId: 'goal-ski-2026',
      planId: null,
      planSessionId: null,
      exercises: [],
      distanceKm: 4,
      durationSec: 1500,
      elevationM: 12,
      effort: 3,
      createdAt: '2026-09-02T09:00:00.000Z',
    },
  ],
  deleted: { goals: [], plans: [], presets: [], sessions: [] },
};
const watched = normalize(watchRaw);
const again = normalize(JSON.parse(serialize(watched)));
const watch = again.sessions.find((session) => session.id === 'log-watch');
const oldRun = again.sessions.find((session) => session.id === 'log-old');
check('watch distance round trips', watch?.distanceKm === 5.07);
check('watch time round trips', watch?.durationSec === 2037);
check('watch pace round trips', watch?.paceSec === 402 && formatPace(watch.paceSec) === '6:42');
check('watch heart rate round trips', watch?.heartRate === 142);
check('watch calories round trip', watch?.activeKcal === 428 && watch?.totalKcal === 499);
check('watch elevation cadence power round trip', watch?.elevationM === 19 && watch?.cadenceSpm === 132 && watch?.powerW === 246);
check('effort 4 is moderate', watch?.effort === 4 && effortLabel(4) === 'Moderate');
check('watch place and clock round trip', watch?.place === 'Barcelona' && watch?.source === 'Apple Watch' && watch?.startTime === '11:30' && watch?.endTime === '12:03');
check('watch weather round trips', watch?.weather?.tempC === 21 && watch?.weather?.humidityPct === 83 && watch?.weather?.airQuality === 2);
check('watch split round trips', watch?.splits.length === 1 && watch.splits[0]?.timeSec === 390 && watch.splits[0]?.paceSec === 390 && watch.splits[0]?.heartRate === 136);
check('summary lists the watch metrics', sessionSummary(watch!) === '5.07 km · 33:57 · 6:42 /km · 142 bpm');
check('older run without new fields still loads', oldRun?.distanceKm === 4 && oldRun?.heartRate === null && oldRun?.splits.length === 0 && oldRun?.paceSec === null && oldRun?.notes === 'felt fine');
check('older run pace still comes from time and distance', sessionSummary(oldRun!).includes('6:15'));
check('watch import does not tombstone the ski goal', again.deleted.goals.length === 0);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('phase checks passed');
