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
  status: GoalStatus;
  updatedAt?: string;
}

export interface SetEntry {
  reps: number;
  weightKg: number;
}

export interface ExerciseEntry {
  name: string;
  sets: SetEntry[];
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
  effort: number | null;
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
