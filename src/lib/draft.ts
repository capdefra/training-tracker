import type { EffortCount, ExerciseEntry, LogPreset, PlanExercise, RunSplit, Session } from '../types';
import { todayISO } from './dates';
import { formatDuration, formatKm, formatPace, trimNum } from './format';
import { uid } from './ids';
import { lastExercise } from './stats';

export interface SetDraft {
  key: string;
  reps: string;
  weightKg: string;
}

export interface ExerciseDraft {
  key: string;
  name: string;
  sets: SetDraft[];
  count: EffortCount;
  targetLabel: string;
}

export interface SplitDraft {
  key: string;
  time: string;
  pace: string;
  heartRate: string;
}

export interface Draft {
  date: string;
  kind: 'strength' | 'run';
  title: string;
  notes: string;
  goalId: string;
  planId: string;
  planSessionId: string;
  exercises: ExerciseDraft[];
  distanceKm: string;
  /** Workout time, as `33:57` or whole minutes. */
  duration: string;
  elevationM: string;
  pace: string;
  heartRate: string;
  activeKcal: string;
  totalKcal: string;
  cadence: string;
  power: string;
  place: string;
  source: string;
  activity: string;
  startTime: string;
  endTime: string;
  tempC: string;
  humidity: string;
  airQuality: string;
  splits: SplitDraft[];
  effort: number | null;
  prompt: string;
  distanceHint: string;
  durationHint: string;
}

export function blankSet(reps = '5'): SetDraft {
  return { key: uid('set'), reps, weightKg: '' };
}

export function blankExercise(name = ''): ExerciseDraft {
  return { key: uid('ex'), name, sets: [blankSet()], count: 'reps', targetLabel: '' };
}

export function blankSplit(): SplitDraft {
  return { key: uid('split'), time: '', pace: '', heartRate: '' };
}

function clockFromMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  return formatDuration(Math.round(minutes * 60));
}

function splitFromSession(split: RunSplit): SplitDraft {
  return {
    key: uid('split'),
    time: split.timeSec > 0 ? formatDuration(split.timeSec) : '',
    pace: split.paceSec ? formatPace(split.paceSec) : '',
    heartRate: split.heartRate ? String(split.heartRate) : '',
  };
}

export function blankDraft(date = todayISO()): Draft {
  return {
    date,
    kind: 'strength',
    title: '',
    notes: '',
    goalId: '',
    planId: '',
    planSessionId: '',
    exercises: [blankExercise()],
    distanceKm: '',
    duration: '',
    elevationM: '',
    pace: '',
    heartRate: '',
    activeKcal: '',
    totalKcal: '',
    cadence: '',
    power: '',
    place: '',
    source: '',
    activity: '',
    startTime: '',
    endTime: '',
    tempC: '',
    humidity: '',
    airQuality: '',
    splits: [],
    effort: null,
    prompt: '',
    distanceHint: '',
    durationHint: '',
  };
}

function setsFromExercise(exercise: ExerciseEntry): SetDraft[] {
  return exercise.sets.map((set) => ({
    key: uid('set'),
    reps: String(set.reps),
    weightKg: trimNum(set.weightKg),
  }));
}

export function draftFromSession(session: Session): Draft {
  return {
    date: session.date,
    kind: session.kind,
    title: session.title,
    notes: session.notes,
    goalId: session.goalId ?? '',
    planId: session.planId ?? '',
    planSessionId: session.planSessionId ?? '',
    exercises: session.exercises.length
      ? session.exercises.map((exercise) => ({
          key: uid('ex'),
          name: exercise.name,
          sets: setsFromExercise(exercise),
          count: 'reps' as const,
          targetLabel: '',
        }))
      : [blankExercise()],
    distanceKm: session.distanceKm !== null ? formatKm(session.distanceKm) : '',
    duration: session.durationSec ? formatDuration(session.durationSec) : '',
    elevationM: session.elevationM !== null ? trimNum(session.elevationM) : '',
    pace: session.paceSec ? formatPace(session.paceSec) : '',
    heartRate: session.heartRate ? String(session.heartRate) : '',
    activeKcal: session.activeKcal ? String(session.activeKcal) : '',
    totalKcal: session.totalKcal ? String(session.totalKcal) : '',
    cadence: session.cadenceSpm ? String(session.cadenceSpm) : '',
    power: session.powerW ? String(session.powerW) : '',
    place: session.place,
    source: session.source,
    activity: session.activity,
    startTime: session.startTime,
    endTime: session.endTime,
    tempC: session.weather?.tempC !== null && session.weather?.tempC !== undefined ? trimNum(session.weather.tempC) : '',
    humidity: session.weather?.humidityPct !== null && session.weather?.humidityPct !== undefined ? String(session.weather.humidityPct) : '',
    airQuality: session.weather?.airQuality !== null && session.weather?.airQuality !== undefined ? String(session.weather.airQuality) : '',
    splits: session.splits.map(splitFromSession),
    effort: session.effort,
    prompt: '',
    distanceHint: '',
    durationHint: '',
  };
}

function setsForTemplate(exercise: PlanExercise, previous: ExerciseEntry | null): SetDraft[] {
  const reps = String(parseInt(exercise.reps, 10) || '');
  const count = Math.max(1, exercise.sets);
  return Array.from({ length: count }, (_, index) => {
    const prior = previous?.sets[index] ?? previous?.sets.at(-1);
    const draft = blankSet(reps);
    if (prior && prior.weightKg > 0) draft.weightKg = trimNum(prior.weightKg);
    return draft;
  });
}

export function applyTemplateMeta(draft: Draft, template: PlanExercise[]): Draft {
  if (template.length === 0) return draft;
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => {
      const match = template.find((item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
      if (!match) return exercise;
      return {
        ...exercise,
        count: match.count === 'seconds' ? 'seconds' : 'reps',
        targetLabel: match.count === 'seconds' ? `${match.sets}×${match.reps} sec` : `${match.sets}×${match.reps}`,
      };
    }),
  };
}

export function exercisesFromTemplate(template: PlanExercise[], sessions: Session[]): ExerciseDraft[] {
  if (template.length === 0) return [blankExercise()];
  return template.map((exercise) => ({
    key: uid('ex'),
    name: exercise.name,
    sets: setsForTemplate(exercise, lastExercise(sessions, exercise.name)),
    count: exercise.count === 'seconds' ? 'seconds' : 'reps',
    targetLabel: exercise.count === 'seconds' ? `${exercise.sets}×${exercise.reps} sec` : `${exercise.sets}×${exercise.reps}`,
  }));
}

export function draftFromPreset(preset: LogPreset, sessions: Session[]): Draft {
  const exercises = preset.kind === 'strength' ? exercisesFromTemplate(preset.templateExercises, sessions) : [blankExercise()];

  return {
    ...blankDraft(preset.date),
    date: preset.date,
    kind: preset.kind,
    title: preset.title,
    goalId: preset.goalId ?? '',
    planId: preset.planId ?? '',
    planSessionId: preset.planSessionId ?? '',
    exercises,
    distanceKm: preset.distanceKm !== null ? formatKm(preset.distanceKm) : '',
    duration: preset.durationMin !== null ? clockFromMinutes(preset.durationMin) : '',
    prompt: preset.prompt,
    distanceHint: preset.kind === 'run' ? 'Optional. Saving with this blank still counts as doing the run.' : '',
    durationHint: preset.kind === 'run' ? 'Optional.' : '',
  };
}

export const COMMON_LIFTS = [
  'Back squat',
  'Romanian deadlift',
  'Deadlift',
  'Hip thrust',
  'Bulgarian split squat',
  'Walking lunge',
  'Calf raise',
  'Single-leg RDL',
  'Step-down',
  'Nordic curl',
  'Bench press',
  'Pull-up',
];

export const RUN_TITLES = ['Easy run', 'Long run', 'Hills', 'Intervals'];
