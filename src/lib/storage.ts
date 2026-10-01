import type {
  ExerciseEntry,
  Goal,
  GoalStatus,
  Plan,
  PlanExercise,
  PlanSession,
  Session,
  SessionKind,
  SetEntry,
  TrainingData,
} from '../types';

const KEY = 'training-tracker:v1';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numberOr(value: unknown, fallback: number): number {
  return numberOrNull(value) ?? fallback;
}

function status(value: unknown): GoalStatus {
  return value === 'paused' || value === 'done' || value === 'active' ? value : 'active';
}

function kind(value: unknown): SessionKind {
  return value === 'run' ? 'run' : 'strength';
}

function focusList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const label = text(item);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }
  return result;
}

function normalizeExercise(value: unknown): PlanExercise | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  if (!name) return null;
  return {
    name,
    sets: Math.max(1, Math.round(numberOr(record.sets, 1))),
    reps: text(record.reps) || '5',
  };
}

function normalizeSet(value: unknown): SetEntry | null {
  const record = asRecord(value);
  if (!record) return null;
  const reps = numberOrNull(record.reps);
  if (reps === null || reps <= 0) return null;
  return {
    reps: Math.round(reps),
    weightKg: Math.max(0, numberOr(record.weightKg, 0)),
  };
}

function normalizeLoggedExercise(value: unknown): ExerciseEntry | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  const sets = Array.isArray(record.sets) ? record.sets.map(normalizeSet).filter((set) => set !== null) : [];
  if (!name || sets.length === 0) return null;
  return { name, sets };
}

function normalizePlanSession(value: unknown): PlanSession | null {
  const record = asRecord(value);
  if (!record) return null;
  const day = Math.round(numberOr(record.dayOfWeek, 1));
  return {
    id: text(record.id) || `ps-${Math.random().toString(36).slice(2, 8)}`,
    dayOfWeek: ((day % 7) + 7) % 7,
    kind: kind(record.kind),
    title: text(record.title) || 'Session',
    focus: text(record.focus),
    notes: text(record.notes),
    exercises: Array.isArray(record.exercises)
      ? record.exercises.map(normalizeExercise).filter((item) => item !== null)
      : [],
    distanceKm: numberOrNull(record.distanceKm),
    durationMin: numberOrNull(record.durationMin),
  };
}

function normalizeGoal(value: unknown): Goal | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  if (!name) return null;
  return {
    id: text(record.id) || `goal-${Math.random().toString(36).slice(2, 8)}`,
    name,
    targetDate: text(record.targetDate),
    focus: focusList(record.focus),
    notes: text(record.notes),
    status: status(record.status),
    createdAt: text(record.createdAt) || new Date().toISOString(),
  };
}

function normalizePlan(value: unknown): Plan | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  if (!name) return null;
  return {
    id: text(record.id) || `plan-${Math.random().toString(36).slice(2, 8)}`,
    goalId: text(record.goalId),
    name,
    startDate: text(record.startDate),
    weeks: Math.min(104, Math.max(1, Math.round(numberOr(record.weeks, 8)))),
    focus: focusList(record.focus),
    notes: text(record.notes),
    sessions: Array.isArray(record.sessions)
      ? record.sessions.map(normalizePlanSession).filter((item) => item !== null)
      : [],
    status: status(record.status),
  };
}

function normalizeSession(value: unknown): Session | null {
  const record = asRecord(value);
  if (!record) return null;
  const date = text(record.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const sessionKind = kind(record.kind);
  const effort = numberOrNull(record.effort);
  return {
    id: text(record.id) || `log-${Math.random().toString(36).slice(2, 8)}`,
    date,
    kind: sessionKind,
    title: text(record.title) || (sessionKind === 'run' ? 'Run' : 'Strength'),
    notes: text(record.notes),
    goalId: text(record.goalId) || null,
    planId: text(record.planId) || null,
    planSessionId: text(record.planSessionId) || null,
    exercises: Array.isArray(record.exercises)
      ? record.exercises.map(normalizeLoggedExercise).filter((item) => item !== null)
      : [],
    distanceKm: numberOrNull(record.distanceKm),
    durationSec: numberOrNull(record.durationSec),
    elevationM: numberOrNull(record.elevationM),
    effort: effort !== null ? Math.min(10, Math.max(1, Math.round(effort))) : null,
    createdAt: text(record.createdAt) || new Date().toISOString(),
  };
}

export function emptyData(): TrainingData {
  return { version: 1, goals: [], plans: [], sessions: [] };
}

export function normalize(input: unknown): TrainingData {
  const record = asRecord(input);
  if (!record) throw new Error('The file needs to be a JSON object.');
  if (!Array.isArray(record.goals) || !Array.isArray(record.plans) || !Array.isArray(record.sessions)) {
    throw new Error('The file needs goals, plans, and sessions arrays.');
  }
  const goals = record.goals.map(normalizeGoal).filter((item) => item !== null);
  const plans = record.plans.map(normalizePlan).filter((item) => item !== null);
  const sessions = record.sessions.map(normalizeSession).filter((item) => item !== null);
  goals.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  plans.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { version: 1, goals, plans, sessions };
}

export function serialize(data: TrainingData): string {
  return `${JSON.stringify(normalize(data), null, 2)}\n`;
}

export function loadLocal(): TrainingData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(data: TrainingData): void {
  localStorage.setItem(KEY, serialize(data));
}

export function clearLocal(): void {
  localStorage.removeItem(KEY);
}

export function hasLocal(): boolean {
  return localStorage.getItem(KEY) !== null;
}

export async function loadRepo(): Promise<TrainingData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/training.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not read data/training.json (${response.status}).`);
  return normalize(await response.json());
}

export function downloadData(data: TrainingData): void {
  const blob = new Blob([serialize(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'training.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
