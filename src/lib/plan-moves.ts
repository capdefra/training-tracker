import { isRealISODate, weekdayIndex } from './dates';
import type { PlanMove, PlanSession } from '../types';

/**
 * Drops malformed moves. The same session and `fromDate` keep the latest `updatedAt`.
 * An equal stamp keeps the later entry. This does not check whether the plan covers the date.
 */
export function normalizeMoves(value: unknown, sessions: PlanSession[]): PlanMove[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map(sessions.map((session) => [session.id, session]));
  const winners = new Map<string, PlanMove>();
  for (const item of value) {
    const move = readMove(item, byId);
    if (!move) continue;
    const key = `${move.sessionId}\0${move.fromDate}`;
    const previous = winners.get(key);
    if (!previous || stamp(move) >= stamp(previous)) winners.set(key, move);
  }
  return [...winners.values()].sort(
    (a, b) => a.fromDate.localeCompare(b.fromDate) || a.sessionId.localeCompare(b.sessionId) || a.toDate.localeCompare(b.toDate),
  );
}

function stamp(move: PlanMove): string {
  return move.updatedAt ?? '';
}

function readMove(value: unknown, sessions: Map<string, PlanSession>): PlanMove | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sessionId = typeof record.sessionId === 'string' ? record.sessionId.trim() : '';
  const fromDate = typeof record.fromDate === 'string' ? record.fromDate.trim() : '';
  const toDate = typeof record.toDate === 'string' ? record.toDate.trim() : '';
  if (!sessionId || !isRealISODate(fromDate) || !isRealISODate(toDate) || fromDate === toDate) return null;
  const session = sessions.get(sessionId);
  if (!session || weekdayIndex(fromDate) !== session.dayOfWeek) return null;
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt.trim() : '';
  return updatedAt ? { sessionId, fromDate, toDate, updatedAt } : { sessionId, fromDate, toDate };
}
