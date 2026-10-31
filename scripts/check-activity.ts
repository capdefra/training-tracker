import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { activityDayFor, activitySummary } from '../src/lib/activity';
import { extraSessionId } from '../src/lib/plan-extras';
import { applySessionDone, extraLogsForDay, planItemsForWeek } from '../src/lib/plans';
import { normalize } from '../src/lib/storage';
import type { PlanExercise, Session, TrainingData } from '../src/types';

const raw = JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData;
const failures: string[] = [];
const today = '2026-10-31';

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const exercises: PlanExercise[] = [{ name: 'Goblet squat', sets: 3, reps: '8' }];
const preset = {
  id: 'preset-full-body',
  name: 'Full body (extra)',
  kind: 'strength' as const,
  focus: 'Full',
  notes: '',
  exercises,
  createdAt: '2026-10-01T08:00:00.000Z',
};

function withPlan(planPatch: Record<string, unknown>, sessions: Session[] = [], presets: unknown = [...raw.presets, preset]): TrainingData {
  return normalize({
    ...raw,
    presets,
    sessions,
    plans: raw.plans.map((plan) => (plan.id === 'plan-ski-home' ? { ...plan, ...planPatch } : plan)),
  });
}

function mark(source: TrainingData, sessionId: string, date: string, done = true): TrainingData {
  return applySessionDone(source, 'plan-ski-home', sessionId, date, done, `${date}T18:00:00.000Z`);
}

function log(date: string, planSessionId: string | null, sets = 0, id = `log-${planSessionId ?? 'free'}-${date}`): Session {
  return {
    id,
    date,
    kind: 'strength',
    title: planSessionId ? 'Planned' : 'Full body (extra)',
    notes: '',
    goalId: 'goal-ski-2026',
    planId: planSessionId ? 'plan-ski-home' : null,
    planSessionId,
    exercises: sets
      ? [{ name: 'Goblet squat', sets: Array.from({ length: sets }, () => ({ reps: 8, weightKg: 16 })) }]
      : [],
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
    createdAt: `${date}T12:00:00.000Z`,
  };
}

function run(date: string, planSessionId: string | null, id = `run-${date}`): Session {
  return { ...log(date, planSessionId, 0, id), kind: 'run', title: planSessionId ? 'Easy run' : 'Shakeout' };
}

function see(source: TrainingData, date: string) {
  const planned = planItemsForWeek(source, source.plans, date);
  return activityDayFor(date, today, planned, source.sessions);
}

const base = withPlan({});
check('a rest day stays neutral', see(base, '2026-10-25').mark === 'neutral' && see(base, '2026-10-25').extra === false);
check('a future planned day stays neutral', see(base, '2026-11-02').mark === 'neutral' && see(base, '2026-11-02').extra === false);
check('today stays neutral until the planned workout is done', see(base, '2026-10-31').mark === 'neutral');
check('an open plan today is not called a rest day', activitySummary(see(base, '2026-10-31'), 1) === 'planned workout still open');
check('a future plan is not called a rest day', activitySummary(see(base, '2026-11-02'), 1) === 'planned workout still open');
check('a past planned day with no log is missed', see(base, '2026-10-28').mark === 'skipped' && see(base, '2026-10-28').extra === false);

const monday = mark(base, 'ps-lower-a', '2026-10-26');
const mondayDay = see(monday, '2026-10-26');
check('a finished repeating session is solid done', mondayDay.mark === 'done' && mondayDay.extra === false);
check('the done label does not mention an extra', activitySummary(mondayDay) === 'planned workout done');

const short = withPlan({}, [log('2026-10-26', 'ps-lower-a', 1)]);
check('a short log does not finish the planned day', see(short, '2026-10-26').mark === 'skipped');

const doubled = {
  moves: [{ sessionId: 'ps-long', fromDate: '2026-10-10', toDate: '2026-10-06', updatedAt: '2026-10-06T08:00:00.000Z' }],
};
const bothOpen = withPlan(doubled, [run('2026-10-06', 'ps-easy')]);
check('one of two planned sessions still misses the day', see(bothOpen, '2026-10-06').mark === 'skipped');
const bothDone = withPlan(doubled, [run('2026-10-06', 'ps-easy', 'run-easy'), run('2026-10-06', 'ps-long', 'run-long')]);
check('every repeating session done fills the square', see(bothDone, '2026-10-06').mark === 'done' && see(bothDone, '2026-10-06').extra === false);

const moved = withPlan({
  moves: [{ sessionId: 'ps-upper', fromDate: '2026-10-28', toDate: '2026-10-29', updatedAt: '2026-10-28T08:00:00.000Z' }],
});
check('moving a session off Wednesday leaves that day neutral', see(moved, '2026-10-28').mark === 'neutral');
const movedDone = mark(moved, 'ps-upper', '2026-10-29');
check('a moved session counts on the day it shows', see(movedDone, '2026-10-29').mark === 'done' && see(movedDone, '2026-10-29').extra === false);

const extraId = extraSessionId('preset-full-body');
const extraLogged = withPlan({ extras: [{ presetId: 'preset-full-body', date: '2026-10-25' }] }, [log('2026-10-25', extraId, 3)]);
const extraDay = see(extraLogged, '2026-10-25');
check('a finished plan extra on a rest day is the dim square', extraDay.mark === 'extra' && extraDay.extra === true);
check('that log is not also an unplanned card', extraLogsForDay(extraLogged.sessions, planItemsForWeek(extraLogged, extraLogged.plans, '2026-10-25'), '2026-10-25').length === 0);
check('the extra label is just the extra', activitySummary(extraDay) === 'extra session');

const extraShort = withPlan({ extras: [{ presetId: 'preset-full-body', date: '2026-10-25' }] }, [log('2026-10-25', extraId, 1)]);
check('a short extra log does not light the dot', see(extraShort, '2026-10-25').mark === 'neutral' && see(extraShort, '2026-10-25').extra === false);

const extraMarked = mark(withPlan({ extras: [{ presetId: 'preset-full-body', date: '2026-10-27' }] }), extraId, '2026-10-27');
const tuesday = mark(extraMarked, 'ps-easy', '2026-10-27');
const tuesdayDay = see(tuesday, '2026-10-27');
check('a done plan plus a done extra keeps the solid square and the dot', tuesdayDay.mark === 'done' && tuesdayDay.extra === true);
check('the combined label names both', activitySummary(tuesdayDay) === 'planned workout done, plus an extra');

const unplannedRest = withPlan({}, [log('2026-10-29', null, 3, 'log-free-thu')]);
check('an unplanned session on a rest day is an extra', see(unplannedRest, '2026-10-29').mark === 'extra' && see(unplannedRest, '2026-10-29').extra === true);

const missedPlus = withPlan({}, [log('2026-10-30', null, 3, 'log-free-fri')]);
const friday = see(missedPlus, '2026-10-30');
check('a missed plan with an unplanned session stays an outline and keeps the extra', friday.mark === 'skipped' && friday.extra === true);
check('the missed-plus-extra label says both', activitySummary(friday) === 'planned workout missed, extra logged');

const orphan = withPlan({}, [log('2026-10-22', 'extra:preset-missing', 3, 'log-orphan')]);
check('an extra id with no card still counts as an unplanned extra', see(orphan, '2026-10-22').mark === 'extra');

const todayExtra = withPlan({}, [log(today, null, 3, 'log-today-extra')]);
const todayOpen = see(todayExtra, today);
check('an extra on an open today stays neutral and is still an extra', todayOpen.mark === 'neutral' && todayOpen.extra === true);
check('that today is described as still open, with the extra', activitySummary(todayOpen, 1) === 'planned workout still open, extra logged');

const todayDone = mark(base, 'ps-long', today);
check('finishing today fills the square', see(todayDone, today).mark === 'done');

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');
const view = readFileSync(join(process.cwd(), 'src/views/ActivityView.tsx'), 'utf8');
check('an extra draws a gold border', css.includes('--activity-gold') && css.includes('.activity-cell.has-extra') && css.includes('inset 0 0 0 2px var(--activity-gold)'));
check('the corner dot is gone', !css.includes('.activity-cell.has-extra::after') && !css.includes('.activity-swatch.has-extra::after'));
check('a missed extra replaces the green outline with gold', css.includes('.activity-cell.skipped.has-extra') && css.includes('border-color: var(--activity-gold)'));
check('today is a light ring, not the gold border', /activity-cell\.is-today \{[^}]*var\(--ink\)/.test(css) && !/activity-cell\.is-today \{[^}]*amber/.test(css));
check('today with an extra keeps a light ring inside the gold', css.includes('.activity-cell.is-today.has-extra') && css.includes('inset 0 0 0 2px var(--activity-gold), inset 0 0 0 4px var(--ink)'));
check('the legend shows the gold frame on each extra state', view.includes('Missed + extra') && view.includes('Done + extra') && view.includes("level.extra && 'has-extra'"));

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('activity day checks passed');
