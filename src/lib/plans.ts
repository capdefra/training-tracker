import type { LogPreset, Plan, PlanPhase, PlanSession, Session, TrainingData, WorkoutPreset } from '../types';
import { addDays, formatPretty, startOfWeek, weekdayIndex } from './dates';

/** Weeks shown on the activity tab, ending with the week that contains today. */
export const ACTIVITY_WEEKS = 16;
import { exerciseTargets, runPrescription, sessionTargetsMet, type ExerciseTarget } from './targets';

export interface PlanItem {
  date: string;
  plan: Plan;
  phase: PlanPhase | null;
  session: PlanSession;
  logs: Session[];
  logged: Session | null;
  targets: ExerciseTarget[];
  done: boolean;
}

export function planLastDay(plan: Plan): string {
  if (plan.endDate) return plan.endDate;
  if (!plan.startDate) return '';
  return addDays(plan.startDate, Math.max(plan.weeks, 1) * 7 - 1);
}

export function planCovers(plan: Plan, date: string): boolean {
  if (plan.status !== 'active' || !plan.startDate) return false;
  const last = planLastDay(plan);
  return date >= plan.startDate && date <= last;
}

/** The phase whose window contains the date. A later start wins if two windows overlap. */
export function phaseOn(plan: Plan, date: string): PlanPhase | null {
  let match: PlanPhase | null = null;
  for (const phase of plan.phases ?? []) {
    if (date < phase.startDate || date > phase.endDate) continue;
    if (!match || phase.startDate >= match.startDate) match = phase;
  }
  return match;
}

/** The repeating session, with this date's phase applied. */
export function sessionForDate(plan: Plan, session: PlanSession, date: string): PlanSession {
  const phase = phaseOn(plan, date);
  if (!phase) return session;
  const change = phase.sessions.find((item) => item.sessionId === session.id);
  if (!change) return session;
  const sets = change.sets;
  return {
    ...session,
    notes: change.notes ?? session.notes,
    durationMin: change.durationMin === undefined ? session.durationMin : change.durationMin,
    exercises: sets === undefined ? session.exercises : session.exercises.map((exercise) => ({ ...exercise, sets })),
  };
}

export function describePhase(plan: Plan, phase: PlanPhase): string {
  const parts: string[] = [];
  for (const change of phase.sessions) {
    const session = plan.sessions.find((item) => item.id === change.sessionId);
    const title = session?.title ?? 'Session';
    if (change.notes) parts.push(`${title}: ${change.notes}`);
    else if (change.sets) parts.push(`${title}: ${change.sets} sets`);
  }
  return parts.join('. ');
}

export function activeGoal(data: TrainingData) {
  const active = data.goals.filter((goal) => goal.status === 'active');
  const pool = active.length > 0 ? active : data.goals;
  return [...pool].sort((a, b) => a.targetDate.localeCompare(b.targetDate) || a.createdAt.localeCompare(b.createdAt))[0] ?? null;
}

export function planItemsForWeek(data: TrainingData, plans: Plan[], anchor: string): PlanItem[] {
  const monday = startOfWeek(anchor);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const weekStart = dates[0] ?? monday;
  const weekEnd = dates[6] ?? monday;
  const weekSessions = data.sessions.filter((session) => session.date >= weekStart && session.date <= weekEnd);
  const items: PlanItem[] = [];
  for (const date of dates) {
    const day = weekdayIndex(date);
    for (const plan of plans) {
      if (!planCovers(plan, date)) continue;
      for (const session of plan.sessions) {
        if (session.dayOfWeek !== day) continue;
        const resolved = sessionForDate(plan, session, date);
        const logs = weekSessions.filter((entry) => entry.planSessionId === session.id);
        const targets = exerciseTargets(resolved, logs);
        const sameDay = logs.find((entry) => entry.date === date);
        items.push({
          date,
          plan,
          phase: phaseOn(plan, date),
          session: resolved,
          logs,
          logged: sameDay ?? logs[0] ?? null,
          targets,
          done: sessionTargetsMet(resolved, logs),
        });
      }
    }
  }
  return items;
}

/**
 * Sessions logged on `date` that are not already represented by a plan card that day.
 * A log fulfills the plan card when it is linked to that plan session, so it is not shown twice.
 */
export function extraLogsForDay(sessions: Session[], planned: PlanItem[], date: string): Session[] {
  const claimed = new Set<string>();
  for (const item of planned) {
    if (item.date !== date) continue;
    for (const log of item.logs) {
      if (log.date === date) claimed.add(log.id);
    }
  }
  return sessions
    .filter((session) => session.date === date && !claimed.has(session.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function weekSentence(items: PlanItem[], today: string): string {
  if (items.length === 0) return 'Nothing from a plan is scheduled this week.';
  const done = items.filter((item) => item.done).length;
  const open = items.filter((item) => !item.done);
  if (open.length === 0) return `All ${items.length} sessions done this week.`;
  const next = open.find((item) => item.date >= today) ?? open[0];
  if (!next) return `${done} of ${items.length} done.`;
  const when = next.date === today ? 'today' : next.date < today ? `still open from ${formatPretty(next.date)}` : `up on ${formatPretty(next.date)}`;
  return `${done} of ${items.length} done. Next is ${next.session.title}, ${when}.`;
}

/** Mondays from the current week backward. Index 0 is the week that contains today. */
export function activityMondays(today: string, weeks = ACTIVITY_WEEKS): string[] {
  const end = startOfWeek(today);
  return Array.from({ length: weeks }, (_, index) => addDays(end, -7 * index));
}

export type DayProgress = 'empty' | 'planned' | 'partial' | 'done';

/** Progress of one day: nothing, planned and untouched, partly done, or done. An unplanned log still counts. */
export function dayProgress(planned: PlanItem[], extras: Session[]): DayProgress {
  if (planned.length === 0) return extras.length > 0 ? 'done' : 'empty';
  const finished = planned.filter((item) => item.done).length;
  const started = planned.some((item) => !item.done && item.logs.length > 0);
  if (finished === planned.length) return 'done';
  if (finished > 0 || started || extras.length > 0) return 'partial';
  return 'planned';
}

export function recentSessions(data: TrainingData, limit = 6): Session[] {
  return [...data.sessions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function logFromPreset(preset: WorkoutPreset, data: TrainingData, date: string): LogPreset {
  const match = matchPresetToWeek(data, preset, date);
  const when = match ? (match.date === date ? 'today' : formatPretty(match.date)) : '';
  return {
    date,
    kind: preset.kind,
    title: preset.name,
    goalId: match?.plan.goalId ?? activeGoal(data)?.id ?? null,
    planId: match?.plan.id ?? null,
    planSessionId: match?.session.id ?? null,
    templateExercises: match ? match.session.exercises : preset.exercises,
    distanceKm: null,
    durationMin: match?.session.kind === 'run' ? match.session.durationMin : null,
    prompt: match
      ? `Preset · ${preset.name} · counts for ${when}${match.session.kind === 'run' && match.session.notes ? ` · ${runPrescription(match.session)}` : ''}`
      : preset.kind === 'run'
        ? `Preset · ${preset.name} · doing the run is the target`
        : `Preset · ${preset.name} · target is sets and reps`,
  };
}

function matchPresetToWeek(data: TrainingData, preset: WorkoutPreset, date: string): PlanItem | null {
  const items = planItemsForWeek(data, data.plans, date).filter((item) => {
    if (item.session.kind !== preset.kind) return false;
    return item.session.title.trim().toLowerCase() === preset.name.trim().toLowerCase();
  });
  return items.find((item) => !item.done) ?? items[0] ?? null;
}

export function buildPreset(plan: Plan, session: Plan['sessions'][number], scheduled: string, today: string): LogPreset {
  const date = scheduled < today ? today : scheduled;
  const when = scheduled === today ? 'today' : formatPretty(scheduled);
  return {
    date,
    kind: session.kind,
    title: session.title,
    goalId: plan.goalId,
    planId: plan.id,
    planSessionId: session.id,
    templateExercises: session.exercises,
    distanceKm: session.distanceKm,
    durationMin: session.durationMin,
    prompt:
      session.kind === 'run'
        ? `From the plan · ${session.title} · ${when} · ${runPrescription(session)} · doing the run is enough`
        : `From the plan · ${session.title} · ${when} · target is sets and reps`,
  };
}

export function findPlanSession(data: TrainingData, planSessionId: string, date?: string) {
  for (const plan of data.plans) {
    const session = plan.sessions.find((item) => item.id === planSessionId);
    if (session) return { plan, session: date ? sessionForDate(plan, session, date) : session };
  }
  return null;
}

export interface PlanChoice {
  id: string;
  label: string;
  plan: Plan;
  session: Plan['sessions'][number];
}

export function planChoices(data: TrainingData, date: string, currentId: string | null): PlanChoice[] {
  const monday = startOfWeek(date);
  const choices: PlanChoice[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < 7; index += 1) {
    const day = addDays(monday, index);
    const weekday = weekdayIndex(day);
    for (const plan of data.plans) {
      if (plan.status !== 'active' || !planCovers(plan, day)) continue;
      for (const session of plan.sessions) {
        if (session.dayOfWeek !== weekday || seen.has(session.id)) continue;
        seen.add(session.id);
        const resolved = sessionForDate(plan, session, day);
        choices.push({
          id: session.id,
          label: `${formatPretty(day)} · ${resolved.title}`,
          plan,
          session: resolved,
        });
      }
    }
  }
  if (currentId && !seen.has(currentId)) {
    const found = findPlanSession(data, currentId, date);
    if (found) {
      choices.push({
        id: found.session.id,
        label: `${found.session.title} (linked)`,
        plan: found.plan,
        session: found.session,
      });
    }
  }
  return choices;
}
