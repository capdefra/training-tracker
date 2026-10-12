import { isRealISODate } from './dates';
import { COMPLETION_KEYS, keepUnknown } from './unknown';
import type { Plan, PlanCompletion, PlanSession } from '../types';

/**
 * Drops malformed entries. The same session and date keep the latest `updatedAt`.
 * An equal stamp keeps the later entry. `date` is the day the card shows.
 */
export function normalizeCompletions(value: unknown, sessions: PlanSession[]): PlanCompletion[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(sessions.map((session) => session.id));
  const winners = new Map<string, PlanCompletion>();
  for (const item of value) {
    const completion = readCompletion(item, known);
    if (!completion) continue;
    const key = `${completion.sessionId}\0${completion.date}`;
    const previous = winners.get(key);
    if (!previous || stamp(completion) >= stamp(previous)) winners.set(key, completion);
  }
  return [...winners.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
  );
}

/** The override for this card, if the planner or the site stored one. */
export function completionFor(plan: Plan, sessionId: string, date: string): PlanCompletion | null {
  let best: PlanCompletion | null = null;
  for (const item of plan.completions ?? []) {
    if (item.sessionId !== sessionId || item.date !== date) continue;
    if (!best || stamp(item) >= stamp(best)) best = item;
  }
  return best;
}

/**
 * Store `done` when it differs from the set-count result. Remove the entry when it matches,
 * so a later log can move the card again. Unknown fields already on that entry stay.
 */
export function planWithSessionDone(plan: Plan, sessionId: string, date: string, done: boolean, automatic: boolean, updatedAt: string): Plan {
  const existing = completionFor(plan, sessionId, date);
  const rest = (plan.completions ?? []).filter((item) => item.sessionId !== sessionId || item.date !== date);
  const next: Plan = { ...plan, updatedAt };
  if (done === automatic) {
    if (rest.length > 0) next.completions = rest;
    else delete next.completions;
    return next;
  }
  const fresh: PlanCompletion = { sessionId, date, done, updatedAt };
  const entry = existing ? keepUnknown(fresh, existing, COMPLETION_KEYS) : fresh;
  const completions = normalizeCompletions([...rest, entry], plan.sessions);
  if (completions.length > 0) next.completions = completions;
  else delete next.completions;
  return next;
}

function stamp(completion: PlanCompletion): string {
  return completion.updatedAt ?? '';
}

function readCompletion(value: unknown, sessions: Set<string>): PlanCompletion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId.trim() : '';
  const date = typeof record.date === 'string' ? record.date.trim() : '';
  if (!sessionId || !sessions.has(sessionId) || !isRealISODate(date) || typeof record.done !== 'boolean') return null;
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt.trim() : '';
  const completion: PlanCompletion = updatedAt ? { sessionId, date, done: record.done, updatedAt } : { sessionId, date, done: record.done };
  return keepUnknown(completion, record, COMPLETION_KEYS);
}
