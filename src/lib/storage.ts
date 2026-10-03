import type {
  Deletion,
  Deletions,
  ExerciseEntry,
  Goal,
  GoalStatus,
  PhaseChange,
  Plan,
  PlanExercise,
  PlanPhase,
  PlanSession,
  RunSplit,
  Session,
  SessionKind,
  SessionWeather,
  SetEntry,
  TrainingData,
  WorkoutPreset,
} from '../types';

const KEY = 'training-tracker:v2';
const LEGACY_KEY = 'training-tracker:v1';

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

function optionalStamp(value: unknown): string | undefined {
  const stamp = text(value);
  return stamp || undefined;
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
  const exercise: PlanExercise = {
    name,
    sets: Math.max(1, Math.round(numberOr(record.sets, 1))),
    reps: text(record.reps) || '5',
  };
  if (record.count === 'seconds') exercise.count = 'seconds';
  return exercise;
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

function isoDate(value: unknown): string {
  const date = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function normalizePhaseChange(value: unknown): PhaseChange | null {
  const record = asRecord(value);
  if (!record) return null;
  const sessionId = text(record.sessionId);
  if (!sessionId) return null;
  const change: PhaseChange = { sessionId };
  if (typeof record.notes === 'string' && record.notes.trim()) change.notes = record.notes.trim();
  if (record.durationMin === null) change.durationMin = null;
  else {
    const duration = numberOrNull(record.durationMin);
    if (duration !== null) change.durationMin = duration;
  }
  if (record.sets !== undefined && record.sets !== null) {
    const sets = Math.round(numberOr(record.sets, 0));
    if (sets > 0) change.sets = sets;
  }
  if (change.notes === undefined && change.durationMin === undefined && change.sets === undefined) return null;
  return change;
}

function normalizePhase(value: unknown): PlanPhase | null {
  const record = asRecord(value);
  if (!record) return null;
  const startDate = isoDate(record.startDate);
  const endDate = isoDate(record.endDate);
  if (!startDate || !endDate || endDate < startDate) return null;
  const sessions = Array.isArray(record.sessions)
    ? record.sessions.map(normalizePhaseChange).filter((item) => item !== null)
    : [];
  if (sessions.length === 0) return null;
  return {
    name: text(record.name),
    startDate,
    endDate,
    sessions,
  };
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
    updatedAt: optionalStamp(record.updatedAt),
  };
}

function normalizePlan(value: unknown): Plan | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  if (!name) return null;
  const endDate = isoDate(record.endDate);
  const phases = Array.isArray(record.phases)
    ? record.phases.map(normalizePhase).filter((item) => item !== null)
    : [];
  phases.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name));
  const updatedAt = optionalStamp(record.updatedAt);
  const plan: Plan = {
    id: text(record.id) || `plan-${Math.random().toString(36).slice(2, 8)}`,
    goalId: text(record.goalId),
    name,
    startDate: text(record.startDate),
    weeks: Math.min(104, Math.max(1, Math.round(numberOr(record.weeks, 8)))),
    ...(endDate ? { endDate } : {}),
    focus: focusList(record.focus),
    notes: text(record.notes),
    sessions: Array.isArray(record.sessions)
      ? record.sessions.map(normalizePlanSession).filter((item) => item !== null)
      : [],
    ...(phases.length > 0 ? { phases } : {}),
    status: status(record.status),
    ...(updatedAt ? { updatedAt } : {}),
  };
  return plan;
}

function normalizePreset(value: unknown): WorkoutPreset | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = text(record.name);
  if (!name) return null;
  const presetKind = kind(record.kind);
  return {
    id: text(record.id) || `preset-${Math.random().toString(36).slice(2, 8)}`,
    name,
    kind: presetKind,
    focus: text(record.focus),
    notes: text(record.notes),
    exercises: presetKind === 'strength' && Array.isArray(record.exercises)
      ? record.exercises.map(normalizeExercise).filter((item) => item !== null)
      : [],
    createdAt: text(record.createdAt) || new Date().toISOString(),
    updatedAt: optionalStamp(record.updatedAt),
  };
}

function clock(value: unknown): string {
  const raw = text(value);
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function positiveCount(value: unknown): number | null {
  const parsed = numberOrNull(value);
  if (parsed === null || parsed <= 0) return null;
  return Math.round(parsed);
}

function normalizeWeather(value: unknown): SessionWeather | null {
  const record = asRecord(value);
  if (!record) return null;
  const tempC = numberOrNull(record.tempC);
  const humidity = numberOrNull(record.humidityPct);
  const air = numberOrNull(record.airQuality);
  const humidityPct = humidity !== null && humidity >= 0 ? Math.round(humidity) : null;
  const airQuality = air !== null && air >= 0 ? Math.round(air) : null;
  if (tempC === null && humidityPct === null && airQuality === null) return null;
  return { tempC, humidityPct, airQuality };
}

function normalizeSplit(value: unknown, index: number): RunSplit | null {
  const record = asRecord(value);
  if (!record) return null;
  const time = numberOrNull(record.timeSec);
  const pace = positiveCount(record.paceSec);
  const heart = positiveCount(record.heartRate);
  const timeSec = time !== null && time >= 0 ? Math.round(time) : null;
  if (timeSec === null && pace === null && heart === null) return null;
  const km = positiveCount(record.km);
  return {
    km: km ?? index + 1,
    timeSec: timeSec ?? 0,
    paceSec: pace,
    heartRate: heart,
  };
}

function normalizeSession(value: unknown): Session | null {
  const record = asRecord(value);
  if (!record) return null;
  const date = text(record.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const sessionKind = kind(record.kind);
  const effort = numberOrNull(record.effort);
  const splits = Array.isArray(record.splits)
    ? record.splits.map(normalizeSplit).filter((item) => item !== null)
    : [];
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
    paceSec: positiveCount(record.paceSec),
    heartRate: positiveCount(record.heartRate),
    activeKcal: positiveCount(record.activeKcal),
    totalKcal: positiveCount(record.totalKcal),
    cadenceSpm: positiveCount(record.cadenceSpm),
    powerW: positiveCount(record.powerW),
    place: text(record.place),
    source: text(record.source),
    activity: text(record.activity),
    startTime: clock(record.startTime),
    endTime: clock(record.endTime),
    weather: normalizeWeather(record.weather),
    splits,
    createdAt: text(record.createdAt) || new Date().toISOString(),
    updatedAt: optionalStamp(record.updatedAt),
  };
}

function normalizeDeletion(value: unknown): Deletion | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = text(record.id);
  const at = text(record.at);
  if (!id || !at) return null;
  return { id, at };
}

function deletionList(value: unknown): Deletion[] {
  if (!Array.isArray(value)) return [];
  const map = new Map<string, Deletion>();
  for (const item of value) {
    const deletion = normalizeDeletion(item);
    if (!deletion) continue;
    const previous = map.get(deletion.id);
    if (!previous || deletion.at > previous.at) map.set(deletion.id, deletion);
  }
  return [...map.values()];
}

export function emptyDeletions(): Deletions {
  return { goals: [], plans: [], presets: [], sessions: [] };
}

function normalizeDeletions(value: unknown): Deletions {
  const record = asRecord(value);
  if (!record) return emptyDeletions();
  return {
    goals: deletionList(record.goals),
    plans: deletionList(record.plans),
    presets: deletionList(record.presets),
    sessions: deletionList(record.sessions),
  };
}

function entityStamp(item: { updatedAt?: string; createdAt?: string }): string {
  return item.updatedAt || item.createdAt || '';
}

function withoutDeleted<T extends { id: string; updatedAt?: string; createdAt?: string }>(items: T[], deletions: Deletion[]): T[] {
  const tombstones = new Map(deletions.map((item) => [item.id, item.at]));
  return items.filter((item) => {
    const at = tombstones.get(item.id);
    return !at || entityStamp(item) > at;
  });
}

export function emptyData(): TrainingData {
  return { version: 1, goals: [], plans: [], presets: [], sessions: [], deleted: emptyDeletions() };
}

export function normalize(input: unknown): TrainingData {
  const record = asRecord(input);
  if (!record) throw new Error('The file needs to be a JSON object.');
  if (record.goals !== undefined && !Array.isArray(record.goals)) throw new Error('Goals need to be an array.');
  if (record.plans !== undefined && !Array.isArray(record.plans)) throw new Error('Plans need to be an array.');
  if (record.sessions !== undefined && !Array.isArray(record.sessions)) throw new Error('Sessions need to be an array.');
  if (!Array.isArray(record.goals) && !Array.isArray(record.plans) && !Array.isArray(record.sessions)) {
    throw new Error('The file needs goals, plans, and sessions arrays.');
  }
  const deleted = normalizeDeletions(record.deleted);
  const goals = withoutDeleted(
    (Array.isArray(record.goals) ? record.goals : []).map(normalizeGoal).filter((item) => item !== null),
    deleted.goals,
  );
  const plans = withoutDeleted(
    (Array.isArray(record.plans) ? record.plans : []).map(normalizePlan).filter((item) => item !== null),
    deleted.plans,
  );
  const presets = withoutDeleted(
    (Array.isArray(record.presets) ? record.presets : []).map(normalizePreset).filter((item) => item !== null),
    deleted.presets,
  );
  const sessions = withoutDeleted(
    (Array.isArray(record.sessions) ? record.sessions : []).map(normalizeSession).filter((item) => item !== null),
    deleted.sessions,
  );
  goals.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  plans.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id));
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return { version: 1, goals, plans, presets, sessions, deleted };
}

export function serialize(data: TrainingData): string {
  return `${JSON.stringify(normalize(data), null, 2)}\n`;
}

function rememberDeletion(list: Deletion[], id: string, at: string): Deletion[] {
  return [...list.filter((item) => item.id !== id), { id, at }];
}

export function removeGoal(data: TrainingData, goalId: string): TrainingData {
  const at = new Date().toISOString();
  const plans = data.plans.filter((plan) => plan.goalId === goalId);
  return {
    ...data,
    goals: data.goals.filter((goal) => goal.id !== goalId),
    plans: data.plans.filter((plan) => plan.goalId !== goalId),
    deleted: {
      ...data.deleted,
      goals: rememberDeletion(data.deleted.goals, goalId, at),
      plans: plans.reduce((list, plan) => rememberDeletion(list, plan.id, at), data.deleted.plans),
    },
  };
}

export function removePlan(data: TrainingData, planId: string): TrainingData {
  const at = new Date().toISOString();
  return {
    ...data,
    plans: data.plans.filter((plan) => plan.id !== planId),
    deleted: { ...data.deleted, plans: rememberDeletion(data.deleted.plans, planId, at) },
  };
}

export function removeSession(data: TrainingData, sessionId: string): TrainingData {
  const at = new Date().toISOString();
  return {
    ...data,
    sessions: data.sessions.filter((session) => session.id !== sessionId),
    deleted: { ...data.deleted, sessions: rememberDeletion(data.deleted.sessions, sessionId, at) },
  };
}

export function loadLocal(): TrainingData | null {
  try {
    localStorage.removeItem(LEGACY_KEY);
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
