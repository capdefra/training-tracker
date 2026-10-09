import { readFileSync } from 'node:fs';
import { parseHash } from '../src/hooks/useHashRoute';
import { draftFromPreset, exercisesFromTemplate } from '../src/lib/draft';
import { addDays } from '../src/lib/dates';
import { buildPreset, planItemsForWeek } from '../src/lib/plans';
import { decideLaunch, freshProgress, isDirty, loadStrengthProgress, progressHasSets, saveStrengthProgress, type StrengthProgress } from '../src/lib/session-progress';
import { sessionFromDraft } from '../src/lib/session-save';
import { normalize } from '../src/lib/storage';
import type { TrainingData } from '../src/types';

const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

const raw = JSON.parse(readFileSync(new URL('../public/data/training.json', import.meta.url), 'utf8')) as TrainingData;
const data = normalize(raw);
const week = planItemsForWeek(data, data.plans, '2026-10-12');
const lower = week.find((item) => item.session.id === 'ps-lower-a');
check('lower A is on the home week', lower !== undefined);
if (lower) {
  const movedData = normalize({
    ...data,
    plans: data.plans.map((plan) =>
      plan.id === lower.plan.id
        ? { ...plan, moves: [{ sessionId: lower.session.id, fromDate: lower.date, toDate: addDays(lower.date, 1) }] }
        : plan,
    ),
  });
  const shifted = planItemsForWeek(movedData, movedData.plans, '2026-10-12').find((item) => item.session.id === 'ps-lower-a');
  check('a one-off move lands lower A on the next day', shifted?.date === addDays(lower.date, 1) && shifted.movedFrom === lower.date);
  if (shifted) {
    const preset = buildPreset(shifted.plan, shifted.session, shifted.date, '2026-10-12');
    check(
      'starting the moved day uses that session’s exercises',
      preset.kind === 'strength' &&
        preset.planSessionId === 'ps-lower-a' &&
        preset.templateExercises.map((exercise) => `${exercise.name}:${exercise.sets}:${exercise.reps}`).join('|') ===
          shifted.session.exercises.map((exercise) => `${exercise.name}:${exercise.sets}:${exercise.reps}`).join('|'),
    );
    check('the real plan still names goblet squat', preset.templateExercises[0]?.name === 'Goblet squat');

    const history = normalize({
      version: 1,
      goals: [],
      plans: [],
      presets: [],
      sessions: [
        {
          id: 'prev',
          date: '2026-10-01',
          kind: 'strength',
          title: 'Lower A',
          notes: '',
          goalId: null,
          planId: 'plan-ski-home',
          planSessionId: 'ps-lower-a',
          exercises: [{ name: 'Goblet squat', pieces: 1, implement: 'kettlebell', sets: [{ reps: 8, weightKg: 16, kgPerPiece: 16 }] }],
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
      deleted: { goals: [], plans: [], presets: [], sessions: [] },
    });
    const drafted = exercisesFromTemplate(preset.templateExercises, history.sessions);
    const goblet = drafted[0];
    check('goblet squat suggests the last 16 kg kettlebell', goblet?.name === 'Goblet squat' && goblet.pendingKg === '16' && goblet.pieces === 1 && goblet.implement === 'kettlebell');

    const draft = draftFromPreset(preset, history.sessions);
    draft.exercises[0] = {
      ...draft.exercises[0]!,
      sets: [{ key: 'set-1', reps: '8', kgPerPiece: '16' }],
    };
    const saved = sessionFromDraft(draft, 'log-1', '2026-10-08T10:00:00.000Z');
    if (typeof saved === 'string') check('partial session saves', false);
    else {
      check('saved session keeps the plan link and date', saved.planSessionId === 'ps-lower-a' && saved.kind === 'strength' && saved.date === preset.date);
      check('only the logged exercise is stored', saved.exercises.length === 1 && saved.exercises[0]?.name === 'Goblet squat');
      check('the set stores kg per piece and the total', saved.exercises[0]?.pieces === 1 && saved.exercises[0]?.implement === 'kettlebell' && saved.exercises[0]?.sets[0]?.kgPerPiece === 16 && saved.exercises[0]?.sets[0]?.weightKg === 16 && saved.exercises[0]?.sets[0]?.reps === 8);
    }

    const empty = freshProgress(draftFromPreset(preset, []), 'new-1', '2026-10-08T09:00:00.000Z');
    const again = freshProgress(draftFromPreset(preset, []), 'new-2', '2026-10-08T11:00:00.000Z');
    const resumed = decideLaunch(again, empty);
    check('the same plan day resumes', resumed.kind === 'use' && resumed.progress.sessionId === 'new-1');
    const dirty = structuredClone(empty) as StrengthProgress;
    dirty.draft.exercises[0]?.sets.push({ key: 'set-1', reps: '8', kgPerPiece: '16' });
    check('logged sets count as unsaved work', isDirty(dirty) && progressHasSets(dirty));
    const other = freshProgress(draftFromPreset({ ...preset, planSessionId: 'ps-upper', title: 'Full upper', templateExercises: [] }, []), 'new-3', '2026-10-08T12:00:00.000Z');
    const asked = decideLaunch(other, dirty);
    check('a different workout asks before discarding sets', asked.kind === 'ask' && asked.current.sessionId === 'new-1' && asked.next.sessionId === 'new-3');
    const blank = freshProgress(draftFromPreset(preset, []), 'new-4', '2026-10-08T12:00:00.000Z');
    blank.draft.exercises = blank.draft.exercises.map((exercise) => ({ ...exercise, sets: [] }));
    const replaced = decideLaunch(other, blank);
    check('an untouched workout is replaced', replaced.kind === 'use' && replaced.progress.sessionId === 'new-3');
  }
}

const memory = memoryStore();
const stored = freshProgress(draftFromPreset({ date: '2026-10-08', kind: 'strength', title: 'Lower A', goalId: null, planId: 'plan-ski-home', planSessionId: 'ps-lower-a', templateExercises: [], distanceKm: null, durationMin: null, prompt: '' }, []), 'keep', '2026-10-08T09:00:00.000Z');
saveStrengthProgress(stored, memory);
const loaded = loadStrengthProgress(memory);
check('progress round-trips in storage', loaded?.sessionId === 'keep' && loaded.draft.title === 'Lower A' && loaded.restChoice === 90 && loaded.baseline === '');

check('session route is the logger', parseHash('#/session').name === 'session');
check('old preview route opens Today', parseHash('#/prototype/session').name === 'today' && parseHash('#/prototype/session/ps-upper').name === 'today');
check('today and log routes stay', parseHash('#/today').name === 'today' && parseHash('#/today/2026-10-08').date === '2026-10-08' && parseHash('#/log').name === 'log' && parseHash('#/log/abc').id === 'abc');

const screen = readFileSync(new URL('../src/components/StrengthSession.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/session.css', import.meta.url), 'utf8');
check('log set disables only when it cannot log', screen.includes('disabled={!canLog}'));
check('logging stops at the planned set count', screen.includes('exercise.sets.length >= exercise.targetSets'));
check('a logged set can be removed', screen.includes('aria-label="Remove set"'));
check('the next exercise sits under the log button', screen.includes('sess-upcoming') && !screen.includes('nextLabel'));
check('enabled log label stays light', css.includes('.sess-screen button.sess-log') && css.includes('color: #f6f3ec'));
check('the session screen does not scroll', css.includes('overflow: hidden') && css.includes('100dvh') && css.includes('overscroll-behavior: none'));
check('the logger does not write the gist itself', !screen.includes('saveToGist') && !screen.includes('localStorage'));

function memoryStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('strength session checks passed');
