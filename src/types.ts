export type SessionKind = 'strength' | 'run';
export type GoalStatus = 'active' | 'paused' | 'done';
export type EffortCount = 'reps' | 'seconds';

export interface Goal {
  id: string;
  name: string;
  targetDate: string;
  focus: string[];
  notes: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface PlanExercise {
  name: string;
  sets: number;
  reps: string;
  /** Seconds are held, not repeated. Side plank uses this. */
  count?: EffortCount;
}

export interface PlanSession {
  id: string;
  dayOfWeek: number;
  kind: SessionKind;
  title: string;
  focus: string;
  notes: string;
  exercises: PlanExercise[];
  distanceKm: number | null;
  durationMin: number | null;
}

/**
 * A change to one repeating session while a phase is in effect.
 * Omitted fields stay as written on the week. `sets` replaces every exercise's set count.
 */
export interface PhaseChange {
  sessionId: string;
  notes?: string;
  durationMin?: number | null;
  sets?: number;
}

/** Inclusive dates. The week still repeats; a phase only replaces the fields it lists. */
export interface PlanPhase {
  name: string;
  startDate: string;
  endDate: string;
  sessions: PhaseChange[];
}

/**
 * One occurrence of a repeating session, shown on `toDate` instead of `fromDate`.
 * Dates are `YYYY-MM-DD`. The planner writes a move for every session that shifts.
 */
export interface PlanMove {
  sessionId: string;
  fromDate: string;
  toDate: string;
  updatedAt?: string;
}

export interface Plan {
  id: string;
  goalId: string;
  name: string;
  startDate: string;
  /** Length label. Coverage uses `endDate` when that is set, otherwise this many weeks. */
  weeks: number;
  endDate?: string;
  focus: string[];
  notes: string;
  sessions: PlanSession[];
  phases?: PlanPhase[];
  /** One-off date changes. Absent means the repeating week is unchanged. */
  moves?: PlanMove[];
  status: GoalStatus;
  updatedAt?: string;
}

/** One dumbbell or kettlebell, or a pair of dumbbells. Two pieces are always dumbbells. */
export type LoadPieces = 1 | 2;
export type LoadImplement = 'dumbbell' | 'kettlebell';

export interface SetEntry {
  reps: number;
  /**
   * Total kilograms for the set. Older sessions stored only this number.
   * When `kgPerPiece` is set, this is `kgPerPiece × pieces`.
   */
  weightKg: number;
  /** Kilograms printed on one dumbbell or kettlebell. Omitted when the set only has a total. */
  kgPerPiece?: number;
}

/** One kilometre from a watch split. Time and pace are both stored because the last split can be short of a full kilometre. */
export interface RunSplit {
  km: number;
  /** Split time in seconds. */
  timeSec: number;
  /** Pace in seconds per kilometre. */
  paceSec: number | null;
  /** Average heart rate for the split, bpm. */
  heartRate: number | null;
}

/** Weather line from a watch workout summary. Missing parts stay null. */
export interface SessionWeather {
  tempC: number | null;
  humidityPct: number | null;
  /** The number the watch shows beside air quality. */
  airQuality: number | null;
}

export interface ExerciseEntry {
  name: string;
  sets: SetEntry[];
  /**
   * 1 = one dumbbell or kettlebell. 2 = a pair of dumbbells.
   * Omitted on older exercises that only stored a total kilogram number.
   */
  pieces?: LoadPieces;
  /** Set with `pieces`. Two pieces are always dumbbells. */
  implement?: LoadImplement;
}

export interface Session {
  id: string;
  date: string;
  kind: SessionKind;
  title: string;
  notes: string;
  goalId: string | null;
  planId: string | null;
  planSessionId: string | null;
  exercises: ExerciseEntry[];
  distanceKm: number | null;
  durationSec: number | null;
  elevationM: number | null;
  /** 1–10. Apple labels 1–3 easy, 4–6 moderate, 7–8 hard, 9–10 all out. */
  effort: number | null;
  /** Average pace in seconds per kilometre, when the watch reports one. */
  paceSec: number | null;
  /** Average heart rate, bpm. */
  heartRate: number | null;
  activeKcal: number | null;
  totalKcal: number | null;
  /** Steps per minute. */
  cadenceSpm: number | null;
  /** Average power, watts. */
  powerW: number | null;
  /** Where the watch placed the workout, such as a city. */
  place: string;
  /** Device that recorded it, such as Apple Watch. */
  source: string;
  /** Watch activity name, such as Outdoor run. The title can stay the plan name. */
  activity: string;
  /** Local start, HH:MM. */
  startTime: string;
  /** Local finish, HH:MM. */
  endTime: string;
  weather: SessionWeather | null;
  splits: RunSplit[];
  createdAt: string;
  updatedAt?: string;
}

/** A reusable workout. Strength targets are sets and reps. A run is done by doing it. */
export interface WorkoutPreset {
  id: string;
  name: string;
  kind: SessionKind;
  focus: string;
  notes: string;
  exercises: PlanExercise[];
  createdAt: string;
  updatedAt?: string;
}

export interface Deletion {
  id: string;
  at: string;
}

export interface Deletions {
  goals: Deletion[];
  plans: Deletion[];
  presets: Deletion[];
  sessions: Deletion[];
}

export interface TrainingData {
  version: 1;
  goals: Goal[];
  plans: Plan[];
  presets: WorkoutPreset[];
  sessions: Session[];
  deleted: Deletions;
}

export interface LogPreset {
  date: string;
  kind: SessionKind;
  title: string;
  goalId: string | null;
  planId: string | null;
  planSessionId: string | null;
  templateExercises: PlanExercise[];
  distanceKm: number | null;
  durationMin: number | null;
  prompt: string;
}
