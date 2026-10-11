import { decideDeploy, parseVersionPayload } from '../src/lib/deploy';
import { documentForGist, parseGistPayload } from '../src/lib/gist';
import { mergeTraining } from '../src/lib/merge';
import { normalize, serialize } from '../src/lib/storage';
import { starterDocument } from '../src/lib/templates';
import {
  PLAN_EXERCISE_KEYS,
  PLAN_KEYS,
  absorbPlanSession,
  keepUnknown,
  replaceLoggedSession,
} from '../src/lib/unknown';
import type { PlanExercise, PlanMove, PlanSession, Session, TrainingData } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

function exercise(plan: TrainingData, sessionId: string, name: string): PlanExercise | undefined {
  return plan.plans[0]?.sessions.find((session) => session.id === sessionId)?.exercises.find((item) => item.name === name);
}

function withFutureFields(): TrainingData {
  const doc = starterDocument();
  const goal = doc.goals[0];
  const plan = doc.plans[0];
  const preset = doc.presets.find((item) => item.id === 'preset-lower-a');
  if (!goal || !plan || !preset) throw new Error('starter document is missing pieces');
  const rdl = plan.sessions.find((session) => session.id === 'ps-lower-a')?.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
  const presetRdl = preset.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
  const phase = plan.phases?.[0];
  const phaseChange = phase?.sessions[0];
  if (!rdl || !presetRdl || !phase || !phaseChange) throw new Error('starter plan is missing the deadlift');
  rdl.alsoCounts = ['Single-leg Romanian deadlift'];
  Object.assign(rdl, { tempo: '3010' });
  Object.assign(presetRdl, { alsoCounts: ['Single-leg Romanian deadlift'], tempo: '3010' });
  Object.assign(plan.sessions.find((session) => session.id === 'ps-lower-a') ?? {}, { coachCue: 'depth' });
  Object.assign(phase, { coachNote: 'ease in' });
  Object.assign(phaseChange, { cue: 'short hills' });
  const move: PlanMove & { reason: string } = {
    sessionId: 'ps-lower-b',
    fromDate: '2026-10-09',
    toDate: '2026-10-10',
    updatedAt: '2026-10-09T12:00:00.000Z',
    reason: 'legs',
  };
  plan.moves = [move];
  Object.assign(plan, { blockId: 'block-1' });
  Object.assign(goal, { color: 'blue', alsoCounts: ['season'], pausedReason: null, gear: { bench: true } });
  Object.assign(doc, { notebook: 'home' });
  Object.assign(doc.deleted, { archive: true });
  Object.assign(doc.deleted.plans[0] ?? {}, { reason: 'replaced' });
  doc.sessions = [
    {
      id: 'log-4e1d780c',
      date: '2026-10-09',
      kind: 'strength',
      title: 'Lower B',
      notes: '',
      goalId: goal.id,
      planId: plan.id,
      planSessionId: 'ps-lower-b',
      exercises: [
        {
          name: 'Kettlebell swing',
          sets: [{ reps: 12, weightKg: 16, kgPerPiece: 16, rpe: 7 }],
          pieces: 1,
          implement: 'kettlebell',
          cue: 'snap',
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
      weather: { tempC: 18, humidityPct: 60, airQuality: 1, wind: 'light' },
      splits: [],
      createdAt: '2026-10-09T18:00:00.000Z',
      moves: [{ sessionId: 'ps-lower-b', fromDate: '2026-10-09', toDate: '2026-10-10' }],
    } as Session,
  ];
  return doc;
}

const raw = JSON.parse(JSON.stringify(withFutureFields())) as TrainingData;
const loaded = parseGistPayload(JSON.stringify(raw));
const saved = serialize(loaded);
const again = parseGistPayload(saved);

const loadedPlan = again.plans.find((plan) => plan.id === 'plan-ski-home');
const loadedRdl = exercise(again, 'ps-lower-a', 'Dumbbell Romanian deadlift');
const loadedPreset = again.presets.find((preset) => preset.id === 'preset-lower-a')?.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
const loadedGoal = again.goals.find((goal) => goal.id === 'goal-ski-2026');
const loadedLog = again.sessions.find((session) => session.id === 'log-4e1d780c');
const loadedPhase = loadedPlan?.phases?.[0];

check('alsoCounts survives a gist load and save', loadedRdl?.alsoCounts?.join('|') === 'Single-leg Romanian deadlift');
check('moves survive a gist load and save', loadedPlan?.moves?.[0]?.fromDate === '2026-10-09' && loadedPlan.moves[0]?.toDate === '2026-10-10');
check('a move field this build does not model survives', (loadedPlan?.moves?.[0] as { reason?: string } | undefined)?.reason === 'legs');
check('plan blockId survives', (loadedPlan as { blockId?: string } | undefined)?.blockId === 'block-1');
check('exercise tempo survives', (loadedRdl as { tempo?: string } | undefined)?.tempo === '3010');
check('preset alsoCounts and tempo survive', loadedPreset?.alsoCounts?.[0] === 'Single-leg Romanian deadlift' && (loadedPreset as { tempo?: string }).tempo === '3010');
check('session coachCue survives', (loadedPlan?.sessions.find((session) => session.id === 'ps-lower-a') as { coachCue?: string } | undefined)?.coachCue === 'depth');
check('phase coachNote survives', (loadedPhase as { coachNote?: string } | undefined)?.coachNote === 'ease in');
check('phase change cue survives', (loadedPhase?.sessions[0] as { cue?: string } | undefined)?.cue === 'short hills');
check('goal color survives', (loadedGoal as { color?: string } | undefined)?.color === 'blue');
check('a null unknown field survives', (loadedGoal as { pausedReason?: null } | undefined)?.pausedReason === null);
check('a nested unknown object survives', (loadedGoal as { gear?: { bench?: boolean } } | undefined)?.gear?.bench === true);
check('alsoCounts on a goal is kept even though goals do not model it', (loadedGoal as { alsoCounts?: string[] } | undefined)?.alsoCounts?.[0] === 'season');
check('moves on a log are kept even though logs do not model them', (loadedLog as { moves?: PlanMove[] } | undefined)?.moves?.[0]?.toDate === '2026-10-10');
check('set rpe survives load migration', (loadedLog?.exercises[0]?.sets[0] as { rpe?: number } | undefined)?.rpe === 7);
check('logged exercise cue survives', (loadedLog?.exercises[0] as { cue?: string } | undefined)?.cue === 'snap');
check('weather wind survives', (loadedLog?.weather as { wind?: string } | null)?.wind === 'light');
check('top-level notebook survives', (again as { notebook?: string }).notebook === 'home');
check('deletion reason survives', (again.deleted.plans[0] as { reason?: string } | undefined)?.reason === 'replaced');
check('deletion list archive flag survives', (again.deleted as { archive?: boolean }).archive === true);
check('a second save does not drop the unknown fields', JSON.stringify(parseGistPayload(serialize(again))) === JSON.stringify(again));

const aliasPayload = JSON.parse(JSON.stringify(raw)) as TrainingData & { plans: Array<{ sessions: Array<{ exercises: Array<PlanExercise & { alsoCounts?: unknown; tempo?: string }> }> }> };
const bad = aliasPayload.plans[0]?.sessions.find((session) => session.id === 'ps-lower-a')?.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
if (bad) {
  bad.alsoCounts = 'not-a-list';
  bad.tempo = '3010';
}
const ignored = normalize(aliasPayload);
const ignoredRdl = exercise(ignored, 'ps-lower-a', 'Dumbbell Romanian deadlift');
check('a non-array alsoCounts is still ignored', ignoredRdl?.alsoCounts === undefined);
check('tempo on that exercise is still kept', (ignoredRdl as { tempo?: string } | undefined)?.tempo === '3010');
check('starter exercises still omit alsoCounts until a writer adds it', !JSON.stringify(starterDocument()).includes('alsoCounts'));

const olderExerciseKeys = PLAN_EXERCISE_KEYS.filter((key) => key !== 'alsoCounts');
const olderPlanKeys = PLAN_KEYS.filter((key) => key !== 'moves');
const sourceExercise = {
  name: 'Dumbbell Romanian deadlift',
  sets: 3,
  reps: '8-12',
  alsoCounts: ['Single-leg Romanian deadlift'],
  tempo: '3010',
};
const olderExercise = keepUnknown(
  { name: sourceExercise.name, sets: sourceExercise.sets, reps: sourceExercise.reps },
  sourceExercise,
  olderExerciseKeys,
);
check('an older exercise schema keeps alsoCounts', olderExercise.alsoCounts?.[0] === 'Single-leg Romanian deadlift');
check('an older exercise schema keeps tempo', (olderExercise as { tempo?: string }).tempo === '3010');
const sourcePlan = {
  id: 'plan-1',
  name: 'Home',
  moves: [{ sessionId: 'ps-lower-b', fromDate: '2026-10-09', toDate: '2026-10-10', reason: 'legs' }],
  blockId: 'block-1',
};
const olderPlan = keepUnknown({ id: sourcePlan.id, name: sourcePlan.name }, sourcePlan, olderPlanKeys);
check('an older plan schema keeps moves', (olderPlan as { moves?: PlanMove[] }).moves?.[0]?.fromDate === '2026-10-09');
check('an older plan schema keeps blockId', (olderPlan as { blockId?: string }).blockId === 'block-1');

const session = loadedPlan?.sessions.find((item) => item.id === 'ps-lower-a');
if (session && loadedRdl) {
  const rebuilt: PlanSession = {
    ...session,
    notes: 'updated note',
    exercises: session.exercises.map((item) => {
      if (item.name !== 'Dumbbell Romanian deadlift') return item;
      const next: PlanExercise = { name: item.name, sets: item.sets, reps: '6' };
      if (item.alsoCounts && item.alsoCounts.length > 0) next.alsoCounts = [...item.alsoCounts];
      return keepUnknown(next, item, PLAN_EXERCISE_KEYS);
    }),
  };
  delete (rebuilt as { coachCue?: string }).coachCue;
  const edited = absorbPlanSession(rebuilt, session);
  const editedRdl = edited.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
  check('editing a session keeps the new reps', editedRdl?.reps === '6');
  check('editing a session keeps alsoCounts', editedRdl?.alsoCounts?.[0] === 'Single-leg Romanian deadlift');
  check('editing a session keeps tempo', (editedRdl as { tempo?: string } | undefined)?.tempo === '3010');
  check('editing a session keeps coachCue', (edited as { coachCue?: string }).coachCue === 'depth');
  check('editing a session keeps the new note', edited.notes === 'updated note');
}

if (loadedLog) {
  const fresh: Session = {
    ...loadedLog,
    title: 'Lower B done',
    exercises: loadedLog.exercises.map((item) => ({
      name: item.name,
      sets: item.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg, ...(set.kgPerPiece ? { kgPerPiece: set.kgPerPiece } : {}) })),
      ...(item.pieces ? { pieces: item.pieces } : {}),
      ...(item.implement ? { implement: item.implement } : {}),
    })),
    weather: loadedLog.weather ? { tempC: loadedLog.weather.tempC, humidityPct: loadedLog.weather.humidityPct, airQuality: loadedLog.weather.airQuality } : null,
  };
  delete (fresh as { moves?: unknown }).moves;
  const replaced = replaceLoggedSession([loadedLog], fresh)[0];
  check('replacing a log keeps the new title', replaced?.title === 'Lower B done');
  check('replacing a log keeps moves it does not model', (replaced as { moves?: PlanMove[] } | undefined)?.moves?.[0]?.toDate === '2026-10-10');
  check('replacing a log keeps set rpe', (replaced?.exercises[0]?.sets[0] as { rpe?: number } | undefined)?.rpe === 7);
  check('replacing a log keeps exercise cue', (replaced?.exercises[0] as { cue?: string } | undefined)?.cue === 'snap');
  check('replacing a log keeps weather wind', (replaced?.weather as { wind?: string } | null)?.wind === 'light');
}

const olderCopy = normalize(JSON.parse(JSON.stringify(again)) as TrainingData);
const newerCopy = normalize(JSON.parse(JSON.stringify(again)) as TrainingData);
const olderPlanRecord = olderCopy.plans[0];
const newerPlanRecord = newerCopy.plans[0];
if (olderPlanRecord && newerPlanRecord) {
  olderPlanRecord.updatedAt = '2026-10-03T08:00:00.000Z';
  newerPlanRecord.updatedAt = '2026-10-11T00:00:00.000Z';
  delete (newerPlanRecord as { blockId?: string }).blockId;
  const newerRdl = newerPlanRecord.sessions.find((session) => session.id === 'ps-lower-a')?.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
  if (newerRdl) delete (newerRdl as { tempo?: string }).tempo;
  newerCopy.sessions = [
    ...newerCopy.sessions,
    {
      id: 'log-other-device',
      date: '2026-10-10',
      kind: 'run',
      title: 'Easy run',
      notes: '',
      goalId: null,
      planId: null,
      planSessionId: 'ps-easy',
      exercises: [],
      distanceKm: 4,
      durationSec: 1500,
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
      createdAt: '2026-10-10T09:00:00.000Z',
    },
  ];
  const merged = mergeTraining(olderCopy, newerCopy);
  const mergedPlan = merged.plans.find((plan) => plan.id === 'plan-ski-home');
  const mergedRdl = exercise(merged, 'ps-lower-a', 'Dumbbell Romanian deadlift');
  check('merge keeps a session that only the other copy has', merged.sessions.some((session) => session.id === 'log-other-device'));
  check('merge puts back a plan field the newer copy lost', (mergedPlan as { blockId?: string } | undefined)?.blockId === 'block-1');
  check('merge puts back an exercise field the newer copy lost', (mergedRdl as { tempo?: string } | undefined)?.tempo === '3010');
  check('merge keeps the move and its unknown reason', (mergedPlan?.moves?.[0] as { reason?: string; toDate?: string } | undefined)?.reason === 'legs' && mergedPlan?.moves?.[0]?.toDate === '2026-10-10');
  const cleared = normalize(JSON.parse(JSON.stringify(again)) as TrainingData);
  const clearedPlan = cleared.plans[0];
  const clearedRdl = clearedPlan?.sessions.find((session) => session.id === 'ps-lower-a')?.exercises.find((item) => item.name === 'Dumbbell Romanian deadlift');
  if (clearedPlan && clearedRdl) {
    clearedPlan.updatedAt = '2026-10-12T00:00:00.000Z';
    delete clearedRdl.alsoCounts;
    const restored = mergeTraining(again, cleared);
    check(
      'merge does not restore alsoCounts the newer copy no longer has',
      exercise(restored, 'ps-lower-a', 'Dumbbell Romanian deadlift')?.alsoCounts === undefined,
    );
  }
  const gistBody = documentForGist(olderCopy, newerCopy);
  check('the gist write includes the other device session', gistBody.includes('log-other-device'));
  check('the gist write includes the recovered block id', gistBody.includes('block-1'));
}

const poisoned = JSON.parse('{"version":1,"notebook":"ok","goals":[{"id":"g1","name":"Goal","targetDate":"","focus":[],"notes":"","status":"active","createdAt":"2026-10-01T00:00:00.000Z","__proto__":{"polluted":true},"color":"blue"}],"plans":[],"presets":[],"sessions":[],"deleted":{"goals":[],"plans":[],"presets":[],"sessions":[]}}');
const safe = normalize(poisoned);
check('an unknown color survives a proto key', (safe.goals[0] as { color?: string } | undefined)?.color === 'blue');
check('the prototype is not polluted', !Object.hasOwn(Object.prototype, 'polluted'));

check('version payload reads a build id', parseVersionPayload({ buildId: ' 2026-10-11T00:00:00.000Z ' }) === '2026-10-11T00:00:00.000Z');
check('version payload rejects a blank id', parseVersionPayload({ buildId: '  ' }) === null);
check('version payload rejects a number', parseVersionPayload({ buildId: 12 }) === null);
check('version payload rejects a list', parseVersionPayload(['2026-10-11T00:00:00.000Z']) === null);

const local = '2026-10-11T00:00:00.000Z';
const remote = '2026-10-12T00:00:00.000Z';
check('a newer deploy reloads', decideDeploy({ localBuildId: local, remoteBuildId: remote, sessionActive: false, reloadedFor: null }).kind === 'reload');
check(
  'an open session defers the reload',
  decideDeploy({ localBuildId: local, remoteBuildId: remote, sessionActive: true, reloadedFor: null }).kind === 'defer',
);
check(
  'an open session still defers after a failed reload',
  decideDeploy({ localBuildId: local, remoteBuildId: remote, sessionActive: true, reloadedFor: remote }).kind === 'defer',
);
check(
  'a second mismatch does not reload again',
  decideDeploy({ localBuildId: local, remoteBuildId: remote, sessionActive: false, reloadedFor: remote }).kind === 'refuse',
);
check(
  'the same build does nothing',
  decideDeploy({ localBuildId: local, remoteBuildId: local, sessionActive: false, reloadedFor: null }).kind === 'current',
);
check(
  'an older version file does not reload this bundle',
  decideDeploy({ localBuildId: remote, remoteBuildId: local, sessionActive: false, reloadedFor: null }).kind === 'current',
);
check(
  'a missing version file does not block',
  decideDeploy({ localBuildId: local, remoteBuildId: null, sessionActive: false, reloadedFor: remote }).kind === 'current',
);
check('dev does not reload', decideDeploy({ localBuildId: 'dev', remoteBuildId: remote, sessionActive: false, reloadedFor: null }).kind === 'current');

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('unknown-field checks passed');
