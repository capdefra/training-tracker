import type { LogPreset, Plan, Session, TrainingData, WorkoutPreset } from '../types';
import { addDays, formatPretty, startOfWeek, weekdayIndex } from './dates';
import { exerciseTargets, sessionTargetsMet, type ExerciseTarget } from './targets';

export interface PlanItem {
  date: string;
  plan: Plan;
  session: Plan['sessions'][number];
  logs: Session[];
  logged: Session | null;
  targets: ExerciseTarget[];
  done: boolean;
}

export function planCovers(plan: Plan, date: string): boolean {
  if (plan.status !== 'active' || !plan.startDate) return false;
  const end = addDays(plan.startDate, plan.weeks * 7);
  return date >= plan.startDate && date < end;
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
        const logs = weekSessions.filter((entry) => entry.planSessionId === session.id);
        const targets = exerciseTargets(session, logs);
        items.push({
          date,
          plan,
          session,
          logs,
          logged: logs[0] ?? null,
          targets,
          done: sessionTargetsMet(session, logs),
        });
      }
    }
  }
  return items;
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
    templateExercises: preset.exercises,
    distanceKm: null,
    durationMin: null,
    prompt: match
      ? `Preset · ${preset.name} · counts for ${when}`
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
        ? `From the plan · ${session.title} · ${when} · doing the run is enough`
        : `From the plan · ${session.title} · ${when} · target is sets and reps`,
  };
}

export function findPlanSession(data: TrainingData, planSessionId: string) {
  for (const plan of data.plans) {
    const session = plan.sessions.find((item) => item.id === planSessionId);
    if (session) return { plan, session };
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
        choices.push({
          id: session.id,
          label: `${formatPretty(day)} · ${session.title}`,
          plan,
          session,
        });
      }
    }
  }
  if (currentId && !seen.has(currentId)) {
    const found = findPlanSession(data, currentId);
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
