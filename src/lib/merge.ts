import type { Deletion, Deletions, TrainingData } from '../types';
import { emptyDeletions, normalize } from './storage';
import { DELETION_KEYS, DELETIONS_KEYS, ROOT_KEYS, absorbGoal, absorbPlan, absorbPreset, absorbSession, keepUnknown } from './unknown';

function stampOf(item: { updatedAt?: string; createdAt?: string; startDate?: string }): string {
  return item.updatedAt || item.createdAt || item.startDate || '';
}

function newer<T extends { id: string; updatedAt?: string; createdAt?: string; startDate?: string }>(a: T, b: T): T {
  const left = stampOf(a);
  const right = stampOf(b);
  if (left !== right) return left > right ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeEntities<T extends { id: string; updatedAt?: string; createdAt?: string; startDate?: string }>(
  a: T[],
  b: T[],
  absorb: (winner: T, loser: T) => T,
): T[] {
  const map = new Map<string, T>();
  const order: string[] = [];
  for (const item of [...a, ...b]) {
    const previous = map.get(item.id);
    if (!previous) {
      order.push(item.id);
      map.set(item.id, item);
    } else {
      const winner = newer(previous, item);
      const loser = winner === previous ? item : previous;
      map.set(item.id, absorb(winner, loser));
    }
  }
  return order.map((id) => map.get(id) as T);
}

function mergeDeletionList(a: Deletion[], b: Deletion[]): Deletion[] {
  const map = new Map<string, Deletion>();
  for (const item of [...a, ...b]) {
    const previous = map.get(item.id);
    if (!previous) {
      map.set(item.id, item);
      continue;
    }
    const winner = item.at > previous.at ? item : previous;
    const loser = winner === item ? previous : item;
    map.set(item.id, keepUnknown({ ...winner }, loser, DELETION_KEYS));
  }
  return [...map.values()];
}

export function mergeDeletions(a: Deletions | undefined, b: Deletions | undefined): Deletions {
  const left = a ?? emptyDeletions();
  const right = b ?? emptyDeletions();
  const merged: Deletions = {
    goals: mergeDeletionList(left.goals, right.goals),
    plans: mergeDeletionList(left.plans, right.plans),
    presets: mergeDeletionList(left.presets, right.presets),
    sessions: mergeDeletionList(left.sessions, right.sessions),
  };
  keepUnknown(merged, left, DELETIONS_KEYS);
  keepUnknown(merged, right, DELETIONS_KEYS);
  return merged;
}

function documentStamp(data: TrainingData): string {
  const stamps = [...data.goals, ...data.plans, ...data.presets, ...data.sessions].map((item) => stampOf(item));
  for (const list of [data.deleted.goals, data.deleted.plans, data.deleted.presets, data.deleted.sessions]) {
    for (const item of list) stamps.push(item.at);
  }
  return stamps.reduce((max, stamp) => (stamp > max ? stamp : max), '');
}

/** Union both copies, then let the later edit win. Unknown fields missing on the winner are filled from the other copy. */
export function mergeTraining(a: TrainingData, b: TrainingData): TrainingData {
  const primary = documentStamp(a) >= documentStamp(b) ? a : b;
  const secondary = primary === a ? b : a;
  const merged = {
    version: 1 as const,
    goals: mergeEntities(a.goals, b.goals, absorbGoal),
    plans: mergeEntities(a.plans, b.plans, absorbPlan),
    presets: mergeEntities(a.presets, b.presets, absorbPreset),
    sessions: mergeEntities(a.sessions, b.sessions, absorbSession),
    deleted: mergeDeletions(primary.deleted, secondary.deleted),
  };
  keepUnknown(merged, primary, ROOT_KEYS);
  keepUnknown(merged, secondary, ROOT_KEYS);
  return normalize(merged);
}
