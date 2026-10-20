import type { EffortCount, ExerciseEntry, ExerciseLoadTarget, LoadImplement, LoadPieces, LogPreset, PlanExercise, RunSplit, Session, SetEntry } from '../types';
import { todayISO } from './dates';
import { formatDuration, formatKm, formatPace, parseNum, trimNum } from './format';
import { uid } from './ids';
import { defaultLoad, roundKg, type LoadDefault } from './load';
import { lastLoggedExercise, usableTarget } from './load-target';
import { effortLabel, sideSuffix } from './per-side';
import { lastExercise } from './stats';

export interface SetDraft {
  key: string;
  reps: string;
  /**
   * Kilograms of one piece, unless `asTotal` is set.
   * A legacy total stays in this field until a piece choice splits it.
   */
  kgPerPiece: string;
  asTotal?: boolean;
}

export interface ExerciseDraft {
  key: string;
  name: string;
  sets: SetDraft[];
  count: EffortCount;
  /** The plan's explicit flag. Absent still uses the name hint at display time. */
  perSide?: boolean;
  targetLabel: string;
  targetSets: number;
  pendingReps: string;
  pendingKg: string;
  /** The pending kilograms are still a total, not kg per piece. */
  pendingAsTotal: boolean;
  seedReps: string;
  seedKg: string;
  seedAsTotal: boolean;
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
  bodyweight: boolean;
  lastNote: string;
  /** Last log, or the recommendation, when that is not what filled the steppers. Empty keeps the usual gear line. */
  comparisonHint: string;
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

function repSeed(reps: string, count: EffortCount): string {
  const parsed = parseInt(reps, 10);
  if (Number.isFinite(parsed) && parsed > 0) return String(parsed);
  return count === 'seconds' ? '20' : '8';
}

function makeExercise(fields: {
  name?: string;
  sets?: SetDraft[];
  count?: EffortCount;
  perSide?: boolean;
  targetLabel?: string;
  targetSets?: number;
  pendingReps?: string;
  pendingKg?: string;
  pendingAsTotal?: boolean;
  seedReps?: string;
  seedKg?: string;
  seedAsTotal?: boolean;
  pieces?: LoadPieces | null;
  implement?: LoadImplement | null;
  bodyweight?: boolean;
  lastNote?: string;
  comparisonHint?: string;
}): ExerciseDraft {
  const seedReps = fields.seedReps ?? '8';
  const seedKg = fields.seedKg ?? '0';
  return {
    key: uid('ex'),
    name: fields.name ?? '',
    sets: fields.sets ?? [],
    count: fields.count ?? 'reps',
    ...(fields.perSide === true || fields.perSide === false ? { perSide: fields.perSide } : {}),
    targetLabel: fields.targetLabel ?? '',
    targetSets: fields.targetSets ?? 3,
    pendingReps: fields.pendingReps ?? seedReps,
    pendingKg: fields.pendingKg ?? seedKg,
    pendingAsTotal: fields.pendingAsTotal ?? false,
    seedReps,
    seedKg,
    seedAsTotal: fields.seedAsTotal ?? false,
    pieces: fields.pieces ?? null,
    implement: fields.implement ?? null,
    bodyweight: fields.bodyweight ?? false,
    lastNote: fields.lastNote ?? '',
    comparisonHint: fields.comparisonHint ?? '',
  };
}

export function blankExercise(name = ''): ExerciseDraft {
  const load = name ? defaultLoad(name) : defaultLoad('');
  if (load.kind === 'bodyweight') {
    return makeExercise({ name, bodyweight: true, pieces: null, implement: null });
  }
  return makeExercise({ name, pieces: load.pieces, implement: load.implement, bodyweight: false });
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

function exerciseDraftFromLogged(exercise: ExerciseEntry): ExerciseDraft {
  const fallback = defaultLoad(exercise.name);
  const weighted = exercise.sets.some((set) => set.weightKg > 0);
  const bodyweight = !exercise.pieces && !weighted && fallback.kind === 'bodyweight';
  const asTotal = !exercise.pieces && weighted;
  const sets: SetDraft[] = exercise.sets.map((set) => ({
    key: uid('set'),
    reps: String(set.reps),
    kgPerPiece: set.kgPerPiece && set.kgPerPiece > 0 ? trimNum(set.kgPerPiece) : set.weightKg > 0 ? trimNum(set.weightKg) : '',
    asTotal: Boolean(asTotal && set.weightKg > 0 && !(set.kgPerPiece && set.kgPerPiece > 0)),
  }));
  const last = sets.at(-1);
  const firstWeighted = sets.find((set) => (parseNum(set.kgPerPiece) ?? 0) > 0);
  const seedKg = firstWeighted?.kgPerPiece || '0';
  const heavy = exercise.sets.find((set) => set.weightKg > 0);
  return makeExercise({
    name: exercise.name,
    sets,
    targetSets: Math.max(sets.length, 1),
    pendingReps: last?.reps || '8',
    pendingKg: last?.kgPerPiece || '0',
    pendingAsTotal: Boolean(last?.asTotal),
    seedReps: last?.reps || '8',
    seedKg,
    seedAsTotal: Boolean(firstWeighted?.asTotal),
    pieces: bodyweight ? null : (exercise.pieces ?? null),
    implement: exercise.pieces === 2 ? 'dumbbell' : (exercise.implement ?? null),
    bodyweight,
    lastNote: asTotal && heavy ? `Last time ${trimNum(heavy.weightKg)} kg total` : '',
  });
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
    exercises: session.exercises.length ? session.exercises.map(exerciseDraftFromLogged) : [blankExercise()],
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

interface PreviousLoad {
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
  bodyweight: boolean;
  seedKg: string;
  seedAsTotal: boolean;
  lastNote: string;
}

function previousLoad(previous: ExerciseEntry | null, fallback: LoadDefault): PreviousLoad {
  const emptyLoaded: PreviousLoad =
    fallback.kind === 'bodyweight'
      ? { pieces: null, implement: null, bodyweight: true, seedKg: '0', seedAsTotal: false, lastNote: '' }
      : { pieces: fallback.pieces, implement: fallback.implement, bodyweight: false, seedKg: '0', seedAsTotal: false, lastNote: '' };
  if (!previous) return emptyLoaded;
  const last = [...previous.sets].reverse().find((set) => set.weightKg > 0);
  if (!last) return emptyLoaded;
  if (previous.pieces) {
    const per = last.kgPerPiece && last.kgPerPiece > 0 ? last.kgPerPiece : last.weightKg / previous.pieces;
    const implement = previous.pieces === 2 ? 'dumbbell' : (previous.implement ?? (fallback.kind === 'loaded' ? fallback.implement : 'dumbbell'));
    return { pieces: previous.pieces, implement, bodyweight: false, seedKg: trimNum(per), seedAsTotal: false, lastNote: '' };
  }
  return {
    pieces: null,
    implement: null,
    bodyweight: false,
    seedKg: trimNum(last.weightKg),
    seedAsTotal: true,
    lastNote: `Last time ${trimNum(last.weightKg)} kg total`,
  };
}

function formatLast(previous: ExerciseEntry | null, side = ''): string {
  if (!previous || previous.sets.length === 0) return '';
  const weighted = [...previous.sets].reverse().find((set) => set.weightKg > 0);
  const ref = weighted ?? previous.sets[previous.sets.length - 1];
  if (!ref) return '';
  const sets = previous.sets.length;
  if (!weighted) return `Last: ${sets}×${ref.reps}${side}`;
  if (previous.pieces) {
    const per = weighted.kgPerPiece && weighted.kgPerPiece > 0 ? weighted.kgPerPiece : weighted.weightKg / previous.pieces;
    return `Last: ${sets}×${ref.reps}${side} @ ${trimNum(per)} kg`;
  }
  return `Last: ${sets}×${ref.reps}${side} @ ${trimNum(weighted.weightKg)} kg total`;
}

function formatTarget(target: ExerciseLoadTarget, fallbackSets: number, side = ''): string {
  const sets = target.sets ?? fallbackSets;
  if (target.reps !== undefined && target.weightKg !== undefined) return `Target: ${sets}×${target.reps}${side} @ ${trimNum(target.weightKg)} kg`;
  if (target.reps !== undefined) return `Target: ${sets}×${target.reps}${side}`;
  if (target.weightKg !== undefined) return `Target: ${sets} sets${side} @ ${trimNum(target.weightKg)} kg`;
  if (target.sets !== undefined) return `Target: ${target.sets} sets${side}`;
  return '';
}

interface PlannedLoad {
  count: EffortCount;
  perSide?: boolean;
  targetSets: number;
  targetLabel: string;
  seedReps: string;
  seedKg: string;
  seedAsTotal: boolean;
  pieces: LoadPieces | null;
  implement: LoadImplement | null;
  bodyweight: boolean;
  lastNote: string;
  comparisonHint: string;
  appliedWeight: boolean;
}

function plannedLoad(exercise: PlanExercise, sessions: Session[]): PlannedLoad {
  const count: EffortCount = exercise.count === 'seconds' ? 'seconds' : 'reps';
  const target = usableTarget(exercise.target);
  const fallback = defaultLoad(exercise.name);
  const history = target ? lastLoggedExercise(sessions, exercise) : lastExercise(sessions, exercise.name);
  const load = previousLoad(history, fallback);
  const bodyweight = load.bodyweight;
  const useReps = target?.reps !== undefined;
  const useWeight = target?.weightKg !== undefined && !bodyweight;
  const targetSets = target?.sets ?? exercise.sets;
  const seedReps = useReps ? String(target.reps) : repSeed(exercise.reps, count);
  const shownReps = useReps ? String(target.reps) : exercise.reps;
  const side = sideSuffix(exercise);
  let pieces = load.pieces;
  let implement = load.implement;
  if (useWeight && !pieces && fallback.kind === 'loaded') {
    pieces = fallback.pieces;
    implement = fallback.implement;
  }
  const shownTarget: ExerciseLoadTarget | null = target
    ? {
        ...(target.sets !== undefined ? { sets: target.sets } : {}),
        ...(target.reps !== undefined ? { reps: target.reps } : {}),
        ...(useWeight && target.weightKg !== undefined ? { weightKg: target.weightKg } : {}),
      }
    : null;
  const comparisonHint =
    shownTarget && (useReps || useWeight)
      ? formatLast(history, side)
      : shownTarget
        ? formatTarget(shownTarget, exercise.sets, side)
        : '';
  return {
    count,
    ...(exercise.perSide === true || exercise.perSide === false ? { perSide: exercise.perSide } : {}),
    targetSets,
    targetLabel: `${targetSets}×${effortLabel(exercise, shownReps)}`,
    seedReps,
    seedKg: useWeight && target?.weightKg !== undefined ? trimNum(target.weightKg) : load.seedKg,
    seedAsTotal: useWeight ? false : load.seedAsTotal,
    pieces,
    implement,
    bodyweight,
    lastNote: load.lastNote,
    comparisonHint,
    appliedWeight: useWeight,
  };
}

export function applyTemplateMeta(draft: Draft, template: PlanExercise[], sessions: Session[] = []): Draft {
  if (template.length === 0) return draft;
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => {
      const match = template.find((item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
      if (!match) return exercise;
      const planned = plannedLoad(match, sessions);
      const fresh = exercise.sets.length === 0;
      const next: ExerciseDraft = {
        ...exercise,
        count: planned.count,
        ...(planned.perSide === true || planned.perSide === false ? { perSide: planned.perSide } : { perSide: undefined }),
        targetSets: planned.targetSets,
        targetLabel: planned.targetLabel,
        seedReps: fresh ? planned.seedReps : exercise.seedReps,
        pendingReps: fresh ? planned.seedReps : exercise.pendingReps,
        comparisonHint: fresh ? planned.comparisonHint : exercise.comparisonHint,
      };
      if (fresh && planned.appliedWeight) {
        next.pendingKg = planned.seedKg;
        next.seedKg = planned.seedKg;
        next.pendingAsTotal = false;
        next.seedAsTotal = false;
        next.pieces = planned.pieces;
        next.implement = planned.implement;
        next.bodyweight = false;
      }
      return next;
    }),
  };
}

export function exercisesFromTemplate(template: PlanExercise[], sessions: Session[]): ExerciseDraft[] {
  if (template.length === 0) return [blankExercise()];
  return template.map((exercise) => {
    const planned = plannedLoad(exercise, sessions);
    return makeExercise({
      name: exercise.name,
      count: planned.count,
      perSide: planned.perSide,
      targetLabel: planned.targetLabel,
      targetSets: planned.targetSets,
      pendingReps: planned.seedReps,
      pendingKg: planned.seedKg,
      pendingAsTotal: planned.seedAsTotal,
      seedReps: planned.seedReps,
      seedKg: planned.seedKg,
      seedAsTotal: planned.seedAsTotal,
      pieces: planned.pieces,
      implement: planned.implement,
      bodyweight: planned.bodyweight,
      lastNote: planned.lastNote,
      comparisonHint: planned.comparisonHint,
    });
  });
}

export function withPieces(exercise: ExerciseDraft, pieces: LoadPieces, implement: LoadImplement): ExerciseDraft {
  return {
    ...exercise,
    pieces,
    implement: pieces === 2 ? 'dumbbell' : implement,
    bodyweight: false,
  };
}

export function exercisesToSession(exercises: ExerciseDraft[]): ExerciseEntry[] | string {
  const result: ExerciseEntry[] = [];
  for (const exercise of exercises) {
    const name = exercise.name.trim();
    if (!name) continue;
    const sets: SetEntry[] = [];
    for (const set of exercise.sets) {
      const reps = parseNum(set.reps);
      if (reps === null || reps <= 0) continue;
      const roundedReps = Math.round(reps);
      const amount = parseNum(set.kgPerPiece);
      if (exercise.bodyweight || amount === null || amount <= 0) {
        sets.push({ reps: roundedReps, weightKg: 0 });
        continue;
      }
      if (!exercise.pieces || set.asTotal) {
        const total = roundKg(amount);
        if (exercise.pieces && total > 0) {
          const per = roundKg(total / exercise.pieces);
          sets.push({ reps: roundedReps, weightKg: roundKg(per * exercise.pieces), kgPerPiece: per });
        } else {
          sets.push({ reps: roundedReps, weightKg: total });
        }
        continue;
      }
      const per = roundKg(amount);
      sets.push({ reps: roundedReps, weightKg: roundKg(per * exercise.pieces), kgPerPiece: per });
    }
    if (sets.length === 0) continue;
    const entry: ExerciseEntry = { name, sets };
    if (exercise.pieces && sets.some((set) => (set.kgPerPiece ?? 0) > 0)) {
      entry.pieces = exercise.pieces;
      entry.implement = exercise.pieces === 2 ? 'dumbbell' : exercise.implement === 'kettlebell' ? 'kettlebell' : 'dumbbell';
    }
    result.push(entry);
  }
  if (result.length === 0) return 'Log at least one set.';
  return result;
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
