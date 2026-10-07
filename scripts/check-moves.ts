import { readFileSync } from 'node:fs';
import { planChoices, planItemsForWeek, extraLogsForDay } from '../src/lib/plans';
import { normalize, serialize } from '../src/lib/storage';
import type { PlanSession, Session, TrainingData } from '../src/types';

const raw = JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData;
const data = normalize(raw);
const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

function withMoves(moves: unknown): TrainingData {
  return normalize({
    ...raw,
    plans: raw.plans.map((plan) => (plan.id === 'plan-ski-home' ? { ...plan, moves } : plan)),
  });
}

function idsOn(source: TrainingData, date: string): string[] {
  return planItemsForWeek(source, source.plans, date)
    .filter((item) => item.date === date)
    .map((item) => item.session.id);
}

function item(source: TrainingData, date: string, id: string) {
  return planItemsForWeek(source, source.plans, date).find((entry) => entry.date === date && entry.session.id === id);
}

function loggedRun(date: string, planSessionId: string | null, id = 'log-run'): Session {
  return {
    id,
    date,
    kind: 'run',
    title: 'Run',
    notes: '',
    goalId: 'goal-ski-2026',
    planId: planSessionId ? 'plan-ski-home' : null,
    planSessionId,
    exercises: [],
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

function loggedStrength(date: string, session: PlanSession): Session {
  return {
    id: `log-${session.id}-${date}`,
    date,
    kind: 'strength',
    title: session.title,
    notes: '',
    goalId: 'goal-ski-2026',
    planId: 'plan-ski-home',
    planSessionId: session.id,
    exercises: session.exercises.map((exercise) => ({
      name: exercise.name,
      sets: Array.from({ length: exercise.sets }, () => ({ reps: 30, weightKg: 0 })),
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

const upperMove = {
  sessionId: 'ps-upper',
  fromDate: '2026-10-07',
  toDate: '2026-10-08',
  updatedAt: '2026-10-07T08:00:00.000Z',
};

check('starter plan has no moves field', data.plans.every((plan) => plan.moves === undefined));
check('absent moves keeps upper on Wednesday', idsOn(data, '2026-10-07').join() === 'ps-upper');
check('absent moves leaves Thursday empty', idsOn(data, '2026-10-08').length === 0);
check('an unmoved card has no hint date', item(data, '2026-10-07', 'ps-upper')?.movedFrom === null);

const moved = withMoves([upperMove]);
check('simple move leaves Wednesday empty', idsOn(moved, '2026-10-07').length === 0);
check('simple move shows upper on Thursday', idsOn(moved, '2026-10-08').join() === 'ps-upper');
check('simple move remembers Wednesday', item(moved, '2026-10-08', 'ps-upper')?.movedFrom === '2026-10-07');
check('simple move keeps Tuesday easy run', idsOn(moved, '2026-10-06').join() === 'ps-easy');
check('simple move keeps Friday lower B', idsOn(moved, '2026-10-09').join() === 'ps-lower-b');
check('next week upper stays on Wednesday', idsOn(moved, '2026-10-14').join() === 'ps-upper' && item(moved, '2026-10-14', 'ps-upper')?.movedFrom === null);
check('next week Thursday stays empty', idsOn(moved, '2026-10-15').length === 0);
check(
  'picker names the moved day',
  planChoices(moved, '2026-10-08', null).find((choice) => choice.id === 'ps-upper')?.label === 'Thu 8 Oct · Full upper',
);
check(
  'picker next week still says Wednesday',
  planChoices(moved, '2026-10-14', null).find((choice) => choice.id === 'ps-upper')?.label === 'Wed 14 Oct · Full upper',
);

const upper = item(moved, '2026-10-08', 'ps-upper');
if (!upper) {
  check('moved upper card exists for the log', false);
} else {
  const doneLog = { ...moved, sessions: [loggedStrength('2026-10-08', upper.session)] };
  const doneCard = item(doneLog, '2026-10-08', 'ps-upper');
  const thursday = planItemsForWeek(doneLog, doneLog.plans, '2026-10-08').filter((entry) => entry.date === '2026-10-08');
  check('a linked log marks the moved card done', doneCard?.done === true && doneCard.movedFrom === '2026-10-07');
  check('the linked log is not a second card', extraLogsForDay(doneLog.sessions, thursday, '2026-10-08').length === 0);
  check('Wednesday stays empty after the log', idsOn(doneLog, '2026-10-07').length === 0);

  const elsewhere = { ...moved, sessions: [loggedStrength('2026-10-06', upper.session)] };
  check('a linked log elsewhere in the week still marks the moved card', item(elsewhere, '2026-10-08', 'ps-upper')?.done === true);

  const shakeout = loggedRun('2026-10-08', null, 'log-shakeout');
  shakeout.title = 'Shakeout';
  const withExtra = { ...moved, sessions: [shakeout] };
  const thursdayOpen = planItemsForWeek(withExtra, withExtra.plans, '2026-10-08').filter((entry) => entry.date === '2026-10-08');
  check('an unplanned workout still shows beside the moved card', extraLogsForDay(withExtra.sessions, thursdayOpen, '2026-10-08').map((entry) => entry.id).join() === 'log-shakeout');
  check('the unplanned workout does not finish the plan card', item(withExtra, '2026-10-08', 'ps-upper')?.done === false);
}

const again = normalize(JSON.parse(serialize(moved)));
check('round trip keeps the move', JSON.stringify(again.plans.find((plan) => plan.id === 'plan-ski-home')?.moves) === JSON.stringify(moved.plans.find((plan) => plan.id === 'plan-ski-home')?.moves));

const cascade = withMoves([
  { sessionId: 'ps-easy', fromDate: '2026-10-06', toDate: '2026-10-07', updatedAt: '2026-10-06T09:00:00.000Z' },
  { sessionId: 'ps-upper', fromDate: '2026-10-07', toDate: '2026-10-08', updatedAt: '2026-10-06T09:00:00.000Z' },
]);
check('cascade clears Tuesday', idsOn(cascade, '2026-10-06').length === 0);
check('cascade puts the easy run on Wednesday', idsOn(cascade, '2026-10-07').join() === 'ps-easy');
check('cascade puts upper on Thursday', idsOn(cascade, '2026-10-08').join() === 'ps-upper' && item(cascade, '2026-10-08', 'ps-upper')?.movedFrom === '2026-10-07');
check('cascade leaves Friday alone', idsOn(cascade, '2026-10-09').join() === 'ps-lower-b');
check('cascade does not touch the next week', idsOn(cascade, '2026-10-13').join() === 'ps-easy' && idsOn(cascade, '2026-10-14').join() === 'ps-upper');

const occupied = withMoves([
  { sessionId: 'ps-easy', fromDate: '2026-10-06', toDate: '2026-10-07', updatedAt: '2026-10-06T09:00:00.000Z' },
]);
check('an occupied day keeps the session already there', idsOn(occupied, '2026-10-07').slice().sort().join() === 'ps-easy,ps-upper');
check('the site does not invent a move onto Thursday', idsOn(occupied, '2026-10-08').length === 0);

const cross = withMoves([
  { sessionId: 'ps-long', fromDate: '2026-10-10', toDate: '2026-10-12', updatedAt: '2026-10-10T09:00:00.000Z' },
]);
check('cross-week move leaves Saturday empty', idsOn(cross, '2026-10-10').length === 0);
check('cross-week move shows the long run on Monday', item(cross, '2026-10-12', 'ps-long')?.movedFrom === '2026-10-10');
check('cross-week move keeps Lower A on that Monday', idsOn(cross, '2026-10-12').slice().sort().join() === 'ps-long,ps-lower-a');
check('the next Saturday occurrence stays put', item(cross, '2026-10-17', 'ps-long')?.movedFrom === null && item(cross, '2026-10-17', 'ps-long')?.date === '2026-10-17');

const loggedMonday = { ...cross, sessions: [loggedRun('2026-10-12', 'ps-long', 'log-monday')] };
check('a log on the new day marks only the moved card', item(loggedMonday, '2026-10-12', 'ps-long')?.done === true);
check('the later Saturday run stays open', item(loggedMonday, '2026-10-17', 'ps-long')?.done === false);
const loggedOrigin = { ...cross, sessions: [loggedRun('2026-10-10', 'ps-long', 'log-saturday')] };
check('a log on the original day still marks the moved card', item(loggedOrigin, '2026-10-12', 'ps-long')?.done === true);
check('that original-day log does not finish the next Saturday', item(loggedOrigin, '2026-10-17', 'ps-long')?.done === false);
const loggedNext = { ...cross, sessions: [loggedRun('2026-10-17', 'ps-long', 'log-next')] };
check('a log on the later occurrence does not finish the moved card', item(loggedNext, '2026-10-12', 'ps-long')?.done === false && item(loggedNext, '2026-10-17', 'ps-long')?.done === true);

const shiftedPhase = withMoves([
  { sessionId: 'ps-long', fromDate: '2026-12-05', toDate: '2026-12-07', updatedAt: '2026-12-05T09:00:00.000Z' },
]);
const carried = item(shiftedPhase, '2026-12-07', 'ps-long');
check('a moved run keeps the phase from its original date', carried?.movedFrom === '2026-12-05' && carried.session.durationMin === 45 && carried.session.notes === '45 min easy');
check('the Saturday still in taper keeps 30 minutes', item(shiftedPhase, '2026-12-12', 'ps-long')?.session.durationMin === 30 && item(shiftedPhase, '2026-12-12', 'ps-long')?.movedFrom === null);

const malformed = withMoves([
  null,
  'ps-upper',
  { sessionId: 'ps-upper' },
  { sessionId: 'ps-upper', fromDate: 'Wednesday', toDate: '2026-10-08' },
  { sessionId: 'ps-upper', fromDate: '2026-02-31', toDate: '2026-10-08' },
  { sessionId: 'ps-upper', fromDate: '2026-13-01', toDate: '2026-10-08' },
  { sessionId: 'ps-missing', fromDate: '2026-10-07', toDate: '2026-10-08' },
  { sessionId: 'ps-upper', fromDate: '2026-10-08', toDate: '2026-10-09' },
  { sessionId: 'ps-upper', fromDate: '2026-10-07', toDate: '2026-10-07' },
  { sessionId: 'ps-upper', fromDate: '2026-09-30', toDate: '2026-10-01', updatedAt: '2026-09-30T09:00:00.000Z' },
  { sessionId: 'ps-upper', fromDate: '2026-10-07', toDate: '2026-10-09', updatedAt: '2026-10-01T00:00:00.000Z' },
  upperMove,
]);
const home = malformed.plans.find((plan) => plan.id === 'plan-ski-home');
check('malformed entries are dropped', home?.moves?.length === 2);
check(
  'a later stamp wins and the early out-of-plan move can be stored',
  home?.moves?.some((move) => move.sessionId === 'ps-upper' && move.fromDate === '2026-10-07' && move.toDate === '2026-10-08') === true &&
    home?.moves?.some((move) => move.fromDate === '2026-09-30' && move.toDate === '2026-10-01') === true,
);
check('the kept move still places upper on Thursday', idsOn(malformed, '2026-10-08').join() === 'ps-upper');
check('the out-of-plan move does not invent a card', idsOn(malformed, '2026-10-01').length === 0 && idsOn(malformed, '2026-09-30').length === 0);
check('moves that are not an array are ignored', withMoves({ sessionId: 'ps-upper', fromDate: '2026-10-07', toDate: '2026-10-08' }).plans[0]?.moves === undefined);
check('an empty moves list is absent', withMoves([]).plans.find((plan) => plan.id === 'plan-ski-home')?.moves === undefined);
check('ignoring bad moves leaves Wednesday on its usual day', idsOn(withMoves([{ sessionId: 'nope' }]), '2026-10-07').join() === 'ps-upper');

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('move checks passed');
