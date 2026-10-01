import type { LogPreset, Plan, Session, TrainingData } from '../types';
import { addDays, formatPretty, startOfWeek, weekdayIndex } from './dates';

export interface PlanItem {
  date: string;
  plan: Plan;
  session: Plan['sessions'][number];
  done: boolean;
  logged: Session | null;
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
        const logged = weekSessions.find((entry) => entry.planSessionId === session.id) ?? null;
        items.push({ date, plan, session, done: logged !== null, logged });
      }
    }
  }
  return items;
}

export function weekSentence(items: PlanItem[], today: string): string {
  if (items.length === 0) return 'Nothing from a plan is scheduled this week.';
  const done = items.filter((item) => item.done).length;
  const open = items.filter((item) => !item.done);
  if (open.length === 0) return `All ${items.length} sessions logged this week.`;
  const next = open.find((item) => item.date >= today) ?? open[0];
  if (!next) return `${done} of ${items.length} logged.`;
  const when = next.date === today ? 'today' : next.date < today ? `still open from ${formatPretty(next.date)}` : `up on ${formatPretty(next.date)}`;
  return `${done} of ${items.length} logged. Next is ${next.session.title}, ${when}.`;
}

export function recentSessions(data: TrainingData, limit = 6): Session[] {
  return [...data.sessions]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
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
    prompt: `From the plan · ${session.title} · ${when}`,
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
