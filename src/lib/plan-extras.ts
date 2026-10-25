import type { PlanExtra, PlanSession, WorkoutPreset } from '../types';
import { isRealISODate, weekdayIndex } from './dates';
import { EXTRA_KEYS, keepUnknown } from './unknown';

/** Stable id for a dated extra. It never collides with a repeating `ps-*` session. */
export function extraSessionId(presetId: string): string {
  return `extra:${presetId}`;
}

/**
 * The preset as a one-day plan session.
 * Phase targets are not applied: the preset is used as written.
 */
export function sessionFromPreset(preset: WorkoutPreset, date: string): PlanSession {
  return {
    id: extraSessionId(preset.id),
    dayOfWeek: weekdayIndex(date),
    kind: preset.kind,
    title: preset.name,
    focus: preset.focus,
    notes: preset.notes,
    exercises: preset.exercises,
    distanceKm: null,
    durationMin: null,
  };
}

/**
 * Drops malformed extras. The same preset and date keep the latest `updatedAt`.
 * An equal stamp keeps the later entry. An unknown preset id is kept:
 * the card is skipped later, when the preset cannot be found.
 */
export function normalizeExtras(value: unknown): PlanExtra[] {
  if (!Array.isArray(value)) return [];
  const winners = new Map<string, PlanExtra>();
  for (const item of value) {
    const extra = readExtra(item);
    if (!extra) continue;
    const key = `${extra.presetId}\0${extra.date}`;
    const previous = winners.get(key);
    if (!previous || stamp(extra) >= stamp(previous)) winners.set(key, extra);
  }
  return [...winners.values()].sort((a, b) => a.date.localeCompare(b.date) || a.presetId.localeCompare(b.presetId));
}

function stamp(extra: PlanExtra): string {
  return extra.updatedAt ?? '';
}

function readExtra(value: unknown): PlanExtra | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const presetId = typeof record.presetId === 'string' ? record.presetId.trim() : '';
  const date = typeof record.date === 'string' ? record.date.trim() : '';
  if (!presetId || !isRealISODate(date)) return null;
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt.trim() : '';
  const extra: PlanExtra = updatedAt ? { presetId, date, updatedAt } : { presetId, date };
  return keepUnknown(extra, record, EXTRA_KEYS);
}
